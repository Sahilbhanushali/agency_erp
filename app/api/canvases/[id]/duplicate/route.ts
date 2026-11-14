import { NextResponse, type NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { can, requireSession } from "@/lib/api-auth"
import { CANVAS_SUMMARY_SELECT, canvasErrorResponse, logCanvasActivity, requireCanvas } from "@/lib/canvas/access"
import { deleteFileForKey, newStorageKey, readFileForKey, saveFile } from "@/lib/chat/storage"

export const dynamic = "force-dynamic"

/**
 * POST — a copy of the board (elements and links; not comments, members or activity)
 * owned by the caller. Uploaded images are copied too, so the two boards never share a
 * file and deleting one cannot break the other.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await params

  const copied: string[] = []
  try {
    await requireCanvas(auth.session, auth.userId, id, "view")
    if (!(await can(auth.session, "canvas", "create"))) {
      return NextResponse.json({ error: "You do not have permission to create boards." }, { status: 403 })
    }
    const source = await prisma.canvas.findUnique({
      where: { id },
      select: {
        title: true, description: true, kind: true, background: true, clientId: true, projectId: true, postId: true,
        elements: { select: { type: true, x: true, y: true, width: true, height: true, z: true, data: true } },
      },
    })
    if (!source) return NextResponse.json({ error: "Board not found" }, { status: 404 })

    const elements: Prisma.CanvasElementCreateWithoutCanvasInput[] = []
    for (const e of source.elements) {
      const data = { ...(e.data as Record<string, unknown>) }
      if (typeof data.storageKey === "string") {
        const file = await readFileForKey(data.storageKey).catch(() => null)
        if (!file) continue // the original file is gone; skip rather than copy a broken image
        const key = newStorageKey(data.storageKey.split(".").pop() ?? "")
        await saveFile(key, new Uint8Array(file.data))
        copied.push(key)
        data.storageKey = key
      }
      elements.push({
        type: e.type, x: e.x, y: e.y, width: e.width, height: e.height, z: e.z,
        data: data as Prisma.InputJsonValue,
        createdBy: { connect: { id: auth.userId } },
      })
    }

    const copy = await prisma.canvas.create({
      data: {
        title: `${source.title} (copy)`.slice(0, 160),
        description: source.description,
        kind: source.kind,
        background: source.background,
        clientId: source.clientId,
        projectId: source.projectId,
        postId: source.postId,
        createdById: auth.userId,
        updatedById: auth.userId,
        elements: { create: elements },
      },
      select: CANVAS_SUMMARY_SELECT,
    })
    await logCanvasActivity(copy.id, auth.userId, "DUPLICATED", `Duplicated from “${source.title}”`)
    await logCanvasActivity(id, auth.userId, "DUPLICATED", `Duplicated as “${copy.title}”`)
    return NextResponse.json(copy, { status: 201 })
  } catch (error) {
    for (const key of copied) await deleteFileForKey(key)
    return canvasErrorResponse(error, "duplicate")
  }
}
