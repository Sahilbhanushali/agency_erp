import { prisma } from "@/lib/prisma"
import { allPermissions } from "@/lib/permissions/catalog"

/**
 * Brings the `permissions` table in step with the catalog, and re-grants ADMIN.
 *
 * `prisma/seed.mjs` does the same thing, but it reads the catalog by shelling out to
 * `npx tsc` — and `typescript` is a devDependency, so the seed cannot run on a server
 * installed with `npm ci --omit=dev`. That is how a production database ends up holding
 * fewer permissions than the code knows about, which silently broke saving a role's
 * permissions.
 *
 * Running inside the app avoids the problem entirely: the catalog is already compiled
 * here. Safe to run repeatedly — rows are matched by name, and no existing grant on any
 * role other than ADMIN is touched.
 */
export async function syncPermissionCatalog() {
  const canonical = allPermissions()
  const legacy = Array.from(new Set(canonical.flatMap((p) => p.legacy))).sort()

  const existing = await prisma.permission.findMany({ select: { name: true } })
  const have = new Set(existing.map((p) => p.name))

  const missingCanonical = canonical.filter((p) => !have.has(p.name))
  const missingLegacy = legacy.filter((name) => !have.has(name))

  if (missingCanonical.length > 0) {
    await prisma.permission.createMany({
      data: missingCanonical.map((p) => ({
        name: p.name,
        description: p.description,
        module: p.module,
        action: p.action,
        label: p.label,
      })),
      skipDuplicates: true,
    })
  }
  if (missingLegacy.length > 0) {
    await prisma.permission.createMany({
      data: missingLegacy.map((name) => ({
        name,
        description: `Legacy permission (${name})`,
      })),
      skipDuplicates: true,
    })
  }

  // Keep the module/action/label columns correct on rows that predate them, so the
  // matrix can group them. Only metadata — never a grant.
  for (const p of canonical) {
    await prisma.permission.updateMany({
      where: { name: p.name, OR: [{ module: null }, { action: null }, { label: null }] },
      data: { module: p.module, action: p.action, label: p.label },
    })
  }

  /**
   * ADMIN holds every permission explicitly. The superuser shortcut in lib/api-auth.ts
   * is only a lockout guard, so without this ADMIN's authority would not be visible in
   * the data — and it would lose grants for any permission added after it was seeded.
   */
  const admin = await prisma.role.findUnique({ where: { name: "ADMIN" }, select: { id: true } })
  let adminGrants = 0
  if (admin) {
    const all = await prisma.permission.findMany({ select: { id: true } })
    const held = await prisma.rolePermission.findMany({
      where: { roleId: admin.id },
      select: { permissionId: true },
    })
    const heldIds = new Set(held.map((r) => r.permissionId))
    const toAdd = all.filter((p) => !heldIds.has(p.id))
    if (toAdd.length > 0) {
      await prisma.rolePermission.createMany({
        data: toAdd.map((p) => ({ roleId: admin.id, permissionId: p.id })),
        skipDuplicates: true,
      })
    }
    adminGrants = all.length
  }

  return {
    createdCanonical: missingCanonical.length,
    createdLegacy: missingLegacy.length,
    totalPermissions: await prisma.permission.count(),
    adminGrants,
  }
}

/** Whether the database is behind the catalog, for showing a warning without fixing it. */
export async function permissionCatalogStatus() {
  const canonical = allPermissions()
  const names = canonical.map((p) => p.name)
  const present = await prisma.permission.count({ where: { name: { in: names } } })
  return {
    expected: canonical.length,
    present,
    inSync: present === canonical.length,
  }
}
