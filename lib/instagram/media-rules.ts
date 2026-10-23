/**
 * The rules that decide whether a post can go to Instagram at all.
 *
 * Deliberately free of imports so it can be compiled and run on its own — see
 * media-rules.check.ts. These checks run at enqueue time rather than at publish time
 * because the difference matters: a rule broken here is a message to the person
 * scheduling the post, while the same problem found by the worker is an opaque Meta
 * error arriving minutes later with nobody watching.
 */

/** Instagram accepts JPEG only. PNG and WebP are rejected by Meta, not by us. */
export const JPEG = /\.(jpe?g)(\?|$)/i
export const VIDEO = /\.(mp4|mov)(\?|$)/i

export type MetaMediaType = "IMAGE" | "REELS" | "STORIES" | "CAROUSEL"

export class MediaRuleError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message)
    this.name = "MediaRuleError"
  }
}

/** Our post types, in Meta's vocabulary. */
export function metaMediaType(postType: string): MetaMediaType {
  switch (postType) {
    case "PHOTO":
      return "IMAGE"
    case "REEL":
      return "REELS"
    case "STORY":
      return "STORIES"
    case "CAROUSEL":
      return "CAROUSEL"
    default:
      throw new MediaRuleError(
        `A ${postType.toLowerCase()} post has no Instagram equivalent. Set the post type to photo, carousel, reel or story.`,
      )
  }
}

/**
 * An absolute, publicly reachable URL.
 *
 * Meta downloads the media from our server, so a relative path or a loopback address
 * produces a container that fails minutes later with an unhelpful error. The private
 * ranges are refused for the same reason: they resolve for us and not for Meta.
 */
export function toPublicUrl(url: string, baseUrl: string): string {
  const absolute = /^https?:\/\//i.test(url)
    ? url
    : `${baseUrl.replace(/\/+$/, "")}${url.startsWith("/") ? "" : "/"}${url}`

  let parsed: URL
  try {
    parsed = new URL(absolute)
  } catch {
    throw new MediaRuleError(`"${url}" is not a usable media URL.`)
  }

  const host = parsed.hostname.toLowerCase()
  const unreachable =
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)

  if (unreachable) {
    throw new MediaRuleError(
      `Instagram downloads the media from this server, so it cannot be published from ${host}. Set NEXT_PUBLIC_BASE_URL to a public address.`,
    )
  }
  return parsed.toString()
}

/**
 * Checks the media set against what Instagram accepts for this kind of post.
 * Returns the URLs that will actually be sent.
 */
export function validateMedia(mediaType: MetaMediaType, urls: string[]): string[] {
  if (urls.length === 0) {
    throw new MediaRuleError("This post has no media to publish. Upload the creative first.")
  }

  if (mediaType === "CAROUSEL") {
    if (urls.length < 2) throw new MediaRuleError("A carousel needs at least 2 items.")
    if (urls.length > 20) throw new MediaRuleError("Instagram allows at most 20 items in a carousel.")
  }

  const used = mediaType === "CAROUSEL" ? urls : urls.slice(0, 1)

  for (const url of used) {
    const isVideo = VIDEO.test(url)
    if (!isVideo && !JPEG.test(url)) {
      const name = url.split("/").pop()?.split("?")[0] ?? url
      throw new MediaRuleError(`Instagram only accepts JPEG images. "${name}" is not a .jpg file.`)
    }
  }

  if (mediaType === "REELS" && !VIDEO.test(used[0])) {
    throw new MediaRuleError("A reel needs an .mp4 or .mov video.")
  }

  return used
}

/**
 * Exponential backoff, capped so a long outage cannot push a post a day late.
 * attempts is 1-based: the first retry waits two minutes, not one.
 */
export function backoffMs(attempts: number, maxMs = 60 * 60_000): number {
  return Math.min(2 ** Math.max(attempts, 1) * 60_000, maxMs)
}
