import { NextResponse, type NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { can, requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { isOnline, publish } from "@/lib/realtime/hub"
import {
  MESSAGE_SELECT,
  avatarUrlFor,
  eligibleUserIds,
  systemMessage,
  toWire,
} from "@/lib/chat/service"

export const dynamic = "force-dynamic"

/** A conversation list, not an archive: bounded, newest activity first. */
const MAX_CONVERSATIONS = 200

export async function GET() {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const me = auth.userId

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: me },
    select: {
      role: true,
      lastReadSeq: true,
      mutedUntil: true,
      leftAt: true,
      leftAtSeq: true,
      conversation: {
        select: {
          id: true,
          type: true,
          name: true,
          description: true,
          avatarKey: true,
          membersCanEditInfo: true,
          lastSeq: true,
          lastMessageAt: true,
          createdAt: true,
          _count: { select: { members: { where: { leftAt: null } } } },
          members: {
            where: { leftAt: null, userId: { not: me } },
            select: { user: { select: { id: true, name: true, avatar: true, isActive: true } } },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ conversation: { lastMessageAt: { sort: "desc", nulls: "last" } } }],
    take: MAX_CONVERSATIONS,
  })

  // The last message each person may see: the newest for a current member, the last
  // one before they left otherwise. Fetched in one query, not one per conversation.
  const lastPairs = memberships
    .map((m) => ({
      conversationId: m.conversation.id,
      seq: m.leftAt ? (m.leftAtSeq ?? 0) : m.conversation.lastSeq,
    }))
    .filter((p) => p.seq > 0)

  const lastMessages = lastPairs.length
    ? await prisma.chatMessage.findMany({
        where: { OR: lastPairs.map((p) => ({ conversationId: p.conversationId, seq: p.seq })) },
        select: MESSAGE_SELECT,
      })
    : []
  const lastById = new Map(lastMessages.map((m) => [m.conversationId, toWire(m)]))

  // Unread counts for every conversation in a single statement. Your own messages and
  // deleted ones do not count; for a conversation you left, nothing after you left does.
  const unreadRows = await prisma.$queryRaw<{ conversationId: string; unread: bigint }[]>(Prisma.sql`
    SELECT m.conversationId AS conversationId, COUNT(*) AS unread
    FROM chat_messages m
    JOIN chat_members cm ON cm.conversationId = m.conversationId AND cm.userId = ${me}
    WHERE m.seq > cm.lastReadSeq
      AND (cm.leftAt IS NULL OR m.seq <= cm.leftAtSeq)
      AND (m.senderId IS NULL OR m.senderId <> ${me})
      AND m.deletedAt IS NULL
      AND m.type <> 'SYSTEM'
    GROUP BY m.conversationId
  `)
  const unreadById = new Map(unreadRows.map((r) => [r.conversationId, Number(r.unread)]))

  const conversations = memberships.map((m) => {
    const c = m.conversation
    const other = c.type === "DIRECT" ? c.members[0]?.user : undefined
    return {
      id: c.id,
      type: c.type,
      name: c.type === "DIRECT" ? (other?.name ?? "Former member") : c.name,
      description: c.description,
      avatarUrl: c.type === "DIRECT" ? (other?.avatar ?? null) : avatarUrlFor(c),
      membersCanEditInfo: c.membersCanEditInfo,
      memberCount: c._count.members,
      other: other ? { id: other.id, name: other.name, online: isOnline(other.id), active: other.isActive } : null,
      lastSeq: c.lastSeq,
      lastMessageAt: c.lastMessageAt ?? c.createdAt,
      lastMessage: lastById.get(c.id) ?? null,
      unread: unreadById.get(c.id) ?? 0,
      me: {
        role: m.role,
        active: m.leftAt === null,
        lastReadSeq: m.lastReadSeq,
        mutedUntil: m.mutedUntil,
      },
    }
  })

  return NextResponse.json({ conversations, me })
}

const createSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("DIRECT"), userId: z.coerce.number().int().positive() }),
  z.object({
    type: z.literal("GROUP"),
    name: z.string().trim().min(1, "Give the group a name").max(120),
    description: z.string().trim().max(2000).optional(),
    memberIds: z.array(z.coerce.number().int().positive()).max(256).default([]),
  }),
])

export async function POST(request: NextRequest) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const me = auth.userId

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }
  const input = parsed.data

  if (input.type === "DIRECT") {
    if (!(await can(auth.session, "chat", "create"))) {
      return NextResponse.json({ error: "You cannot start new conversations" }, { status: 403 })
    }
    if (input.userId === me) {
      return NextResponse.json({ error: "You cannot start a conversation with yourself" }, { status: 422 })
    }
    const [target] = await eligibleUserIds([input.userId])
    if (!target) {
      return NextResponse.json({ error: "That person is not available for chat" }, { status: 404 })
    }

    // One DM per pair, enforced by a unique key rather than by checking first.
    const directKey = `${Math.min(me, target)}:${Math.max(me, target)}`
    const existing = await prisma.conversation.findUnique({ where: { directKey }, select: { id: true } })
    if (existing) return NextResponse.json({ id: existing.id, created: false })

    try {
      const created = await prisma.conversation.create({
        data: {
          type: "DIRECT",
          directKey,
          createdById: me,
          members: { create: [{ userId: me }, { userId: target }] },
        },
        select: { id: true },
      })
      publish([me, target], { type: "conversation", conversationId: created.id })
      return NextResponse.json({ id: created.id, created: true }, { status: 201 })
    } catch (error) {
      // Both people opened a chat with each other at the same moment.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await prisma.conversation.findUnique({ where: { directKey }, select: { id: true } })
        if (winner) return NextResponse.json({ id: winner.id, created: false })
      }
      throw error
    }
  }

  // GROUP
  if (!(await can(auth.session, "chat_groups", "create"))) {
    return NextResponse.json({ error: "You cannot create groups" }, { status: 403 })
  }
  const others = (await eligibleUserIds(input.memberIds)).filter((id) => id !== me)

  const group = await prisma.conversation.create({
    data: {
      type: "GROUP",
      name: input.name,
      description: input.description || null,
      createdById: me,
      members: {
        create: [{ userId: me, role: "ADMIN" }, ...others.map((userId) => ({ userId }))],
      },
    },
    select: { id: true },
  })

  const creator = await prisma.user.findUnique({ where: { id: me }, select: { name: true } })
  await systemMessage(group.id, `${creator?.name ?? "Someone"} created the group "${input.name}"`)
  publish([me, ...others], { type: "conversation", conversationId: group.id })

  return NextResponse.json({ id: group.id, created: true, skipped: input.memberIds.length - others.length }, { status: 201 })
}
