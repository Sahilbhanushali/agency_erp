import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isOnline, publish, type ChatEvent } from "@/lib/realtime/hub"

/**
 * The rules every chat route shares, so none of them has to remember them.
 *
 * Access is membership. A conversation id, message id or attachment id from the client
 * is only ever looked up together with the caller's membership; a member who has left
 * keeps the history up to the moment they left and nothing after it.
 */

export interface Access {
  active: boolean
  role: "MEMBER" | "ADMIN"
  /** Highest seq this person may read. Null while they are a current member. */
  maxSeq: number | null
  lastReadSeq: number
  mutedUntil: Date | null
}

export async function memberAccess(conversationId: string, userId: number): Promise<Access | null> {
  const m = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { role: true, leftAt: true, leftAtSeq: true, lastReadSeq: true, mutedUntil: true },
  })
  if (!m) return null
  return {
    active: m.leftAt === null,
    role: m.role,
    maxSeq: m.leftAt === null ? null : (m.leftAtSeq ?? 0),
    lastReadSeq: m.lastReadSeq,
    mutedUntil: m.mutedUntil,
  }
}

/** 404 rather than 403: an outsider learns nothing about whether a conversation exists. */
export const notFound = () => NextResponse.json({ error: "Conversation not found" }, { status: 404 })
export const readOnly = () =>
  NextResponse.json({ error: "You are no longer a member of this conversation" }, { status: 403 })
export const tooFast = () =>
  NextResponse.json({ error: "You are doing that too quickly. Wait a moment and try again." }, { status: 429 })

export async function activeMemberIds(conversationId: string): Promise<number[]> {
  const rows = await prisma.conversationMember.findMany({
    where: { conversationId, leftAt: null },
    select: { userId: true },
  })
  return rows.map((r) => r.userId)
}

/** Publish to the people currently in a conversation, resolved from the database now. */
export async function publishToConversation(conversationId: string, event: ChatEvent) {
  publish(await activeMemberIds(conversationId), event)
}

// ---------------------------------------------------------------------------
// Wire format
// ---------------------------------------------------------------------------

export const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  seq: true,
  type: true,
  body: true,
  forwarded: true,
  clientId: true,
  editedAt: true,
  deletedAt: true,
  createdAt: true,
  sender: { select: { id: true, name: true, avatar: true } },
  replyTo: {
    select: {
      id: true,
      body: true,
      deletedAt: true,
      type: true,
      sender: { select: { id: true, name: true } },
      _count: { select: { attachments: true } },
    },
  },
  attachments: { select: { id: true, originalName: true, mimeType: true, size: true, kind: true } },
  reactions: { select: { emoji: true, userId: true } },
} satisfies Prisma.ChatMessageSelect

export type MessageRow = Prisma.ChatMessageGetPayload<{ select: typeof MESSAGE_SELECT }>

/** What clients receive. A deleted message keeps its place but loses its content. */
export function toWire(m: MessageRow) {
  const deleted = m.deletedAt !== null
  return {
    id: m.id,
    conversationId: m.conversationId,
    seq: m.seq,
    type: m.type,
    body: deleted ? null : m.body,
    forwarded: m.forwarded,
    clientId: m.clientId,
    editedAt: m.editedAt,
    deletedAt: m.deletedAt,
    createdAt: m.createdAt,
    sender: m.sender,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          senderName: m.replyTo.sender?.name ?? null,
          deleted: m.replyTo.deletedAt !== null,
          preview:
            m.replyTo.deletedAt !== null
              ? null
              : (m.replyTo.body?.slice(0, 160) ?? (m.replyTo._count.attachments ? "Attachment" : null)),
        }
      : null,
    attachments: deleted
      ? []
      : m.attachments.map((a) => ({
          id: a.id,
          name: a.originalName,
          mimeType: a.mimeType,
          size: a.size,
          kind: a.kind,
          url: `/api/chat/attachments/${a.id}`,
        })),
    reactions: deleted ? [] : m.reactions,
  }
}

