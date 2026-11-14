import { NextResponse, type NextRequest } from "next/server"
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
} from "@/lib/chat/service"
import { deleteFileForKey } from "@/lib/chat/storage"
import { readOutgoingMessage } from "@/lib/chat/send-request"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PAGE = 50
const CATCH_UP_MAX = 200

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
  const read = await readOutgoingMessage(request, {
    conversationId: id,
    senderId: me,
    mayAttach: !isMultipart || (await can(auth.session, "chat", "share")),
  })
  if (!read.ok) return read.response
  const { body, attachment, replyToId, clientId } = read.message

  try {
    const { message, duplicate } = await sendMessage({
      conversationId: id,
      senderId: me,
      type: attachment ? "ATTACHMENT" : "TEXT",
      body: body || null,
      replyToId,
      clientId,
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
