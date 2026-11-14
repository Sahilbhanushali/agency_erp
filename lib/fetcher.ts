/**
 * The SWR fetcher for JSON APIs.
 *
 * Throws on any non-2xx response, with the server's `{ error }` message, so SWR reports
 * it as `error`. The previous per-file `fetch(url).then(r => r.json())` returned the
 * error body AS DATA: a 403 or 500 rendered as an empty list (broken looked like
 * empty), and `const { data = [] }` defaults did not apply, so `.map` on `{ error }`
 * crashed the page.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same as the untyped fetchers it replaces
export async function jsonFetcher<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error) ||
      `Request failed (${res.status})`
    const error = new Error(message) as Error & { status?: number }
    error.status = res.status
    throw error
  }
  return body as T
}
