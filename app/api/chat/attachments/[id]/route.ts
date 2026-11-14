import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { can, requireSession } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { memberAccess } from "@/lib/chat/service"
import { readFileForKey } from "@/lib/chat/storage"

/**
 * Serves a chat attachment to someone allowed to see it, and to nobody else.
 *
 * The attachment id alone is not enough: the message it belongs to must be in a
 * conversation the caller is a member of, and within the history they may read. A
 * removed member therefore loses access to anything posted after they left — even
 * with the URL in hand.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Types a browser may display in place. Everything else is a download. */
const INLINE = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime|webm)|application\/pdf)$/

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 })

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const att = await prisma.chatAttachment.findUnique({
    where: { id },
    select: {
      storageKey: true,
      originalName: true,
      mimeType: true,
      message: { select: { conversationId: true, seq: true, deletedAt: true, conversation: { select: { type: true } } } },
    },
  })
  if (!att || att.message.deletedAt) return notFound()
  // Chat files need chat:read; files in an approval discussion follow the post instead,
  // which memberAccess re-checks below.
  if (att.message.conversation.type !== "APPROVAL" && !(await can(auth.session, "chat", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const access = await memberAccess(att.message.conversationId, auth.userId)
  if (!access) return notFound()
  if (access.maxSeq !== null && att.message.seq > access.maxSeq) return notFound()

  let file: { data: Buffer; size: number }
  try {
    file = await readFileForKey(att.storageKey)
  } catch {
    return notFound()
  }

  const download = request.nextUrl.searchParams.get("download") === "1" || !INLINE.test(att.mimeType)
  const encoded = encodeURIComponent(att.originalName)
  const headers: Record<string, string> = {
    "Content-Type": att.mimeType,
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${att.originalName.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encoded}`,
    // Private: a shared cache must never hand one person's attachment to another.
    "Cache-Control": "private, max-age=300",
    // The browser must not second-guess the type we detected from the bytes.
    "X-Content-Type-Options": "nosniff",
    // Served from this origin, so if anything were ever rendered it must not run.
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    "Accept-Ranges": "bytes",
  }

  // Range requests let a video seek without downloading the whole file first.
  const range = request.headers.get("range")
  const match = range?.match(/^bytes=(\d*)-(\d*)$/)
  if (match && (match[1] || match[2])) {
    let start = match[1] ? Number(match[1]) : file.size - Number(match[2])
    let end = match[1] && match[2] ? Number(match[2]) : file.size - 1
    start = Math.max(0, start)
    end = Math.min(end, file.size - 1)
    if (start > end || start >= file.size) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } })
    }
    return new NextResponse(new Uint8Array(file.data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${file.size}`, "Content-Length": String(end - start + 1) },
    })
  }

  return new NextResponse(new Uint8Array(file.data), {
    status: 200,
    headers: { ...headers, "Content-Length": String(file.size) },
  })
}
