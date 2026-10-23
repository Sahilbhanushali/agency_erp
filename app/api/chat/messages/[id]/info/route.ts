import { NextResponse, type NextRequest } from "next/server"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { notFound, visibleMessage } from "@/lib/chat/service"

export const dynamic = "force-dynamic"

/**
 * Message info, as in WhatsApp: for a message you sent, who it reached and who read
 * it, and when. Only the sender may ask — who read what is theirs to know.
 *
 * Times come from chat_receipt_marks. A message older than that table still shows
 * read/delivered (from the members' markers), just without a time.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const found = await visibleMessage(id, auth.userId)
  // Someone else's message answers exactly like a missing one.
  if (!found || found.msg.senderId !== auth.userId || found.msg.type === "SYSTEM") return notFound()
  const { msg } = found

  const [detail, members, marks] = await Promise.all([
    prisma.chatMessage.findUnique({ where: { id }, select: { createdAt: true, editedAt: true, deletedAt: true } }),
    prisma.conversationMember.findMany({
      where: {
        conversationId: msg.conversationId,
        userId: { not: auth.userId },
        // Everyone who was in the conversation when it was sent and has not left
        // before it — someone added later never had it to read.
        OR: [{ leftAt: null }, { leftAtSeq: { gte: msg.seq } }],
      },
      select: {
        joinedAt: true,
        lastReadSeq: true,
        lastDeliveredSeq: true,
        leftAt: true,
        user: { select: { id: true, name: true, avatar: true } },
      },
    }),
    prisma.chatReceiptMark.findMany({
      where: { conversationId: msg.conversationId, fromSeq: { lt: msg.seq }, toSeq: { gte: msg.seq } },
      select: { userId: true, kind: true, at: true },
      orderBy: { at: "asc" },
    }),
  ])
  if (!detail) return notFound()

  const firstAt = (userId: number, kind: string) => marks.find((m) => m.userId === userId && m.kind === kind)?.at ?? null

  const people = members
    .filter((m) => m.joinedAt <= detail.createdAt || m.lastDeliveredSeq >= msg.seq)
    .map((m) => {
      const read = m.lastReadSeq >= msg.seq
      const delivered = read || m.lastDeliveredSeq >= msg.seq
      return {
        id: m.user.id,
        name: m.user.name,
        avatar: m.user.avatar,
        left: !!m.leftAt,
        status: read ? "read" : delivered ? "delivered" : "sent",
        readAt: read ? firstAt(m.user.id, "READ") : null,
        // A message read without a delivered mark was delivered when it was read.
        deliveredAt: delivered ? (firstAt(m.user.id, "DELIVERED") ?? firstAt(m.user.id, "READ")) : null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({
    sentAt: detail.createdAt,
    editedAt: detail.editedAt,
    deleted: !!detail.deletedAt,
    people,
  })
}
