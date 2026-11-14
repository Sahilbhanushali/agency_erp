import { NextResponse, type NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { ELEMENT_SELECT, canvasErrorResponse, logCanvasActivity, requireCanvas, touchCanvas } from "@/lib/canvas/access"
import { DEFAULT_SIZE, batchGeometrySchema, createElementSchema, parseElementData } from "@/lib/canvas/schema"

export const dynamic = "force-dynamic"

const MAX_ELEMENTS = 1_000

type Context = { params: Promise<{ id: string }> }

/** POST — add one element. Without a z it goes on top. */
export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await params

  const parsed = createElementSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid element" }, { status: 422 })
  }
  const { type, data, ...geometry } = parsed.data
  const payload = parseElementData(type, data)
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: 422 })

  try {
    await requireCanvas(auth.session, auth.userId, id, "edit")
    const [count, top] = await Promise.all([
      prisma.canvasElement.count({ where: { canvasId: id } }),
      prisma.canvasElement.aggregate({ where: { canvasId: id }, _max: { z: true } }),
    ])
    if (count >= MAX_ELEMENTS) {
      return NextResponse.json({ error: `A board holds up to ${MAX_ELEMENTS} items.` }, { status: 422 })
    }
    const size = DEFAULT_SIZE[type]
    const element = await prisma.canvasElement.create({
      data: {
        canvasId: id,
        type,
        x: geometry.x ?? 0,
        y: geometry.y ?? 0,
        width: geometry.width ?? size.width,
        height: geometry.height ?? size.height,
        // Sections default to the back so what is dropped into them stays visible.
        z: geometry.z ?? (type === "SECTION" ? (await prisma.canvasElement.aggregate({ where: { canvasId: id }, _min: { z: true } }))._min.z ?? 0 : (top._max.z ?? 0) + 1),
        data: payload.data as Prisma.InputJsonValue,
        createdById: auth.userId,
      },
      select: ELEMENT_SELECT,
    })
    await touchCanvas(id, auth.userId)
    await logCanvasActivity(id, auth.userId, "ELEMENT_ADDED", `Added ${type.toLowerCase()}${describe(payload.data)}`)
    return NextResponse.json(element, { status: 201 })
  } catch (error) {
    return canvasErrorResponse(error, "add element")
  }
}

/** PATCH — move/resize/restack many elements at once (dragging a section, arranging). */
export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await params

  const parsed = batchGeometrySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid positions" }, { status: 422 })
  }

  try {
    await requireCanvas(auth.session, auth.userId, id, "edit")
    const ids = parsed.data.elements.map((e) => e.id)
    const owned = await prisma.canvasElement.count({ where: { id: { in: ids }, canvasId: id } })
    if (owned !== new Set(ids).size) {
      return NextResponse.json({ error: "Some items are not on this board" }, { status: 404 })
    }
    await prisma.$transaction(
      parsed.data.elements.map(({ id: elementId, ...geometry }) =>
        prisma.canvasElement.update({ where: { id: elementId }, data: geometry, select: { id: true } }),
      ),
    )
    await touchCanvas(id, auth.userId)
    // Moves are not logged one by one: arranging a board would bury everything else.
    return NextResponse.json({ ok: true })
  } catch (error) {
    return canvasErrorResponse(error, "arrange")
  }
}

function describe(data: Record<string, unknown>): string {
  const label = data.title ?? data.text ?? data.label ?? data.caption ?? data.hex ?? data.url
  return typeof label === "string" && label.trim() ? ` “${label.trim().slice(0, 60)}”` : ""
}
