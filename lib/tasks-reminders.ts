import { prisma } from "@/lib/prisma"
import { notifyTaskOverdue } from "@/lib/tasks"

/**
 * Overdue task reminders.
 *
 * Deliberately not every overdue task every day: a reminder that arrives daily forever
 * gets filtered out and stops working. One goes out the day a task slips, then at 3, 7
 * and 14 days — a cadence that escalates instead of nagging.
 */
const REMIND_ON_DAYS = [1, 3, 7, 14]

export async function sendOverdueTaskReminders(options: { dryRun?: boolean } = {}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overdue = await prisma.task.findMany({
    where: {
      dueDate: { lt: today },
      status: { notIn: ["DONE", "CANCELLED"] },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      createdById: true,
      assignees: { select: { id: true } },
    },
  })

  const due = overdue.filter((task) => {
    if (!task.dueDate) return false
    const days = Math.floor((today.getTime() - new Date(task.dueDate).setHours(0, 0, 0, 0)) / 86_400_000)
    return REMIND_ON_DAYS.includes(days)
  })

  if (options.dryRun) {
    return {
      overdueTotal: overdue.length,
      remindingAbout: due.map((t) => ({
        id: t.id,
        title: t.title,
        days: Math.floor((today.getTime() - new Date(t.dueDate!).setHours(0, 0, 0, 0)) / 86_400_000),
        recipients: new Set([...t.assignees.map((a) => a.id), t.createdById].filter(Boolean)).size,
      })),
      dryRun: true,
    }
  }

  for (const task of due) await notifyTaskOverdue(task)
  return { overdueTotal: overdue.length, reminded: due.length }
}
