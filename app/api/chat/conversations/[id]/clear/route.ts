import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { publish } from "@/lib/realtime/hub"
import { memberAccess, notFound } from "@/lib/chat/service"

export const dynamic = "force-dynamic"

const schema = z.object({
  /** false: "Clear chat" — empty it, keep it in the list. true: "Delete chat" — also remove it from the list. */
  delete: z.boolean().default(false),
})

/**
 * Clear or delete a chat for yourself, as in WhatsApp. Everyone else keeps every
 * message: nothing is deleted from the conversation, the caller's membership just
 * remembers what they no longer want to see.
 *
 * Deleting a group you are still in is refused — leave it first, or other members
 * would keep messaging someone who can no longer see the chat.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 })

  const access = await memberAccess(id, auth.userId)
  if (!access) return notFound()

  const conv = await prisma.conversation.findUnique({ where: { id }, select: { type: true, lastSeq: true } })
  if (!conv) return notFound()
  if (parsed.data.delete && conv.type === "GROUP" && access.active) {
    return NextResponse.json({ error: "Leave the group first, then delete it from your chats." }, { status: 409 })
  }

  // Up to the last message they could see; for someone who left, the moment they left.
  const seq = access.maxSeq ?? conv.lastSeq
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: id, userId: auth.userId } },
    data: {
      clearedSeq: Math.max(seq, access.clearedSeq),
      // Nothing cleared is unread any more.
      lastReadSeq: Math.max(seq, access.lastReadSeq),
      ...(parsed.data.delete ? { hiddenAt: new Date() } : {}),
    },
  })

  // The caller's other tabs empty the thread too.
  publish([auth.userId], { type: "cleared", conversationId: id, seq, hidden: parsed.data.delete })
  return NextResponse.json({ clearedSeq: seq, hidden: parsed.data.delete })
}
