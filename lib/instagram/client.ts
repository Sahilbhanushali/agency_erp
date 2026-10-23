import { redactSecrets } from "./token-vault"

/**
 * Thin wrapper over the Instagram API with Instagram Login.
 *
 * Every endpoint and permission name here was read from Meta's current documentation
 * rather than recalled — Instagram's API has two incompatible shapes (Instagram Login
 * vs Facebook Login) with different hosts and different permission names, and mixing
 * them is the usual reason an integration fails in a confusing way.
 *
 * Verified against https://developers.facebook.com/docs/instagram-platform/ :
 *   authorize   https://www.instagram.com/oauth/authorize
 *   exchange    POST https://api.instagram.com/oauth/access_token   (code: 1 hour, single use)
 *   long-lived  GET  https://graph.instagram.com/access_token?grant_type=ig_exchange_token
 *   refresh     GET  https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token
 *   graph       https://graph.instagram.com/<version>
 *
 * Connecting and keeping an account alive live here; publishing lives in publisher.ts,
 * which shares this file's version pinning and error classification.
 */

/** Pinned, not "latest": a silent version bump must never change behaviour under us. */
export const IG_API_VERSION = "v26.0"

export const IG_AUTH_URL = "https://www.instagram.com/oauth/authorize"
export const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
export const IG_GRAPH_HOST = "https://graph.instagram.com"

/**
 * Only what this feature needs. Meta reviews each one, so asking for messaging,
 * comment management or ads here would cost approval time for capability we do not use.
 */
export const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
] as const

/** A long-lived token lasts 60 days and cannot be refreshed once it has lapsed. */
export const LONG_LIVED_TOKEN_DAYS = 60
/** Meta refuses to refresh a token younger than this. */
export const REFRESH_MIN_AGE_HOURS = 24

export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Already redacted — safe to persist or log. */
    readonly detail: string,
    /** Meta's own error subcode, when it sent one. */
    readonly code?: number,
  ) {
    super(message)
    this.name = "InstagramApiError"
  }

  /** True when the account must authorise again rather than be retried. */
  get isAuthError() {
    return this.status === 400 || this.status === 401 || this.code === 190
  }
}

function appCredentials() {
  const clientId = process.env.INSTAGRAM_APP_ID
  const clientSecret = process.env.INSTAGRAM_APP_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET must be set")
  }
  return { clientId, clientSecret }
}

/** Must exactly match a redirect URI registered in the Meta App Dashboard. */
export function redirectUri() {
  const base = process.env.INSTAGRAM_REDIRECT_URI || process.env.NEXTAUTH_URL
  if (!base) throw new Error("INSTAGRAM_REDIRECT_URI or NEXTAUTH_URL must be set")
  return base.endsWith("/api/social/instagram/callback")
    ? base
    : `${base.replace(/\/+$/, "")}/api/social/instagram/callback`
}

/** Where to send the browser to begin authorisation. */
export function authorizationUrl(state: string) {
  const { clientId } = appCredentials()
  const url = new URL(IG_AUTH_URL)
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", redirectUri())
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", IG_SCOPES.join(","))
  url.searchParams.set("state", state)
  return url.toString()
}

/** Shared by the publisher so both halves classify Meta's errors the same way. */
export async function readError(response: Response, context: string): Promise<never> {
  const raw = await response.text().catch(() => "")
  const detail = redactSecrets(raw).slice(0, 1000)

  let code: number | undefined
  try {
    code = JSON.parse(raw)?.error?.code ?? JSON.parse(raw)?.error_type
  } catch {
    // Meta does not always answer with JSON; the redacted body is enough.
  }
  throw new InstagramApiError(`${context} failed (${response.status})`, response.status, detail, code)
}

export interface ShortLivedToken {
  accessToken: string
  userId: string
  permissions: string[]
}

/** Step 1 — swap the one-time authorisation code for a short-lived token. */
export async function exchangeCodeForToken(code: string): Promise<ShortLivedToken> {
  const { clientId, clientSecret } = appCredentials()

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code,
  })

  const response = await fetch(IG_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })
  if (!response.ok) await readError(response, "Authorization code exchange")

  const data = await response.json()
  const permissions: string[] = Array.isArray(data.permissions)
    ? data.permissions
    : typeof data.permissions === "string"
      ? data.permissions.split(",").filter(Boolean)
      : []

  return { accessToken: String(data.access_token), userId: String(data.user_id), permissions }
}

export interface LongLivedToken {
  accessToken: string
  expiresAt: Date
}

/** Step 2 — upgrade to the 60-day token. Server-side only: it needs the app secret. */
export async function exchangeForLongLivedToken(shortLived: string): Promise<LongLivedToken> {
  const { clientSecret } = appCredentials()

  const url = new URL(`${IG_GRAPH_HOST}/access_token`)
  url.searchParams.set("grant_type", "ig_exchange_token")
  url.searchParams.set("client_secret", clientSecret)
  url.searchParams.set("access_token", shortLived)

  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) await readError(response, "Long-lived token exchange")

  const data = await response.json()
  return {
    accessToken: String(data.access_token),
    expiresAt: expiryFrom(data.expires_in),
  }
}

/**
 * Extends a long-lived token by another 60 days. Meta requires the token to be at
 * least 24 hours old and not yet expired; once it has lapsed there is no way back
 * and the account owner must authorise again.
 */
export async function refreshLongLivedToken(current: string): Promise<LongLivedToken> {
  const url = new URL(`${IG_GRAPH_HOST}/refresh_access_token`)
  url.searchParams.set("grant_type", "ig_refresh_token")
  url.searchParams.set("access_token", current)

  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) await readError(response, "Token refresh")

  const data = await response.json()
  return { accessToken: String(data.access_token), expiresAt: expiryFrom(data.expires_in) }
}

export interface InstagramProfile {
  id: string
  username: string
  accountType?: string
  profilePictureUrl?: string
}

/** The authorised professional account behind a token. */
export async function fetchProfile(accessToken: string): Promise<InstagramProfile> {
  const url = new URL(`${IG_GRAPH_HOST}/${IG_API_VERSION}/me`)
  url.searchParams.set("fields", "id,username,account_type,profile_picture_url")
  url.searchParams.set("access_token", accessToken)

  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) await readError(response, "Profile lookup")

  const data = await response.json()
  return {
    id: String(data.id),
    username: String(data.username ?? ""),
    accountType: data.account_type ?? undefined,
    profilePictureUrl: data.profile_picture_url ?? undefined,
  }
}

/** Meta reports seconds; fall back to the documented 60 days if it omits them. */
function expiryFrom(expiresIn: unknown): Date {
  const seconds = Number(expiresIn)
  const ms = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : LONG_LIVED_TOKEN_DAYS * 86_400_000
  return new Date(Date.now() + ms)
}
