import { Prisma, type PostStatus } from "@prisma/client"
import type { Session } from "next-auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { can, contentScope } from "@/lib/api-auth"
import {
  ACTION_PERMISSION,
  STAGE_LABELS,
  decide,
  stageOf,
  type WorkflowAction,
  type WorkflowStatus,
} from "@/lib/posts/workflow-rules"

/**
 * The one place a post's workflow status changes.
 *
 * Every route that approves, rejects, schedules, publishes or invalidates a post calls
 * `transitionPost`. It:
 *   1. authorizes the actor — permission AND scope (an approver must be able to see the
 *      post; a client only acts through its own share link, checked by the caller);
 *   2. asks the pure rules in workflow-rules.ts whether the transition is legal;
 *   3. applies it with a conditional update on (id, status, version), so a stale screen,
 *      a duplicate click or two concurrent approvals get a 409 instead of a lost update;
 *   4. appends an immutable PostStatusChange row in the same transaction;
 *   5. then writes the audit log and notifies the relevant people, once each.
 */

export class WorkflowError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export const workflowErrorResponse = (error: unknown) => {
  if (error instanceof WorkflowError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  console.error("[post-workflow] unexpected failure:", error)
  return NextResponse.json({ error: "Could not update the post" }, { status: 500 })
}

export type WorkflowActor =
  | { type: "USER"; session: Session; userId: number }
  /**
   * The client: either through a share link (`exportLinkId`) or signed in to the client
   * portal (`userId`). Callers must already have proven the post belongs to this client.
   */
  | { type: "CLIENT"; name: string; email?: string | null; exportLinkId?: string; userId?: number }
  | { type: "SYSTEM"; name: string }

/** Posts a person is attached to — their assigned work, projects they belong to or manage, or posts they created. */
export function postsAttachedTo(userId: number, email?: string | null): Prisma.PostWhereInput {
  return {
    OR: [
      { createdById: userId },
      { assignedToId: userId },
      { assignedUsers: { some: { id: userId } } },
      { project: { managerId: userId } },
      { project: { assignedUsers: { some: { id: userId } } } },
      ...(email ? [{ project: { client: { email } } }] : []),
    ],
  }
}

/** Throws 404 when the user may not see this post at all (no existence leak), 403 without the permission. */
export async function assertPostAccess(
  session: Session,
  userId: number,
  postId: string,
  permission: string,
  module = "posts",
) {
  if (!(await can(session, module, permission))) {
    throw new WorkflowError(403, "FORBIDDEN", "You do not have permission to do this.")
  }
  if ((await contentScope(session)) === "all") return
  const visible = await prisma.post.count({
    where: { AND: [{ id: postId }, postsAttachedTo(userId, session.user?.email)] },
  })
  if (!visible) throw new WorkflowError(404, "NOT_FOUND", "Post not found")
}

export interface TransitionInput {
  postId: string
  action: WorkflowAction
  actor: WorkflowActor
  reason?: string | null
  /** The version the caller's screen was showing. Mismatch → 409, never a silent overwrite. */
  expectedVersion?: number
  scheduledAt?: Date | null
  nextRequiresClientApproval?: boolean
  /** Extra column writes applied atomically with the transition (e.g. an edit's fields). */
  extraData?: Prisma.PostUpdateManyMutationInput
  metadata?: Prisma.InputJsonValue
  /**
   * The permission that authorizes this transition when it is a side effect of another
   * action — e.g. uploading a design (assets:create) submits it. Scope is still checked.
   */
  authorizedBy?: { module: string; action: string }
}

const NOTIFY_TITLES: Partial<Record<WorkflowAction, string>> = {
  SUBMIT: "Post submitted for approval",
  EDIT_INVALIDATE: "Post edited — approval needed again",
  APPROVE: "Post approved",
  REJECT: "Post rejected",
  REQUEST_CHANGES: "Changes requested",
  CLIENT_APPROVE: "Client approved — ready to schedule",
  CLIENT_REQUEST_CHANGES: "Client requested changes",
  SCHEDULE: "Post scheduled",
  RESCHEDULE: "Post rescheduled",
  UNSCHEDULE: "Post unscheduled",
  PUBLISH: "Post published",
  CANCEL: "Post cancelled",
  REOPEN: "Post reopened",
  CLIENT_TOGGLE: "Client approval setting changed",
}

const AUDITED: ReadonlySet<WorkflowAction> = new Set([
  "APPROVE",
  "REJECT",
  "REQUEST_CHANGES",
  "CLIENT_APPROVE",
  "CLIENT_REQUEST_CHANGES",
  "PUBLISH",
  "CANCEL",
  "CLIENT_TOGGLE",
  "EDIT_INVALIDATE",
])

export async function transitionPost(input: TransitionInput) {
  const { postId, action, actor } = input
  const permission = ACTION_PERMISSION[action]

  if (actor.type === "USER") {
    if (!permission) throw new WorkflowError(403, "FORBIDDEN_ACTOR", "Only the client can record a client decision.")
    const by = input.authorizedBy
    await assertPostAccess(actor.session, actor.userId, postId, by?.action ?? permission, by?.module ?? "posts")
  }

  if ((action === "SCHEDULE" || action === "RESCHEDULE") && !input.scheduledAt) {
    throw new WorkflowError(422, "SCHEDULE_REQUIRED", "Choose a publishing date and time.")
  }
  if (input.scheduledAt && Number.isNaN(input.scheduledAt.getTime())) {
    throw new WorkflowError(422, "SCHEDULE_INVALID", "The publishing date is not valid.")
  }

  const actorId = actor.type === "USER" ? actor.userId : null
  const actorName =
    actor.type === "USER" ? (actor.session.user?.name ?? null) : actor.name
  const actorEmail =
    actor.type === "USER" ? (actor.session.user?.email ?? null) : actor.type === "CLIENT" ? (actor.email ?? null) : null
  const now = new Date()

  const result = await prisma.$transaction(
    async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
        select: { id: true, title: true, status: true, version: true, requiresClientApproval: true },
      })
      if (!post) throw new WorkflowError(404, "NOT_FOUND", "Post not found")

