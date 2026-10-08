/**
 * Seeds the permission catalog, an ADMIN role holding every permission, and the
 * first admin user. Safe to re-run: everything upserts, so it tops up missing
 * permissions and re-grants them without duplicating rows.
 *
 *   npm run db:seed
 *
 * Plain .mjs on purpose — no TypeScript runner is installed, so this needs no
 * extra dependency to run.
 */
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const ADMIN_EMAIL = "admin@gmail.com"
const ADMIN_PASSWORD = "admin123"
const ADMIN_ROLE = "ADMIN"

/**
 * Every permission name the application actually checks for. Keep this in sync
 * with the code: `grep -rhoE '"(Manage|View)-[A-Za-z-]+"' app components lib`.
 * The odd spellings (View-calender, View-post vs View-posts) match what the code
 * checks — renaming them here would silently disable those checks.
 */
const PERMISSIONS = [
  ["Manage-User", "Create, edit and remove users and their roles"],
  ["Manage-settings", "Change application settings, roles and permissions"],
  ["Manage-clients", "Create, edit and remove clients"],
  ["View-clients", "View the client list and client details"],
  ["Manage-projects", "Create, edit and remove projects"],
  ["View-project", "View a project and its details"],
  ["Manage-post", "Create, edit and remove posts"],
  ["View-post", "View an individual post"],
  ["View-posts", "View the post list"],
  ["Manage-content", "Write and edit post content and captions"],
  ["Manage-design", "Upload and manage design work on posts"],
  ["Manage-approvals", "Approve or reject submitted work"],
  ["Manage-assets", "Upload, replace and delete assets"],
  ["View-assets", "View and download assets"],
  ["Manage-festival", "Create and edit festivals"],
  ["View-festivals", "View the festival calendar"],
  ["View-calender", "View the content calendar"],
  ["View-tasks", "View assigned tasks"],
  ["View-reports", "View reports and analytics"],
  ["View-utilities", "View utility lists"],
  ["Manage-companies", "Create, edit and remove billing companies"],
  ["View-companies", "View billing companies and their details"],
  ["Manage-quotations", "Create, edit, send and delete quotations"],
  ["View-quotations", "View quotations and their totals"],
  ["Manage-invoices", "Create, edit, send and delete invoices, and record payments"],
  ["View-invoices", "View invoices, payments and balances"],
]

async function main() {
  // 1. Permission catalog
  for (const [name, description] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    })
  }
  const permissions = await prisma.permission.findMany({ select: { id: true } })

  // 2. ADMIN role
  const role = await prisma.role.upsert({
    where: { name: ADMIN_ROLE },
    update: { description: "Full access to every part of the application" },
    create: { name: ADMIN_ROLE, description: "Full access to every part of the application" },
  })

  // 3. Grant the role every permission (skipDuplicates keeps re-runs cheap)
  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    skipDuplicates: true,
  })

  // 4. Admin user
  const password = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { roleId: role.id, password },
    create: { email: ADMIN_EMAIL, name: "Admin", roleId: role.id, password },
  })

  const granted = await prisma.rolePermission.count({ where: { roleId: role.id } })
  console.log(`✓ ${PERMISSIONS.length} permissions in the catalog`)
  console.log(`✓ role ${role.name} (id ${role.id}) holds ${granted} permissions`)
  console.log(`✓ admin user ${admin.email} (id ${admin.id}) — password: ${ADMIN_PASSWORD}`)
  console.log("\nChange that password after the first sign-in.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
