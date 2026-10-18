import { prisma } from "@/lib/prisma"

/**
 * Daily todo logic, kept out of the route handlers so the cron job and the API agree
 * on what "today's list" means.
 */

/** Midnight for a given day, so every comparison is date-only and unambiguous. */
export function dayStart(date: Date | string = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export const todoSelect = {
  id: true,
  date: true,
  title: true,
  notes: true,
  status: true,
  progress: true,
  blocker: true,
  taskId: true,
  position: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true, avatar: true } },
  task: {
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      project: { select: { id: true, name: true } },
      post: { select: { id: true, title: true } },
    },
  },
}

/**
 * Mirror every task assigned to this person and due on `date` into that day's list.
 *
 * Idempotent: the unique [userId, date, taskId] index means running it repeatedly —
 * on every page load, and again from the cron — adds each task once. Returns how many
 * were newly added so a caller can tell the user what appeared.
 *
 * Tasks already finished are skipped: a day's plan should not open with work that is
 * already done.
 */
export async function syncTasksDueToday(userId: number, date: Date = new Date()) {
  const day = dayStart(date)
  const nextDay = new Date(day)
  nextDay.setDate(nextDay.getDate() + 1)

  const due = await prisma.task.findMany({
    where: {
      assignees: { some: { id: userId } },
      dueDate: { gte: day, lt: nextDay },
      status: { notIn: ["DONE", "CANCELLED"] },
    },
    select: { id: true, title: true, position: true },
  })
  if (due.length === 0) return { added: 0 }

  const existing = await prisma.dailyTodo.findMany({
    where: { userId, date: day, taskId: { in: due.map((t) => t.id) } },
    select: { taskId: true },
  })
  const have = new Set(existing.map((e) => e.taskId))
  const missing = due.filter((t) => !have.has(t.id))
  if (missing.length === 0) return { added: 0 }

  await prisma.dailyTodo.createMany({
    data: missing.map((task, i) => ({
      userId,
      date: day,
      title: task.title,
      taskId: task.id,
      position: 1000 + i,
    })),
    skipDuplicates: true,
  })
  return { added: missing.length }
}

/**
 * Carry yesterday's unfinished work into today, once, marked so it is visible as
 * carried over rather than silently re-planned.
 */
export async function carryOverUnfinished(userId: number, date: Date = new Date()) {
  const today = dayStart(date)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const stale = await prisma.dailyTodo.findMany({
    where: { userId, date: yesterday, status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] } },
    select: { id: true, title: true, notes: true, blocker: true, progress: true, taskId: true },
  })
  if (stale.length === 0) return { carried: 0 }

  const already = await prisma.dailyTodo.findMany({
    where: { userId, date: today },
    select: { title: true, taskId: true },
  })
  const haveTask = new Set(already.map((a) => a.taskId).filter(Boolean))
  const haveTitle = new Set(already.map((a) => a.title))

  const toCarry = stale.filter((s) =>
    s.taskId ? !haveTask.has(s.taskId) : !haveTitle.has(s.title),
  )
  if (toCarry.length === 0) return { carried: 0 }

  await prisma.dailyTodo.createMany({
    data: toCarry.map((s, i) => ({
      userId,
      date: today,
      title: s.title,
      notes: s.notes,
      blocker: s.blocker,
      progress: s.progress,
      taskId: s.taskId,
      status: "CARRIED_OVER" as const,
      position: 2000 + i,
    })),
    skipDuplicates: true,
  })
  return { carried: toCarry.length }
}

/** Numbers a manager actually reads: how much got done, and what is stuck. */
export function summarise(todos: { status: string; progress: number; blocker: string | null }[]) {
  const total = todos.length
  const done = todos.filter((t) => t.status === "DONE").length
  const blocked = todos.filter((t) => t.status === "BLOCKED" || t.blocker).length
  const inProgress = todos.filter((t) => t.status === "IN_PROGRESS").length
  const carried = todos.filter((t) => t.status === "CARRIED_OVER").length

  // Average progress across everything planned, with DONE counting as 100 even if the
  // person never dragged the slider.
  const completion =
    total === 0
      ? 0
      : Math.round(
          todos.reduce((sum, t) => sum + (t.status === "DONE" ? 100 : t.progress), 0) / total,
        )

  return { total, done, inProgress, blocked, carried, completion }
}
