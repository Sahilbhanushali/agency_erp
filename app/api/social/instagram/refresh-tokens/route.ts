import { NextResponse, type NextRequest } from "next/server"
import { isCronRequest } from "@/lib/cron-auth"
import { requireCan } from "@/lib/api-auth"
import {
  InstagramApiError,
  LONG_LIVED_TOKEN_DAYS,
  REFRESH_MIN_AGE_HOURS,
  refreshLongLivedToken,
} from "@/lib/instagram/client"
import { openToken, redactSecrets, sealToken } from "@/lib/instagram/token-vault"
import { prisma } from "@/lib/prisma"

/**
 * Keeps connected accounts alive.
 *
 * This is not housekeeping — it is load-bearing. An Instagram long-lived token lasts
 * 60 days and, once lapsed, cannot be refreshed at all: the only recovery is asking
 * the client to authorise again. Meta also refuses to refresh a token younger than
 * 24 hours, so this runs daily and renews anything inside the window.
 *
 * Scheduled by lib/jobs/registry.ts as `instagram-token-refresh`.
 */
export const dynamic = "force-dynamic"

/** Renew once a token is within this long of expiry, leaving room for failed days. */
const RENEW_WITHIN_DAYS = 10

export async function POST(request: NextRequest) {
  // Either the scheduler, or an administrator pressing "Run now" in Settings.
  if (!isCronRequest(request)) {
    const auth = await requireCan("social_accounts", "update")
    if (!auth.ok) return auth.response
  }

  const now = Date.now()
  const due = await prisma.socialAccount.findMany({
    where: {
      platform: "INSTAGRAM",
      status: { in: ["CONNECTED", "ERROR"] },
      tokenExpiresAt: { not: null, lte: new Date(now + RENEW_WITHIN_DAYS * 86_400_000) },
    },
    select: { id: true, username: true, accessTokenEnc: true, tokenRefreshedAt: true, tokenExpiresAt: true },
  })

  let refreshed = 0
  let skipped = 0
  const failures: string[] = []

  for (const account of due) {
    // Meta rejects a refresh on a token less than 24 hours old.
    const ageMs = now - (account.tokenRefreshedAt?.getTime() ?? 0)
    if (ageMs < REFRESH_MIN_AGE_HOURS * 3_600_000) {
      skipped++
      continue
    }

    // Past the 60-day window there is nothing to refresh — say so plainly rather
    // than calling Meta and recording a confusing error.
    if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() <= now) {
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          status: "REAUTH_REQUIRED",
          statusMessage: `The ${LONG_LIVED_TOKEN_DAYS}-day token expired and cannot be renewed. Reconnect this account.`,
        },
      })
      failures.push(`@${account.username}: expired`)
      continue
    }

    try {
      const renewed = await refreshLongLivedToken(openToken(account.accessTokenEnc))
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          accessTokenEnc: sealToken(renewed.accessToken),
          tokenExpiresAt: renewed.expiresAt,
          tokenRefreshedAt: new Date(),
          status: "CONNECTED",
          statusMessage: null,
        },
      })
      refreshed++
    } catch (error) {
      const authProblem = error instanceof InstagramApiError && error.isAuthError
      const safe = redactSecrets(error instanceof Error ? error.message : String(error))

      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          // An auth failure means the user revoked us or the token died; a transient
          // one should not demand a reconnect the client does not actually need.
          status: authProblem ? "REAUTH_REQUIRED" : "ERROR",
          statusMessage: authProblem
            ? "Instagram rejected the stored token. Reconnect this account."
            : "Could not reach Instagram to renew the connection. Will retry.",
        },
      })
      console.error(`[instagram/refresh] @${account.username}:`, safe)
      failures.push(`@${account.username}`)
    }
  }

  const message = `Instagram tokens — ${refreshed} refreshed, ${skipped} not yet due, ${failures.length} failed`
  return NextResponse.json({
    ok: failures.length === 0,
    message,
    refreshed,
    skipped,
    failed: failures.length,
  })
}
