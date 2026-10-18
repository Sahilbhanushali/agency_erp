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
/**
 * Reading the catalog needs TypeScript, which is a devDependency — so this step fails on
 * a server installed with `npm ci --omit=dev`. That is not a theoretical problem: a
 * production database then never receives the permission rows, and saving a role's
 * permissions silently drops every grant it has no row for.
 *
 * Say so clearly rather than dying on a confusing "tsc: not found", and name the
 * alternative, which runs inside the app where the catalog is already compiled.
 */
let allPermissions
try {
  const out = mkdtempSync(join(tmpdir(), "permcat-"))
  execSync(
    `npx tsc lib/permissions/catalog.ts --outDir ${out} --module commonjs --target es2022 --skipLibCheck`,
    { stdio: "pipe" },
  )
  ;({ allPermissions } = await import(join(out, "catalog.js")))
} catch (error) {
  console.error("Seed failed: could not read lib/permissions/catalog.ts.")
  console.error("TypeScript is a devDependency, so this does not work after `npm ci --omit=dev`.")
  console.error("Either install dev dependencies (`npm ci`) and re-run, or sync the catalog")
  console.error("through the running app instead:")
  console.error("")
  console.error('  curl -X POST -b "<admin session cookie>" https://<host>/api/permissions/sync')
  console.error("")
  console.error("or press “Sync catalog” on Users → Roles & Permissions.")
  console.error(`(${error.message.split("\n")[0]})`)
  process.exit(1)
}

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

  /**
   * 3. The one admin account. The password is only ever written as a bcrypt hash, and
   *    only on first creation: re-running this to pick up new permissions must not
   *    quietly reset a password that has since been changed on a live server.
   */
  const password = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { roleId: admin.id },
    create: { email: ADMIN_EMAIL, name: ADMIN_NAME, roleId: admin.id, password },
  })
  const freshAccount = user.password === password

  console.log(`✓ ${CANONICAL.length} module permissions + ${LEGACY.length} legacy, ADMIN role, admin user #${user.id}`)
  if (freshAccount) {
    console.log(`  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} — change this password at first sign-in`)
  } else {
    console.log(`  ${ADMIN_EMAIL} already existed — its password was left alone`)
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

  