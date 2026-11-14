import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { can, contentScope, isClientContact, requireSession } from "@/lib/api-auth"
import { postsAttachedTo } from "@/lib/posts/workflow"

export const dynamic = "force-dynamic"

const MAX_POSTS = 200
const querySchema = z.object({
  postIds: z
    .string()
    .transform((v) => [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))])
    .pipe(z.array(z.string().max(40)).max(MAX_POSTS)),
})

/**
 * GET ?postIds=a,b,c → { counts: { [postId]: unread } } for the caller's approval
 * discussions. Only posts the caller may read are counted; others are simply absent.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  const query = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!query.success) return NextResponse.json({ error: `Pass up to ${MAX_POSTS} post ids` }, { status: 400 })
  const requested = query.data.postIds
  if (requested.length === 0) return NextResponse.json({ counts: {} })

  if (!(await can(auth.session, "posts", "read")) || (await isClientContact(auth.session))) {
    return NextResponse.json({ counts: {} })
  }

  const scope = await contentScope(auth.session)
  const visible = await prisma.post.findMany({
    where: {
      AND: [{ id: { in: requested } }, ...(scope === "all" ? [] : [postsAttachedTo(auth.userId, auth.session.user?.email)])],
    },
    select: { id: true },
  })
  if (visible.length === 0) return NextResponse.json({ counts: {} })

  const memberships = await prisma.conversationMember.findMany({
    where: {
      userId: auth.userId,
      leftAt: null,
      conversation: { type: "APPROVAL", postId: { in: visible.map((p) => p.id) } },
    },
    select: { conversationId: true, lastReadSeq: true, conversation: { select: { postId: true } } },
  })
  if (memberships.length === 0) return NextResponse.json({ counts: {} })

  const grouped = await prisma.chatMessage.groupBy({
    by: ["conversationId"],
    where: {
      OR: memberships.map((m) => ({ conversationId: m.conversationId, seq: { gt: m.lastReadSeq } })),
      type: { not: "SYSTEM" },
      senderId: { not: auth.userId },
      deletedAt: null,
    },
    _count: { _all: true },
  })
  const postOf = new Map(memberships.map((m) => [m.conversationId, m.conversation.postId]))
  const counts: Record<string, number> = {}
  for (const row of grouped) {
    const postId = postOf.get(row.conversationId)
    if (postId && row._count._all > 0) counts[postId] = row._count._all
  }
  return NextResponse.json({ counts })
}
