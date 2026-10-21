import { NextResponse, type NextRequest } from "next/server"
import { isCronRequest } from "@/lib/cron-auth"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { InstagramApiError } from "@/lib/instagram/client"
import { openToken, redactSecrets } from "@/lib/instagram/token-vault"
import {
  fetchAccountDay,
  fetchAccountProfile,
  fetchMediaInsights,
  fetchRecentMedia,
} from "@/lib/instagram/insights"

/**
 * Pulls Instagram numbers into our own tables.
 *
 * Runs on a schedule rather than on page load because of what Instagram does with
 * these numbers: they keep moving for up to 48 hours, story insights vanish after 24,
 * and the Graph API is rate-limited per user. A dashboard that called Meta directly
 * would be slow, lossy and throttled.
 *
 * Registered in lib/jobs/registry.ts as `instagram-insights-sync`.
 */
export const dynamic = "force-dynamic"

/**
 * Re-read the last few days every run. Meta revises recent figures for up to 48
 * hours, so a day captured once and never revisited is wrong more often than not.
 */
const DAYS_TO_REFRESH = 3
/** Enough to cover a busy account between runs without burning the rate limit. */
const MEDIA_PER_ACCOUNT = 25

const int = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null

export async function POST(request: NextRequest) {
  if (!isCronRequest(request)) {
    const auth = await requireCan("social_accounts", "update")
    if (!auth.ok) return auth.response
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { platform: "INSTAGRAM", status: "CONNECTED" },
    select: { id: true, igUserId: true, username: true, accessTokenEnc: true },
  })

  let daysWritten = 0
  let mediaWritten = 0
  const failures: string[] = []

  for (const account of accounts) {
    let token: string
    try {
      token = openToken(account.accessTokenEnc)
    } catch {
      failures.push(`@${account.username}: unreadable token`)
      continue
    }

    try {
      // --- account level -----------------------------------------------------
      // The profile call is allowed to fail on its own: a missing follower count
      // should not cost us the day's reach and interactions.
      let followersCount: number | null = null
      try {
        followersCount = int((await fetchAccountProfile(token)).followersCount)
      } catch (error) {
        console.warn(
          `[instagram/insights] @${account.username} profile:`,
          redactSecrets(error instanceof Error ? error.message : String(error)),
        )
      }

      for (let back = 0; back < DAYS_TO_REFRESH; back++) {
        const day = new Date()
        day.setUTCDate(day.getUTCDate() - back)
        day.setUTCHours(0, 0, 0, 0)

        const metrics = await fetchAccountDay(account.igUserId, token, day)
        const row = {
          reach: int(metrics.reach),
          views: int(metrics.views),
          totalInteractions: int(metrics.total_interactions),
          accountsEngaged: int(metrics.accounts_engaged),
          likes: int(metrics.likes),
          comments: int(metrics.comments),
          shares: int(metrics.shares),
          saves: int(metrics.saves),
          // Only meaningful for today; older rows keep whatever they were written with.
          ...(back === 0 && followersCount !== null ? { followersCount } : {}),
          raw: metrics,
          fetchedAt: new Date(),
        }

        await prisma.instagramAccountInsight.upsert({
          where: { socialAccountId_date: { socialAccountId: account.id, date: day } },
          create: { socialAccountId: account.id, date: day, ...row },
          update: row,
        })
        daysWritten++
      }

      // --- per media ---------------------------------------------------------
      const media = await fetchRecentMedia(account.igUserId, token, MEDIA_PER_ACCOUNT)

      // Link media back to the post that produced it, where this app published it.
      const publishedHere = await prisma.instagramPublishJob.findMany({
        where: { mediaId: { in: media.map((m) => m.id) } },
        select: { mediaId: true, postId: true },
      })
      const postByMedia = new Map(
        publishedHere.filter((j) => j.mediaId).map((j) => [j.mediaId as string, j.postId]),
      )

      for (const item of media) {
        const metrics = await fetchMediaInsights(item.id, token, item.mediaProductType)
        // null means Meta has nothing to report — a quiet story, or a carousel child.
        if (metrics === null) continue

        const row = {
          postId: postByMedia.get(item.id) ?? null,
          mediaType: item.mediaProductType ?? item.mediaType ?? null,
          permalink: item.permalink ?? null,
          caption: item.caption ?? null,
          thumbnailUrl: item.thumbnailUrl ?? null,
          publishedAt: item.timestamp ? new Date(item.timestamp) : null,
          reach: int(metrics.reach),
          views: int(metrics.views),
          // like_count on the media object is live; the insights metric lags.
          likes: int(metrics.likes) ?? int(item.likeCount),
          comments: int(metrics.comments) ?? int(item.commentsCount),
          shares: int(metrics.shares),
          saved: int(metrics.saved),
          totalInteractions: int(metrics.total_interactions),
          avgWatchTimeMs: int(metrics.ig_reels_avg_watch_time),
          raw: metrics,
          fetchedAt: new Date(),
        }

        await prisma.instagramMediaInsight.upsert({
          where: { socialAccountId_mediaId: { socialAccountId: account.id, mediaId: item.id } },
          create: { socialAccountId: account.id, mediaId: item.id, ...row },
          update: row,
        })
        mediaWritten++
      }

      await prisma.socialAccount.update({
        where: { id: account.id },
        data: { lastSyncedAt: new Date() },
      })
    } catch (error) {
      const safe = redactSecrets(error instanceof Error ? error.message : String(error))

      // A dead token is the account's problem, not this job's — say so where the
      // person managing connections will see it.
      if (error instanceof InstagramApiError && error.isAuthError) {
        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            status: "REAUTH_REQUIRED",
            statusMessage: "Instagram rejected the stored token. Reconnect this account.",
          },
        })
      }

      console.error(`[instagram/insights] @${account.username}:`, safe)
      failures.push(`@${account.username}`)
    }
  }

  return NextResponse.json({
    ok: failures.length === 0,
    message: `Instagram insights — ${daysWritten} account-days, ${mediaWritten} posts, ${failures.length} accounts failed`,
    accounts: accounts.length,
    daysWritten,
    mediaWritten,
    failed: failures.length,
  })
}
