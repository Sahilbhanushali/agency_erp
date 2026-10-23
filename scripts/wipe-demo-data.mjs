#!/usr/bin/env node
/**
 * Removes demo/sample business data from a database, keeping the configuration and the
 * administrator accounts.
 *
 *   node scripts/wipe-demo-data.mjs                     # dry run: shows what would go
 *   node scripts/wipe-demo-data.mjs --confirm           # does it
 *   node scripts/wipe-demo-data.mjs --keep=a@x.com,b@y.com --confirm
 *   node scripts/wipe-demo-data.mjs --only=hr           # HR only: see below
 *
 * The dry run is real: it performs every delete inside a transaction and then rolls it
 * back, so "it would succeed" is proven, not assumed. --confirm commits the same
 * transaction. Either everything goes or nothing does.
 *
 * DELETED  clients, projects, posts and everything under them, leads, quotations,
 *          invoices, payments, contracts, expenses, festivals, shoot events, credentials,
 *          tasks, daily todos, notifications, payroll runs and payslips, and all HRMS
 *          records (jobs, candidates, interviews, offers, letterheads, offer templates),
 *          attendance (punches, regularizations, sync logs) and leave requests, balances
 *          and ledger. Balances are recreated from the leave types on next view.
 * KEPT     roles, permissions, settings, companies, utilities, leave types, salary and
 *          payslip templates, scheduled jobs, the audit log, and every user with the
 *          ADMIN role plus anyone named in --keep.
 * PEOPLE   everyone else is deactivated, not deleted. That is this app's rule for
 *          people (see CLAUDE.md): their account stays, their access goes.
 *
 * --only=hr deletes just the HRMS, attendance and leave records above — for a live
 * system whose clients and projects are real but whose hiring and attendance screens
 * still hold sample rows. Nobody is deactivated and no files are touched.
 *
 * Constructs its own PrismaClient, like prisma/seed.mjs: a plain Node script cannot
 * import the TypeScript client in lib/prisma.ts on a server without dev dependencies.
 */
