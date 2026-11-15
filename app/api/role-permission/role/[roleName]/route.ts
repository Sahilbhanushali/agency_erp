import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { MODULES, allPermissions, permissionName } from "@/lib/permissions/catalog"
import { ensurePermissionIds } from "@/lib/permissions/store"
import { clientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/** The matrix the editor saves: module key -> the actions that should be granted. */
const matrixSchema = z.object({
  matrix: z.record(z.string(), z.array(z.string()).max(32)),
})

/**
 * A role's permissions.
 *
 * Two shapes, because two kinds of caller need different things:
 *   - default: the historical `[{ permission: "Manage-post" }, ...]` array. Eight
 *     dashboard pages read this to decide which buttons to show, and breaking that
 *     shape broke all of them at once.
 *   - `?view=matrix`: every module and action in the catalog with a granted flag, for
 *     the permission editor.
 *
 * Keeping the legacy shape as the default means the migration never needed a
 * co-ordinated front-end change.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ roleName: string }> }) {
  const auth = await requireCan("roles", "read")
  if (!auth.ok) return auth.response

  try {
    const { roleName } = await context.params
    const role = await prisma.role.findUnique({
      where: { name: decodeURIComponent(roleName) },
      select: {
        id: true,
        name: true,
        permissions: { select: { permission: { select: { name: true } } } },
      },
    })
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })

    const held = new Set(role.permissions.map((rp) => rp.permission.name))

    if (request.nextUrl.searchParams.get("view") !== "matrix") {
      // Legacy shape. Includes canonical module:action names alongside the old flat
      // ones so a page checking either style keeps working.
      return NextResponse.json(
        Array.from(held).map((permission) => ({ permission })),
      )
    }

    const modules = MODULES.map((m) => ({
      key: m.key,
      label: m.label,
      group: m.group,
      href: m.href ?? null,
      actions: m.actions.map((a) => ({
        action: a.action,
        label: a.label,
        granted: held.has(permissionName(m.key, a.action)),
        /** True when only a pre-migration name grants this, so the UI can say so. */
        viaLegacy:
          !held.has(permissionName(m.key, a.action)) && a.legacy.some((l) => held.has(l)),
      })),
    }))

    /**
     * The counts the editor shows.
     *
     * `heldTotal` is every row granted to this role; `available` is what the catalog
     * defines. They differ for ADMIN because the sync grants it the legacy flat names
     * too — aliases kept so pre-migration code keeps working. Those are not editable
     * and no other role gets them, which is why ADMIN reads 149 while a fully granted
     * custom role reads 108. Reporting the breakdown is the difference between that
     * looking like a bug and looking like what it is.
     */
    const catalogNames = new Set(allPermissions().map((p) => p.name))
    const legacyGranted = [...held].filter((name) => !catalogNames.has(name)).length

    return NextResponse.json({
      role: { id: role.id, name: role.name },
      modules,
      totals: {
        available: catalogNames.size,
        granted: [...held].filter((name) => catalogNames.has(name)).length,
        legacyGranted,
        heldTotal: held.size,
      },
    })
  } catch (error) {
    console.error("[role-permission] read failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/**
 * Replace a role's permissions with the submitted matrix.
 *
 * The client's values are never trusted: every module/action pair is resolved against
 * the catalog and anything unrecognised is rejected, so a crafted request cannot invent
 * a permission. The write is one transaction — a partially saved matrix would be a role
 * with holes in it.
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ roleName: string }> }) {
  const auth = await requireCan("roles", "update")
  if (!auth.ok) return auth.response

  try {
    const { roleName } = await context.params
    const decoded = decodeURIComponent(roleName)

    const parsed = matrixSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const role = await prisma.role.findUnique({
      where: { name: decoded },
      select: {
        id: true,
        name: true,
        permissions: { select: { permission: { select: { id: true, name: true } } } },
      },
    })
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })

    // Locking every administrator out of this screen is not a recoverable mistake.
    if (role.name === "ADMIN") {
      return NextResponse.json(
        { error: "ADMIN holds every permission by design and cannot be edited." },
        { status: 409 },
      )
    }

    // Resolve the submitted matrix against the catalog. Unknown pairs are refused
    // outright rather than ignored, so a caller learns their request was wrong.
    const wanted = new Set<string>()
    const unknown: string[] = []
    for (const [moduleKey, actions] of Object.entries(parsed.data.matrix)) {
      const mod = MODULES.find((m) => m.key === moduleKey)
      if (!mod) {
        unknown.push(moduleKey)
        continue
      }
      for (const action of actions) {
        if (!mod.actions.some((a) => a.action === action)) {
          unknown.push(`${moduleKey}:${action}`)
          continue
        }
        wanted.add(permissionName(moduleKey, action))
      }
    }
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `Unknown permissions: ${unknown.slice(0, 5).join(", ")}` },
        { status: 422 },
      )
    }

    // Disabling a module's read must deny the whole module, so drop its other actions
    // rather than leaving a role that can create what it cannot see.
    for (const mod of MODULES) {
      const hasRead = mod.actions.some((a) => a.action === "read")
      if (!hasRead) continue
      if (wanted.has(permissionName(mod.key, "read"))) continue
      for (const a of mod.actions) wanted.delete(permissionName(mod.key, a.action))
    }

    /**
     * Resolve every name to a row id, creating any the `permissions` table is missing.
     *
     * This used to be a plain lookup whose misses were filtered out, which meant a
     * database holding fewer permissions than the catalog — anything seeded before the
     * catalog grew, which is the normal state of a server that has not re-run the seed
     * — silently discarded most of the matrix and still answered "Permissions updated".
     */
    const canonicalNames = allPermissions().map((p) => p.name)
    const { idByName, created } = await ensurePermissionIds(canonicalNames)
    const canonicalIds = new Set(idByName.values())

    const before = role.permissions.map((rp) => rp.permission.name).sort()

    // Resolved before the transaction so the count reported back is the count written.
    const grantIds = Array.from(wanted).flatMap((name) => {
      const id = idByName.get(name)
      if (id === undefined) {
        console.error(`[role-permission] cannot grant "${name}" — no permission row for it`)
        return []
      }
      return [id]
    })

    if (grantIds.length !== wanted.size) {
      // Saying 200 while dropping grants is what made this look like a UI bug for so
      // long. Fail loudly instead: nothing is written and the role is left as it was.
      return NextResponse.json(
        {
          error:
            "Could not save every permission — the permission catalog and the database " +
            "are out of step. Run the seed on this database and try again.",
        },
        { status: 500 },
      )
    }

    await prisma.$transaction(async (tx) => {
      // Only canonical grants are rewritten. Legacy grants are left alone so a role
      // keeps working if some route has not been migrated yet.
      await tx.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { in: Array.from(canonicalIds) } },
      })
      if (grantIds.length > 0) {
        await tx.rolePermission.createMany({
          data: grantIds.map((permissionId) => ({ roleId: role.id, permissionId })),
          skipDuplicates: true,
        })
      }
    })

    // Confirm from the database rather than from intent. A grant that did not land
    // must not be reported as saved.
    const saved = await prisma.rolePermission.count({
      where: { roleId: role.id, permissionId: { in: Array.from(canonicalIds) } },
    })

    await logAuditAction({
      userId: String(auth.userId),
      action: "PERMISSIONS_UPDATED",
      entityType: "Role",
      entityId: String(role.id),
      oldValues: JSON.stringify({ role: role.name, count: before.length }),
      newValues: JSON.stringify({ role: role.name, granted: Array.from(wanted).sort() }),
      ipAddress: clientIp(request.headers) || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({
      message: `${saved} permission${saved === 1 ? "" : "s"} saved for ${role.name}`,
      granted: saved,
      // Surfaced so a drifted database is visible in the response, not only the logs.
      ...(created.length > 0 ? { createdPermissions: created.length } : {}),
    })
  } catch (error) {
    console.error("[role-permission] update failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
