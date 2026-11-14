import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { rateLimited } from "@/lib/realtime/hub"
import { canvasErrorResponse, requireCanvas } from "@/lib/canvas/access"
import { AttachmentRuleError, validateAttachment } from "@/lib/chat/file-rules"
import { newStorageKey, readFileForKey, saveFile } from "@/lib/chat/storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const keySchema = z.string().regex(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|gif|webp)$/)

type Context = { params: Promise<{ id: string }> }

/**
 * POST multipart { file } — stores an image for this board in private storage and
 * returns its key; the client then adds an IMAGE element pointing at it. The type is
 * decided from the file's bytes, and only images are accepted.
 */
export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await params
  try {
    await requireCanvas(auth.session, auth.userId, id, "edit")
  } catch (error) {
    return canvasErrorResponse(error, "upload")
  }
  if (rateLimited(auth.userId, "canvas:upload", 30, 60_000)) {
    return NextResponse.json({ error: "Too many uploads. Wait a moment and try again." }, { status: 429 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload" }, { status: 422 })
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: `Images are limited to ${MAX_IMAGE_BYTES / 1024 / 1024} MB` }, { status: 413 })
  }

  try {
    const head = new Uint8Array(await file.slice(0, 4100).arrayBuffer())
    const type = validateAttachment(head, file.name, file.size)
    if (type.kind !== "IMAGE" || !["jpg", "png", "gif", "webp"].includes(type.ext)) {
      return NextResponse.json({ error: "Only JPG, PNG, GIF and WebP images can be added to a board" }, { status: 415 })
    }
    const key = newStorageKey(type.ext)
    await saveFile(key, new Uint8Array(await file.arrayBuffer()))
    return NextResponse.json({ storageKey: key, name: file.name.slice(0, 200) }, { status: 201 })
  } catch (error) {
    if (error instanceof AttachmentRuleError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[canvas] image upload failed:", { canvasId: id, error })
    return NextResponse.json({ error: "Could not store the image" }, { status: 500 })
  }
}

/**
 * GET ?key= — an uploaded image, to people who can view this board, and only when an
 * element of this board actually uses that key.
 */
export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await params
  const key = keySchema.safeParse(request.nextUrl.searchParams.get("key"))
  if (!key.success) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    await requireCanvas(auth.session, auth.userId, id, "view")
    const used = await prisma.canvasElement.count({
      where: { canvasId: id, type: "IMAGE", data: { path: "$.storageKey", equals: key.data } },
    })
    if (!used) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const file = await readFileForKey(key.data).catch(() => null)
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const ext = key.data.split(".").pop()
    const contentType = { jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" }[ext as "jpg"] ?? "application/octet-stream"
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    })
  } catch (error) {
    return canvasErrorResponse(error, "image")
  }
}
