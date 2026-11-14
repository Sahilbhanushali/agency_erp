import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import {
  CANVAS_SUMMARY_SELECT,
  assertLinkable,
  canvasErrorResponse,
  logCanvasActivity,
  requireCanvas,
  withProjectClient,
} from "@/lib/canvas/access"
import { updateCanvasSchema } from "@/lib/canvas/schema"
import { deleteFileForKey } from "@/lib/chat/storage"

export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

/** GET — the board, its elements, who it is shared with, and what the caller may do. */
export async function GET(_request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await params
  try {
    const access = await requireCanvas(auth.session, auth.userId, id, "view")
    const canvas = await prisma.canvas.findUnique({
      where: { id },
      select: {
        ...CANVAS_SUMMARY_SELECT,
        elements: {
          orderBy: { z: "asc" },
          select: {
            id: true, type: true, x: true, y: true, width: true, height: true, z: true, data: true,
            createdAt: true, updatedAt: true, createdBy: { select: { id: true, name: true } },
            _count: { select: { comments: true } },
          },
        },
        members: {
          orderBy: { addedAt: "asc" },
          select: { role: true, user: { select: { id: true, name: true, avatar: true, role: { select: { name: true } } } } },
        },
      },
    })
    if (!canvas) return NextResponse.json({ error: "Board not found" }, { status: 404 })
    return NextResponse.json({ canvas, access })
  } catch (error) {
    return canvasErrorResponse(error, "load")
  }
}

/** PATCH — title, description, background and client/project/post links. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await params

  const parsed = updateCanvasSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid change" }, { status: 422 })
  }
  const input = await withProjectClient(parsed.data)

  try {
    await requireCanvas(auth.session, auth.userId, id, "edit")
    await assertLinkable(auth.session, auth.userId, input)
    const canvas = await prisma.canvas.update({
      where: { id },
      data: { ...input, updatedById: auth.userId, version: { increment: 1 } },
      select: CANVAS_SUMMARY_SELECT,
    })
    const linked = ["clientId", "projectId", "postId"].some((k) => k in input)
    await logCanvasActivity(
      id,
      auth.userId,
      linked ? "LINKED" : "UPDATED",
      linked
        ? `Linked to ${[canvas.client?.name, canvas.project?.name, canvas.post?.title].filter(Boolean).join(" · ") || "nothing"}`
        : `Updated board details`,
    )
    return NextResponse.json(canvas)
  } catch (error) {
    return canvasErrorResponse(error, "update")
  }
}

/** DELETE — the board and everything on it, including uploaded images. */
export async function DELETE(_request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await params
  try {
    await requireCanvas(auth.session, auth.userId, id, "delete")
    const images = await prisma.canvasElement.findMany({ where: { canvasId: id, type: "IMAGE" }, select: { data: true } })
    const deleted = await prisma.canvas.delete({ where: { id }, select: { title: true } })
    // Images go after the rows, so a failed delete never leaves elements pointing at nothing.
    for (const image of images) {
      const key = (image.data as { storageKey?: unknown } | null)?.storageKey
      if (typeof key === "string") await deleteFileForKey(key).catch((e) => console.error("[canvas] image cleanup failed:", e))
    }
    await prisma.auditLog
      .create({
        data: {
          userId: auth.userId,
          action: "CANVAS_DELETED",
          entityType: "Canvas",
          entityId: id,
          oldValues: JSON.stringify({ title: deleted.title }),
        },
      })
      .catch((e) => console.error("[canvas] audit failed:", e))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return canvasErrorResponse(error, "delete")
  }
}
