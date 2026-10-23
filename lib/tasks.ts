import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/smtp"

/**
 * Shared task helpers. These live here rather than in a route file because Next only
 * allows route handlers and its own config exports from app/api/**\/route.ts.
 */

/** Fields a task row renders — never the whole record by default. */
export const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  completedAt: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  postId: true,
  projectId: true,
  clientId: true,
  createdBy: { select: { id: true, name: true } },
  assignees: { select: { id: true, name: true, email: true, avatar: true } },
  post: { select: { id: true, title: true } },
  project: { select: { id: true, name: true } },
  client: { select: { id: true, name: true, company: true } },
} satisfies Prisma.TaskSelect

/**
 * Returns a human sentence when a referenced record does not exist, else null.
 * Every id from an untrusted caller goes through here, so a bad one becomes a 422
 * instead of a foreign-key 500.
 */
/**
 * Checks every record a task points at, and works out which project it belongs to.
 *
 * A task on a post belongs to that post's project. That used to be left to the caller,
 * so a task created with only a postId had no projectId and never appeared in the
 * project's task list. Now the project always follows the post, and a post paired with
 * a different project is refused instead of saved contradicting itself.
 *
 * Returns the projectId to store: undefined means "leave it as it is" (an edit that did
 * not touch the link), null means "not linked to a project".
 */
export async function validateTaskLinks(
  input: {
    assigneeIds?: number[]
    postId?: string | null
    projectId?: string | null
    clientId?: string | null
  },
  /** For an edit: the post the task is already on, if the edit does not change it. */
  existingPostId?: string | null,
): Promise<{ error: string } | { projectId: string | null | undefined }> {
  const postId = input.postId !== undefined ? input.postId : existingPostId
  const [assignees, post, project, client] = await Promise.all([
    input.assigneeIds?.length
      ? prisma.user.findMany({ where: { id: { in: input.assigneeIds } }, select: { id: true } })
      : [],
    postId ? prisma.post.findUnique({ where: { id: postId }, select: { id: true, projectId: true } }) : null,
    input.projectId
      ? prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } })
      : null,
    input.clientId
      ? prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } })
      : null,
  ])

  if (input.assigneeIds?.length && assignees.length !== input.assigneeIds.length) {
    return { error: "One of those users no longer exists" }
  }
  if (postId && !post) return { error: "That post no longer exists" }
  if (input.projectId && !project) return { error: "That project no longer exists" }
  if (input.clientId && !client) return { error: "That client no longer exists" }

  if (post) {
    if (input.projectId && input.projectId !== post.projectId) {
      return { error: "That post belongs to a different project" }
    }
    // Only report a project when the link is being set, so an unrelated edit leaves it.
    return { projectId: input.postId !== undefined || input.projectId !== undefined ? post.projectId : undefined }
  }
  return { projectId: input.projectId }
}

/**
 * Who may change a task, and how much.
 *
 *   - `tasks:update` — anyone holding it edits anything.
 *   - the assignees — may move status and report progress on work they were given.
 *   - whoever created it — may move status on work they handed out, so a manager can
 *     reopen something that was closed too early without needing the blanket permission.
 *
 * Returning the reason rather than a bare boolean lets the route explain the refusal.
 */
