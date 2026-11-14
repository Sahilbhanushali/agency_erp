import { transitionPost } from "@/lib/posts/workflow"
import { isSchedulable, stageOf, type WorkflowStatus } from "@/lib/posts/workflow-rules"
import { isSocialPublishable } from "@/lib/posts/content-types"
import { randomUUID } from "node:crypto"
import type { InstagramPublishJob, PublishJobStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { logAuditAction } from "@/lib/audit"
import { APP_BASE_URL } from "@/lib/utils"
import { InstagramApiError } from "./client"
import {
  MediaRuleError,
  VIDEO,
  backoffMs,
  metaMediaType,
  toPublicUrl as toPublicUrlWithBase,
  validateMedia,
} from "./media-rules"
import { openToken, redactSecrets } from "./token-vault"
import {
  containerStatus,
  createCarouselItem,
  createContainer,
  fetchMedia,
  publishContainer,
  publishingQuota,
  recentMedia,
  type MediaSpec,
} from "./publisher"

/**
 * The Instagram publishing queue.
 *
 * The thing this exists to prevent is publishing the same post twice. Instagram has no
 * idempotency key, and publishing is a two-step protocol — create a container, then
 * publish it — so a worker that dies in the gap, or two workers that pick up the same
 * row, can put the same creative on a client's feed twice. That is not recoverable by
 * an apology; it has to be impossible by construction.
 *
 * Three things make it so:
 *   1. postId is unique, so a post cannot be queued twice.
 *   2. Claiming is a conditional UPDATE, so exactly one worker can own a row.
 *   3. The container id is written to the database *before* publishing is attempted,
 *      and a resumed job asks Meta what happened to that container rather than
 *      starting over. A container that reports PUBLISHED is already live.
 */

/** How long a worker may hold a row before it is assumed dead and reclaimed. */
const STALE_CLAIM_MS = 15 * 60_000
/** Meta advises polling a container about once a minute. */
const PROCESSING_RECHECK_MS = 60_000
/** Backoff ceiling, so a long outage does not push a job a day into the future. */
const MAX_BACKOFF_MS = 60 * 60_000

/** Re-exported so callers keep one import for "why can this post not be published". */
export { MediaRuleError as EnqueueError } from "./media-rules"

/** The rules module is base-URL agnostic; this installation's base is applied here. */
const toPublicUrl = (url: string) => toPublicUrlWithBase(url, APP_BASE_URL)

export interface EnqueueInput {
  postId: string
  socialAccountId: string
  /** Defaults to the post's scheduled time, or now. */
  scheduledFor?: Date
  userId?: number
}

/**
 * Validates everything that can be known up front, then creates or replaces this
 * post's queue row. Nothing reaches Meta here.
 */
export async function enqueuePost({ postId, socialAccountId, scheduledFor, userId }: EnqueueInput) {
  const [post, account] = await Promise.all([
    prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        type: true,
        caption: true,
        status: true,
        requiresClientApproval: true,
        scheduledAt: true,
        assets: { select: { url: true, type: true }, orderBy: { order: "asc" } },
      },
    }),
    prisma.socialAccount.findUnique({
      where: { id: socialAccountId },
      select: { id: true, status: true, username: true, platform: true },
    }),
  ])

  if (!post) throw new MediaRuleError("That post no longer exists.", 404)
  if (!account) throw new MediaRuleError("That Instagram account is not connected here.", 404)
  if (account.platform !== "INSTAGRAM") {
    throw new MediaRuleError("That account is not an Instagram account.")
  }
  if (account.status !== "CONNECTED") {
    throw new MediaRuleError(
      `@${account.username} needs to be reconnected before anything can be published to it.`,
      409,
    )
  }

  // Nothing reaches a platform before every required approval is in. This used to queue
  // any post at all — a draft, or one still waiting for its client.
  if (!isSocialPublishable(post.type)) {
    throw new MediaRuleError("Presentations are internal deliverables and are not published to Instagram.")
  }
  const state = { status: post.status as WorkflowStatus, requiresClientApproval: post.requiresClientApproval }
  if (post.status !== "SCHEDULED" && !isSchedulable(state)) {
    throw new MediaRuleError(
      stageOf(state) === "PENDING_CLIENT"
        ? "This post is waiting for client approval and cannot be published yet."
        : "Only approved posts can be published.",
      409,
    )
  }

  const existing = await prisma.instagramPublishJob.findUnique({
    where: { postId },
    select: { id: true, status: true },
  })
  if (existing?.status === "PUBLISHED") {
    throw new MediaRuleError("This post has already been published to Instagram.", 409)
  }
  if (existing && ["CLAIMED", "PROCESSING"].includes(existing.status)) {
    throw new MediaRuleError("This post is being published right now. Wait for it to finish.", 409)
  }

  const mediaType = metaMediaType(post.type)

  // Reference assets are mood-board material, not the deliverable.
  const assets = post.assets.filter((a) => a.type !== "link")
  const urls = validateMedia(mediaType, assets.map((a) => toPublicUrl(a.url)))

  const when = scheduledFor ?? post.scheduledAt ?? new Date()
  const caption = post.caption?.trim() || undefined
  const payload = {
    socialAccountId,
    scheduledFor: when,
    status: "PENDING" as PublishJobStatus,
    mediaType,
    caption,
    mediaUrls: urls,
    // A re-queue starts clean: a stale container id would be resumed instead.
    containerId: null,
    mediaId: null,
    permalink: null,
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    claimedAt: null,
    claimToken: null,
    createdById: userId ?? null,
  }

  const job = await prisma.instagramPublishJob.upsert({
    where: { postId },
    create: { postId, ...payload },
    update: payload,
  })

  await logAuditAction({
    userId: String(userId ?? "system"),
    action: "INSTAGRAM_PUBLISH_QUEUED",
    entityType: "POST",
    entityId: postId,
    newValues: JSON.stringify({
      jobId: job.id,
      account: `@${account.username}`,
      mediaType,
      scheduledFor: when.toISOString(),
    }),
  })

  return job
}

