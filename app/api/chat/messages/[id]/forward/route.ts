import { NextResponse, type NextRequest } from "next/server"
import { copyFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { can, requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { rateLimited } from "@/lib/realtime/hub"
import { memberAccess, sendMessage, tooFast, visibleMessage, type NewAttachment } from "@/lib/chat/service"
import { newStorageKey, pathForKey } from "@/lib/chat/storage"
import { extensionOf } from "@/lib/chat/file-rules"

/**
 * Forward a message into other conversations.
 *
 * You must be able to read the original and be a current member of every destination.
 * The text and files are copied, not linked: forwarding never gives anyone access to
 * the conversation it came from, and deleting the original does not break the copy.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ conversationIds: z.array(z.string().trim().min(1)).min(1).max(5) })

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Choose up to 5 conversations" }, { status: 422 })
  if (rateLimited(auth.userId, "chat:forward", 10, 60_000)) return tooFast()

  const found = await visibleMessage(id, auth.userId)
  if (!found || found.msg.deletedAt || found.msg.type === "SYSTEM") {
    return NextResponse.json({ error: "That message cannot be forwarded" }, { status: 404 })
  }

  const source = await prisma.chatMessage.findUniqueOrThrow({
    where: { id },
    select: { body: true, attachments: { select: { storageKey: true, originalName: true, mimeType: true, size: true, kind: true } } },
  })
  if (source.attachments.length > 0 && !(await can(auth.session, "chat", "share"))) {
    return NextResponse.json({ error: "You cannot send attachments" }, { status: 403 })
  }

  // Every destination is checked before anything is sent, so a bad id fails the whole
  // request instead of forwarding to some conversations and not others.
  const targets = [...new Set(parsed.data.conversationIds)]
  for (const cid of targets) {
    const access = await memberAccess(cid, auth.userId)
    if (!access?.active) return NextResponse.json({ error: "You cannot post in one of those conversations" }, { status: 403 })
  }

  let sent = 0
  for (const cid of targets) {
    const copies: NewAttachment[] = []
    for (const a of source.attachments) {
      const key = newStorageKey(extensionOf(a.storageKey))
      const dest = pathForKey(key)
      await mkdir(path.dirname(dest), { recursive: true })
      await copyFile(pathForKey(a.storageKey), dest)
      copies.push({ storageKey: key, originalName: a.originalName, mimeType: a.mimeType, size: a.size, kind: a.kind })
    }
    await sendMessage({
      conversationId: cid,
      senderId: auth.userId,
      type: copies.length ? "ATTACHMENT" : "TEXT",
      body: source.body,
      forwarded: true,
      attachments: copies,
    })
    sent++
  }
  return NextResponse.json({ forwarded: sent })
}
