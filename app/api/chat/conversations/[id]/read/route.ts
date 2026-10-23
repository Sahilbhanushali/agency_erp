import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { publish } from "@/lib/realtime/hub"
import { activeMemberIds, advanceReceipt, memberAccess, notFound } from "@/lib/chat/service"

/**
 * Marks messages read up to a seq. Only ever moves forward, and never past what exists
 * or past the moment a former member left.
 *
 * The event goes to the reader's own tabs, so an unread badge clears everywhere, and to
 * the other members, which is what drives read receipts.
 */
export const dynamic = "force-dynamic"

const schema = z.object({ seq: z.coerce.number().int().min(0) })

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid seq" }, { status: 422 })

  const access = await memberAccess(id, auth.userId)
  if (!access) return notFound()

  const conv = await prisma.conversation.findUnique({ where: { id }, select: { lastSeq: true } })
  if (!conv) return notFound()
  const cap = access.maxSeq ?? conv.lastSeq
  const seq = Math.min(parsed.data.seq, cap)

  // Conditional write: a stale tab reporting an older seq cannot move the marker back.
  // Delivered first: reading something means it was delivered, even if no tab was
  // open when it arrived, and Message info should never show "read" before "delivered".
  await advanceReceipt(id, [auth.userId], "DELIVERED", seq, true)
  const count = await advanceReceipt(id, [auth.userId], "READ", seq, true)

  if (count > 0) {
    const recipients = new Set([auth.userId, ...(access.active ? await activeMemberIds(id) : [])])
    publish(recipients, { type: "read", conversationId: id, userId: auth.userId, seq })
  }
  return NextResponse.json({ seq: Math.max(seq, access.lastReadSeq) })
}
