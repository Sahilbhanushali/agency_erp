import { NextResponse, type NextRequest } from "next/server"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

/**
 * Search conversations by name and messages by text — only within history the caller
 * may read. Conversations they left are searched up to the moment they left.
 */
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const me = auth.userId

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100)
  if (q.length < 2) return NextResponse.json({ conversations: [], messages: [] })

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: me },
    select: { conversationId: true, leftAt: true, leftAtSeq: true },
  })
  if (memberships.length === 0) return NextResponse.json({ conversations: [], messages: [] })

  const active = memberships.filter((m) => !m.leftAt).map((m) => m.conversationId)
  const left = memberships.filter((m) => m.leftAt)
  const scope = [
    ...(active.length ? [{ conversationId: { in: active } }] : []),
    ...left.map((m) => ({ conversationId: m.conversationId, seq: { lte: m.leftAtSeq ?? 0 } })),
  ]
  const ids = memberships.map((m) => m.conversationId)

  const [conversations, messages] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        id: { in: ids },
        OR: [
          { type: "GROUP", name: { contains: q } },
          // A DM is found by the other person's name.
          { type: "DIRECT", members: { some: { userId: { not: me }, user: { name: { contains: q } } } } },
        ],
      },
      select: {
        id: true,
        type: true,
        name: true,
        members: { where: { userId: { not: me } }, select: { user: { select: { name: true } } }, take: 1 },
      },
      take: 10,
    }),
    prisma.chatMessage.findMany({
      where: { OR: scope, body: { contains: q }, deletedAt: null, type: { not: "SYSTEM" } },
      select: {
        id: true,
        conversationId: true,
        seq: true,
        body: true,
        createdAt: true,
        sender: { select: { name: true } },
        conversation: {
          select: {
            type: true,
            name: true,
            members: { where: { userId: { not: me } }, select: { user: { select: { name: true } } }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ])

  const titleOf = (c: { type: string; name: string | null; members: { user: { name: string } }[] }) =>
    c.type === "DIRECT" ? (c.members[0]?.user.name ?? "Former member") : (c.name ?? "Group")

  return NextResponse.json({
    conversations: conversations.map((c) => ({ id: c.id, type: c.type, name: titleOf(c) })),
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      seq: m.seq,
      body: m.body,
      createdAt: m.createdAt,
      senderName: m.sender?.name ?? null,
      conversationName: titleOf(m.conversation),
    })),
  })
}
