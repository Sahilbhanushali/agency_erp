import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { rateLimited } from "@/lib/realtime/hub"
import { tooFast, type NewAttachment } from "@/lib/chat/service"
import { AttachmentRuleError, MAX_BYTES, safeDisplayName, validateAttachment } from "@/lib/chat/file-rules"
import { newStorageKey, saveFile } from "@/lib/chat/storage"

export const MAX_BODY = 4000
/** Ceiling checked before the file is read, so a huge upload is refused cheaply. */
const HARD_MAX_BYTES = Math.max(...Object.values(MAX_BYTES))

const textSchema = z.object({
  body: z.string().max(MAX_BODY, `Keep messages under ${MAX_BODY} characters`).optional().default(""),
  clientId: z.string().trim().min(8).max(64).optional(),
  replyToId: z.string().trim().max(40).optional().nullable(),
})

export type OutgoingMessage = {
  body: string
  clientId: string | null
  replyToId: string | null
  attachment?: NewAttachment
}

/**
 * Reads and validates a message a member wants to send — JSON text, or multipart with
 * one file — shared by chat and approval discussions so both apply the same rules.
 * The file's type is decided from its bytes; the client's claimed type is never read.
 * On success the file is already stored: the caller must delete it if sending fails.
 */
export async function readOutgoingMessage(
  request: NextRequest,
  options: { conversationId: string; senderId: number; mayAttach: boolean },
): Promise<{ ok: true; message: OutgoingMessage } | { ok: false; response: NextResponse }> {
  const fail = (error: string, status: number) => ({ ok: false as const, response: NextResponse.json({ error }, { status }) })
  const isMultipart = (request.headers.get("content-type") ?? "").includes("multipart/form-data")

  let fields: z.infer<typeof textSchema>
  let file: File | null = null

  if (isMultipart) {
    if (!options.mayAttach) return fail("You cannot send attachments", 403)
    if (rateLimited(options.senderId, "chat:upload", 10, 60_000)) return { ok: false, response: tooFast() }

    const form = await request.formData().catch(() => null)
    if (!form) return fail("Could not read the upload", 400)
    const f = form.get("file")
    if (!(f instanceof File)) return fail("No file was attached", 422)
    file = f
    const parsed = textSchema.safeParse({
      body: form.get("body") ?? "",
      clientId: form.get("clientId") ?? undefined,
      replyToId: form.get("replyToId") || null,
    })
    if (!parsed.success) return fail(parsed.error.issues[0].message, 422)
    fields = parsed.data
  } else {
    const parsed = textSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422)
    fields = parsed.data
  }

  const body = fields.body.trim()
  if (!body && !file) return fail("Type a message or attach a file", 422)

  // A reply must point at a message in this same conversation that the sender can see.
  if (fields.replyToId) {
    const target = await prisma.chatMessage.findFirst({
      where: { id: fields.replyToId, conversationId: options.conversationId },
      select: { id: true },
    })
    if (!target) return fail("The message you replied to is not in this conversation", 422)
  }

  let attachment: NewAttachment | undefined
  if (file) {
    if (file.size > HARD_MAX_BYTES) return fail(`Files are limited to ${HARD_MAX_BYTES / 1024 / 1024} MB`, 413)
    try {
      const head = new Uint8Array(await file.slice(0, 4100).arrayBuffer())
      const type = validateAttachment(head, file.name, file.size)
      const key = newStorageKey(type.ext)
      await saveFile(key, new Uint8Array(await file.arrayBuffer()))
      attachment = {
        storageKey: key,
        originalName: safeDisplayName(file.name),
        mimeType: type.mime,
        size: file.size,
        kind: type.kind,
      }
    } catch (error) {
      if (error instanceof AttachmentRuleError) return fail(error.message, error.status)
      console.error("[chat] upload failed:", error)
      return fail("Could not store the file", 500)
    }
  }

  return {
    ok: true,
    message: { body, clientId: fields.clientId ?? null, replyToId: fields.replyToId ?? null, attachment },
  }
}
