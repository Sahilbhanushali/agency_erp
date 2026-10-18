/**
 * Migrate flat permissions to module + action, preserving every role's exact capability.
 *
 *   node prisma/migrate-permissions.mjs            # report what would change
 *   node prisma/migrate-permissions.mjs --apply    # write it
 *
 * What it does:
 *   1. Creates the canonical `module:action` permission rows from the catalog.
 *   2. Backfills module/action/label on legacy rows it can classify.
 *   3. For each role, grants the canonical action wherever the role already holds a
 *      legacy name that implied it.
 *
 * What it deliberately does NOT do: remove legacy rows or legacy grants. Both keep
 * working, so this is additive and re-runnable, and a half-migrated deployment is still
 * a correct one.
 *
 * On privilege: `Manage-X` already authorises POST, PATCH and DELETE in the existing
 * route handlers, so it expands to create+update+delete. That mirrors current
 * capability rather than widening it — the least-privilege guidance applies to defaults
 * for new roles, and silently revoking delete from roles that have it today would be a
 * regression, not a hardening.
 */
import { PrismaClient } from "@prisma/client"
import { execSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

// The catalog is TypeScript; compile it once so there is a single source of truth
// rather than a duplicated list in this script.
const out = mkdtempSync(join(tmpdir(), "permcat-"))
execSync(
  `npx tsc lib/permissions/catalog.ts --outDir ${out} --module commonjs --target es2022 --skipLibCheck`,
  { stdio: "pipe" },
)
const { MODULES, allPermissions, permissionName } = await import(join(out, "catalog.js"))

async function main() {
  const canonical = allPermissions()
  console.log(`Catalog: ${MODULES.length} modules, ${canonical.length} canonical permissions`)
  console.log(APPLY ? "Mode: APPLY\n" : "Mode: DRY RUN (pass --apply to write)\n")

  const existing = await prisma.permission.findMany({ select: { id: true, name: true } })
  const byName = new Map(existing.map((p) => [p.name, p.id]))

  // 1. Canonical permission rows
  let created = 0
  for (const perm of canonical) {
    if (byName.has(perm.name)) continue
    created++
    if (APPLY) {
      const row = await prisma.permission.create({
        data: {
          name: perm.name,
          description: perm.description,
          module: perm.module,
          action: perm.action,
          label: perm.label,
        },
        select: { id: true, name: true },
      })
      byName.set(row.name, row.id)
    }
  }
  console.log(`1. Canonical permission rows to create: ${created}`)

  // 2. Backfill module/action on legacy rows, so the matrix can show where they came from
  const legacyToModule = new Map()
  for (const m of MODULES) {
    for (const a of m.actions) {
      for (const name of a.legacy) {
        if (!legacyToModule.has(name)) legacyToModule.set(name, { module: m.key, action: a.action })
      }
    }
  }
  let backfilled = 0
  for (const row of existing) {
    const hit = legacyToModule.get(row.name)
    if (!hit) continue
    backfilled++
    if (APPLY) {
      await prisma.permission.update({
        where: { id: row.id },
        // module/action stay NULL on legacy rows: the unique constraint is reserved for
        // canonical ones. Only the human label is backfilled.
        data: { label: `Legacy — ${hit.module}:${hit.action}` },
      })
    }
  }
  console.log(`2. Legacy rows annotated: ${backfilled}`)

  // 3. Expand each role's grants
  const roles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
      permissions: { select: { permission: { select: { name: true } } } },
    },
  })

  let grantsAdded = 0
  for (const role of roles) {
    const held = new Set(role.permissions.map((rp) => rp.permission.name))
    const toAdd = []

    for (const m of MODULES) {
      for (const a of m.actions) {
        const canonicalName = permissionName(m.key, a.action)
        if (held.has(canonicalName)) continue
        // Baseline actions were ungated before, so every existing role keeps them.
        // Otherwise: granted only if the role already holds a legacy name implying it.
        const implied = a.baseline || a.legacy.some((l) => held.has(l))
        if (!implied) continue
        toAdd.push(canonicalName)
      }
    }

    if (toAdd.length === 0) {
      console.log(`   ${role.name.padEnd(22)} ${held.size} held -> no change`)
      continue
    }
    grantsAdded += toAdd.length
    console.log(`   ${role.name.padEnd(22)} ${held.size} held -> +${toAdd.length} action grants`)

    if (APPLY) {
      const ids = toAdd.map((n) => byName.get(n)).filter(Boolean)
      // One transaction per role: a half-expanded role would be a role with holes in it.
      await prisma.$transaction(
        ids.map((permissionId) =>
          prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId } },
            update: {},
            create: { roleId: role.id, permissionId },
          }),
        ),
      )
    }
  }
  console.log(`3. Action grants to add: ${grantsAdded}`)

  if (APPLY) {
    console.log(
      `\nDone. permissions=${await prisma.permission.count()} role_permissions=${await prisma.rolePermission.count()}`,
    )
  } else {
    console.log("\nNothing written. Re-run with --apply.")
  }
}

main()
  .catch((e) => {
    console.error("Migration failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
