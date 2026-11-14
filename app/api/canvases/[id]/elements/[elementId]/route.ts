import { NextResponse, type NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { ELEMENT_SELECT, canvasErrorResponse, logCanvasActivity, requireCanvas, touchCanvas } from "@/lib/canvas/access"
import { parseElementData, updateElementSchema, type ElementType } from "@/lib/canvas/schema"
import { deleteFileForKey } from "@/lib/chat/storage"

export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string; elementId: string }> }

async function elementOn(canvasId: string, elementId: string) {
  return prisma.canvasElement.findFirst({
    where: { id: elementId, canvasId },
    select: { id: true, type: true, data: true },
  })
}

/** PATCH — geometry and/or content. Content is merged over what is there, then re-validated whole. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id, elementId } = await params

  const parsed = updateElementSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid change" }, { status: 422 })
  }
  const { data, ...geometry } = parsed.data

  try {
    await requireCanvas(auth.session, auth.userId, id, "edit")
    const current = await elementOn(id, elementId)
    if (!current) return NextResponse.json({ error: "Item not found" }, { status: 404 })

    let nextData: Prisma.InputJsonValue | undefined
    if (data) {
      const merged = { ...(current.data as Record<string, unknown>), ...data }
      // An uploaded image's file is fixed to the element; it is replaced by a new element.
      if (current.type === "IMAGE") merged.storageKey = (current.data as { storageKey?: unknown }).storageKey
      if (merged.storageKey === undefined) delete merged.storageKey
      const payload = parseElementData(current.type as ElementType, merged)
      if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: 422 })
      nextData = payload.data as Prisma.InputJsonValue
    }

    const element = await prisma.canvasElement.update({
      where: { id: elementId },
      data: { ...geometry, ...(nextData !== undefined ? { data: nextData } : {}) },
      select: ELEMENT_SELECT,
    })
    await touchCanvas(id, auth.userId)
    if (data) await logCanvasActivity(id, auth.userId, "ELEMENT_UPDATED", `Edited a ${current.type.toLowerCase()}`)
    return NextResponse.json(element)
  } catch (error) {
    return canvasErrorResponse(error, "update element")
  }
}

/** DELETE — removes the element, its comments, and its uploaded image if it had one. */
export async function DELETE(_request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id, elementId } = await params
  try {
    await requireCanvas(auth.session, auth.userId, id, "edit")
    const current = await elementOn(id, elementId)
    if (!current) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    await prisma.canvasElement.delete({ where: { id: elementId } })
    // Every upload belongs to exactly one element (duplicating a board copies its files).
    const key = (current.data as { storageKey?: unknown } | null)?.storageKey
    if (typeof key === "string") await deleteFileForKey(key)
    await touchCanvas(id, auth.userId)
    await logCanvasActivity(id, auth.userId, "ELEMENT_REMOVED", `Removed a ${current.type.toLowerCase()}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return canvasErrorResponse(error, "remove element")
  }
}