export function taskAccess(
  task: { createdById: number | null; assignees: { id: number }[] },
  userId: number,
  canManage: boolean,
): { level: "full" | "status" | "none"; reason: string } {
  if (canManage) return { level: "full", reason: "has tasks:update" }

  /**
   * The person who created a task may edit it.
   *
   * They used to get "status" only, so whoever raised a task could not fix its own
   * title, due date or assignees — the thing they had just written. Checked before
   * the assignee branch so a creator who is also assigned is not demoted to status.
   *
   * This is ownership, not a permission: it grants nothing on anybody else's task,
   * and the update schema has no createdById, so it cannot be used to take one over.
   */
  if (task.createdById === userId) return { level: "full", reason: "created this task" }

  // Being handed work comes with the ability to report on it, and nothing more.
  if (task.assignees.some((a) => a.id === userId)) return { level: "status", reason: "assignee" }

  return {
    level: "none",
    reason: "only the people assigned to this task, or whoever created it, can change it",
  }
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

/** Shared chrome so every task email looks like it came from the same system. */
function taskEmailHtml(opts: {
  heading: string
  intro: string
  taskTitle: string
  rows: [string, string][]
  taskId: string
  tone?: "normal" | "alert"
}) {
  const accent = opts.tone === "alert" ? "#b91c1c" : "#0f172a"
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:28px;border:1px solid #e2e8f0;border-radius:12px;color:#0f172a;">
    <h1 style="margin:0 0 6px 0;font-size:18px;color:${accent};">${opts.heading}</h1>
    <p style="margin:0 0 18px 0;font-size:14px;color:#475569;line-height:1.6;">${opts.intro}</p>
    <div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <p style="margin:0 0 8px 0;font-size:15px;font-weight:600;">${escapeHtml(opts.taskTitle)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${opts.rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:3px 0;color:#64748b;width:120px;">${k}</td><td style="padding:3px 0;font-weight:500;">${escapeHtml(v)}</td></tr>`,
          )
          .join("")}
      </table>
    </div>
    <div style="margin:22px 0 0 0;">
      <a href="${APP_URL}/dashboard/tasks?task=${opts.taskId}" style="display:inline-block;padding:11px 22px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">Open task</a>
    </div>
  </div>`
}

const escapeHtml = (value: string) =>
  String(value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  )

/**
 * In-app notification plus email.
 *
 * Email is best-effort and never fails the request: a task must still get assigned when
 * SMTP is down. The in-app row is what the desktop notification poller reads, so it is
 * written first and inside the caller's flow.
 */
async function notify(
  recipients: number[],
  payload: { title: string; message: string; link: string },
  email?: { subject: string; html: string },
) {
  if (recipients.length === 0) return

  await prisma.notification.createMany({
    data: recipients.map((userId) => ({ ...payload, userId })),
  })

  if (!email) return
  try {
    const people = await prisma.user.findMany({
      where: { id: { in: recipients } },
      select: { email: true },
    })
    const to = people.map((p) => p.email).filter(Boolean)
    if (to.length === 0) return

    await sendMail({ to, subject: email.subject, html: email.html })
  } catch (error) {
    console.error("[tasks] notification email failed:", error)
  }
}

/** Someone has been given work. Never notify a person of their own action. */
export async function notifyTaskAssignees(
  assigneeIds: number[],
  taskId: string,
  title: string,
  actorId: number,
  details?: { dueDate?: Date | null; priority?: string; assignedBy?: string | null },
) {
  const recipients = assigneeIds.filter((id) => id !== actorId)
  if (recipients.length === 0) return

  const due = details?.dueDate
    ? new Date(details.dueDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No due date"

  await notify(
    recipients,
    {
      title: "New task assigned",
      message: `You have been assigned: "${title}"`,
      link: `/dashboard/tasks?task=${taskId}`,
    },
    {
      subject: `New task assigned: ${title}`,
      html: taskEmailHtml({
        heading: "A task has been assigned to you",
        intro: "It will also appear in My Day on the date it is due.",
        taskTitle: title,
        taskId,
        rows: [
          ["Due", due],
          ["Priority", details?.priority ?? "MEDIUM"],
          ...(details?.assignedBy ? ([["Assigned by", details.assignedBy]] as [string, string][]) : []),
        ],
      }),
    },
  )
}

/**
 * A task moved. The people who care are the other assignees and whoever created it —
 * the person who made the change already knows.
 */
export async function notifyTaskStatusChange(
  taskId: string,
  title: string,
  from: string,
  to: string,
  actorId: number,
  actorName: string | null,
  audience: { assigneeIds: number[]; createdById: number | null },
) {
  const recipients = Array.from(
    new Set([...audience.assigneeIds, ...(audience.createdById ? [audience.createdById] : [])]),
  ).filter((id) => id !== actorId)

  await notify(
    recipients,
    {
      title: `Task ${to.toLowerCase().replace("_", " ")}`,
      message: `${actorName ?? "Someone"} moved "${title}" from ${from.toLowerCase()} to ${to.toLowerCase()}`,
      link: `/dashboard/tasks?task=${taskId}`,
    },
    {
      subject: `${title} — now ${to.toLowerCase().replace("_", " ")}`,
      html: taskEmailHtml({
        heading: "Task status changed",
        intro: `${escapeHtml(actorName ?? "Someone")} moved this from <strong>${from.toLowerCase()}</strong> to <strong>${to.toLowerCase()}</strong>.`,
        taskTitle: title,
        taskId,
        rows: [["Was", from], ["Now", to]],
        tone: to === "BLOCKED" ? "alert" : "normal",
      }),
    },
  )
}

/** Overdue nudge, used by the reminder cron. */
export async function notifyTaskOverdue(task: {
  id: string
  title: string
  dueDate: Date | null
  assignees: { id: number }[]
  createdById: number | null
}) {
  const days = task.dueDate
    ? Math.max(1, Math.floor((Date.now() - new Date(task.dueDate).getTime()) / 86_400_000))
    : 0
  const recipients = Array.from(
    new Set([...task.assignees.map((a) => a.id), ...(task.createdById ? [task.createdById] : [])]),
  )

  await notify(
    recipients,
    {
      title: "Task overdue",
      message: `"${task.title}" was due ${days} day${days === 1 ? "" : "s"} ago`,
      link: `/dashboard/tasks?task=${task.id}`,
    },
    {
      subject: `Overdue: ${task.title}`,
      html: taskEmailHtml({
        heading: `Overdue by ${days} day${days === 1 ? "" : "s"}`,
        intro: "This task has passed its due date and is not finished.",
        taskTitle: task.title,
        taskId: task.id,
        tone: "alert",
        rows: [
          ["Was due", task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-IN") : "—"],
          ["Overdue by", `${days} day${days === 1 ? "" : "s"}`],
        ],
      }),
    },
  )
}
