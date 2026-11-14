import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { canvasErrorResponse, logCanvasActivity, requireCanvas } from "@/lib/canvas/access"

export const dynamic = "force-dynamic"

/** DELETE — stop sharing with this person. Stewards remove anyone; people may remove themselves. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id, userId: raw } = await params
  const target = z.coerce.number().int().positive().safeParse(raw)
  if (!target.success) return NextResponse.json({ error: "Invalid person" }, { status: 400 })

  try {
    const leaving = target.data === auth.userId
    await requireCanvas(auth.session, auth.userId, id, leaving ? "view" : "share")
    const removed = await prisma.canvasMember.deleteMany({ where: { canvasId: id, userId: target.data } })
    if (removed.count === 0) return NextResponse.json({ error: "Not shared with that person" }, { status: 404 })
    const user = await prisma.user.findUnique({ where: { id: target.data }, select: { name: true } })
    await logCanvasActivity(id, auth.userId, "UNSHARED", leaving ? "Left the board" : `Stopped sharing with ${user?.name ?? "someone"}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return canvasErrorResponse(error, "unshare")
  }
}
