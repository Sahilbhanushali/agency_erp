import type { Session } from "next-auth"
import { prisma } from "@/lib/prisma"
import { isClientContact } from "@/lib/api-auth"
import { assertPostAccess, WorkflowError } from "@/lib/posts/workflow"
import { systemMessage } from "@/lib/chat/service"

/**
 * Approval discussions: one conversation per post, on the chat engine.
 *
 * Access is the post's own access rule, re-checked on every read (memberAccess calls
 * mayDiscussPost for APPROVAL conversations), so losing access to the post loses the
 * discussion too — membership rows are only the delivery list. Client contacts are
 * excluded: they decide through share links, and this thread is the team's working
 * conversation.
 */

/**
 * A session-shaped identity for evaluating someone else's access with the same rules
 * as a request would. Never returned to a client and never used to act as that user.
 */
async function identityOf(userId: number): Promise<Session | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, email: true, name: true },
  })
  if (!user?.isActive) return null
  return {
    user: { id: String(userId), email: user.email, name: user.name, role: null },
    expires: new Date(Date.now() + 60_000).toISOString(),
  }
}

/** Whether this person may read and post in the discussion of this post. */
export async function mayDiscussPost(userId: number, postId: string, session?: Session): Promise<boolean> {
  const identity = session ?? (await identityOf(userId))
  if (!identity) return false
  if (await isClientContact(identity)) return false
  try {
    await assertPostAccess(identity, userId, postId, "read")
    return true
  } catch (error) {
    if (error instanceof WorkflowError) return false
    throw error
  }
}

/** The post's discussion id, creating it on first use. */
export async function ensurePostDiscussion(postId: string, createdById: number | null): Promise<string> {
  const existing = await prisma.conversation.findUnique({ where: { postId }, select: { id: true } })
  if (existing) return existing.id
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { title: true } })
  if (!post) throw new WorkflowError(404, "NOT_FOUND", "Post not found")
  try {
    const created = await prisma.conversation.create({
      data: { type: "APPROVAL", postId, name: post.title.slice(0, 120), createdById },
      select: { id: true },
    })
    return created.id
  } catch {
    // Two people opening it at once: postId is unique, so the loser reads the winner's.
    const winner = await prisma.conversation.findUnique({ where: { postId }, select: { id: true } })
    if (!winner) throw new Error(`Could not create the discussion for post ${postId}`)
    return winner.id
  }
}

/** People who should hear about this post's discussion: its team and its reviewers. */
async function stakeholderIds(postId: string): Promise<number[]> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      createdById: true,
      assignedToId: true,
      assignedUsers: { select: { id: true } },
      project: { select: { managerId: true } },
      statusChanges: { where: { actorId: { not: null } }, select: { actorId: true }, distinct: ["actorId"] },
    },
  })
  if (!post) return []
  const ids = [
    post.createdById,
    post.assignedToId,
    post.project.managerId,
    ...post.assignedUsers.map((u) => u.id),
    ...post.statusChanges.map((s) => s.actorId),
  ]
  return [...new Set(ids.filter((id): id is number => typeof id === "number"))]
}

/** Adds these people as members when they may take part; never removes anyone. */
export async function addDiscussionMembers(conversationId: string, postId: string, userIds: number[]) {
  const unique = [...new Set(userIds)]
  const allowed: number[] = []
  for (const id of unique) {
    if (await mayDiscussPost(id, postId)) allowed.push(id)
  }
  if (allowed.length === 0) return
  await prisma.conversationMember.createMany({
    data: allowed.map((userId) => ({ conversationId, userId })),
    skipDuplicates: true,
  })
}

/** Opens the discussion for someone already authorized to read the post. */
export async function openPostDiscussion(postId: string, userId: number): Promise<string> {
  const conversationId = await ensurePostDiscussion(postId, userId)
  await prisma.conversationMember.createMany({ data: [{ conversationId, userId }], skipDuplicates: true })
  return conversationId
}

/** Brings the delivery list up to date: new assignees and reviewers start receiving it. */
export async function syncDiscussionMembers(conversationId: string, postId: string) {
  await addDiscussionMembers(conversationId, postId, await stakeholderIds(postId))
}

/** Members who may still read the post, i.e. the people a message actually reaches. */
export async function discussionAudience(conversationId: string, postId: string): Promise<number[]> {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId, leftAt: null },
    select: { userId: true, mutedUntil: true },
  })
  const audience: number[] = []
  for (const m of members) {
    if (await mayDiscussPost(m.userId, postId)) audience.push(m.userId)
  }
  return audience
}

export const discussionLink = (postId: string) => `/dashboard/projects/posts/${postId}?tab=discussion`

/**
 * In-app notification for a new message. One unread notification per person per
 * discussion: later messages refresh it rather than stacking a row per message.
 */
export async function notifyDiscussion(input: {
  conversationId: string
  postId: string
  senderId: number
  senderName: string
  preview: string
}) {
  const [post, members] = await Promise.all([
    prisma.post.findUnique({ where: { id: input.postId }, select: { title: true } }),
    prisma.conversationMember.findMany({
      where: { conversationId: input.conversationId, leftAt: null, userId: { not: input.senderId } },
      select: { userId: true, mutedUntil: true },
    }),
  ])
  if (!post) return
  const now = new Date()
  const link = discussionLink(input.postId)
  const title = `New message on “${post.title.slice(0, 80)}”`
  const message = `${input.senderName}: ${input.preview.slice(0, 200)}`

  for (const member of members) {
    if (member.mutedUntil && member.mutedUntil > now) continue
    if (!(await mayDiscussPost(member.userId, input.postId))) continue
    const open = await prisma.notification.findFirst({
      where: { userId: member.userId, link, isRead: false },
      select: { id: true },
    })
    if (open) {
      await prisma.notification.update({ where: { id: open.id }, data: { title, message, createdAt: now } })
    } else {
      await prisma.notification.create({ data: { userId: member.userId, title, message, link } })
    }
  }
}

/** Workflow decisions that open a discussion if none exists: the team needs to talk. */
const OPENS_DISCUSSION = new Set(["REJECT", "REQUEST_CHANGES", "CLIENT_REQUEST_CHANGES"])

const NOTE: Record<string, string> = {
  SUBMIT: "submitted it for approval",
  APPROVE: "approved it",
  REJECT: "rejected it",
  REQUEST_CHANGES: "requested changes",
  CLIENT_APPROVE: "approved it (client)",
  CLIENT_REQUEST_CHANGES: "requested changes (client)",
  EDIT_INVALIDATE: "edited it after approval, so it needs approval again",
  PUBLISH: "marked it published",
  CANCEL: "cancelled it",
  REOPEN: "reopened it",
}

/**
 * Writes the workflow decision into the discussion, so corrections and resubmissions
 * sit in the same thread as the conversation about them.
 */
export async function noteWorkflowInDiscussion(input: {
  postId: string
  action: string
  version: number
  actorId: number | null
  actorName: string | null
  reason?: string | null
}) {
  const what = NOTE[input.action]
  if (!what) return
  let conversationId = (await prisma.conversation.findUnique({ where: { postId: input.postId }, select: { id: true } }))?.id
  if (!conversationId) {
    if (!OPENS_DISCUSSION.has(input.action)) return
    conversationId = await ensurePostDiscussion(input.postId, input.actorId)
  }
  await syncDiscussionMembers(conversationId, input.postId)
  const reason = input.reason?.trim() ? ` — “${input.reason.trim().slice(0, 500)}”` : ""
  await systemMessage(conversationId, `${input.actorName ?? "Someone"} ${what} (version ${input.version})${reason}`)
}

