import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { can, contentScope, isClientContact } from "@/lib/api-auth"

/**
 * Who may see and change a board.
 *
 *   canvas:read     open boards at all. Which boards: ones you created, ones shared
 *                   with you, and — for roles that plan all content (contentScope
 *                   "all") — every board. Client contacts see only boards shared with them.
 *   canvas:update   change a board you own, were made EDITOR on, or plan (all scope).
 *   canvas:delete   delete a board you own, or any board with all scope.
 *   canvas:share    share a board you own, or any board with all scope.
 */
export type CanvasRole = "OWNER" | "EDITOR" | "VIEWER" | "PLANNER"

export interface CanvasAccess {
  role: CanvasRole
  canEdit: boolean
  canDelete: boolean
  canShare: boolean
  canComment: boolean
}

export class CanvasAccessError extends Error {
  constructor(public status: 403 | 404, message: string) {
    super(message)
  }
}

export const canvasErrorResponse = (error: unknown, context: string) => {
  if (error instanceof CanvasAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error(`[canvas] ${context} failed:`, error)
  return NextResponse.json({ error: "Something went wrong with this board" }, { status: 500 })
}

/** Boards this caller may list. */
export async function visibleCanvasWhere(session: Session, userId: number): Promise<Prisma.CanvasWhereInput> {
  const planner = (await contentScope(session)) === "all" && !(await isClientContact(session))
  if (planner) return {}
  return { OR: [{ createdById: userId }, { members: { some: { userId } } }] }
}

/** The caller's access to one board. 404 when they may not see it at all. */
export async function canvasAccess(session: Session, userId: number, canvasId: string): Promise<CanvasAccess> {
  if (!(await can(session, "canvas", "read"))) {
    throw new CanvasAccessError(403, "You do not have permission to open boards.")
  }
  const canvas = await prisma.canvas.findUnique({
    where: { id: canvasId },
    select: { createdById: true, members: { where: { userId }, select: { role: true } } },
  })
  if (!canvas) throw new CanvasAccessError(404, "Board not found")

  const client = await isClientContact(session)
  const planner = !client && (await contentScope(session)) === "all"
  const member = canvas.members[0]?.role ?? null

  let role: CanvasRole
  if (canvas.createdById === userId && !client) role = "OWNER"
  else if (member === "EDITOR") role = "EDITOR"
  else if (planner) role = "PLANNER"
  else if (member === "VIEWER") role = "VIEWER"
  else throw new CanvasAccessError(404, "Board not found")

  const [mayUpdate, mayDelete, mayShare] = await Promise.all([
    can(session, "canvas", "update"),
    can(session, "canvas", "delete"),
    can(session, "canvas", "share"),
  ])
  const steward = role === "OWNER" || role === "PLANNER"
  return {
    role,
    canEdit: mayUpdate && role !== "VIEWER",
    canDelete: mayDelete && steward,
    canShare: mayShare && steward,
    // Everyone who can see a board may give feedback on it; that is what sharing is for.
    canComment: true,
  }
}

/** canvasAccess, then require one capability. */
export async function requireCanvas(
  session: Session,
  userId: number,
  canvasId: string,
  need: "view" | "edit" | "delete" | "share" | "comment",
): Promise<CanvasAccess> {
  const access = await canvasAccess(session, userId, canvasId)
  const allowed =
    need === "view" ||
    (need === "edit" && access.canEdit) ||
    (need === "delete" && access.canDelete) ||
    (need === "share" && access.canShare) ||
    (need === "comment" && access.canComment)
  if (!allowed) {
    const verb = { view: "view", edit: "edit", delete: "delete", share: "share", comment: "comment on" }[need]
    throw new CanvasAccessError(403, `You do not have permission to ${verb} this board.`)
  }
  return access
}

/** Links to a client/project/post must point at things the caller may see. */
export async function assertLinkable(
  session: Session,
  userId: number,
  links: { clientId?: string | null; projectId?: string | null; postId?: string | null },
) {
  const scope = await contentScope(session)
  if (links.projectId) {
    const ok = await prisma.project.count({
      where: {
        id: links.projectId,
        ...(scope === "all" ? {} : { OR: [{ managerId: userId }, { assignedUsers: { some: { id: userId } } }] }),
      },
    })
    if (!ok) throw new CanvasAccessError(404, "Project not found")
  }
  if (links.postId) {
    const ok = await prisma.post.count({
      where: {
        id: links.postId,
        ...(scope === "all"
          ? {}
          : { OR: [{ createdById: userId }, { assignedToId: userId }, { assignedUsers: { some: { id: userId } } }, { project: { managerId: userId } }, { project: { assignedUsers: { some: { id: userId } } } }] }),
      },
    })
    if (!ok) throw new CanvasAccessError(404, "Post not found")
  }
  if (links.clientId) {
    const ok = await prisma.client.count({
      where: {
        id: links.clientId,
        ...(scope === "all"
          ? {}
          : { projects: { some: { OR: [{ managerId: userId }, { assignedUsers: { some: { id: userId } } }] } } }),
      },
    })
    if (!ok) throw new CanvasAccessError(404, "Client not found")
  }
}

/** Append-only board activity. Best effort: a failed log never fails the change. */
export async function logCanvasActivity(canvasId: string, actorId: number | null, action: string, summary: string) {
  try {
    await prisma.canvasActivity.create({
      data: { canvasId, actorId, action, summary: summary.slice(0, 300) },
    })
  } catch (error) {
    console.error("[canvas] activity log failed:", { canvasId, action, error })
  }
}

/** Records who last changed a board and when; bumps its version for stale-view checks. */
export async function touchCanvas(canvasId: string, userId: number) {
  await prisma.canvas.update({
    where: { id: canvasId },
    data: { updatedById: userId, version: { increment: 1 } },
    select: { id: true },
  })
}

/** Fields every board summary carries. */
export const CANVAS_SUMMARY_SELECT = {
  id: true,
  title: true,
  description: true,
  kind: true,
  background: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  post: { select: { id: true, title: true } },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  _count: { select: { elements: true, comments: true, members: true } },
} satisfies Prisma.CanvasSelect

/** Fields every element carries over the wire. */
export const ELEMENT_SELECT = {
  id: true, type: true, x: true, y: true, width: true, height: true, z: true, data: true,
  createdAt: true, updatedAt: true, createdBy: { select: { id: true, name: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.CanvasElementSelect

/** A board linked to a project (campaign) is linked to that project's client too. */
export async function withProjectClient<T extends { clientId?: string | null; projectId?: string | null }>(links: T): Promise<T> {
  if (!links.projectId || links.clientId) return links
  const project = await prisma.project.findUnique({ where: { id: links.projectId }, select: { clientId: true } })
  return project?.clientId ? { ...links, clientId: project.clientId } : links
}
