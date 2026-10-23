import { NextResponse, type NextRequest } from "next/server"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { memberAccess } from "@/lib/chat/service"
import { readFileForKey } from "@/lib/chat/storage"
import { detectType } from "@/lib/chat/file-rules"

/** A group's picture, for members only — it lives in private storage like any attachment. */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  if (!(await memberAccess(id, auth.userId))) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const conv = await prisma.conversation.findUnique({ where: { id }, select: { avatarKey: true } })
  if (!conv?.avatarKey) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const { data, size } = await readFileForKey(conv.avatarKey)
    const type = detectType(new Uint8Array(data.subarray(0, 64)), conv.avatarKey)
    if (!type || type.kind !== "IMAGE") return NextResponse.json({ error: "Not found" }, { status: 404 })
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type.mime,
        "Content-Length": String(size),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