      if (input.expectedVersion !== undefined && input.expectedVersion !== post.version) {
        throw new WorkflowError(
          409,
          "STALE",
          "This post changed since you opened it. Refresh to see the latest version.",
        )
      }

      const clientApprovedCurrentVersion =
        action === "CLIENT_TOGGLE"
          ? (await tx.postStatusChange.count({
              where: { postId, action: "CLIENT_APPROVE", version: post.version },
            })) > 0
          : false

      const decision = decide({
        post: { status: post.status as WorkflowStatus, requiresClientApproval: post.requiresClientApproval },
        action,
        actorType: actor.type,
        reason: input.reason,
        nextRequiresClientApproval: input.nextRequiresClientApproval,
        clientApprovedCurrentVersion,
      })
      if (!decision.ok) {
        const status = decision.code === "REASON_REQUIRED" ? 422 : decision.code === "FORBIDDEN_ACTOR" ? 403 : 409
        throw new WorkflowError(status, decision.code, decision.message)
      }

      const to = decision.to as PostStatus
      const data: Prisma.PostUpdateManyMutationInput = {
        ...input.extraData,
        status: to,
        // The legacy mirror every older screen still reads.
        designerHeadApproval: to,
        requiresClientApproval: decision.requiresClientApproval,
        ...(decision.bumpVersion ? { version: { increment: 1 } } : {}),
      }
      if (action === "APPROVE") {
        Object.assign(data, { approvedAt: now, designApprovedAt: now, designApprovedById: actorId })
      }
      if (action === "CLIENT_APPROVE") Object.assign(data, { approvedAt: now })
      if (action === "REJECT" || action === "REQUEST_CHANGES" || action === "CLIENT_REQUEST_CHANGES") {
        Object.assign(data, { rejectedAt: now, designRejectedAt: now, designRejectedById: actorId })
      }
      if (action === "SCHEDULE" || action === "RESCHEDULE") Object.assign(data, { scheduledAt: input.scheduledAt })
      if (action === "PUBLISH") Object.assign(data, { postedAt: now })

      // The write only lands if nobody moved the post since we read it.
      const { count } = await tx.post.updateMany({
        where: { id: postId, status: post.status, version: post.version },
        data,
      })
      if (count === 0) {
        throw new WorkflowError(409, "CONFLICT", "Someone else updated this post at the same time. Refresh and try again.")
      }

