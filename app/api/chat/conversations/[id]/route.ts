import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { can, requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { isOnline, publish } from "@/lib/realtime/hub"
import { activeMemberIds, avatarUrlFor, memberAccess, notFound, readOnly, systemMessage } from "@/lib/chat/service"
import { AttachmentRuleError, validateAttachment } from "@/lib/chat/file-rules"
import { deleteFileForKey, newStorageKey, saveFile } from "@/lib/chat/storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const AVATAR_MAX = 5 * 1024 * 1024

/** Group details and members. Any member, current or former, may look. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const access = await memberAccess(id, auth.userId)
  if (!access) return notFound()

  const c = await prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      name: true,
      description: true,
      avatarKey: true,
      membersCanEditInfo: true,
      lastSeq: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
      members: {
        where: { leftAt: null },
        select: {
          role: true,
          lastReadSeq: true,
          lastDeliveredSeq: true,
          joinedAt: true,
          user: { select: { id: true, name: true, avatar: true, role: { select: { name: true } } } },
        },
        orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
      },
    },
  })
  if (!c) return notFound()

  const [canEditGroups, canDeleteGroups] = await Promise.all([
    can(auth.session, "chat_groups", "update"),
    can(auth.session, "chat_groups", "delete"),
  ])
  const isGroupAdmin = access.active && access.role === "ADMIN"

  return NextResponse.json({
    conversation: {
      id: c.id,
      type: c.type,
      name: c.name,
      description: c.description,
      avatarUrl: avatarUrlFor(c),
      membersCanEditInfo: c.membersCanEditInfo,
      lastSeq: c.lastSeq,
      createdAt: c.createdAt,
      createdBy: c.createdBy,
      members: c.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        avatar: m.user.avatar,
        jobRole: m.user.role?.name ?? null,
        role: m.role,
        lastReadSeq: m.lastReadSeq,
        lastDeliveredSeq: Math.max(m.lastDeliveredSeq, m.lastReadSeq),
        online: isOnline(m.user.id),
      })),
    },
    // What this person may do, so the UI does not offer actions the server will refuse.
    permissions: {
      active: access.active,
      isGroupAdmin,
      canEditInfo: c.type === "GROUP" && access.active && ((isGroupAdmin && canEditGroups) || c.membersCanEditInfo),
      canManageMembers: c.type === "GROUP" && isGroupAdmin && canEditGroups,
      canDelete: c.type === "GROUP" && isGroupAdmin && canDeleteGroups,
      canLeave: c.type === "GROUP" && access.active,
    },
  })
}

const editSchema = z.object({
  name: z.string().trim().min(1, "Give the group a name").max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  membersCanEditInfo: z.boolean().optional(),
  removeAvatar: z.boolean().optional(),
})

/** Edit name, description, avatar and who may edit them. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const me = auth.userId

  const access = await memberAccess(id, me)
  if (!access) return notFound()
  if (!access.active) return readOnly()

  const conv = await prisma.conversation.findUnique({
    where: { id },
    select: { type: true, name: true, avatarKey: true, membersCanEditInfo: true },
  })
  if (!conv) return notFound()
  if (conv.type !== "GROUP") return NextResponse.json({ error: "Direct conversations have no editable details" }, { status: 422 })

  const isGroupAdmin = access.role === "ADMIN" && (await can(auth.session, "chat_groups", "update"))

  let raw: Record<string, unknown> = {}
  let avatar: File | null = null
  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: "Could not read the upload" }, { status: 400 })
    const f = form.get("avatar")
    if (f instanceof File) avatar = f
    for (const key of ["name", "description"]) if (form.has(key)) raw[key] = form.get(key)
    if (form.get("removeAvatar") === "true") raw.removeAvatar = true
  } else {
    raw = (await request.json().catch(() => null)) ?? {}
  }

  const parsed = editSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })
  const input = parsed.data

  // Who may change what. The setting itself is admin-only; the details follow it.
  if (input.membersCanEditInfo !== undefined && !isGroupAdmin) {
    return NextResponse.json({ error: "Only group admins can change who may edit the group" }, { status: 403 })
  }
  const editingDetails = input.name !== undefined || input.description !== undefined || avatar || input.removeAvatar
  if (editingDetails && !isGroupAdmin && !conv.membersCanEditInfo) {
    return NextResponse.json({ error: "Only group admins can edit this group" }, { status: 403 })
  }

  let avatarKey: string | null | undefined
  if (avatar) {
    try {
      const head = new Uint8Array(await avatar.slice(0, 4100).arrayBuffer())
      const type = validateAttachment(head, avatar.name, avatar.size)
      if (type.kind !== "IMAGE") throw new AttachmentRuleError("The group picture must be an image.")
      if (avatar.size > AVATAR_MAX) throw new AttachmentRuleError("The group picture must be under 5 MB.", 413)
      avatarKey = newStorageKey(type.ext)
      await saveFile(avatarKey, new Uint8Array(await avatar.arrayBuffer()))
    } catch (error) {
      if (error instanceof AttachmentRuleError) return NextResponse.json({ error: error.message }, { status: error.status })
      throw error
    }
  } else if (input.removeAvatar) {
    avatarKey = null
  }

  await prisma.conversation.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.membersCanEditInfo !== undefined ? { membersCanEditInfo: input.membersCanEditInfo } : {}),
      ...(avatarKey !== undefined ? { avatarKey } : {}),
    },
  })
  if (avatarKey !== undefined && conv.avatarKey) await deleteFileForKey(conv.avatarKey)

  const actor = await prisma.user.findUnique({ where: { id: me }, select: { name: true } })
  const who = actor?.name ?? "Someone"
  if (input.name !== undefined && input.name !== conv.name) await systemMessage(id, `${who} renamed the group to "${input.name}"`)
  if (avatar) await systemMessage(id, `${who} changed the group picture`)
  if (input.membersCanEditInfo !== undefined && input.membersCanEditInfo !== conv.membersCanEditInfo) {
    await systemMessage(id, input.membersCanEditInfo ? `${who} let all members edit group info` : `${who} limited group info to admins`)
  }

  publish(await activeMemberIds(id), { type: "conversation", conversationId: id })
  return NextResponse.json({ ok: true })
}

/**
 * Deletes a group and everything in it, files included. A real delete — conversations,
 * messages and attachments cascade in the database, and their files are removed here.
 */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("chat", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const access = await memberAccess(id, auth.userId)
  if (!access) return notFound()

  const conv = await prisma.conversation.findUnique({ where: { id }, select: { type: true, avatarKey: true, name: true } })
  if (!conv) return notFound()
  if (conv.type !== "GROUP") return NextResponse.json({ error: "Direct conversations cannot be deleted" }, { status: 422 })
  if (!access.active || access.role !== "ADMIN" || !(await can(auth.session, "chat_groups", "delete"))) {
    return NextResponse.json({ error: "Only a group admin with permission to delete groups can do this" }, { status: 403 })
  }

  const recipients = await prisma.conversationMember.findMany({ where: { conversationId: id }, select: { userId: true } })
  const files = await prisma.chatAttachment.findMany({ where: { message: { conversationId: id } }, select: { storageKey: true } })

  await prisma.conversation.delete({ where: { id } })
  await Promise.all([...files.map((f) => deleteFileForKey(f.storageKey)), conv.avatarKey ? deleteFileForKey(conv.avatarKey) : null])

  await prisma.auditLog.create({
    data: {
      userId: auth.userId,
      action: "CHAT_GROUP_DELETED",
      entityType: "Conversation",
      entityId: id,
      oldValues: JSON.stringify({ name: conv.name, members: recipients.length, files: files.length }),
    },
  })

  publish(recipients.map((r) => r.userId), { type: "removed", conversationId: id })
  return NextResponse.json({ deleted: true })
}
