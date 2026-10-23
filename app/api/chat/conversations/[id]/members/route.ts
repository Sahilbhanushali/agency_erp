import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { can, requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { publish } from "@/lib/realtime/hub"
import { activeMemberIds, eligibleUserIds, memberAccess, notFound, readOnly, systemMessage } from "@/lib/chat/service"

export const dynamic = "force-dynamic"

const schema = z.object({
  userIds: z.array(z.coerce.number().int().positive()).min(1).max(100),
})

/**
 * Adds people to a group. Requires being an admin of this group AND holding
 * chat_groups:update — the permission says you may administer groups, the group role
 * says which ones.
 *
 * Someone re-added after leaving gets the full history again: an admin has explicitly
 * let them back in. Their read marker moves to now, so they are not greeted with
 * hundreds of unread messages.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const access = await memberAccess(id, auth.userId)
  if (!access) return notFound()
  if (!access.active) return readOnly()

  const conv = await prisma.conversation.findUnique({ where: { id }, select: { type: true, lastSeq: true } })
  if (!conv) return notFound()
  if (conv.type !== "GROUP") return NextResponse.json({ error: "People can only be added to groups" }, { status: 422 })
  if (access.role !== "ADMIN" || !(await can(auth.session, "chat_groups", "update"))) {
    return NextResponse.json({ error: "Only group admins can add members" }, { status: 403 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Choose at least one person" }, { status: 422 })

  const eligible = await eligibleUserIds(parsed.data.userIds)
  const current = new Set(await activeMemberIds(id))
  const toAdd = eligible.filter((uid) => !current.has(uid))
  if (toAdd.length === 0) {
    return NextResponse.json({ error: "Everyone selected is already a member or cannot use chat" }, { status: 422 })
  }

  await prisma.$transaction(
    toAdd.map((userId) =>
      prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: id, userId } },
        create: { conversationId: id, userId, lastReadSeq: conv.lastSeq },
        update: { leftAt: null, leftAtSeq: null, role: "MEMBER", lastReadSeq: conv.lastSeq, joinedAt: new Date() },
      }),
    ),
  )

  const [actor, added] = await Promise.all([
    prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } }),
    prisma.user.findMany({ where: { id: { in: toAdd } }, select: { name: true } }),
  ])
  await systemMessage(id, `${actor?.name ?? "Someone"} added ${added.map((u) => u.name).join(", ")}`)
  publish([...current, ...toAdd], { type: "conversation", conversationId: id })

  return NextResponse.json({ added: toAdd.length, skipped: parsed.data.userIds.length - toAdd.length })
}
