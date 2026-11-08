import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSession } from "@/lib/api-auth"
import { transitionPost, workflowErrorResponse } from "@/lib/posts/workflow"

const bodySchema = z.object({
  /** The person confirms the post is actually live; nothing is inferred. */
  confirmed: z.literal(true),
  platform: z.string().trim().max(50).optional(),
  publishedUrl: z.string().trim().url().max(2000).optional(),
  expectedVersion: z.number().int().positive().optional(),
})

/**
 * Record that a scheduled (or ready) post has been published.
 *
 * This used to be a simulation: it waited one second and marked the post POSTED without
 * publishing anything, so "Published" meant nothing. Automatic publishing (Instagram)
 * marks posts published itself, from the platform's success response. This endpoint is
 * the manual path — someone with posts:publish confirming the post is live, optionally
 * with its URL — and it goes through the same transition rules as everything else.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { id: postId } = await context.params

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Confirm that the post is live before marking it published." },
      { status: 422 },
    )
  }
  const { platform, publishedUrl, expectedVersion } = parsed.data

  try {
    const result = await transitionPost({
      postId,
      action: "PUBLISH",
      actor: { type: "USER", session: auth.session, userId: auth.userId },
      expectedVersion,
      reason: platform ? `Published on ${platform}` : "Marked as published",
      metadata: { source: "manual", ...(platform ? { platform } : {}), ...(publishedUrl ? { publishedUrl } : {}) },
    })
    return NextResponse.json({ post: result.post })
  } catch (error) {
    return workflowErrorResponse(error)
  }
}
