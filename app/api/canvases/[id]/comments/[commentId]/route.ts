import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { canvasErrorResponse, requireCanvas } from "@/lib/canvas/access"

export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string; commentId: string }> }

const patchSchema = z.object({ resolved: z.boolean() }).strict()

async function commentOn(canvasId: string, commentId: string) {
  return prisma.canvasComment.findFirst({ where: { id: commentId, canvasId }, select: { id: true, authorId: true } })
}

/** PATCH { resolved } — anyone who can edit the board, or the comment's author. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id, commentId } = await params
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid change" }, { status: 422 })
  try {
    const access = await requireCanvas(auth.session, auth.userId, id, "view")
    const comment = await commentOn(id, commentId)
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    if (!access.canEdit && comment.authorId !== auth.userId) {
      return NextResponse.json({ error: "You cannot resolve this comment" }, { status: 403 })
    }
    await prisma.canvasComment.update({ where: { id: commentId }, data: { resolved: parsed.data.resolved } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return canvasErrorResponse(error, "resolve comment")
  }
}

/** DELETE — the author, or whoever looks after the board (owner/planner). */
export async function DELETE(_request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id, commentId } = await params
  try {
    const access = await requireCanvas(auth.session, auth.userId, id, "view")
    const comment = await commentOn(id, commentId)
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    const steward = access.role === "OWNER" || access.role === "PLANNER"
    if (comment.authorId !== auth.userId && !steward) {
      return NextResponse.json({ error: "You cannot delete this comment" }, { status: 403 })
    }
    await prisma.canvasComment.delete({ where: { id: commentId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return canvasErrorResponse(error, "delete comment")
  }
}