      // Keep the staged approval chain (proofing view) consistent with the transition.
      if (action === "CLIENT_APPROVE" || action === "CLIENT_REQUEST_CHANGES") {
        const chain = await tx.approvalChain.findFirst({
          where: { postId, isCompleted: false },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
        if (chain) {
          await tx.approvalStep.updateMany({
            where: { chainId: chain.id, stage: "CLIENT", status: "PENDING" },
            data: {
              status: action === "CLIENT_APPROVE" ? "APPROVED" : "CHANGES_REQUESTED",
              decisionAt: now,
              decisionByName: actorName,
              feedback: input.reason?.trim() || null,
            },
          })
          await tx.approvalChain.update({
            where: { id: chain.id },
            data: { isCompleted: true, finalStatus: action === "CLIENT_APPROVE" ? "APPROVED" : "CHANGES_REQUESTED" },
          })
        }
      }
      if (action === "EDIT_INVALIDATE" && to !== post.status) {
        // The approvals in the current chain were for the previous version. Superseded,
        // not deleted: they stay visible as history, and the next review starts fresh.
        await tx.approvalChain.updateMany({
          where: { postId, finalStatus: { not: "SUPERSEDED" } },
          data: { finalStatus: "SUPERSEDED", isCompleted: true },
        })
      }

      const statusChanged = to !== post.status
      const versionChanged = decision.bumpVersion
      const toggled = decision.requiresClientApproval !== post.requiresClientApproval
      const change =
        statusChanged || versionChanged || toggled || action === "RESCHEDULE"
          ? await tx.postStatusChange.create({
              data: {
                postId,
                action,
                fromStatus: post.status,
                toStatus: to,
                version: post.version,
                reason: input.reason?.trim() || null,
                actorId,
                actorName,
                actorEmail,
                actorType: actor.type,
                metadata: {
                  ...(input.metadata && typeof input.metadata === "object" ? (input.metadata as object) : {}),
                  ...(input.scheduledAt ? { scheduledAt: input.scheduledAt.toISOString() } : {}),
                  ...(toggled ? { requiresClientApproval: decision.requiresClientApproval } : {}),
                  ...(versionChanged ? { newVersion: post.version + 1 } : {}),
                },
              },
            })
          : null

      return {
        post: {
          id: post.id,
          title: post.title,
          from: post.status,
          status: to,
          version: post.version + (versionChanged ? 1 : 0),
          requiresClientApproval: decision.requiresClientApproval,
        },
        change,
      }
    },
    // The post row is the contended row; READ COMMITTED makes a concurrent writer wait
    // rather than fail with MariaDB snapshot-isolation error 1020 (see CLAUDE.md).
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  )

  if (result.change) {
    await afterTransition(input, result.post, actorId, actorName).catch((error) =>
      console.error("[post-workflow] notification/audit failed:", error),
    )
    // Imported lazily: lib/chat/approval imports this module for its access rule.
    await import("@/lib/chat/approval")
      .then(({ noteWorkflowInDiscussion }) =>
        noteWorkflowInDiscussion({
          postId,
          action,
          version: result.post.version,
          actorId,
          actorName,
          reason: input.reason,
        }),
      )
      .catch((error) => console.error("[post-workflow] discussion note failed:", { postId, action, error }))
  }
  return result
}

async function afterTransition(
  input: TransitionInput,
  post: { id: string; title: string; from: PostStatus; status: PostStatus; requiresClientApproval: boolean; version: number },
  actorId: number | null,
  actorName: string | null,
) {
  const { action } = input

  if (AUDITED.has(action)) {
    // Written directly rather than through logAuditAction, whose string userId cannot
    // express "no internal user" — client and system actions would fail to parse.
    await prisma.auditLog.create({ data: {
      userId: actorId,
      action: `POST_${action}`,
      entityType: "Post",
      entityId: post.id,
      oldValues: JSON.stringify({ status: post.from }),
      newValues: JSON.stringify({
        status: post.status,
        version: post.version,
        requiresClientApproval: post.requiresClientApproval,
        reason: input.reason ?? undefined,
        actor: actorName ?? undefined,
      }),
    } })
  }

  const title = NOTIFY_TITLES[action]
  if (!title) return

  const full = await prisma.post.findUnique({
    where: { id: post.id },
    select: {
      createdById: true,
      assignedToId: true,
      assignedUsers: { select: { id: true } },
      project: { select: { managerId: true, name: true } },
    },
  })
  if (!full) return

  const team = [full.createdById, full.assignedToId, ...full.assignedUsers.map((u) => u.id)]
  const manager = full.project.managerId
  // Who needs to know: reviewers hear about work waiting for them; the people doing the
  // work hear about decisions; scheduling outcomes go to both.
  const recipients =
    action === "SUBMIT" || (action === "EDIT_INVALIDATE" && post.from !== post.status)
      ? [manager]
      : action === "APPROVE" || action === "REJECT" || action === "REQUEST_CHANGES"
        ? team
        : [...team, manager]

  const userIds = [...new Set(recipients.filter((id): id is number => !!id && id !== actorId))]
  if (userIds.length === 0) return

  const stage = STAGE_LABELS[stageOf({ status: post.status as WorkflowStatus, requiresClientApproval: post.requiresClientApproval })]
  const by = actorName ? ` by ${actorName}` : ""
  const why = input.reason?.trim() ? ` — “${input.reason.trim().slice(0, 200)}”` : ""
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title,
      message: `“${post.title}” (${full.project.name}) is now ${stage.toLowerCase()}${by}${why}`,
      link: `/dashboard/projects/posts/${post.id}`,
    })),
  })
}

/** Timeline for the post detail page, newest first. */
export function postTimeline(postId: string) {
  return prisma.postStatusChange.findMany({
    where: { postId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      action: true,
      fromStatus: true,
      toStatus: true,
      version: true,
      reason: true,
      actorName: true,
      actorType: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, name: true } },
    },
  })
}
