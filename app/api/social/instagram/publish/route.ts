import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { EnqueueError, enqueuePost } from "@/lib/instagram/queue"
import { logAuditAction } from "@/lib/audit"

/**
 * Schedules a post for Instagram, or pulls it back.
 *
 * Nothing here talks to Meta. It validates what can be known up front and writes a
 * queue row; the worker at /api/social/instagram/process-queue does the publishing.
 * Separating them is what makes publishing survive a browser tab closing, a deploy,
 * or the request timing out halfway through.
 */
export const dynamic = "force-dynamic"

const enqueueSchema = z.object({
  postId: z.string().min(1),
  socialAccountId: z.string().min(1),
  /** Omitted means "use the post's own scheduled time, or now". */
  scheduledFor: z.string().datetime().optional(),
})

export async function POST(request: NextRequest) {
  const auth = await requireCan("posts", "publish")
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 })
  }

  const parsed = enqueueSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  const userId = Number((auth.session as any)?.user?.id)

  try {
    const job = await enqueuePost({
      postId: parsed.data.postId,
      socialAccountId: parsed.data.socialAccountId,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : undefined,
      userId: Number.isFinite(userId) ? userId : undefined,
    })

    return NextResponse.json({
      id: job.id,
      status: job.status,
      scheduledFor: job.scheduledFor,
      mediaType: job.mediaType,
    })
  } catch (error) {
    // EnqueueError messages are written for the person scheduling the post.
    if (error instanceof EnqueueError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[instagram/publish] enqueue failed:", error)
    return NextResponse.json({ error: "Could not schedule this post" }, { status: 500 })
  }
}

/**
 * This post's queue row, plus the accounts it could be published to.
 *
 * Both in one response on purpose: the composer would otherwise need
 * `social_accounts:read` as well, and someone allowed to publish a post is not
 * necessarily allowed to administer connections. Only id, username and status are
 * returned — never a token, encrypted or otherwise.
 */
export async function GET(request: NextRequest) {
  const auth = await requireCan("posts", "read")
  if (!auth.ok) return auth.response

  const postId = request.nextUrl.searchParams.get("postId")
  if (!postId) return NextResponse.json({ error: "postId is required" }, { status: 400 })

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      type: true,
      caption: true,
      scheduledAt: true,
      project: { select: { client: { select: { id: true } } } },
      _count: { select: { assets: true } },
    },
  })
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

  const clientId = post.project?.client?.id ?? null

  const [job, accounts] = await Promise.all([
    prisma.instagramPublishJob.findUnique({
      where: { postId },
      // Never the whole row: containerId and claimToken are internal plumbing.
      select: {
        id: true,
        status: true,
        scheduledFor: true,
        mediaType: true,
        attempts: true,
        maxAttempts: true,
        nextAttemptAt: true,
        lastError: true,
        permalink: true,
        publishedAt: true,
        socialAccount: { select: { id: true, username: true, status: true } },
      },
    }),
    prisma.socialAccount.findMany({
      // This client's own accounts, plus the agency's (clientId null). Another
      // client's account is never an option here.
      where: {
        platform: "INSTAGRAM",
        status: "CONNECTED",
        OR: [{ clientId: null }, ...(clientId ? [{ clientId }] : [])],
      },
      select: { id: true, username: true, profilePictureUrl: true, clientId: true },
      orderBy: { username: "asc" },
    }),
  ])

  return NextResponse.json({
    job,
    accounts,
    post: {
      type: post.type,
      hasCaption: !!post.caption?.trim(),
      assetCount: post._count.assets,
      scheduledAt: post.scheduledAt,
    },
  })
}

const cancelSchema = z.object({ postId: z.string().min(1) })

/**
 * Cancels a queued post.
 *
 * Only while it is still waiting: once a worker owns the row it may already have a
 * container at Meta, and cancelling then would leave the database disagreeing with
 * what is actually on the account.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireCan("posts", "publish")
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 })
  }

  const parsed = cancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 })
  }

  const { count } = await prisma.instagramPublishJob.updateMany({
    where: { postId: parsed.data.postId, status: "PENDING" },
    data: { status: "CANCELLED", claimToken: null, claimedAt: null },
  })

  if (count === 0) {
    const job = await prisma.instagramPublishJob.findUnique({
      where: { postId: parsed.data.postId },
      select: { status: true },
    })
    if (!job) return NextResponse.json({ error: "This post is not queued" }, { status: 404 })
    return NextResponse.json(
      {
        error:
          job.status === "PUBLISHED"
            ? "This post is already live on Instagram and cannot be unpublished from here."
            : "This post is already being published and can no longer be cancelled.",
      },
      { status: 409 },
    )
  }

  const userId = (auth.session as any)?.user?.id
  await logAuditAction({
    userId: String(userId ?? "system"),
    action: "INSTAGRAM_PUBLISH_CANCELLED",
    entityType: "POST",
    entityId: parsed.data.postId,
  })

  return NextResponse.json({ cancelled: true })
}
