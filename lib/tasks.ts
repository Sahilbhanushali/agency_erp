import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

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
export async function validateTaskLinks(input: {
  assigneeIds?: number[]
  postId?: string | null
  projectId?: string | null
  clientId?: string | null
}): Promise<string | null> {
  const [assignees, post, project, client] = await Promise.all([
    input.assigneeIds?.length
      ? prisma.user.findMany({ where: { id: { in: input.assigneeIds } }, select: { id: true } })
      : [],
    input.postId
      ? prisma.post.findUnique({ where: { id: input.postId }, select: { id: true } })
      : null,
    input.projectId
      ? prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } })
      : null,
    input.clientId
      ? prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } })
      : null,
  ])

  if (input.assigneeIds?.length && assignees.length !== input.assigneeIds.length) {
    return "One of those users no longer exists"
  }
  if (input.postId && !post) return "That post no longer exists"
  if (input.projectId && !project) return "That project no longer exists"
  if (input.clientId && !client) return "That client no longer exists"
  return null
}

/** In-app notification per assignee. Never notify someone of their own action. */
export async function notifyTaskAssignees(
  assigneeIds: number[],
  taskId: string,
  title: string,
  actorId: number,
) {
  const recipients = assigneeIds.filter((id) => id !== actorId)
  if (recipients.length === 0) return

  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      title: "New task assigned",
      message: `You have been assigned: "${title}"`,
      userId,
      link: `/dashboard/tasks?task=${taskId}`,
    })),
  })
}
