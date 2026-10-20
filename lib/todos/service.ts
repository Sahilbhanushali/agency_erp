import { prisma } from "@/lib/prisma"

/**
 * Daily todo logic, kept out of the route handlers so the cron job and the API agree
 * on what "today's list" means.
 */

/** Midnight for a given day, so every comparison is date-only and unambiguous. */
export function dayStart(date: Date | string = new Date()): Date {
  const d = new Date(date)
  if (isNaN(d.getTime())) return new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export const blockerSelect = {
  id: true,
  todoId: true,
  title: true,
  description: true,
  category: true,
  impact: true,
  assistanceRequired: true,
  status: true,
  responsibleParty: true,
  expectedResolution: true,
  resolutionNotes: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
}

export const todoSelect = {
  id: true,
  userId: true,
  date: true,
  title: true,
  notes: true,
  status: true,
  priority: true,
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
  blockers: {
    select: blockerSelect,
    orderBy: { createdAt: "desc" as const },
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
    select: { id: true, title: true, priority: true, position: true },
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
      priority: task.priority,
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
    select: { id: true, title: true, notes: true, priority: true, blocker: true, progress: true, taskId: true },
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
      priority: s.priority,
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

/**
 * Keeps a DailyTodo's status and blocker summary string in sync with its TodoBlocker items.
 *
 * Rules:
 * 1. If any blocker is OPEN or IN_PROGRESS:
 *    - DailyTodo.status = BLOCKED
 *    - DailyTodo.blocker = latest active blocker's title
 * 2. If ALL blockers are RESOLVED (or none exist):
 *    - If DailyTodo.status was BLOCKED:
 *      - Switch to IN_PROGRESS (if progress > 0) or PENDING (if progress === 0)
 *      - DailyTodo.blocker = null
 *    - DailyTodo is NEVER silently set to DONE when blockers resolve.
 */
export async function syncTodoBlockerState(todoId: string) {
  const blockers = await prisma.todoBlocker.findMany({
    where: { todoId },
    orderBy: { createdAt: "desc" },
  })

  const activeBlockers = blockers.filter((b) => b.status === "OPEN" || b.status === "IN_PROGRESS")
  const currentTodo = await prisma.dailyTodo.findUnique({
    where: { id: todoId },
    select: { id: true, status: true, progress: true },
  })
  if (!currentTodo) return

  if (activeBlockers.length > 0) {
    const latestSummary = activeBlockers[0].title
    await prisma.dailyTodo.update({
      where: { id: todoId },
      data: {
        status: "BLOCKED",
        blocker: latestSummary,
      },
    })
  } else {
    // All resolved or none exist
    let newStatus = currentTodo.status
    if (currentTodo.status === "BLOCKED") {
      newStatus = currentTodo.progress > 0 ? "IN_PROGRESS" : "PENDING"
    }
    await prisma.dailyTodo.update({
      where: { id: todoId },
      data: {
        status: newStatus,
        blocker: null,
      },
    })
  }
}

/** Numbers a manager and dashboard actually read: how much got done, and what is stuck. */
export function summarise(
  todos: {
    status: string
    progress: number
    blocker?: string | null
    blockers?: { status: string }[]
  }[],
) {
  const total = todos.length
  const done = todos.filter((t) => t.status === "DONE").length
  const blocked = todos.filter(
    (t) =>
      t.status === "BLOCKED" ||
      (t.blockers && t.blockers.some((b) => b.status !== "RESOLVED")) ||
      Boolean(t.blocker),
  ).length
  const inProgress = todos.filter((t) => t.status === "IN_PROGRESS").length
  const carried = todos.filter((t) => t.status === "CARRIED_OVER").length
  const pending = todos.filter((t) => t.status === "PENDING").length

  const completion =
    total === 0
      ? 0
      : Math.round(
          todos.reduce((sum, t) => sum + (t.status === "DONE" ? 100 : t.progress), 0) / total,
        )

  return { total, done, inProgress, blocked, carried, pending, completion }
}
