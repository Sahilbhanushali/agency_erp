import type { NextRequest } from "next/server"
import { timingSafeEqual } from "node:crypto"

/**
 * Lets a scheduled job call a protected endpoint without a browser session.
 *
 * The alternative — having the cron process import the service code directly — meant
 * compiling TypeScript at runtime, which fails on a server installed with
 * `npm ci --omit=dev` because `typescript` is a devDependency. Calling the running app
 * over localhost reuses the exact code path the UI uses and needs no build tooling.
 *
 * `CRON_SECRET` must be set for this to work at all: an unset secret authorises
 * nothing, so forgetting to configure it cannot accidentally open an endpoint.
 */
export function isCronRequest(request: NextRequest): boolean {
  const configured = process.env.CRON_SECRET
  if (!configured || configured.length < 16) return false

  const provided = request.headers.get("x-cron-secret")
  if (!provided) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(configured)
  // Length must match before timingSafeEqual, and comparing lengths first leaks only
  // the length — which an attacker can obtain by other means anyway.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
