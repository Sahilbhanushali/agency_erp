import assert from "node:assert/strict"
import {
  MediaRuleError,
  backoffMs,
  metaMediaType,
  toPublicUrl,
  validateMedia,
} from "./media-rules"

/**
 * Run with: npm run check:instagram
 *
 * These rules decide whether a post reaches a client's Instagram feed, so the cases
 * that matter are the refusals: a PNG, a localhost URL and a one-item carousel all
 * fail at Meta minutes after publishing if they get past here, by which time nobody
 * is watching.
 */

const PUBLIC = "https://agency.example.com"

function refuses(fn: () => unknown, because: string) {
  assert.throws(fn, MediaRuleError, `should refuse: ${because}`)
}

// --- post type mapping ------------------------------------------------------
assert.equal(metaMediaType("PHOTO"), "IMAGE")
assert.equal(metaMediaType("REEL"), "REELS")
assert.equal(metaMediaType("STORY"), "STORIES")
assert.equal(metaMediaType("CAROUSEL"), "CAROUSEL")
refuses(() => metaMediaType("BLOG"), "a blog post has no Instagram equivalent")
refuses(() => metaMediaType("UNKNOWN"), "an unknown type must not be guessed at")

// --- URLs Meta can actually reach -------------------------------------------
assert.equal(
  toPublicUrl("/uploads/a.jpg", PUBLIC),
  "https://agency.example.com/uploads/a.jpg",
  "a relative path becomes absolute",
)
assert.equal(
  toPublicUrl("uploads/a.jpg", PUBLIC),
  "https://agency.example.com/uploads/a.jpg",
  "a missing leading slash is tolerated",
)
assert.equal(
  toPublicUrl("/uploads/a.jpg", "https://agency.example.com/"),
  "https://agency.example.com/uploads/a.jpg",
  "a trailing slash on the base does not double up",
)
assert.equal(
  toPublicUrl("https://cdn.example.com/a.jpg", PUBLIC),
  "https://cdn.example.com/a.jpg",
  "an absolute URL is left alone",
)

// The whole point: Meta fetches the file, so our own loopback is useless to it.
refuses(() => toPublicUrl("/a.jpg", "http://localhost:3000"), "localhost")
refuses(() => toPublicUrl("/a.jpg", "http://127.0.0.1:3000"), "loopback IP")
refuses(() => toPublicUrl("/a.jpg", "http://10.0.0.5"), "private 10/8")
refuses(() => toPublicUrl("/a.jpg", "http://192.168.1.10"), "private 192.168/16")
refuses(() => toPublicUrl("/a.jpg", "http://172.16.0.1"), "private 172.16/12 low edge")
refuses(() => toPublicUrl("/a.jpg", "http://172.31.255.254"), "private 172.16/12 high edge")
refuses(() => toPublicUrl("/a.jpg", "http://169.254.169.254"), "link-local metadata address")
refuses(() => toPublicUrl("/a.jpg", "http://box.local"), ".local hostname")
refuses(() => toPublicUrl("not a url", "also not a url"), "an unparseable URL")

// 172.15 and 172.32 are outside the private block and must stay allowed.
assert.equal(toPublicUrl("/a.jpg", "http://172.15.0.1"), "http://172.15.0.1/a.jpg")
assert.equal(toPublicUrl("/a.jpg", "http://172.32.0.1"), "http://172.32.0.1/a.jpg")

// --- what Instagram accepts --------------------------------------------------
assert.deepEqual(
  validateMedia("IMAGE", [`${PUBLIC}/a.jpg`, `${PUBLIC}/b.jpg`]),
  [`${PUBLIC}/a.jpg`],
  "a single image post sends only the first asset",
)
assert.deepEqual(
  validateMedia("IMAGE", [`${PUBLIC}/a.JPEG`]),
  [`${PUBLIC}/a.JPEG`],
  "the extension check is case-insensitive",
)
assert.deepEqual(
  validateMedia("IMAGE", [`${PUBLIC}/a.jpg?v=2`]),
  [`${PUBLIC}/a.jpg?v=2`],
  "a cache-busting query string does not hide the extension",
)

refuses(() => validateMedia("IMAGE", []), "no media at all")
refuses(() => validateMedia("IMAGE", [`${PUBLIC}/a.png`]), "PNG — Meta accepts JPEG only")
refuses(() => validateMedia("IMAGE", [`${PUBLIC}/a.webp`]), "WebP")
refuses(() => validateMedia("CAROUSEL", [`${PUBLIC}/a.jpg`]), "a one-item carousel")
refuses(
  () => validateMedia("CAROUSEL", Array.from({ length: 21 }, (_, i) => `${PUBLIC}/${i}.jpg`)),
  "21 carousel items — Meta allows 20",
)
refuses(() => validateMedia("REELS", [`${PUBLIC}/a.jpg`]), "a reel with a still image")

assert.equal(
  validateMedia("CAROUSEL", Array.from({ length: 20 }, (_, i) => `${PUBLIC}/${i}.jpg`)).length,
  20,
  "exactly 20 carousel items is allowed",
)
assert.deepEqual(validateMedia("REELS", [`${PUBLIC}/a.mp4`]), [`${PUBLIC}/a.mp4`])
assert.deepEqual(validateMedia("STORIES", [`${PUBLIC}/a.mov`]), [`${PUBLIC}/a.mov`])
assert.deepEqual(
  validateMedia("CAROUSEL", [`${PUBLIC}/a.jpg`, `${PUBLIC}/b.mp4`]),
  [`${PUBLIC}/a.jpg`, `${PUBLIC}/b.mp4`],
  "a mixed carousel of image and video is allowed",
)

// --- backoff -----------------------------------------------------------------
assert.equal(backoffMs(1), 120_000, "first retry waits 2 minutes")
assert.equal(backoffMs(2), 240_000)
assert.equal(backoffMs(3), 480_000)
assert.equal(backoffMs(0), 120_000, "attempt 0 is treated as the first retry")
assert.equal(backoffMs(99), 3_600_000, "backoff is capped, not unbounded")
assert.ok(backoffMs(5) < backoffMs(6), "backoff grows until the cap")

console.log("instagram media rules: all checks passed")
