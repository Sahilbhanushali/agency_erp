import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { can, requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { rateLimited } from "@/lib/realtime/hub"
import {
  MESSAGE_SELECT,
  memberAccess,
  notFound,
  readOnly,
  sendMessage,
  toWire,
  tooFast,
  type NewAttachment,
} from "@/lib/chat/service"
import { AttachmentRuleError, MAX_BYTES, safeDisplayName, validateAttachment } from "@/lib/chat/file-rules"
import { deleteFileForKey, newStorageKey, saveFile } from "@/lib/chat/storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PAGE = 50
const CATCH_UP_MAX = 200
const MAX_BODY = 4000
/** Ceiling checked before the file is read, so a huge upload is refused cheaply. */
const HARD_MAX_BYTES = Math.max(...Object.values(MAX_BYTES))

/**
 * Message history.
 *   ?before=<seq>  older messages, for scrolling up
 *   ?after=<seq>   newer messages, for catching up after a reconnect or scrolling down
 *                  from an older window; `truncated` doubles as "there are more"
 *   ?around=<seq>  a window centred on one message, for jumping to a search hit; says
 *                  whether there is more history on each side
 *   (none)         the latest page
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const access = await memberAccess(id, auth.userId)
  if (!access) return notFound()

  const sp = request.nextUrl.searchParams
  const before = Number(sp.get("before")) || null
  const after = sp.has("after") ? Number(sp.get("after")) : null
  const around = Number(sp.get("around")) || null

  // Someone who has left reads the history up to the moment they left, and no further.
  const ceiling = access.maxSeq !== null ? { lte: access.maxSeq } : {}
  // And a floor for someone who cleared the chat: what they cleared stays cleared.
  const floor = access.clearedSeq

  if (around !== null && Number.isFinite(around)) {
    const HALF = PAGE / 2
    const [older, newer] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { conversationId: id, seq: { lte: around, gt: floor, ...ceiling } },
        select: MESSAGE_SELECT,
        orderBy: { seq: "desc" },
        take: HALF + 1,
      }),
      prisma.chatMessage.findMany({
        where: { conversationId: id, seq: { gt: Math.max(around, floor), ...ceiling } },
        select: MESSAGE_SELECT,
        orderBy: { seq: "asc" },
        take: HALF + 1,
      }),
    ])
    return NextResponse.json({
      messages: [...older.slice(0, HALF).reverse(), ...newer.slice(0, HALF)].map(toWire),
      hasMore: older.length > HALF,
      hasNewer: newer.length > HALF,
      access: { active: access.active, role: access.role, lastReadSeq: access.lastReadSeq },
    })
  }

  if (after !== null && Number.isFinite(after)) {
    const rows = await prisma.chatMessage.findMany({
      where: { conversationId: id, seq: { gt: Math.max(after, floor), ...ceiling } },
      select: MESSAGE_SELECT,
      orderBy: { seq: "asc" },
      take: CATCH_UP_MAX + 1,
    })
    return NextResponse.json({
      messages: rows.slice(0, CATCH_UP_MAX).map(toWire),
      // More than this means the client was away long enough to just reload the page.
      truncated: rows.length > CATCH_UP_MAX,
    })
  }

  const rows = await prisma.chatMessage.findMany({
    where: {
      conversationId: id,
      seq: { ...(before ? { lt: before } : {}), gt: floor, ...ceiling },
    },
    select: MESSAGE_SELECT,
    orderBy: { seq: "desc" },
    take: PAGE + 1,
  })
  const hasMore = rows.length > PAGE
  return NextResponse.json({
    messages: rows.slice(0, PAGE).reverse().map(toWire),
    hasMore,
    access: { active: access.active, role: access.role, lastReadSeq: access.lastReadSeq },
  })
}

const textSchema = z.object({
  body: z.string().max(MAX_BODY, `Keep messages under ${MAX_BODY} characters`).optional().default(""),
  clientId: z.string().trim().min(8).max(64).optional(),
  replyToId: z.string().trim().max(40).optional().nullable(),
})

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const me = auth.userId

  const access = await memberAccess(id, me)
  if (!access) return notFound()
  if (!access.active) return readOnly()

  if (rateLimited(me, "chat:send", 30, 10_000)) return tooFast()

  const isMultipart = (request.headers.get("content-type") ?? "").includes("multipart/form-data")

  let fields: z.infer<typeof textSchema>
  let file: File | null = null

  if (isMultipart) {
    if (!(await can(auth.session, "chat", "share"))) {
      return NextResponse.json({ error: "You cannot send attachments" }, { status: 403 })
    }
    if (rateLimited(me, "chat:upload", 10, 60_000)) return tooFast()

    const form = await request.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: "Could not read the upload" }, { status: 400 })
    const f = form.get("file")
    if (!(f instanceof File)) return NextResponse.json({ error: "No file was attached" }, { status: 422 })
    file = f
    const parsed = textSchema.safeParse({
      body: form.get("body") ?? "",
      clientId: form.get("clientId") ?? undefined,
      replyToId: form.get("replyToId") || null,
    })
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })
    fields = parsed.data
  } else {
    const parsed = textSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 422 })
    fields = parsed.data
  }

  const body = fields.body.trim()
  if (!body && !file) return NextResponse.json({ error: "Type a message or attach a file" }, { status: 422 })

  // A reply must point at a message in this same conversation that the sender can see.
  if (fields.replyToId) {
    const target = await prisma.chatMessage.findFirst({
      where: { id: fields.replyToId, conversationId: id },
      select: { id: true },
    })
    if (!target) return NextResponse.json({ error: "The message you replied to is not in this conversation" }, { status: 422 })
  }

  let attachment: NewAttachment | undefined
  if (file) {
    if (file.size > HARD_MAX_BYTES) {
      return NextResponse.json({ error: `Files are limited to ${HARD_MAX_BYTES / 1024 / 1024} MB` }, { status: 413 })
    }
    try {
      // The type comes from the bytes; file.type (the client's claim) is never read.
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
      if (error instanceof AttachmentRuleError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      console.error("[chat] upload failed:", error)
      return NextResponse.json({ error: "Could not store the file" }, { status: 500 })
    }
  }

  try {
    const { message, duplicate } = await sendMessage({
      conversationId: id,
      senderId: me,
      type: attachment ? "ATTACHMENT" : "TEXT",
      body: body || null,
      replyToId: fields.replyToId ?? null,
      clientId: fields.clientId ?? null,
      attachments: attachment ? [attachment] : undefined,
    })
    // A retried upload stored a second copy of the file that nothing points to.
    if (duplicate && attachment) await deleteFileForKey(attachment.storageKey)
    return NextResponse.json({ message, duplicate }, { status: duplicate ? 200 : 201 })
  } catch (error) {
    if (attachment) await deleteFileForKey(attachment.storageKey)
    console.error("[chat] send failed:", error)
    return NextResponse.json({ error: "Could not send the message" }, { status: 500 })
  }
}
