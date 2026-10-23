"use client"

import { useEffect, useRef } from "react"

/**
 * Re-runs a page's own loader when the data it shows changes elsewhere.
 *
 *   useLiveRefresh(fetchUsers)
 *   useLiveRefresh(loadInvoices, ["Invoice", "Payment"])
 *
 * For components that load with useEffect + fetch. SWR keys are revalidated centrally
 * and need nothing. The event comes from the dashboard's live connection
 * (components/chat/chat-provider.tsx) after any write anywhere in the app.
 *
 * `models` narrows it to the Prisma models this view depends on. Leave it out and the
 * loader runs on any change — always correct, just less frugal.
 */
export const LIVE_REFRESH_EVENT = "app:data-changed"

export function useLiveRefresh(load: () => unknown, models?: string[]) {
  // Latest loader without re-subscribing every render.
  const ref = useRef(load)
  ref.current = load
  const key = models?.join(",") ?? ""

  useEffect(() => {
    const wanted = key ? new Set(key.split(",")) : null
    const handler = (e: Event) => {
      const changed: string[] = (e as CustomEvent<{ models: string[] }>).detail?.models ?? []
      if (wanted && !changed.includes("*") && !changed.some((m) => wanted.has(m))) return
      void ref.current()
    }
    window.addEventListener(LIVE_REFRESH_EVENT, handler)
    return () => window.removeEventListener(LIVE_REFRESH_EVENT, handler)
  }, [key])
}
