import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { rateLimited } from "@/lib/realtime/hub"
import { MESSAGE_SELECT, publishToConversation, readOnly, toWire, tooFast, visibleMessage } from "@/lib/chat/service"

/** Toggle an emoji reaction. Same emoji again removes it. */
export const dynamic = "force-dynamic"

// One emoji (with any skin tone or ZWJ sequence), not arbitrary text.
const schema = z.object({
  emoji: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .refine((v) => /^\p{Extended_Pictographic}/u.test(v) && !/[\p{L}\p{N}\s]/u.test(v), "That is not an emoji"),
})

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Choose an emoji" }, { status: 422 })

  const found = await visibleMessage(id, auth.userId)
  if (!found) return NextResponse.json({ error: "Message not found" }, { status: 404 })
  if (!found.access.active) return readOnly()
  if (found.msg.deletedAt || found.msg.type === "SYSTEM") {
    return NextResponse.json({ error: "You cannot react to that message" }, { status: 422 })
  }
  if (rateLimited(auth.userId, "chat:react", 30, 10_000)) return tooFast()

  const key = { messageId_userId_emoji: { messageId: id, userId: auth.userId, emoji: parsed.data.emoji } }
  const existing = await prisma.chatReaction.findUnique({ where: key, select: { id: true } })
  if (existing) {
    await prisma.chatReaction.delete({ where: { id: existing.id } })
  } else {
    await prisma.chatReaction
      .create({ data: { messageId: id, userId: auth.userId, emoji: parsed.data.emoji } })
      .catch(() => null) // a double-click racing itself: the unique key already has it
  }

  const message = toWire(await prisma.chatMessage.findUniqueOrThrow({ where: { id }, select: MESSAGE_SELECT }))
  await publishToConversation(found.msg.conversationId, {
    type: "message_updated",
    conversationId: found.msg.conversationId,
    message,
  })
  return NextResponse.json({ message })
}
