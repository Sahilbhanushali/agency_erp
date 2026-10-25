import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { chatEligibleUserWhere } from "@/lib/chat/service"

/**
 * Search chats, people and messages — only within history the caller may read.
 * Conversations they left are searched up to the moment they left.
 *
 *   ?q=invoice march          every word must appear, in any order ("march invoice" too)
 *   &conversationId=<id>      only this conversation: the in-thread search, which needs
 *                             every hit (oldest→newest) to step through, not a summary
 *   &offset=<n>               next page of message hits in the global search
 *
 * Messages match on their text or on an attached file's name, so "brief.pdf" finds the
 * message that carried it.
 */
export const dynamic = "force-dynamic"

const Query = z.object({
  q: z.string().trim().max(100).default(""),
  conversationId: z.string().max(64).optional(),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
})

const PAGE = 30
const IN_THREAD_MAX = 500

export async function GET(request: NextRequest) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const me = auth.userId

  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Invalid search" }, { status: 400 })
  const { q, conversationId, offset } = parsed.data

  const empty = { conversations: [], people: [], messages: [], hasMore: false }
  // ponytail: LIKE '%term%' per word, fine for an agency's volume; a FULLTEXT index on
  // chat_messages.body is the upgrade if search ever gets slow.
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 6)
  if (q.length < 2) return NextResponse.json(empty)

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: me, ...(conversationId ? { conversationId } : {}) },
    select: { conversationId: true, leftAt: true, leftAtSeq: true, clearedSeq: true, hiddenAt: true },
  })
  if (memberships.length === 0) {
    // Not a member of that conversation reads exactly like "nothing found".
    return NextResponse.json(empty)
  }

  // Per conversation: nothing they cleared, nothing after they left.
  const scope: Prisma.ChatMessageWhereInput[] = memberships.map((m) => ({
    conversationId: m.conversationId,
    seq: { gt: m.clearedSeq, ...(m.leftAt ? { lte: m.leftAtSeq ?? 0 } : {}) },
  }))
  const messageWhere: Prisma.ChatMessageWhereInput = {
    AND: [
      { OR: scope },
      { deletedAt: null, type: { not: "SYSTEM" } },
      {
        OR: [
          { AND: terms.map((t) => ({ body: { contains: t } })) },
          { attachments: { some: { originalName: { contains: q } } } },
        ],
      },
    ],
  }

  const messageSelect = {
    id: true,
    conversationId: true,
    seq: true,
    body: true,
    createdAt: true,
    sender: { select: { name: true } },
    attachments: { select: { originalName: true, kind: true }, take: 1 },
  } satisfies Prisma.ChatMessageSelect

  // In one conversation: every hit, so the thread can show "3 of 12" and step through.
  if (conversationId) {
    const rows = await prisma.chatMessage.findMany({
      where: messageWhere,
      select: messageSelect,
      orderBy: { seq: "asc" },
      take: IN_THREAD_MAX,
    })
    return NextResponse.json({
      conversations: [],
      people: [],
      messages: rows.map((m) => wire(m, null)),
      hasMore: false,
    })
  }

  // Chats you deleted are not offered by name; their newer messages still match below.
  const ids = memberships.filter((m) => !m.hiddenAt).map((m) => m.conversationId)
  const titleSelect = {
    type: true,
    name: true,
    members: { where: { userId: { not: me } }, select: { user: { select: { id: true, name: true } } }, take: 1 },
  } satisfies Prisma.ConversationSelect

  const [conversations, people, messages] = await Promise.all([
    offset > 0
      ? []
      : prisma.conversation.findMany({
          where: {
            id: { in: ids },
            OR: [
              { type: "GROUP", AND: terms.map((t) => ({ name: { contains: t } })) },
              // A DM is found by the other person's name.
              { type: "DIRECT", members: { some: { userId: { not: me }, user: { AND: terms.map((t) => ({ name: { contains: t } })) } } } },
            ],
          },
          select: { id: true, ...titleSelect },
          orderBy: { lastMessageAt: "desc" },
          take: 10,
        }),
    // Colleagues to start a chat with, whether or not you have talked before.
    offset > 0
      ? []
      : prisma.user.findMany({
          where: {
            ...chatEligibleUserWhere,
            id: { not: me },
            AND: terms.map((t) => ({ OR: [{ name: { contains: t } }, { email: { contains: t } }] })),
          },
          select: { id: true, name: true, avatar: true, role: { select: { name: true } } },
          orderBy: { name: "asc" },
          take: 8,
        }),
    prisma.chatMessage.findMany({
      where: messageWhere,
      select: { ...messageSelect, conversation: { select: titleSelect } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: offset,
      take: PAGE + 1,
    }),
  ])

  const titleOf = (c: { type: string; name: string | null; members: { user: { name: string } }[] }) =>
    c.type === "DIRECT" ? (c.members[0]?.user.name ?? "Former member") : (c.name ?? "Group")

  // People you already have a DM with show up under Chats; listing them twice is noise.
  const dmWith = new Set(conversations.filter((c) => c.type === "DIRECT").map((c) => c.members[0]?.user.id))

  return NextResponse.json({
    conversations: conversations.map((c) => ({ id: c.id, type: c.type, name: titleOf(c) })),
    people: people
      .filter((p) => !dmWith.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, role: p.role?.name ?? null })),
    messages: messages.slice(0, PAGE).map((m) => wire(m, titleOf(m.conversation))),
    hasMore: messages.length > PAGE,
  })
}

function wire(
  m: {
    id: string
    conversationId: string
    seq: number
    body: string | null
    createdAt: Date
    sender: { name: string } | null
    attachments: { originalName: string; kind: string }[]
  },
  conversationName: string | null,
) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    seq: m.seq,
    body: m.body,
    fileName: m.attachments[0]?.originalName ?? null,
    createdAt: m.createdAt,
    senderName: m.sender?.name ?? null,
    conversationName,
  }
}
