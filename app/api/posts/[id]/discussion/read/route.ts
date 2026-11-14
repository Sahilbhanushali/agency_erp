import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { advanceReceipt, memberAccess } from "@/lib/chat/service"

export const dynamic = "force-dynamic"

const schema = z.object({ seq: z.coerce.number().int().min(0) })

/** POST { seq } — the caller has read the post's discussion up to `seq`. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id: postId } = await params

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid seq" }, { status: 422 })

  const conv = await prisma.conversation.findUnique({ where: { postId }, select: { id: true, lastSeq: true } })
  // memberAccess re-checks the post itself for approval discussions.
  const access = conv ? await memberAccess(conv.id, auth.userId) : null
  if (!conv || !access) return NextResponse.json({ error: "Discussion not found" }, { status: 404 })

  const seq = Math.min(parsed.data.seq, conv.lastSeq)
  await advanceReceipt(conv.id, [auth.userId], "DELIVERED", seq, true)
  await advanceReceipt(conv.id, [auth.userId], "READ", seq, true)

  // Reading the thread answers its notification.
  await prisma.notification.updateMany({
    where: { userId: auth.userId, isRead: false, link: `/dashboard/projects/posts/${postId}?tab=discussion` },
    data: { isRead: true },
  })
  return NextResponse.json({ seq: Math.max(seq, access.lastReadSeq) })
}
