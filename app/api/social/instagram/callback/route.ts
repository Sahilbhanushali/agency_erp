import { NextResponse } from "next/server"
import { logAuditAction } from "@/lib/audit"
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchProfile,
  InstagramApiError,
} from "@/lib/instagram/client"
import { redactSecrets, sealToken } from "@/lib/instagram/token-vault"
import { prisma } from "@/lib/prisma"

/**
 * Instagram redirects the browser here after the user accepts or declines.
 *
 * Unauthenticated by necessity — it is Meta's redirect, not an app fetch — so the
 * `state` row carries the entire trust decision: who started this, for which client,
 * whether it has already been used, and whether it is still within its window. The
 * authorisation code is single-use and expires in an hour; a replayed callback finds
 * a consumed state and is refused before any token exchange happens.
 */
export const dynamic = "force-dynamic"

/** Sends the browser somewhere in-app with a result the page can explain. */
function finish(request: Request, path: string, params: Record<string, string>) {
  const url = new URL(path, new URL(request.url).origin)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url)
}

const ACCOUNTS = "/dashboard/social/accounts"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")
  const errorReason = url.searchParams.get("error_reason")

  // The user pressed Cancel. Not a failure worth alarming anyone about.
  if (error) {
    return finish(request, ACCOUNTS, {
      status: "cancelled",
      message: errorReason === "user_denied" ? "Authorisation was cancelled." : "Instagram declined the request.",
    })
  }

  if (!code || !state) {
    return finish(request, ACCOUNTS, { status: "error", message: "Instagram returned an incomplete response." })
  }

  const pending = await prisma.socialOAuthState.findUnique({ where: { state } })

  // One row answers all of: unknown, replayed, and expired.
  if (!pending || pending.consumedAt || pending.expiresAt < new Date()) {
    console.warn("[instagram/callback] rejected state", {
      known: Boolean(pending),
      replayed: Boolean(pending?.consumedAt),
      expired: pending ? pending.expiresAt < new Date() : null,
    })
    return finish(request, ACCOUNTS, {
      status: "error",
      message: "This connection link is no longer valid. Start again from Social Accounts.",
    })
  }

  // Burn it before the exchange, so two simultaneous callbacks cannot both proceed.
  const claimed = await prisma.socialOAuthState.updateMany({
    where: { id: pending.id, consumedAt: null },
    data: { consumedAt: new Date() },
  })
  if (claimed.count !== 1) {
    return finish(request, ACCOUNTS, { status: "error", message: "That connection was already completed." })
  }

  const returnTo = pending.returnTo ?? ACCOUNTS

  try {
    const shortLived = await exchangeCodeForToken(code)
    const longLived = await exchangeForLongLivedToken(shortLived.accessToken)
    const profile = await fetchProfile(longLived.accessToken)

    // An Instagram account may only be attached in one place. Re-authorising the same
    // account is fine; silently moving it to a different client is not.
    const existing = await prisma.socialAccount.findUnique({
      where: { platform_igUserId: { platform: "INSTAGRAM", igUserId: profile.id } },
      select: { id: true, clientId: true },
    })

    const targetClientId = pending.clientId ?? null
    if (existing && existing.clientId !== targetClientId && pending.reconnectAccountId !== existing.id) {
      return finish(request, returnTo, {
        status: "error",
        message: `@${profile.username} is already connected to another client. Disconnect it there first.`,
      })
    }

    const sealed = sealToken(longLived.accessToken)
    const common = {
      username: profile.username,
      accountType: profile.accountType ?? null,
      profilePictureUrl: profile.profilePictureUrl ?? null,
      accessTokenEnc: sealed,
      tokenExpiresAt: longLived.expiresAt,
      tokenRefreshedAt: new Date(),
      scopes: shortLived.permissions,
      status: "CONNECTED" as const,
      statusMessage: null,
      lastSyncedAt: new Date(),
      disconnectedAt: null,
    }

    const account = await prisma.socialAccount.upsert({
      where: { platform_igUserId: { platform: "INSTAGRAM", igUserId: profile.id } },
      create: {
        platform: "INSTAGRAM",
        igUserId: profile.id,
        clientId: targetClientId,
        connectedById: pending.userId,
        ...common,
      },
      update: { ...common, clientId: targetClientId, connectedById: pending.userId },
      select: { id: true, username: true },
    })

    await logAuditAction({
      userId: String(pending.userId),
      action: existing ? "RECONNECT_SOCIAL_ACCOUNT" : "CONNECT_SOCIAL_ACCOUNT",
      entityType: "SocialAccount",
      entityId: account.id,
      // Never the token, and never the code — only what happened.
      newValues: JSON.stringify({ platform: "INSTAGRAM", username: account.username, clientId: targetClientId }),
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    })

    return finish(request, returnTo, { status: "connected", account: account.username })
  } catch (err) {
    const safe =
      err instanceof InstagramApiError
        ? `${err.message}: ${err.detail}`
        : redactSecrets(err instanceof Error ? err.message : String(err))

    console.error("[instagram/callback]", safe)

    // Meta's wording is for developers; the user gets something actionable instead.
    return finish(request, returnTo, {
      status: "error",
      message: "Instagram could not complete the connection. Please try again.",
    })
  }
}
