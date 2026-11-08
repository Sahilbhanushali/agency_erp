import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"
import { assertPostAccess, transitionPost, workflowErrorResponse } from "@/lib/posts/workflow"
import { isSchedulable, type WorkflowStatus } from "@/lib/posts/workflow-rules"

const bodySchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }).nullable(),
  expectedVersion: z.number().int().positive().optional(),
})

/**
 * Set, move or clear a post's publishing date.
 *
 *   ready (all approvals in) + date → SCHEDULED          (posts:publish)
 *   scheduled + new date            → rescheduled         (posts:publish)
 *   scheduled + null                → back to approved    (posts:publish)
 *   anything else + date            → a planned date only; the post is NOT scheduled
 *                                     until every required approval is in (posts:update)
 *
 * This used to schedule any APPROVED post — including one still waiting for its client —
 * and could never schedule a client-approved (C_APPROVED) one.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id: postId } = await context.params

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid publishing date and time." }, { status: 422 })
  }
  const { expectedVersion } = parsed.data
  const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { status: true, requiresClientApproval: true, version: true },
    })
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })
    const state = { status: post.status as WorkflowStatus, requiresClientApproval: post.requiresClientApproval }
    const actor = { type: "USER" as const, session: auth.session, userId: auth.userId }

    if (post.status === "SCHEDULED") {
      const result = await transitionPost({
        postId,
        action: scheduledAt ? "RESCHEDULE" : "UNSCHEDULE",
        actor,
        expectedVersion,
        scheduledAt: scheduledAt ?? undefined,
      })
      return NextResponse.json({ post: result.post, scheduled: !!scheduledAt })
    }

    if (scheduledAt && isSchedulable(state)) {
      const result = await transitionPost({ postId, action: "SCHEDULE", actor, expectedVersion, scheduledAt })
      return NextResponse.json({ post: result.post, scheduled: true })
    }

    // Not ready yet: remember the intended date without scheduling anything.
    await assertPostAccess(auth.session, auth.userId, postId, "update")
    const { count } = await prisma.post.updateMany({
      where: { id: postId, version: post.version, status: post.status },
      data: { scheduledAt },
    })
    if (count === 0) {
      return NextResponse.json({ error: "This post changed meanwhile. Refresh and try again." }, { status: 409 })
    }
    return NextResponse.json({
      post: { id: postId, status: post.status, version: post.version },
      scheduled: false,
      message: "Planned date saved. The post is scheduled once every required approval is in.",
    })
  } catch (error) {
    return workflowErrorResponse(error)
  }
}
