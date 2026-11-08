/**
 * DEV / TEST seed: sample clients, projects, strategies and posts, plus test accounts
 * for every role a dashboard bug report usually involves.
 *
 * Built to reproduce "the Manager's Content Pipeline shows 0 while ADMIN's is right":
 *
 *   manager@seed.test      role "Manager"            every catalog permission, as granted
 *                                                     by ticking everything in the matrix
 *   manager-nc@seed.test   role "Manager (no create)" everything except posts:create
 *   designer@seed.test     role "Designer"           posts read/update, assigned 6 posts
 *   admin@gmail.com        ADMIN (from prisma/seed.mjs)
 *
 * All seed accounts use the password  test@1234
 *
 *   npm run db:seed          first — permission catalog, ADMIN role, admin account
 *   npm run db:seed:dev      then this; safe to re-run (replaces its own sample data)
 *
 * Refuses to run against anything but a local database: it creates accounts with a
 * known password and must never reach a real server.
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const url = process.env.DATABASE_URL ?? ""
const host = (() => {
  try {
    return new URL(url).hostname
  } catch {
    return ""
  }
})()
if (!["localhost", "127.0.0.1", "::1"].includes(host) || process.env.NODE_ENV === "production") {
  console.error(`Refusing to seed test data: DATABASE_URL host is "${host || "unset"}", not localhost.`)
  process.exit(1)
}

const prisma = new PrismaClient()

const PASSWORD = "test@1234"
const TAG = "[SEED]" // prefixes every project name so a re-run can find and replace them
const CLIENT_DOMAIN = "@client.seed.test"

async function main() {
  const canonical = await prisma.permission.findMany({
    where: { module: { not: null } },
    select: { id: true, name: true },
  })
  if (canonical.length === 0 || !(await prisma.role.findUnique({ where: { name: "ADMIN" } }))) {
    throw new Error("Run `npm run db:seed` first — the permission catalog and ADMIN role are missing.")
  }

  // ── Roles ──────────────────────────────────────────────────────────────────────
  const grant = async (name, description, permissionIds) => {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    })
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    })
    return role
  }
  const ids = (pred) => canonical.filter((p) => pred(p.name)).map((p) => p.id)

  const manager = await grant("Manager", "Seed: every catalog permission", ids(() => true))
  const managerNc = await grant(
    "Manager (no create)",
    "Seed: everything except posts:create",
    ids((n) => n !== "posts:create"),
  )
  const designer = await grant(
    "Designer",
    "Seed: read and update posts",
    ids((n) => ["posts:read", "posts:update", "projects:read"].includes(n)),
  )

  // ── Accounts (upserted; users are never deleted) ─────────────────────────────────
  const password = await bcrypt.hash(PASSWORD, 10)
  const account = (email, name, roleId) =>
    prisma.user.upsert({
      where: { email },
      update: { roleId, isActive: true, password },
      create: { email, name, roleId, password },
    })
  const mgr = await account("manager@seed.test", "Seed Manager", manager.id)
  const mgrNc = await account("manager-nc@seed.test", "Seed Manager (no create)", managerNc.id)
  const des = await account("designer@seed.test", "Seed Designer", designer.id)
  const admin = await prisma.user.findUnique({ where: { email: "admin@gmail.com" }, select: { id: true } })

  // ── Replace previous sample data ───────────────────────────────────────────────
  const oldProjects = await prisma.project.findMany({
    where: { name: { startsWith: TAG } },
    select: { id: true },
  })
  const oldIds = oldProjects.map((p) => p.id)
  try {
    await prisma.$transaction([
      prisma.post.deleteMany({ where: { projectId: { in: oldIds } } }),
      prisma.projectStrategy.deleteMany({ where: { projectId: { in: oldIds } } }),
      prisma.project.deleteMany({ where: { id: { in: oldIds } } }),
      prisma.client.deleteMany({ where: { email: { endsWith: CLIENT_DOMAIN } } }),
    ])
  } catch (error) {
    throw new Error(
      "Could not clear the previous seed data — something created in the app (a comment, " +
        "approval or asset) still points at a seed post. Delete it or run `npm run db:fresh`.\n" +
        error.message,
    )
  }

  // ── Clients, projects, strategies, posts ─────────────────────────────────────────
  const now = new Date()
  const months = [0, -1].map((offset) => new Date(now.getFullYear(), now.getMonth() + offset, 1))

  const clients = await Promise.all(
    ["Acme Foods", "Bloom Studio"].map((name) =>
      prisma.client.create({
        data: { name, email: `${name.split(" ")[0].toLowerCase()}${CLIENT_DOMAIN}`, company: name },
      }),
    ),
  )

  const projects = []
  for (const [i, client] of clients.entries()) {
    projects.push(
      await prisma.project.create({
        data: {
          name: `${TAG} ${client.name} — Monthly Social`,
          startDate: months[1],
          clientId: client.id,
          managerId: mgr.id,
          // The designer is attached to the first project only; neither manager is
          // attached to anything, so an "own"-scoped manager sees nothing.
          ...(i === 0 ? { assignedUsers: { connect: [{ id: des.id }] } } : {}),
        },
      }),
    )
  }
  // An inactive project: its posts must not count for anyone.
  const inactive = await prisma.project.create({
    data: { name: `${TAG} Archived Campaign`, startDate: months[1], isActive: false, clientId: clients[0].id },
  })

  for (const project of projects) {
    for (const m of months) {
      await prisma.projectStrategy.create({
        data: {
          projectId: project.id,
          month: m.getMonth() + 1,
          year: m.getFullYear(),
          total: 12,
          postTypes: { PHOTO: 5, REEL: 4, CAROUSEL: 2, STORY: 1 },
        },
      })
    }
  }

  // Every pipeline stage the dashboard counts, so each card has a known non-zero value.
  const STAGES = [
    { contentStatus: "DRAFT", status: "DRAFT" },
    { contentStatus: "SUBMITTED", status: "DRAFT" },
    { contentStatus: "PENDING_REVIEW", status: "DRAFT" },
    { contentStatus: "REJECTED", status: "DRAFT" },
    { contentStatus: "RESUBMITTED", status: "DRAFT" },
    { contentStatus: "APPROVED", status: "DRAFT" },
    { contentStatus: "APPROVED", status: "SUBMITTED" },
    { contentStatus: "APPROVED", status: "REJECTED" },
    { contentStatus: "APPROVED", status: "APPROVED" },
    { contentStatus: "APPROVED", status: "SCHEDULED" },
    { contentStatus: "APPROVED", status: "POSTED" },
  ]
  const TYPES = ["PHOTO", "REEL", "CAROUSEL", "STORY"]

  let created = 0
  for (const [pi, project] of projects.entries()) {
    for (const [mi, m] of months.entries()) {
      for (const [si, stage] of STAGES.entries()) {
        const day = new Date(m.getFullYear(), m.getMonth(), 3 + si * 2, 12)
        const assignToDesigner = pi === 0 && mi === 0 && si >= 5 // 6 posts this month
        await prisma.post.create({
          data: {
            title: `${project.name.replace(TAG, "").trim()} · ${stage.contentStatus}/${stage.status}`,
            type: TYPES[si % TYPES.length],
            ...stage,
            projectId: project.id,
            createdById: admin?.id ?? mgr.id,
            createdAt: day,
            scheduledAt: ["SCHEDULED", "POSTED"].includes(stage.status) ? day : null,
            postedAt: stage.status === "POSTED" ? day : null,
            ...(assignToDesigner
              ? { assignedToId: des.id, assignedUsers: { connect: [{ id: des.id }] } }
              : {}),
          },
        })
        created++
      }
    }
  }
  await prisma.post.create({
    data: { title: "Archived — must never be counted", type: "PHOTO", projectId: inactive.id, contentStatus: "APPROVED", status: "POSTED" },
  })

  const perMonth = projects.length * STAGES.length
  console.log(`✓ roles: Manager (${canonical.length} perms), Manager (no create) (${canonical.length - 1}), Designer`)
  console.log(`✓ ${clients.length} clients, ${projects.length} active projects + 1 inactive, ${created + 1} posts`)
  console.log("")
  console.log(`Expected Content Pipeline for the current month (${perMonth} posts, strategy total 24):`)
  console.log(`  ADMIN, manager@seed.test           written 20 · approved 12 · pending 4 · changes 2 · resubmitted 2`)
  console.log(`  manager-nc@seed.test               all zeros — no posts:create, so scoped to own work (none)`)
  console.log(`  designer@seed.test                 written 6 · approved 6 (its 6 assigned posts)`)
  console.log("")
  console.log(`Accounts: manager@seed.test, manager-nc@seed.test, designer@seed.test — password ${PASSWORD}`)
}

main()
  .catch((error) => {
    console.error("Dev seed failed:", error.message ?? error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
