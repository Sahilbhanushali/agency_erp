import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { can, contentScope, isClientContact, requireSession } from "@/lib/api-auth"
import {
  WorkflowError,
  postTimeline,
  postsAttachedTo,
  transitionPost,
  workflowErrorResponse,
  type WorkflowActor,
} from "@/lib/posts/workflow"
import {
  ACTION_PERMISSION,
  STAGE_LABELS,
  WORKFLOW_ACTIONS,
  decide,
  stageOf,
  type WorkflowAction,
  type WorkflowStatus,
} from "@/lib/posts/workflow-rules"

export const dynamic = "force-dynamic"

/**
 * The post workflow, in one endpoint.
 *
 *   GET  → current stage, the actions THIS caller may take right now, and the timeline
 *   POST → { action, reason?, expectedVersion?, scheduledAt?, requiresClientApproval? }
 *
 * The UI renders only the actions GET returns; POST re-checks everything regardless,
 * so a hidden button is a convenience, never the security boundary.
 */

const bodySchema = z.object({
  action: z.enum(WORKFLOW_ACTIONS),
  reason: z.string().trim().max(5000).optional(),
  expectedVersion: z.number().int().positive().optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  requiresClientApproval: z.boolean().optional(),
})

/** Edits go through PUT /api/posts/[id]; they are not a button. */
const NOT_A_BUTTON: ReadonlySet<WorkflowAction> = new Set(["EDIT_INVALIDATE"])

async function loadPost(id: string) {
  return prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      version: true,
      requiresClientApproval: true,
      scheduledAt: true,
      project: {
        select: {
          client: { select: { email: true, name: true } },
          manager: { select: { name: true } },
        },
      },
    },
  })
}

/** A signed-in client contact acts as the client — but only on their own client's posts. */
async function clientActorFor(
  session: Parameters<typeof isClientContact>[0],
  post: NonNullable<Awaited<ReturnType<typeof loadPost>>>,
) {
  const email = session?.user?.email
  if (!email || !(await isClientContact(session))) return null
  if (post.project.client?.email?.toLowerCase() !== email.toLowerCase()) return null
  return email
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await context.params

  try {
    const post = await loadPost(id)
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

    const [scope, clientEmail] = await Promise.all([contentScope(auth.session), clientActorFor(auth.session, post)])
    if (scope !== "all" && !clientEmail) {
      const visible = await prisma.post.count({
        where: { AND: [{ id }, postsAttachedTo(auth.userId, auth.session.user?.email)] },
      })
      if (!visible) return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    const permissions = [...new Set(Object.values(ACTION_PERMISSION).filter((p): p is string => !!p))]
    const held = new Map(
      await Promise.all(permissions.map(async (p) => [p, await can(auth.session, "posts", p)] as const)),
    )
    const state = { status: post.status as WorkflowStatus, requiresClientApproval: post.requiresClientApproval }

    const actions = WORKFLOW_ACTIONS.filter((action) => {
      if (NOT_A_BUTTON.has(action) || action === "CLIENT_TOGGLE") return false
      const permission = ACTION_PERMISSION[action]
      const actorType = permission ? "USER" : "CLIENT"
      if (actorType === "CLIENT" && !clientEmail) return false
      if (actorType === "USER" && !held.get(permission!)) return false
      // A placeholder reason so reason-required actions are still offered; the real
      // reason is collected in the dialog and validated on POST.
      return decide({ post: state, action, actorType, reason: "x" }).ok
    })

    return NextResponse.json({
      status: post.status,
      version: post.version,
      requiresClientApproval: post.requiresClientApproval,
      scheduledAt: post.scheduledAt,
      stage: stageOf(state),
      stageLabel: STAGE_LABELS[stageOf(state)],
      actions,
      canToggleClientApproval: held.get("update") === true && post.status !== "POSTED" && post.status !== "CANCELLED",
      // Who the post is waiting on right now, for "who needs to act" in the UI.
      waitingOn:
        stageOf(state) === "PENDING_APPROVAL"
          ? post.project.manager?.name
            ? `Approval by ${post.project.manager.name} (project manager) or another approver`
            : "Approval by someone with approval permission"
          : stageOf(state) === "PENDING_CLIENT"
            ? `Client approval${post.project.client?.name ? ` from ${post.project.client.name}` : ""}`
            : stageOf(state) === "READY_TO_SCHEDULE"
              ? "Scheduling"
              : stageOf(state) === "SCHEDULED"
                ? "Publishing"
                : stageOf(state) === "CHANGES_REQUESTED" || stageOf(state) === "REJECTED" || stageOf(state) === "DRAFT"
                  ? "The creator to edit and submit"
                  : null,
      timeline: await postTimeline(id),
    })
  } catch (error) {
    console.error("[post-workflow] GET failed:", error)
    return NextResponse.json({ error: "Could not load the workflow" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }
  const input = parsed.data
  if (NOT_A_BUTTON.has(input.action)) {
    return NextResponse.json({ error: "Edit the post to change its content." }, { status: 422 })
  }
  if (input.action === "CLIENT_TOGGLE" && input.requiresClientApproval === undefined) {
    return NextResponse.json({ error: "requiresClientApproval is required" }, { status: 422 })
  }

  try {
    let actor: WorkflowActor = { type: "USER", session: auth.session, userId: auth.userId }
    if (input.action === "CLIENT_APPROVE" || input.action === "CLIENT_REQUEST_CHANGES") {
      const post = await loadPost(id)
      if (!post) throw new WorkflowError(404, "NOT_FOUND", "Post not found")
      const clientEmail = await clientActorFor(auth.session, post)
      if (!clientEmail) {
        throw new WorkflowError(403, "FORBIDDEN_ACTOR", "Only this post's client can record a client decision.")
      }
      actor = { type: "CLIENT", name: auth.session.user?.name ?? clientEmail, email: clientEmail, userId: auth.userId }
    }

    const result = await transitionPost({
      postId: id,
      action: input.action,
      actor,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      nextRequiresClientApproval: input.requiresClientApproval,
    })
    return NextResponse.json({ post: result.post })
  } catch (error) {
    return workflowErrorResponse(error)
  }
}