/**
 * Takes ownership of jobs that are due.
 *
 * The conditional UPDATE is what makes this safe: two workers running the same query
 * see the same candidates, but only one UPDATE can move a row out of PENDING, so the
 * loser claims nothing. The token is then used to read back exactly what was won.
 */
export async function claimDueJobs(limit = 5): Promise<InstagramPublishJob[]> {
  const now = new Date()
  const token = randomUUID()

  const candidates = await prisma.instagramPublishJob.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: now },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    select: { id: true },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  })
  if (candidates.length === 0) return []

  await prisma.instagramPublishJob.updateMany({
    where: { id: { in: candidates.map((c) => c.id) }, status: "PENDING" },
    data: { status: "CLAIMED", claimToken: token, claimedAt: now, attempts: { increment: 1 } },
  })

  return prisma.instagramPublishJob.findMany({ where: { claimToken: token } })
}

/**
 * Returns rows abandoned by a worker that died.
 *
 * They go back to PENDING rather than being retried blindly — runJob() will see the
 * container id and ask Meta what became of it before doing anything irreversible.
 */
export async function releaseStaleClaims(): Promise<number> {
  const { count } = await prisma.instagramPublishJob.updateMany({
    where: {
      status: { in: ["CLAIMED", "PROCESSING"] },
      claimedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) },
    },
    data: { status: "PENDING", claimToken: null, claimedAt: null },
  })
  return count
}

const backoffFrom = (attempts: number) => new Date(Date.now() + backoffMs(attempts, MAX_BACKOFF_MS))

/** Put the job back without blaming it — used for "not our turn yet" outcomes. */
async function requeue(job: InstagramPublishJob, when: Date, note: string, keepAttempt = false) {
  await prisma.instagramPublishJob.update({
    where: { id: job.id },
    data: {
      status: "PENDING",
      nextAttemptAt: when,
      claimToken: null,
      claimedAt: null,
      lastError: note,
      // A wait is not a failed attempt; charging one would exhaust the budget on a queue.
      ...(keepAttempt ? {} : { attempts: Math.max(job.attempts - 1, 0) }),
    },
  })
  return { jobId: job.id, outcome: "waiting" as const, note }
}

