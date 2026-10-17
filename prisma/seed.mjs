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

const prisma = new PrismaClient()

const ADMIN_EMAIL = "admin@gmail.com"
const ADMIN_PASSWORD = "admin@123"
const ADMIN_NAME = "System Admin"

/** Every permission the app checks for. ADMIN is granted all of them. */
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
  ["View-tasks", "View tasks assigned to you and your team"],
  ["Manage-tasks", "Create, edit, assign and delete tasks"],
  ["View-reports", "View reports and analytics"],
  ["View-utilities", "View utility lists"],
  ["Manage-credentials", "Create, edit and remove stored credentials"],
  ["View-credentials", "View stored credentials and reveal their passwords"],
  ["Manage-companies", "Create, edit and remove billing companies"],
  ["View-companies", "View billing companies and their details"],
  ["Manage-quotations", "Create, edit, send and delete quotations"],
  ["View-quotations", "View quotations and their totals"],
  ["Manage-invoices", "Create, edit, send and delete invoices, and record payments"],
  ["View-invoices", "View invoices, payments and balances"],
  ["View-hrms", "View HRMS dashboards, job pipeline, and candidates"],
  ["Manage-hrms", "Create and manage job openings, candidates, and recruitment"],
  ["Manage-offers", "Create, approve, and send offer letters"],
  ["Manage-onboarding", "Manage onboarding workflows and employee conversions"],
  ["View-attendance", "View company attendance logs and rosters"],
  ["Manage-attendance", "Manual punch correction and attendance sync"],
  ["Approve-attendance", "Review and approve attendance regularizations"],
  ["View-leaves", "View employee leave requests and balances"],
  ["Manage-leaves", "Apply or adjust employee leave balances and policies"],
  ["Approve-leaves", "Review, approve, or reject employee leave requests"],
  ["View-payroll", "View payroll runs, registers, and summaries"],
  ["Manage-payroll", "Create, calculate, and recalculate payroll runs"],
  ["Approve-payroll", "Approve, lock, and publish payroll runs"],
  ["View-salary", "View employee salary structures and revisions"],
  ["Manage-salary", "Create and edit employee compensation structures"],
  ["Manage-loans", "Disburse, schedule, and pause employee loans and advances"],
  ["Manage-fnf", "Calculate and approve Full and Final settlements for offboarding"],
]

async function main() {
  // 1. Permission catalog — upserted by name, so re-running adds new ones without
  //    disturbing the grants already in place.
  for (const [name, description] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    })
  }
  const permissions = await prisma.permission.findMany({ select: { id: true } })

  // 2. ADMIN role, holding every permission.
  const admin = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: { description: "Full access to every module" },
    create: { name: "ADMIN", description: "Full access to every module" },
  })

  // Re-grant from scratch so a permission added above is picked up, and one removed
  // from the catalog does not linger as a stale grant.
  await prisma.rolePermission.deleteMany({ where: { roleId: admin.id } })
  await prisma.rolePermission.createMany({
    data: permissions.map(({ id }) => ({ roleId: admin.id, permissionId: id })),
  })

  // 3. The one admin account. The password is only ever written as a bcrypt hash.
  const password = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { roleId: admin.id, password },
    create: { email: ADMIN_EMAIL, name: ADMIN_NAME, roleId: admin.id, password },
  })

  console.log(`✓ ${PERMISSIONS.length} permissions, ADMIN role, admin user #${user.id}`)
  console.log(`  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} — change this password at first sign-in`)
}

main()
  .catch((error) => {
    console.error("Seed failed:", error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

  