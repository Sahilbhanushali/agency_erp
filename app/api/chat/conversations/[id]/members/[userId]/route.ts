import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { can, requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { publish } from "@/lib/realtime/hub"
import { activeMemberIds, memberAccess, notFound, readOnly, systemMessage } from "@/lib/chat/service"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string; userId: string }> }

async function loadGroup(id: string) {
  return prisma.conversation.findUnique({ where: { id }, select: { type: true } })
}

const roleSchema = z.object({ role: z.enum(["MEMBER", "ADMIN"]) })

/** Promote or demote a group admin. A group can never be left without one. */
export async function PATCH(request: NextRequest, context: Params) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id, userId: rawTarget } = await context.params
  const target = Number(rawTarget)
  if (!Number.isInteger(target)) return NextResponse.json({ error: "Invalid member" }, { status: 400 })

  const access = await memberAccess(id, auth.userId)
  if (!access) return notFound()
  if (!access.active) return readOnly()
  const conv = await loadGroup(id)
  if (conv?.type !== "GROUP") return notFound()
  if (access.role !== "ADMIN" || !(await can(auth.session, "chat_groups", "update"))) {
    return NextResponse.json({ error: "Only group admins can change admins" }, { status: 403 })
  }

  const parsed = roleSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Choose MEMBER or ADMIN" }, { status: 422 })

  const targetAccess = await memberAccess(id, target)
  if (!targetAccess?.active) return NextResponse.json({ error: "That person is not in this group" }, { status: 404 })
  if (targetAccess.role === parsed.data.role) return NextResponse.json({ ok: true })

  if (parsed.data.role === "MEMBER") {
    const admins = await prisma.conversationMember.count({ where: { conversationId: id, leftAt: null, role: "ADMIN" } })
    if (admins <= 1) {
      return NextResponse.json({ error: "A group needs at least one admin. Make someone else an admin first." }, { status: 409 })
    }
  }

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: id, userId: target } },
    data: { role: parsed.data.role },
  })

  const [actor, subject] = await Promise.all([
    prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: target }, select: { name: true } }),
  ])
  await systemMessage(
    id,
    parsed.data.role === "ADMIN"
      ? `${actor?.name ?? "Someone"} made ${subject?.name ?? "a member"} an admin`
      : `${actor?.name ?? "Someone"} removed ${subject?.name ?? "a member"} as admin`,
  )
  publish(await activeMemberIds(id), { type: "conversation", conversationId: id })
  return NextResponse.json({ ok: true })
}

/**
 * Remove someone, or leave yourself.
 *
 * The removal message is posted while the person is still a member, then their access
 * is capped at that message's seq. They see why they lost access, and nothing after.
 */
export async function DELETE(_request: NextRequest, context: Params) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id, userId: rawTarget } = await context.params
  const target = Number(rawTarget)
  if (!Number.isInteger(target)) return NextResponse.json({ error: "Invalid member" }, { status: 400 })
  const leaving = target === auth.userId

  const access = await memberAccess(id, auth.userId)
  if (!access) return notFound()
  if (!access.active) return readOnly()
  const conv = await loadGroup(id)
  if (!conv) return notFound()
  if (conv.type !== "GROUP") return NextResponse.json({ error: "You cannot leave a direct conversation" }, { status: 422 })

  if (!leaving && (access.role !== "ADMIN" || !(await can(auth.session, "chat_groups", "update")))) {
    return NextResponse.json({ error: "Only group admins can remove members" }, { status: 403 })
  }

  const targetAccess = leaving ? access : await memberAccess(id, target)
  if (!targetAccess?.active) return NextResponse.json({ error: "That person is not in this group" }, { status: 404 })

  const [actor, subject] = await Promise.all([
    prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } }),
    leaving ? null : prisma.user.findUnique({ where: { id: target }, select: { name: true } }),
  ])
  const { message } = await systemMessage(
    id,
    leaving ? `${actor?.name ?? "Someone"} left` : `${actor?.name ?? "Someone"} removed ${subject?.name ?? "a member"}`,
  )

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: id, userId: target } },
    data: { leftAt: new Date(), leftAtSeq: message.seq, role: "MEMBER", lastReadSeq: message.seq },
  })

  // Never strand a group without an admin: hand it to the longest-standing member.
  const remainingAdmins = await prisma.conversationMember.count({ where: { conversationId: id, leftAt: null, role: "ADMIN" } })
  if (remainingAdmins === 0) {
    const heir = await prisma.conversationMember.findFirst({
      where: { conversationId: id, leftAt: null },
      orderBy: { joinedAt: "asc" },
      select: { userId: true, user: { select: { name: true } } },
    })
    if (heir) {
      await prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId: id, userId: heir.userId } },
        data: { role: "ADMIN" },
      })
      await systemMessage(id, `${heir.user.name} is now an admin`)
    }
  }

  publish([target], { type: "removed", conversationId: id })
  publish(await activeMemberIds(id), { type: "conversation", conversationId: id })
  return NextResponse.json({ ok: true })
}
