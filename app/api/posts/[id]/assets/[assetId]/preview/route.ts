import { promises as fs } from "fs"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { assertPostAccess, workflowErrorResponse } from "@/lib/posts/workflow"
import { isPresentationUrl } from "@/lib/posts/content-types"
import { resolveUploadFile } from "@/lib/storage"
import {
  MAX_PREVIEW_BYTES,
  openPresentation,
  presentationImage,
  summarizePresentation,
} from "@/lib/posts/presentation-preview"

export const runtime = "nodejs"

const querySchema = z.discriminatedUnion("part", [
  z.object({ part: z.literal("summary") }),
  z.object({ part: z.literal("thumbnail") }),
  z.object({ part: z.literal("slide"), slide: z.coerce.number().int().min(1).max(200) }),
])

const PRIVATE_CACHE = { "Cache-Control": "private, max-age=300" }

/**
 * GET /api/posts/:id/assets/:assetId/preview?part=summary|thumbnail|slide&slide=N
 *
 * Preview of a presentation asset for reviewers. Readable by anyone who may read the
 * post; the asset must belong to that post, so an id from elsewhere reveals nothing.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> },
) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id: postId, assetId } = await params

  try {
    await assertPostAccess(auth.session, auth.userId, postId, "read")
  } catch (error) {
    return workflowErrorResponse(error)
  }

  const query = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!query.success) {
    return NextResponse.json({ error: "Invalid preview request" }, { status: 400 })
  }

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, postId },
    select: { url: true, filename: true, size: true },
  })
  if (!asset) return NextResponse.json({ error: "File not found" }, { status: 404 })

  const name = asset.filename || asset.url
  if (!isPresentationUrl(name) && !isPresentationUrl(asset.url)) {
    return NextResponse.json({ error: "This file is not a presentation" }, { status: 422 })
  }
  if (/\.ppt$/i.test(name)) {
    // Legacy binary format: no readable structure without an Office renderer.
    return NextResponse.json({ previewable: false, reason: "Legacy .ppt files can be downloaded but not previewed." })
  }

  try {
    const filePath = await resolveUploadFile(asset.url)
    if (!filePath) return NextResponse.json({ error: "File not found" }, { status: 404 })
    const { size } = await fs.stat(filePath)
    if (size > MAX_PREVIEW_BYTES) {
      return NextResponse.json({ previewable: false, reason: "This presentation is too large to preview; download it instead." })
    }

    const zip = await openPresentation(await fs.readFile(filePath))
    if (!zip) {
      return NextResponse.json({ previewable: false, reason: "This file could not be read as a PowerPoint presentation." })
    }

    if (query.data.part === "summary") {
      return NextResponse.json(await summarizePresentation(zip), { headers: PRIVATE_CACHE })
    }

    const image = await presentationImage(
      zip,
      query.data.part === "thumbnail" ? { kind: "thumbnail" } : { kind: "slide", index: query.data.slide },
    )
    if (!image) return NextResponse.json({ error: "No image for this slide" }, { status: 404 })
    return new NextResponse(new Uint8Array(image.bytes), {
      headers: { ...PRIVATE_CACHE, "Content-Type": image.contentType, "X-Content-Type-Options": "nosniff" },
    })
  } catch (error) {
    console.error("[presentation-preview] failed:", { postId, assetId, error })
    return NextResponse.json({ error: "Could not preview this presentation" }, { status: 500 })
  }
}