async function fail(job: InstagramPublishJob, reason: string) {
  await prisma.instagramPublishJob.update({
    where: { id: job.id },
    data: { status: "FAILED", lastError: reason, claimToken: null, claimedAt: null },
  })
  await logAuditAction({
    userId: String(job.createdById ?? "system"),
    action: "INSTAGRAM_PUBLISH_FAILED",
    entityType: "POST",
    entityId: job.postId,
    newValues: JSON.stringify({ jobId: job.id, reason }),
  })
  return { jobId: job.id, outcome: "failed" as const, note: reason }
}

/**
 * Records a verified publish, in the database and on the post itself.
 *
 * Only ever called with a media id Meta has given us, because "do not mark content as
 * published until success has been verified" is the whole point of the queue.
 */
async function markPublished(job: InstagramPublishJob, mediaId: string, permalink?: string) {
  await prisma.$transaction([
    prisma.instagramPublishJob.update({
      where: { id: job.id },
      data: {
        status: "PUBLISHED",
        mediaId,
        permalink: permalink ?? null,
        publishedAt: new Date(),
        claimToken: null,
        claimedAt: null,
        lastError: null,
      },
    }),
    prisma.postPlatform.updateMany({
      where: { postId: job.postId, platform: "INSTAGRAM" },
      data: { isPosted: true },
    }),
  ])

  // The post's status moves through the workflow engine (timeline + notifications),
  // as a SYSTEM actor: this is the verified publishing result.
  try {
    await transitionPost({
      postId: job.postId,
      action: "PUBLISH",
      actor: { type: "SYSTEM", name: "Instagram" },
      reason: "Published to Instagram",
      metadata: { source: "instagram", jobId: job.id, mediaId, ...(permalink ? { permalink } : {}) },
    })
  } catch (error) {
    // The media IS live on Instagram; the job row above already records that. If the
    // post was moved meanwhile (e.g. edited back into review) say so loudly rather
    // than overwrite the newer workflow state.
    console.error(`[instagram] published job ${job.id}, but post ${job.postId} could not be marked published:`, error)
  }

  await logAuditAction({
    userId: String(job.createdById ?? "system"),
    action: "INSTAGRAM_PUBLISHED",
    entityType: "POST",
    entityId: job.postId,
    newValues: JSON.stringify({ jobId: job.id, mediaId, permalink }),
  })

  return { jobId: job.id, outcome: "published" as const, note: permalink ?? mediaId }
}

export type JobOutcome = Awaited<ReturnType<typeof runJob>>

/**
 * Advances one claimed job by one step.
 *
 * Every path that could publish twice is guarded by asking Meta first. The function is
 * safe to call again on the same row at any point.
 */
