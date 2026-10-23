import { NextResponse, type NextRequest } from "next/server"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { publish, rateLimited } from "@/lib/realtime/hub"
import { activeMemberIds, memberAccess, notFound } from "@/lib/chat/service"

/**
 * "Priya is typing…". Ephemeral — nothing is stored. Membership is checked like any
 * other event, so typing cannot be used to probe a conversation you are not in.
 */
export const dynamic = "force-dynamic"

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const access = await memberAccess(id, auth.userId)
  if (!access?.active) return notFound()

  // The client sends at most one every few seconds; this is the backstop.
  if (rateLimited(auth.userId, `typing:${id}`, 2, 2_000)) return NextResponse.json({ ok: true })

  const me = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } })
  const others = (await activeMemberIds(id)).filter((uid) => uid !== auth.userId)
  publish(others, { type: "typing", conversationId: id, userId: auth.userId, name: me?.name ?? "Someone" })
  return NextResponse.json({ ok: true })
}
