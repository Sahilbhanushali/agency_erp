import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { canvasErrorResponse, logCanvasActivity, requireCanvas } from "@/lib/canvas/access"
import { commentSchema } from "@/lib/canvas/schema"

export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

const select = {
  id: true, body: true, resolved: true, elementId: true, createdAt: true,
  author: { select: { id: true, name: true, avatar: true } },
} as const

/** GET — feedback on the board, oldest first (a conversation reads top to bottom). */
export async function GET(_request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await params
  try {
    await requireCanvas(auth.session, auth.userId, id, "view")
    const comments = await prisma.canvasComment.findMany({
      where: { canvasId: id },
      orderBy: { createdAt: "asc" },
      take: 500,
      select,
    })
    return NextResponse.json({ comments })
  } catch (error) {
    return canvasErrorResponse(error, "comments")
  }
}

/** POST { body, elementId? } — comment on the board or on one item on it. */
export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await params
  const parsed = commentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid comment" }, { status: 422 })
  }
  try {
    await requireCanvas(auth.session, auth.userId, id, "comment")
    if (parsed.data.elementId) {
      const onBoard = await prisma.canvasElement.count({ where: { id: parsed.data.elementId, canvasId: id } })
      if (!onBoard) return NextResponse.json({ error: "That item is not on this board" }, { status: 404 })
    }
    const comment = await prisma.canvasComment.create({
      data: { canvasId: id, elementId: parsed.data.elementId ?? null, body: parsed.data.body, authorId: auth.userId },
      select,
    })
    await logCanvasActivity(id, auth.userId, "COMMENTED", `Commented${parsed.data.elementId ? " on an item" : ""}: “${parsed.data.body.slice(0, 80)}”`)
    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    return canvasErrorResponse(error, "comment")
  }
}