export async function runJob(job: InstagramPublishJob) {
  // Already done. Nothing here is idempotent by accident, so say so and stop.
  if (job.mediaId) {
    return markPublished(job, job.mediaId, job.permalink ?? undefined)
  }

  const account = await prisma.socialAccount.findUnique({
    where: { id: job.socialAccountId },
    select: { id: true, igUserId: true, username: true, status: true, accessTokenEnc: true },
  })
  if (!account) return fail(job, "The Instagram account this post was queued for has been removed.")
  if (account.status !== "CONNECTED") {
    return fail(job, `@${account.username} is not connected. Reconnect it and schedule the post again.`)
  }

  let token: string
  try {
    token = openToken(account.accessTokenEnc)
  } catch {
    return fail(job, "The stored access token could not be read. Reconnect this account.")
  }

  const urls = Array.isArray(job.mediaUrls) ? (job.mediaUrls as string[]) : []
  if (urls.length === 0) return fail(job, "This job has no media attached.")

  try {
    // ---- resume: a container already exists, so find out what happened to it ----
    if (job.containerId) {
      const state = await containerStatus(job.containerId, token)

      if (state === "PUBLISHED") {
        // The worker died between publishing and recording it. The post is live; find
        // its media id rather than publishing a second copy.
        const match = (await recentMedia(account.igUserId, token)).find(
          (m) => (m.caption ?? "") === (job.caption ?? ""),
        )
        return markPublished(job, match?.id ?? job.containerId, match?.permalink)
      }

      if (state === "IN_PROGRESS") {
        await prisma.instagramPublishJob.update({
          where: { id: job.id },
          data: { status: "PROCESSING" },
        })
        return requeue(
          job,
          new Date(Date.now() + PROCESSING_RECHECK_MS),
          "Instagram is still processing the media.",
        )
      }

      if (state === "EXPIRED" || state === "ERROR") {
        // The container is unusable. Drop it so the next attempt builds a fresh one.
        await prisma.instagramPublishJob.update({
          where: { id: job.id },
          data: { containerId: null },
        })
        if (job.attempts >= job.maxAttempts) {
          return fail(job, `Instagram reported the upload as ${state.toLowerCase()} after ${job.attempts} attempts.`)
        }
        return requeue(
          job,
          backoffFrom(job.attempts),
          `Instagram reported the upload as ${state.toLowerCase()}. Retrying.`,
          true,
        )
      }

      // FINISHED — fall through and publish it below.
    }

    // ---- no container yet: check the allowance, then build one ----
    if (!job.containerId) {
      const quota = await publishingQuota(account.igUserId, token)
      if (quota.exhausted) {
        return requeue(
          job,
          new Date(Date.now() + 30 * 60_000),
          `@${account.username} has used its ${quota.cap}-post daily allowance. Waiting.`,
        )
      }

      let spec: MediaSpec
      if (job.mediaType === "CAROUSEL") {
        const children: string[] = []
        for (const url of urls) {
          children.push(
            await createCarouselItem(
              account.igUserId,
              token,
              VIDEO.test(url) ? { videoUrl: url } : { imageUrl: url },
            ),
          )
        }
        spec = { mediaType: "CAROUSEL", children, caption: job.caption ?? undefined }
      } else if (job.mediaType === "REELS") {
        spec = { mediaType: "REELS", videoUrl: urls[0], caption: job.caption ?? undefined }
      } else if (job.mediaType === "STORIES") {
        spec = VIDEO.test(urls[0])
          ? { mediaType: "STORIES", videoUrl: urls[0] }
          : { mediaType: "STORIES", imageUrl: urls[0] }
      } else {
        spec = { mediaType: "IMAGE", imageUrl: urls[0], caption: job.caption ?? undefined }
      }

      const containerId = await createContainer(account.igUserId, token, spec)

      // Written before anything is published. If this process dies on the next line,
      // the resume path above finds the container instead of creating another.
      await prisma.instagramPublishJob.update({
        where: { id: job.id },
        data: { containerId, status: "PROCESSING" },
      })
      job = { ...job, containerId, status: "PROCESSING" }

      const state = await containerStatus(containerId, token)
      if (state !== "FINISHED") {
        return requeue(
          job,
          new Date(Date.now() + PROCESSING_RECHECK_MS),
          "Instagram is preparing the media.",
        )
      }
    }

    // ---- publish ----
    const mediaId = await publishContainer(account.igUserId, token, job.containerId!)

    // Read it back, so "published" means a post that exists rather than a 200 response.
    let permalink: string | undefined
    try {
      permalink = (await fetchMedia(mediaId, token)).permalink
    } catch {
      // The post is live — Meta returned its id. Only the permalink is missing.
    }

    return markPublished(job, mediaId, permalink)
  } catch (error) {
    const safe = redactSecrets(error instanceof Error ? error.message : String(error))
    const detail =
      error instanceof InstagramApiError ? `${safe} ${redactSecrets(error.detail)}`.trim() : safe

    if (error instanceof InstagramApiError && error.isAuthError) {
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          status: "REAUTH_REQUIRED",
          statusMessage: "Instagram rejected the stored token. Reconnect this account.",
        },
      })
      return fail(job, `Instagram rejected the request for @${account.username}. Reconnect the account.`)
    }

    console.error(`[instagram/queue] job ${job.id}:`, detail)

    if (job.attempts >= job.maxAttempts) {
      return fail(job, `Gave up after ${job.attempts} attempts. Last error: ${detail}`.slice(0, 1000))
    }
    return requeue(job, backoffFrom(job.attempts), detail.slice(0, 1000), true)
  }
}
