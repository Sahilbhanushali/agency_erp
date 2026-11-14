import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { canvasErrorResponse, requireCanvas } from "@/lib/canvas/access"

export const dynamic = "force-dynamic"

/** GET — the board's activity, newest first (last 100). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await params
  try {
    await requireCanvas(auth.session, auth.userId, id, "view")
    const activity = await prisma.canvasActivity.findMany({
      where: { canvasId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, action: true, summary: true, createdAt: true, actor: { select: { id: true, name: true } } },
    })
    return NextResponse.json({ activity })
  } catch (error) {
    return canvasErrorResponse(error, "activity")
  }
}
