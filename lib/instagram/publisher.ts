import { IG_API_VERSION, IG_GRAPH_HOST, readError } from "./client"

/**
 * The Instagram Content Publishing API, for accounts connected with Instagram Login.
 *
 * Publishing is a two-step protocol and the gap between the steps is where duplicate
 * posts come from, so the exact shape matters. Verified against
 * https://developers.facebook.com/docs/instagram-platform/content-publishing :
 *
 *   create   POST /<IG_ID>/media                  -> { id } (a *container*, not a post)
 *   status   GET  /<CONTAINER_ID>?fields=status_code
 *   publish  POST /<IG_ID>/media_publish          -> { id } (the real media id)
 *   limit    GET  /<IG_ID>/content_publishing_limit
 *
 * Two documented constraints drive the queue's design:
 *   - a container expires if it is not published within 24 hours;
 *   - Meta recommends polling a container's status once a minute for at most five.
 *
 * And one that bites at upload time: JPEG is the only image format Instagram accepts.
 * PNG and WebP are rejected by Meta, not by us, so they are caught before queueing.
 */

/** Meta cURLs the media from these URLs, so they must be publicly reachable. */
export type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED"

export type MediaSpec =
  | { mediaType: "IMAGE"; imageUrl: string; caption?: string }
  | { mediaType: "REELS"; videoUrl: string; caption?: string; coverUrl?: string }
  | { mediaType: "STORIES"; imageUrl?: string; videoUrl?: string }
  | { mediaType: "CAROUSEL"; children: string[]; caption?: string }

function graphUrl(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`${IG_GRAPH_HOST}/${IG_API_VERSION}/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  url.searchParams.set("access_token", accessToken)
  return url
}

/**
 * Creates a media container. The returned id is NOT a published post — nothing is
 * visible to anyone until publishContainer() is called with it.
 */
export async function createContainer(
  igUserId: string,
  accessToken: string,
  spec: MediaSpec,
): Promise<string> {
  const body = new URLSearchParams({ access_token: accessToken })

  switch (spec.mediaType) {
    case "IMAGE":
      body.set("image_url", spec.imageUrl)
      if (spec.caption) body.set("caption", spec.caption)
      break
    case "REELS":
      body.set("media_type", "REELS")
      body.set("video_url", spec.videoUrl)
      if (spec.caption) body.set("caption", spec.caption)
      if (spec.coverUrl) body.set("cover_url", spec.coverUrl)
      break
    case "STORIES":
      body.set("media_type", "STORIES")
      if (spec.imageUrl) body.set("image_url", spec.imageUrl)
      if (spec.videoUrl) body.set("video_url", spec.videoUrl)
      break
    case "CAROUSEL":
      body.set("media_type", "CAROUSEL")
      body.set("children", spec.children.join(","))
      if (spec.caption) body.set("caption", spec.caption)
      break
  }

  const response = await fetch(`${IG_GRAPH_HOST}/${IG_API_VERSION}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })
  if (!response.ok) await readError(response, "Media container creation")

  const data = await response.json()
  return String(data.id)
}

