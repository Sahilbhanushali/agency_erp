/**
 * Fixed-window rate limiter keyed by an arbitrary string (IP, email, …), for
 * unauthenticated endpoints. lib/realtime/hub.ts has a per-user one for signed-in actions.
 *
 * In-memory: per process, reset on restart — the same single-instance assumption the
 * realtime hub already makes. Keys come from anonymous callers, so expired windows are
 * swept to keep an attacker from growing the map without bound.
 */
const windows = new Map<string, { start: number; count: number }>()
let lastSweep = Date.now()
const SWEEP_EVERY_MS = 60_000
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()

  if (now - lastSweep > SWEEP_EVERY_MS) {
    lastSweep = now
    for (const [k, w] of windows) {
      if (now - w.start > MAX_WINDOW_MS) windows.delete(k)
    }
  }

  const w = windows.get(key)
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 })
    return false
  }
  w.count++
  return w.count > limit
}

/** Best-effort client IP. Only trustworthy behind a proxy that overwrites X-Forwarded-For. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  )
}
