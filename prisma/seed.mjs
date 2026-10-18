/**
 * Production seed: the permission catalog, the ADMIN role, and one admin account.
 *
 * Nothing else. No clients, projects, posts or sample data — a live install starts
 * empty and real data is entered through the app.
 *
 *   npm run db:seed     seed on top of whatever is already there (idempotent)
 *   npm run db:fresh    DROP EVERYTHING, recreate the schema, then seed
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { execSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const prisma = new PrismaClient()

const ADMIN_EMAIL = "admin@gmail.com"
const ADMIN_PASSWORD = "admin@123"
const ADMIN_NAME = "System Admin"

/**
 * Permissions come from lib/permissions/catalog.ts so there is one source of truth for
 * what can be granted. The legacy flat names (View-X / Manage-X) are seeded too, because
 * routes that have not been migrated to `requireCan` still check them.
 */
const out = mkdtempSync(join(tmpdir(), "permcat-"))
execSync(
  `npx tsc lib/permissions/catalog.ts --outDir ${out} --module commonjs --target es2022 --skipLibCheck`,
  { stdio: "pipe" },
)
const { allPermissions } = await import(join(out, "catalog.js"))

const CANONICAL = allPermissions()
const LEGACY = Array.from(new Set(CANONICAL.flatMap((p) => p.legacy))).sort()

async function main() {
  // 1. Permission catalog — canonical module:action rows, plus the legacy names that
  //    unmigrated routes still check. Upserted by name, so re-running adds new
  //    permissions without disturbing existing grants.
  for (const perm of CANONICAL) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description, module: perm.module, action: perm.action, label: perm.label },
      create: {
        name: perm.name,
        description: perm.description,
        module: perm.module,
        action: perm.action,
        label: perm.label,
      },
    })
  }
  for (const name of LEGACY) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name, description: `Legacy permission (${name})` },
    })
  }
  const permissions = await prisma.permission.findMany({ select: { id: true } })

  // 2. ADMIN holds every permission explicitly. The superuser shortcut in
  //    lib/api-auth.ts is only a lockout guard — authorization itself is data-driven,
  //    so ADMIN's authority must be visible in the database like any other role.
  const admin = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: { description: "Full access to every module" },
    create: { name: "ADMIN", description: "Full access to every module" },
  })

  await prisma.rolePermission.deleteMany({ where: { roleId: admin.id } })
  await prisma.rolePermission.createMany({
    data: permissions.map(({ id }) => ({ roleId: admin.id, permissionId: id })),
    skipDuplicates: true,
  })

  // 3. The one admin account. The password is only ever written as a bcrypt hash.
  const password = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { roleId: admin.id, password },
    create: { email: ADMIN_EMAIL, name: ADMIN_NAME, roleId: admin.id, password },
  })

  console.log(`✓ ${CANONICAL.length} module permissions + ${LEGACY.length} legacy, ADMIN role, admin user #${user.id}`)
  console.log(`  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} — change this password at first sign-in`)
}

main()
  .catch((error) => {
    console.error("Seed failed:", error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

  