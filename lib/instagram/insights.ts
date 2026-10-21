import { IG_API_VERSION, IG_GRAPH_HOST, InstagramApiError, readError } from "./client"

/**
 * Instagram Insights, for accounts connected with Instagram Login.
 *
 * The metric names below were read from Meta's current reference rather than recalled,
 * because Instagram retired a lot of them and the replacements are not obvious:
 *
 *   - `impressions` is deprecated for v22.0+ and, since 21 April 2025, for every
 *     version on media created after 2 July 2024. We pin v26.0, so asking for it is
 *     an error rather than a slightly stale number. `views` replaces it.
 *   - `plays`, `video_views` and `clips_replays_count` went the same way for reels,
 *     with `views` and `ig_reels_avg_watch_time` taking over.
 *   - Only `reach` still supports `metric_type=time_series`; everything else must be
 *     asked for a day at a time with `total_value`, which is why the worker walks
 *     days rather than requesting a range.
 *
 * Three constraints shape the caller:
 *   - numbers move for up to 48 hours, so recent days are re-read, not trusted once;
 *   - story insights exist for 24 hours and are then gone permanently;
 *   - an account under 100 followers simply omits some metrics rather than erroring.
 */

/** Account metrics that are safe to request together: all day/total_value. */
export const ACCOUNT_METRICS = [
  "reach",
  "views",
  "total_interactions",
  "accounts_engaged",
  "likes",
  "comments",
  "shares",
  "saves",
] as const

/** Per-media metrics, by Meta's media_product_type. Carousel albums use FEED. */
export const MEDIA_METRICS: Record<string, string[]> = {
  FEED: ["reach", "views", "likes", "comments", "shares", "saved", "total_interactions"],
  REELS: [
    "reach",
    "views",
    "likes",
    "comments",
    "shares",
    "saved",
    "total_interactions",
    "ig_reels_avg_watch_time",
  ],
  STORY: ["reach", "views", "replies", "navigation", "profile_visits"],
}

function graphUrl(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`${IG_GRAPH_HOST}/${IG_API_VERSION}/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  url.searchParams.set("access_token", accessToken)
  return url
}

/** Flattens Meta's insights envelope into { metric: number }. */
function flatten(payload: any): Record<string, number> {
  const out: Record<string, number> = {}
  if (!Array.isArray(payload?.data)) return out

  for (const entry of payload.data) {
    const name = String(entry?.name ?? "")
    if (!name) continue

    // total_value shape
    if (entry.total_value && typeof entry.total_value.value === "number") {
      out[name] = entry.total_value.value
      continue
    }
    // time_series shape — take the last point, which is the day asked for.
    if (Array.isArray(entry.values) && entry.values.length > 0) {
      const last = entry.values[entry.values.length - 1]
      if (typeof last?.value === "number") out[name] = last.value
    }
  }
  return out
}

export interface AccountProfile {
  followersCount?: number
  followsCount?: number
  mediaCount?: number
}

/** Profile counters. Separate from insights: these are current, not per-day. */
export async function fetchAccountProfile(accessToken: string): Promise<AccountProfile> {
  const response = await fetch(
    graphUrl("me", accessToken, { fields: "followers_count,follows_count,media_count" }),
    { cache: "no-store" },
  )
  if (!response.ok) await readError(response, "Profile counters")

  const data = await response.json()
  return {
    followersCount: typeof data.followers_count === "number" ? data.followers_count : undefined,
    followsCount: typeof data.follows_count === "number" ? data.follows_count : undefined,
    mediaCount: typeof data.media_count === "number" ? data.media_count : undefined,
  }
}

/**
 * One day of account insights.
 *
 * `since`/`until` are inclusive Unix seconds. Asked for a single day at a time because
 * `total_value` collapses whatever range it is given into one number — handing it a
 * week would silently produce a week's total filed under one date.
 */
export async function fetchAccountDay(
  igUserId: string,
  accessToken: string,
  day: Date,
): Promise<Record<string, number>> {
  const start = Math.floor(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) / 1000)
  const end = start + 86_399

  const response = await fetch(
    graphUrl(`${igUserId}/insights`, accessToken, {
      metric: ACCOUNT_METRICS.join(","),
      period: "day",
      metric_type: "total_value",
      since: String(start),
      until: String(end),
    }),
    { cache: "no-store" },
  )
  if (!response.ok) await readError(response, "Account insights")

  return flatten(await response.json())
}

export interface MediaSummary {
  id: string
  mediaType?: string
  mediaProductType?: string
  permalink?: string
  caption?: string
  thumbnailUrl?: string
  timestamp?: string
  likeCount?: number
  commentsCount?: number
}

/** Recent media on the account, newest first. */
export async function fetchRecentMedia(
  igUserId: string,
  accessToken: string,
  limit = 25,
): Promise<MediaSummary[]> {
  const response = await fetch(
    graphUrl(`${igUserId}/media`, accessToken, {
      fields:
        "id,media_type,media_product_type,permalink,caption,thumbnail_url,media_url,timestamp,like_count,comments_count",
      limit: String(limit),
    }),
    { cache: "no-store" },
  )
  if (!response.ok) await readError(response, "Recent media")

  const data = await response.json()
  if (!Array.isArray(data?.data)) return []

  return data.data.map((m: any) => ({
    id: String(m.id),
    mediaType: m.media_type ?? undefined,
    mediaProductType: m.media_product_type ?? undefined,
    permalink: m.permalink ?? undefined,
    caption: m.caption ?? undefined,
    // Videos expose thumbnail_url; images only media_url.
    thumbnailUrl: m.thumbnail_url ?? m.media_url ?? undefined,
    timestamp: m.timestamp ?? undefined,
    likeCount: typeof m.like_count === "number" ? m.like_count : undefined,
    commentsCount: typeof m.comments_count === "number" ? m.comments_count : undefined,
  }))
}

/**
 * Insights for one piece of media.
 *
 * Returns null rather than throwing for the two documented "nothing to report" cases,
 * which are normal rather than faults: a story seen by fewer than five accounts
 * (Meta's error code 10), and media inside a carousel album, which has no insights of
 * its own. Treating those as failures would fill the log with noise and stall a sync.
 */
export async function fetchMediaInsights(
  mediaId: string,
  accessToken: string,
  productType: string | undefined,
): Promise<Record<string, number> | null> {
  const metrics = MEDIA_METRICS[productType ?? "FEED"] ?? MEDIA_METRICS.FEED

  const response = await fetch(
    graphUrl(`${mediaId}/insights`, accessToken, { metric: metrics.join(",") }),
    { cache: "no-store" },
  )

  if (!response.ok) {
    try {
      await readError(response, "Media insights")
    } catch (error) {
      if (error instanceof InstagramApiError && (error.code === 10 || error.code === 100)) {
        return null
      }
      throw error
    }
  }

  return flatten(await response.json())
}