import { PrismaClient, Prisma } from "@prisma/client"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const CONFIRM = args.includes("--confirm")
const HR_ONLY = args.includes("--only=hr")
const keepEmails = new Set(
  (args.find((a) => a.startsWith("--keep="))?.slice(7) ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
)

/** Business data. Their children cascade, or are deleted here in dependency order. */
const TARGET_MODELS = [
  "Client", "Project", "ProjectStrategy", "Post", "PostPlatform", "Asset", "Comment",
  "ApprovalFlow", "ApprovalAttachment", "ApprovalHistory", "ApprovalChain", "ApprovalStep",
  "ProofAnnotation", "ProofAnnotationReply", "PostAssignment", "TaskLog", "ExportLink",
  "Task", "DailyTodo", "TodoBlocker",
  "Lead", "LeadActivity", "Quotation", "QuotationLine", "Invoice", "InvoiceLine", "Payment",
  "Contract", "Expense", "Festival", "ShootEvent", "Credential", "Notification",
  "PayrollRun", "Payslip", "PayslipLine", "PayrollPayment",
  "HrmsJobOpening", "HrmsCandidate", "HrmsApplication", "HrmsCandidateActivity",
  "HrmsInterview", "HrmsInterviewInterviewer", "HrmsOffer", "HrmsOfferRevision",
  "HrmsOnboarding", "HrmsLetterhead", "HrmsOfferTemplate",
  "InstagramPublishJob", "InstagramMediaInsight",
]

const HR_MODELS = [
  "HrmsJobOpening", "HrmsCandidate", "HrmsApplication", "HrmsCandidateActivity",
  "HrmsInterview", "HrmsInterviewInterviewer", "HrmsOffer", "HrmsOfferRevision",
  "HrmsOnboarding", "HrmsLetterhead", "HrmsOfferTemplate",
  "Attendance", "AttendanceRegularization", "AttendanceSyncLog",
  "LeaveRequest", "LeaveLedger", "LeaveBalance",
]
for (const m of HR_MODELS) if (!TARGET_MODELS.includes(m)) TARGET_MODELS.push(m)

const UPLOADS_ROOT = path.resolve(process.cwd(), "public", "uploads")

class Rollback extends Error {}

const prisma = new PrismaClient()

async function main() {
  const models = Prisma.dmmf.datamodel.models
  const table = new Map(models.map((m) => [m.name, m.dbName ?? m.name]))
  const wanted = HR_ONLY ? HR_MODELS : TARGET_MODELS
  const missing = wanted.filter((m) => !table.has(m))
  const targets = wanted.filter((m) => table.has(m))
  if (missing.length) console.log(`(not in this schema, skipped: ${missing.join(", ")})`)

  // Delete children before parents, using this database's actual foreign keys.
  const fks = await prisma.$queryRawUnsafe(`
    SELECT k.TABLE_NAME AS child, k.REFERENCED_TABLE_NAME AS parent
    FROM information_schema.KEY_COLUMN_USAGE k
    WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL`)
  const byTable = new Map(targets.map((m) => [table.get(m), m]))
  const deps = new Map(targets.map((m) => [m, new Set()])) // model -> models that must go first
  for (const { child, parent } of fks) {
    const c = byTable.get(child), p = byTable.get(parent)
    if (c && p && c !== p) deps.get(p).add(c)
  }
  const order = []
  const seen = new Set()
  const visit = (m, stack = new Set()) => {
    if (seen.has(m)) return
    if (stack.has(m)) return // a cycle: rely on the FK's own cascade/set-null
    stack.add(m)
    for (const d of deps.get(m)) visit(d, stack)
    stack.delete(m)
    seen.add(m)
    order.push(m)
  }
  for (const m of targets) visit(m)

  // Who stays able to sign in.
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, isActive: true, role: { select: { name: true } } },
    orderBy: { id: "asc" },
  })
  const kept = users.filter((u) => u.role?.name === "ADMIN" || keepEmails.has(u.email.toLowerCase()))
  const toDeactivate = HR_ONLY ? [] : users.filter((u) => !kept.includes(u) && u.isActive)
  if (kept.length === 0) {
    throw new Error("Refusing to run: no user would keep access. Give someone the ADMIN role or pass --keep=<email>.")
  }

  // Files the deleted rows point at, removed only after a committed run.
  const assetUrls = HR_ONLY ? [] : (await prisma.asset.findMany({ select: { url: true } })).map((a) => a.url)

  const counts = {}
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const m of order) {
          const delegate = tx[m.charAt(0).toLowerCase() + m.slice(1)]
          const { count } = await delegate.deleteMany({})
          if (count) counts[m] = count
        }
        if (toDeactivate.length) {
          await tx.user.updateMany({
            where: { id: { in: toDeactivate.map((u) => u.id) } },
            data: { isActive: false, deactivatedAt: new Date() },
          })
        }
        await tx.auditLog.create({
          data: {
            action: HR_ONLY ? "HR_DEMO_DATA_WIPED" : "DEMO_DATA_WIPED",
            entityType: "SYSTEM",
            newValues: JSON.stringify({ deleted: counts, deactivated: toDeactivate.map((u) => u.email) }),
            ipAddress: "cli",
            userAgent: "scripts/wipe-demo-data.mjs",
          },
        })
        if (!CONFIRM) throw new Rollback()
      },
      { timeout: 120_000, maxWait: 10_000 },
    )
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  console.log(`\n${CONFIRM ? "DELETED" : "WOULD DELETE"} ${total} rows`)
  for (const [m, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${m}`)
  console.log(`\n${CONFIRM ? "DEACTIVATED" : "WOULD DEACTIVATE"} ${toDeactivate.length} account(s):`)
  for (const u of toDeactivate) console.log(`         ${u.name} <${u.email}> (${u.role?.name ?? "no role"})`)
  console.log(`\nKEPT with access: ${kept.map((u) => `${u.name} <${u.email}>`).join(", ")}`)

  let files = 0
  for (const url of assetUrls) {
    const rel = url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/(api\/)?uploads\//, "")
    const full = path.resolve(UPLOADS_ROOT, rel)
    if (!full.startsWith(UPLOADS_ROOT + path.sep) || !fs.existsSync(full)) continue
    files++
    if (CONFIRM) fs.rmSync(full, { force: true })
  }
  console.log(`\n${CONFIRM ? "Removed" : "Would remove"} ${files} uploaded file(s) under public/uploads that only those records used.`)

  if (!CONFIRM) console.log("\nDry run — nothing was changed. Re-run with --confirm to apply.")
}

main()
  .catch((e) => {
    console.error("\nNothing was changed:", e.message.split("\n").slice(-3).join(" "))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