export type WireMessage = ReturnType<typeof toWire>

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export interface NewAttachment {
  storageKey: string
  originalName: string
  mimeType: string
  size: number
  kind: "IMAGE" | "VIDEO" | "DOCUMENT" | "FILE"
}

export interface SendInput {
  conversationId: string
  senderId: number | null
  type: "TEXT" | "ATTACHMENT" | "SYSTEM"
  body?: string | null
  replyToId?: string | null
  clientId?: string | null
  forwarded?: boolean
  attachments?: NewAttachment[]
}

/**
 * Writes a message, then announces it.
 *
 * The seq comes from incrementing the conversation's counter inside the same
 * transaction, so two simultaneous senders get consecutive numbers and never the same
 * one. A clientId already used by this sender returns the original message: that is
 * what makes a retry after a dropped connection safe.
 */
export async function sendMessage(input: SendInput): Promise<{ message: WireMessage; duplicate: boolean }> {
  if (input.clientId && input.senderId !== null) {
    const existing = await prisma.chatMessage.findUnique({
      where: { senderId_clientId: { senderId: input.senderId, clientId: input.clientId } },
      select: MESSAGE_SELECT,
    })
    if (existing) return { message: toWire(existing), duplicate: true }
  }

  let row: MessageRow
  try {
    row = await prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.update({
        where: { id: input.conversationId },
        data: { lastSeq: { increment: 1 }, lastMessageAt: new Date() },
        select: { lastSeq: true },
      })
      const created = await tx.chatMessage.create({
        data: {
          conversationId: input.conversationId,
          seq: conv.lastSeq,
          type: input.type,
          senderId: input.senderId,
          body: input.body ?? null,
          replyToId: input.replyToId ?? null,
          clientId: input.clientId ?? null,
          forwarded: input.forwarded ?? false,
          attachments: input.attachments?.length ? { create: input.attachments } : undefined,
        },
        select: MESSAGE_SELECT,
      })
      // Your own message is read by you.
      if (input.senderId !== null) {
        await tx.conversationMember.updateMany({
          where: { conversationId: input.conversationId, userId: input.senderId },
          data: { lastReadSeq: conv.lastSeq },
        })
      }
      return created
    }, {
      /**
       * READ COMMITTED, deliberately. This database is MariaDB 11.8 with
       * innodb_snapshot_isolation=ON (the default since 11.6.2): under the default
       * REPEATABLE READ, a sender whose snapshot predates another sender's commit is
       * refused with error 1020 instead of waiting. Measured: 22 of 25 simultaneous
       * sends to one group failed that way. Under READ COMMITTED the increment takes
       * the row lock, waits its turn and reads the latest value — which is precisely
       * what a counter needs.
       */
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    })
  } catch (error) {
    // Two tabs racing the same retry: the loser reads the winner's row.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      input.clientId &&
      input.senderId !== null
    ) {
      const existing = await prisma.chatMessage.findUnique({
        where: { senderId_clientId: { senderId: input.senderId, clientId: input.clientId } },
        select: MESSAGE_SELECT,
      })
      if (existing) return { message: toWire(existing), duplicate: true }
    }
    throw error
  }

  const message = toWire(row)
  const members = await activeMemberIds(input.conversationId)
  publish(members, { type: "message", conversationId: input.conversationId, message })

  // Everyone with an open tab just received it: that is the grey double tick. People
  // offline get theirs when they next connect — see deliverPending().
  if (input.type !== "SYSTEM") {
    const reached = members.filter((uid) => uid !== input.senderId && isOnline(uid))
    await markDelivered(input.conversationId, reached, message.seq, members)
  }
  return { message, duplicate: false }
}

/**
 * Moves these people's delivered marker forward to `seq` and tells the conversation.
 * Conditional, so a late or repeated call can never move it backwards.
 */
export async function markDelivered(conversationId: string, userIds: number[], seq: number, audience?: number[]) {
  if (userIds.length === 0) return
  const count = await advanceReceipt(conversationId, userIds, "DELIVERED", seq)
  if (count === 0) return
  publish(audience ?? (await activeMemberIds(conversationId)), { type: "delivered", conversationId, userIds, seq })
}

