import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { canvasErrorResponse, logCanvasActivity, requireCanvas } from "@/lib/canvas/access"
import { shareSchema } from "@/lib/canvas/schema"

export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

/**
 * POST { userId, role } — share the board (or change someone's role on it). Only active
 * people whose role may open boards can be added: sharing with someone who could never
 * open it would look like access that does not exist.
 */
export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await params
  const parsed = shareSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid share" }, { status: 422 })
  const { userId, role } = parsed.data

  try {
    await requireCanvas(auth.session, auth.userId, id, "share")
    const canvas = await prisma.canvas.findUnique({ where: { id }, select: { createdById: true } })
    if (canvas?.createdById === userId) {
      return NextResponse.json({ error: "The owner already has full access" }, { status: 409 })
    }
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
        role: { OR: [{ name: "ADMIN" }, { permissions: { some: { permission: { name: "canvas:read" } } } }] },
      },
      select: { id: true, name: true },
    })
    if (!user) {
      return NextResponse.json({ error: "That person cannot open boards. Grant their role Canvas → Open boards first." }, { status: 422 })
    }
    const member = await prisma.canvasMember.upsert({
      where: { canvasId_userId: { canvasId: id, userId } },
      create: { canvasId: id, userId, role },
      update: { role },
      select: { role: true, user: { select: { id: true, name: true, avatar: true, role: { select: { name: true } } } } },
    })
    await logCanvasActivity(id, auth.userId, "SHARED", `Shared with ${user.name} as ${role.toLowerCase()}`)
    await prisma.notification
      .create({
        data: {
          userId,
          title: "A board was shared with you",
          message: `${auth.session.user?.name ?? "Someone"} gave you ${role.toLowerCase()} access to a board.`,
          link: `/dashboard/canvas/${id}`,
        },
      })
      .catch((e) => console.error("[canvas] share notification failed:", e))
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    return canvasErrorResponse(error, "share")
  }
}
