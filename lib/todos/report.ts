import { prisma } from "@/lib/prisma"
import { resolveSmtp } from "@/lib/smtp"
import { dayStart, summarise } from "@/lib/todos/service"
import { namesSatisfying } from "@/lib/permissions/catalog"

/**
 * End-of-day report: what each person planned, how far they got, and what blocked them.
 *
 * Recipients are resolved per person: their `reportsTo` manager if set, otherwise
 * everyone holding `todos:export`. That means the report follows the org chart where
 * one exists and still reaches someone when it does not.
 */

interface ReportRow {
  user: { id: number; name: string | null; email: string }
  todos: { title: string; status: string; progress: number; blocker: string | null }[]
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Not started",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
  CARRIED_OVER: "Carried over",
}

function personBlock(row: ReportRow) {
  const s = summarise(row.todos)
  const blockers = row.todos.filter((t) => t.blocker)

  const rows = row.todos
    .map(
      (t) => `
      <tr>
        <td style="padding:6px 8px;border-top:1px solid #f1f5f9;font-size:13px;">${escapeHtml(t.title)}</td>
        <td style="padding:6px 8px;border-top:1px solid #f1f5f9;font-size:12px;color:#475569;white-space:nowrap;">${STATUS_LABEL[t.status] ?? t.status}</td>
        <td style="padding:6px 8px;border-top:1px solid #f1f5f9;font-size:12px;text-align:right;white-space:nowrap;">${t.status === "DONE" ? 100 : t.progress}%</td>
      </tr>`,
    )
    .join("")

  return `
    <div style="margin:0 0 28px 0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <div style="padding:12px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
        <strong style="font-size:14px;color:#0f172a;">${escapeHtml(row.user.name ?? row.user.email)}</strong>
        <span style="font-size:12px;color:#64748b;"> — ${s.done}/${s.total} done · ${s.completion}% overall${
          s.blocked > 0 ? ` · <strong style="color:#b91c1c;">${s.blocked} blocked</strong>` : ""
        }</span>
      </div>
      ${
        row.todos.length === 0
          ? `<p style="margin:0;padding:14px;font-size:13px;color:#64748b;">Nothing planned today.</p>`
          : `<table style="width:100%;border-collapse:collapse;">${rows}</table>`
      }
      ${
        blockers.length > 0
          ? `<div style="padding:12px 14px;background:#fef2f2;border-top:1px solid #fecaca;">
               <strong style="font-size:12px;color:#991b1b;">Blockers</strong>
               <ul style="margin:6px 0 0 16px;padding:0;font-size:12px;color:#7f1d1d;">
                 ${blockers.map((b) => `<li>${escapeHtml(b.title)} — ${escapeHtml(b.blocker!)}</li>`).join("")}
               </ul>
             </div>`
          : ""
      }
    </div>`
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  )

/**
 * Build and send the day's reports.
 * `dryRun` renders everything and reports who would receive what, without sending —
 * which is how this gets tested without mailing the team.
 */
export async function sendEndOfDayReports(options: { date?: Date; dryRun?: boolean } = {}) {
  const date = dayStart(options.date)
  const label = date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })

  const todos = await prisma.dailyTodo.findMany({
    where: { date },
    select: {
      title: true,
      status: true,
      progress: true,
      blocker: true,
      user: { select: { id: true, name: true, email: true, reportsToId: true } },
    },
    orderBy: [{ userId: "asc" }, { position: "asc" }],
  })

  if (todos.length === 0) return { date: label, reports: 0, skipped: "nobody planned anything" }

  // Group per person, remembering who each reports to.
  const byUser = new Map<number, ReportRow & { reportsToId: number | null }>()
  for (const t of todos) {
    const row = byUser.get(t.user.id) ?? {
      user: { id: t.user.id, name: t.user.name, email: t.user.email },
      reportsToId: t.user.reportsToId,
      todos: [],
    }
    row.todos.push({ title: t.title, status: t.status, progress: t.progress, blocker: t.blocker })
    byUser.set(t.user.id, row)
  }

  // Fallback recipients: everyone who may receive the report.
  const accepted = namesSatisfying("todos", "export")
  const fallback = await prisma.user.findMany({
    where: { role: { permissions: { some: { permission: { name: { in: accepted } } } } } },
    select: { id: true, name: true, email: true },
  })

  // One email per manager, containing every person who reports to them.
  const perManager = new Map<number, { email: string; name: string | null; rows: ReportRow[] }>()
  const managerIds = Array.from(
    new Set(Array.from(byUser.values()).map((r) => r.reportsToId).filter(Boolean) as number[]),
  )
  const managers = managerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: managerIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const managerById = new Map(managers.map((m) => [m.id, m]))

  const unassigned: ReportRow[] = []
  for (const row of byUser.values()) {
    const manager = row.reportsToId ? managerById.get(row.reportsToId) : undefined
    if (!manager) {
      unassigned.push(row)
      continue
    }
    const bucket = perManager.get(manager.id) ?? { email: manager.email, name: manager.name, rows: [] }
    bucket.rows.push(row)
    perManager.set(manager.id, bucket)
  }

  /**
   * One email per recipient, not one per reason. Somebody who both manages a person
   * and holds todos:export was otherwise mailed twice with overlapping content.
   */
  const inbox = new Map<string, { name: string | null; rows: Map<number, ReportRow> }>()
  const addTo = (email: string, name: string | null, rows: ReportRow[]) => {
    const entry = inbox.get(email) ?? { name, rows: new Map() }
    for (const r of rows) entry.rows.set(r.user.id, r)
    inbox.set(email, entry)
  }

  for (const bucket of perManager.values()) addTo(bucket.email, bucket.name, bucket.rows)
  // People with no manager set go to everyone holding todos:export.
  if (unassigned.length > 0) {
    for (const recipient of fallback) addTo(recipient.email, recipient.name, unassigned)
  }

  const deliveries = Array.from(inbox.entries()).map(([to, entry]) => ({
    to,
    people: entry.rows.size,
  }))

  if (options.dryRun) {
    return { date: label, dryRun: true, deliveries, people: byUser.size }
  }

  const { transporter, fromEmail } = await resolveSmtp()
  let sent = 0

  const send = async (to: string, rows: ReportRow[]) => {
    const overall = summarise(rows.flatMap((r) => r.todos))
    await transporter.sendMail({
      from: fromEmail,
      to,
      subject: `Daily work report — ${label} (${overall.done}/${overall.total} done${
        overall.blocked ? `, ${overall.blocked} blocked` : ""
      })`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#0f172a;">
          <h1 style="margin:0 0 4px 0;font-size:18px;">Daily work report</h1>
          <p style="margin:0 0 20px 0;font-size:13px;color:#64748b;">
            ${label} · ${rows.length} ${rows.length === 1 ? "person" : "people"} ·
            ${overall.done}/${overall.total} items done · ${overall.completion}% overall
          </p>
          ${rows.map(personBlock).join("")}
          <p style="margin:24px 0 0 0;font-size:11px;color:#94a3b8;">
            Sent automatically at end of day. Figures come from what each person recorded.
          </p>
        </div>`,
    })
    sent++
  }

  for (const [to, entry] of inbox) await send(to, Array.from(entry.rows.values()))

  return { date: label, reports: sent, people: byUser.size }
}
