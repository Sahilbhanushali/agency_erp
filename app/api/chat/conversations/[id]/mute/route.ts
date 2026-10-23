import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { publish } from "@/lib/realtime/hub"
import { memberAccess, notFound } from "@/lib/chat/service"

/** Mute notifications for this conversation: for a while, indefinitely, or not at all. */
export const dynamic = "force-dynamic"

const schema = z.object({
  /** Hours to mute for; 0 unmutes; -1 mutes until turned off. */
  hours: z.number().int().min(-1).max(24 * 365),
})

/** "Indefinitely" stored as a far-future date, so every check stays a simple comparison. */
const FOREVER = new Date("9999-12-31T00:00:00Z")

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid mute duration" }, { status: 422 })
  if (!(await memberAccess(id, auth.userId))) return notFound()

  const { hours } = parsed.data
  const mutedUntil = hours === 0 ? null : hours === -1 ? FOREVER : new Date(Date.now() + hours * 3_600_000)
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: id, userId: auth.userId } },
    data: { mutedUntil },
  })
  // Your other tabs need to know too, or one of them would keep notifying.
  publish([auth.userId], { type: "conversation", conversationId: id })
  return NextResponse.json({ mutedUntil })
}