/** A carousel child. Identical to a normal container but flagged, and never published alone. */
export async function createCarouselItem(
  igUserId: string,
  accessToken: string,
  item: { imageUrl?: string; videoUrl?: string },
): Promise<string> {
  const body = new URLSearchParams({ access_token: accessToken, is_carousel_item: "true" })
  if (item.imageUrl) body.set("image_url", item.imageUrl)
  if (item.videoUrl) {
    body.set("video_url", item.videoUrl)
    body.set("media_type", "VIDEO")
  }

  const response = await fetch(`${IG_GRAPH_HOST}/${IG_API_VERSION}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })
  if (!response.ok) await readError(response, "Carousel item creation")

  const data = await response.json()
  return String(data.id)
}

/**
 * Where a container is up to. This is also the reconciliation primitive: a worker that
 * lost its connection mid-publish asks here rather than publishing again, and PUBLISHED
 * means the post is already live.
 */
export async function containerStatus(
  containerId: string,
  accessToken: string,
): Promise<ContainerStatus> {
  const response = await fetch(graphUrl(containerId, accessToken, { fields: "status_code" }), {
    cache: "no-store",
  })
  if (!response.ok) await readError(response, "Container status")

  const data = await response.json()
  const status = String(data.status_code ?? "").toUpperCase()
  // An unknown value is treated as still working rather than as success.
  return (["EXPIRED", "ERROR", "FINISHED", "IN_PROGRESS", "PUBLISHED"] as const).includes(
    status as ContainerStatus,
  )
    ? (status as ContainerStatus)
    : "IN_PROGRESS"
}

/** The irreversible step. The returned id is the live post. */
export async function publishContainer(
  igUserId: string,
  accessToken: string,
  creationId: string,
): Promise<string> {
  const body = new URLSearchParams({ access_token: accessToken, creation_id: creationId })

  const response = await fetch(`${IG_GRAPH_HOST}/${IG_API_VERSION}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })
  if (!response.ok) await readError(response, "Media publish")

  const data = await response.json()
  return String(data.id)
}

export interface PublishedMedia {
  id: string
  permalink?: string
  timestamp?: string
  caption?: string
}

/** Reads back a published post, to confirm it exists and to capture its permalink. */
export async function fetchMedia(mediaId: string, accessToken: string): Promise<PublishedMedia> {
  const response = await fetch(
    graphUrl(mediaId, accessToken, { fields: "id,permalink,timestamp,caption" }),
    { cache: "no-store" },
  )
  if (!response.ok) await readError(response, "Media lookup")

  const data = await response.json()
  return {
    id: String(data.id),
    permalink: data.permalink ?? undefined,
    timestamp: data.timestamp ?? undefined,
    caption: data.caption ?? undefined,
  }
}

/**
 * Recent posts on the account, newest first.
 *
 * Used only for reconciliation: if a container reports PUBLISHED but we never recorded
 * a media id — the worker died between the two — the post is found here by its caption
 * instead of being published a second time.
 */
export async function recentMedia(
  igUserId: string,
  accessToken: string,
  limit = 25,
): Promise<PublishedMedia[]> {
  const response = await fetch(
    graphUrl(`${igUserId}/media`, accessToken, {
      fields: "id,permalink,timestamp,caption",
      limit: String(limit),
    }),
    { cache: "no-store" },
  )
  if (!response.ok) await readError(response, "Recent media lookup")

  const data = await response.json()
  return Array.isArray(data.data)
    ? data.data.map((m: any) => ({
        id: String(m.id),
        permalink: m.permalink ?? undefined,
        timestamp: m.timestamp ?? undefined,
        caption: m.caption ?? undefined,
      }))
    : []
}

export interface PublishingQuota {
  used: number
  cap: number
  exhausted: boolean
}

/**
 * How much of the 24-hour publishing allowance is spent.
 *
 * Meta's own documentation contradicts itself here — the Rate Limit section says 100
 * posts per rolling 24 hours while the Carousel section says 50 — so the cap Meta
 * reports for the account is used, and 25 is assumed if it reports none. Checking
 * before publishing turns a hard API rejection into a job that simply waits.
 */
export async function publishingQuota(
  igUserId: string,
  accessToken: string,
): Promise<PublishingQuota> {
  const response = await fetch(
    graphUrl(`${igUserId}/content_publishing_limit`, accessToken, {
      fields: "config,quota_usage",
    }),
    { cache: "no-store" },
  )
  if (!response.ok) await readError(response, "Publishing limit")

  const data = await response.json()
  const row = Array.isArray(data.data) ? data.data[0] ?? {} : {}
  const used = Number(row.quota_usage ?? 0)
  const cap = Number(row.config?.quota_total ?? 25)

  const safeUsed = Number.isFinite(used) ? used : 0
  const safeCap = Number.isFinite(cap) && cap > 0 ? cap : 25
  return { used: safeUsed, cap: safeCap, exhausted: safeUsed >= safeCap }
}
