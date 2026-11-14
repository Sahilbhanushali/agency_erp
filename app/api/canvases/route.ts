import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import {
  CANVAS_SUMMARY_SELECT,
  assertLinkable,
  canvasErrorResponse,
  logCanvasActivity,
  visibleCanvasWhere,
  withProjectClient,
} from "@/lib/canvas/access"
import { createCanvasSchema, moodboardElements } from "@/lib/canvas/schema"

export const dynamic = "force-dynamic"

const PAGE = 48

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  kind: z.enum(["CANVAS", "MOODBOARD"]).optional(),
  clientId: z.string().max(40).optional(),
  projectId: z.string().max(40).optional(),
  postId: z.string().max(40).optional(),
  cursor: z.string().max(40).optional(),
})

/** GET /api/canvases — boards the caller may see, newest activity first, paged. */
export async function GET(request: NextRequest) {
  const auth = await requireCan("canvas", "read")
  if (!auth.ok) return auth.response

  const query = listQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!query.success) return NextResponse.json({ error: "Invalid filters" }, { status: 400 })
  const { q, kind, clientId, projectId, postId, cursor } = query.data

  try {
    const where: Prisma.CanvasWhereInput = {
      AND: [
        await visibleCanvasWhere(auth.session, auth.userId),
        ...(q ? [{ OR: [{ title: { contains: q } }, { description: { contains: q } }] }] : []),
        ...(kind ? [{ kind }] : []),
        ...(clientId ? [{ clientId }] : []),
        ...(projectId ? [{ projectId }] : []),
        ...(postId ? [{ postId }] : []),
      ],
    }
    const rows = await prisma.canvas.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: CANVAS_SUMMARY_SELECT,
    })
    const hasMore = rows.length > PAGE
    const items = rows.slice(0, PAGE)
    return NextResponse.json({ items, nextCursor: hasMore ? items[items.length - 1].id : null })
  } catch (error) {
    return canvasErrorResponse(error, "list")
  }
}

/** POST /api/canvases — new board; a MOODBOARD starts from the brief template. */
export async function POST(request: NextRequest) {
  const auth = await requireCan("canvas", "create")
  if (!auth.ok) return auth.response

  const parsed = createCanvasSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid board" }, { status: 422 })
  }
  const input = await withProjectClient(parsed.data)

  try {
    await assertLinkable(auth.session, auth.userId, input)
    const canvas = await prisma.canvas.create({
      data: {
        title: input.title,
        description: input.description || null,
        kind: input.kind,
        clientId: input.clientId ?? null,
        projectId: input.projectId ?? null,
        postId: input.postId ?? null,
        createdById: auth.userId,
        updatedById: auth.userId,
        elements:
          input.kind === "MOODBOARD"
            ? { create: moodboardElements().map((e) => ({ ...e, data: e.data as Prisma.InputJsonValue, createdById: auth.userId })) }
            : undefined,
      },
      select: CANVAS_SUMMARY_SELECT,
    })
    await logCanvasActivity(canvas.id, auth.userId, "CREATED", `Created ${input.kind === "MOODBOARD" ? "mood board" : "board"} “${canvas.title}”`)
    return NextResponse.json(canvas, { status: 201 })
  } catch (error) {
    return canvasErrorResponse(error, "create")
  }
}