/**
 * Moves read or delivered markers forward to `seq`, and records when, so Message info
 * can say "Read 14:02". Conditional: a late or repeated call never moves one backwards.
 * Returns how many members actually moved.
 */
export async function advanceReceipt(
  conversationId: string,
  userIds: number[],
  kind: "READ" | "DELIVERED",
  seq: number,
  /** A former member still clears their own unread history (capped by the caller). */
  includeLeft = false,
): Promise<number> {
  const field = kind === "READ" ? "lastReadSeq" : "lastDeliveredSeq"
  const where = { conversationId, userId: { in: userIds }, ...(includeLeft ? {} : { leftAt: null }), [field]: { lt: seq } }
  const behind = await prisma.conversationMember.findMany({
    where,
    select: { userId: true, lastReadSeq: true, lastDeliveredSeq: true },
  })
  if (behind.length === 0) return 0
  const { count } = await prisma.conversationMember.updateMany({ where, data: { [field]: seq } })
  if (count > 0) {
    // ponytail: two tabs advancing at once can log overlapping ranges; Message info
    // takes the earliest time covering a message, which is the true one.
    // The ticks above are what matter; the times are extra. A failure here (say the
    // table is not yet created on a server) must never stop messages being read.
    await prisma.chatReceiptMark
      .createMany({
        data: behind.map((m) => ({ conversationId, userId: m.userId, kind, fromSeq: m[field], toSeq: seq })),
      })
      .catch((error) => console.error("[chat] could not record receipt time", error))
  }
  return count
}

/**
 * Called when someone's tab connects: everything sent while they were offline has now
 * reached them. One query finds the conversations that are behind.
 */
export async function deliverPending(userId: number) {
  const behind = await prisma.$queryRaw<{ conversationId: string; lastSeq: number }[]>(Prisma.sql`
    SELECT cm.conversationId AS conversationId, c.lastSeq AS lastSeq
    FROM chat_members cm
    JOIN chat_conversations c ON c.id = cm.conversationId
    WHERE cm.userId = ${userId} AND cm.leftAt IS NULL AND cm.lastDeliveredSeq < c.lastSeq
  `)
  for (const row of behind) await markDelivered(row.conversationId, [userId], Number(row.lastSeq))
}

/** "Priya added Rohit." Server-written, so it cannot be forged by a client. */
export function systemMessage(conversationId: string, body: string) {
  return sendMessage({ conversationId, senderId: null, type: "SYSTEM", body })
}

/** Loads a message the caller may see, or null. Used by every message-level route. */
export async function visibleMessage(messageId: string, userId: number) {
  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, seq: true, senderId: true, deletedAt: true, type: true, body: true },
  })
  if (!msg) return null
  const access = await memberAccess(msg.conversationId, userId)
  if (!access) return null
  if (access.maxSeq !== null && msg.seq > access.maxSeq) return null
  return { msg, access }
}

// ---------------------------------------------------------------------------
// Who may be added to a chat
// ---------------------------------------------------------------------------

/**
 * Active people whose role may use chat. Mirrors can(): ADMIN, or a role granted
 * chat:read. Used both to offer people in pickers and to validate ids a client sends,
 * so nobody can be added to a conversation they would be unable to open.
 */
export const chatEligibleUserWhere: Prisma.UserWhereInput = {
  isActive: true,
  role: {
    OR: [{ name: "ADMIN" }, { permissions: { some: { permission: { name: "chat:read" } } } }],
  },
}

/** Returns the subset of these ids that are eligible, de-duplicated. */
export async function eligibleUserIds(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return []
  const rows = await prisma.user.findMany({
    where: { ...chatEligibleUserWhere, id: { in: [...new Set(ids)] } },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export const avatarUrlFor = (c: { id: string; avatarKey: string | null }) =>
  c.avatarKey ? `/api/chat/conversations/${c.id}/avatar` : null
