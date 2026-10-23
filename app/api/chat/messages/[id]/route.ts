import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { MESSAGE_SELECT, publishToConversation, readOnly, toWire, visibleMessage } from "@/lib/chat/service"
import { deleteFileForKey } from "@/lib/chat/storage"

export const dynamic = "force-dynamic"

const notFound = () => NextResponse.json({ error: "Message not found" }, { status: 404 })
const editSchema = z.object({ body: z.string().trim().min(1, "A message cannot be empty").max(4000) })

/** Edit your own message. Never someone else's, whatever your role. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "update")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const found = await visibleMessage(id, auth.userId)
  if (!found) return notFound()
  const { msg, access } = found
  if (!access.active) return readOnly()
  if (msg.senderId !== auth.userId || msg.type === "SYSTEM") {
    return NextResponse.json({ error: "You can only edit your own messages" }, { status: 403 })
  }
  if (msg.deletedAt) return NextResponse.json({ error: "That message was deleted" }, { status: 409 })

  const parsed = editSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })

  const row = await prisma.chatMessage.update({
    where: { id },
    data: { body: parsed.data.body, editedAt: new Date() },
    select: MESSAGE_SELECT,
  })
  const message = toWire(row)
  await publishToConversation(msg.conversationId, { type: "message_updated", conversationId: msg.conversationId, message })
  return NextResponse.json({ message })
}

/**
 * Delete your own message. The content really goes — text cleared, attachment files
 * removed from disk — and a "message deleted" placeholder keeps its place in the order.
 */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "delete")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const found = await visibleMessage(id, auth.userId)
  if (!found) return notFound()
  const { msg, access } = found
  if (!access.active) return readOnly()
  if (msg.senderId !== auth.userId || msg.type === "SYSTEM") {
    return NextResponse.json({ error: "You can only delete your own messages" }, { status: 403 })
  }
  if (msg.deletedAt) return NextResponse.json({ ok: true })

  const files = await prisma.chatAttachment.findMany({ where: { messageId: id }, select: { storageKey: true } })
  const row = await prisma.$transaction(async (tx) => {
    await tx.chatAttachment.deleteMany({ where: { messageId: id } })
    await tx.chatReaction.deleteMany({ where: { messageId: id } })
    return tx.chatMessage.update({
      where: { id },
      data: { body: null, deletedAt: new Date() },
      select: MESSAGE_SELECT,
    })
  })
  await Promise.all(files.map((f) => deleteFileForKey(f.storageKey)))

  const message = toWire(row)
  await publishToConversation(msg.conversationId, { type: "message_updated", conversationId: msg.conversationId, message })
  return NextResponse.json({ message })
}
