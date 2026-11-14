import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { isClientContact, requireSession } from "@/lib/api-auth"
import { assertPostAccess, workflowErrorResponse } from "@/lib/posts/workflow"
import { rateLimited } from "@/lib/realtime/hub"
import { MESSAGE_SELECT, sendMessage, toWire, tooFast } from "@/lib/chat/service"
import { deleteFileForKey } from "@/lib/chat/storage"
import { readOutgoingMessage } from "@/lib/chat/send-request"
import { notifyDiscussion, openPostDiscussion, syncDiscussionMembers } from "@/lib/chat/approval"
import type { Session } from "next-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PAGE = 50

/**
 * The approval discussion of one post, for anyone who may read the post (client
 * contacts excluded: they decide through share links). Opening it makes the caller a
 * participant so they are notified of later messages.
 */
async function authorize(session: Session, userId: number, postId: string): Promise<NextResponse | null> {
  try {
    await assertPostAccess(session, userId, postId, "read")
  } catch (error) {
    return workflowErrorResponse(error)
  }
  if (await isClientContact(session)) {
    return NextResponse.json({ error: "Discussions are internal to the agency team." }, { status: 403 })
  }
  return null
}

const querySchema = z.object({ before: z.coerce.number().int().positive().optional() })

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id: postId } = await params
  const denied = await authorize(auth.session, auth.userId, postId)
  if (denied) return denied

  const query = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!query.success) return NextResponse.json({ error: "Invalid page" }, { status: 400 })

  try {
    const conversationId = await openPostDiscussion(postId, auth.userId)
    const before = query.data.before

    const [rows, me, participants] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { conversationId, ...(before ? { seq: { lt: before } } : {}) },
        orderBy: { seq: "desc" },
        take: PAGE + 1,
        select: MESSAGE_SELECT,
      }),
      prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: auth.userId } },
        select: { lastReadSeq: true },
      }),
      prisma.conversationMember.findMany({
        where: { conversationId, leftAt: null },
        select: { user: { select: { id: true, name: true, avatar: true, role: { select: { name: true } } } } },
      }),
    ])
    const lastReadSeq = me?.lastReadSeq ?? 0
    const unread = await prisma.chatMessage.count({
      where: { conversationId, seq: { gt: lastReadSeq }, type: { not: "SYSTEM" }, senderId: { not: auth.userId }, deletedAt: null },
    })

    return NextResponse.json({
      conversationId,
      messages: rows.slice(0, PAGE).reverse().map(toWire),
      hasMore: rows.length > PAGE,
      lastReadSeq,
      unread,
      participants: participants.map(({ user }) => ({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        role: user.role?.name ?? null,
      })),
    })
  } catch (error) {
    console.error("[post-discussion] load failed:", { postId, error })
    return NextResponse.json({ error: "Could not load the discussion" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id: postId } = await params
  const denied = await authorize(auth.session, auth.userId, postId)
  if (denied) return denied
  if (rateLimited(auth.userId, "chat:send", 30, 10_000)) return tooFast()

  const conversationId = await openPostDiscussion(postId, auth.userId)
  const read = await readOutgoingMessage(request, { conversationId, senderId: auth.userId, mayAttach: true })
  if (!read.ok) return read.response
  const { body, attachment, replyToId, clientId } = read.message

  let sent: Awaited<ReturnType<typeof sendMessage>>
  try {
    sent = await sendMessage({
      conversationId,
      senderId: auth.userId,
      type: attachment ? "ATTACHMENT" : "TEXT",
      body: body || null,
      replyToId,
      clientId,
      attachments: attachment ? [attachment] : undefined,
    })
    if (sent.duplicate && attachment) await deleteFileForKey(attachment.storageKey)
  } catch (error) {
    if (attachment) await deleteFileForKey(attachment.storageKey)
    console.error("[post-discussion] send failed:", { postId, error })
    return NextResponse.json({ error: "Could not send the message" }, { status: 500 })
  }

  if (!sent.duplicate) {
    // Delivery is best effort: the message is saved either way.
    try {
      await syncDiscussionMembers(conversationId, postId)
      await notifyDiscussion({
        conversationId,
        postId,
        senderId: auth.userId,
        senderName: auth.session.user?.name ?? "Someone",
        preview: body || `Sent ${attachment?.originalName ?? "a file"}`,
      })
    } catch (error) {
      console.error("[post-discussion] notify failed:", { postId, error })
    }
  }
  return NextResponse.json({ message: sent.message, duplicate: sent.duplicate }, { status: sent.duplicate ? 200 : 201 })
}
