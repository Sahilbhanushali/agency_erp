"use client"

import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface MePermissions {
  permissions?: string[]
  modules?: string[]
  role?: string | null
}

/**
 * The signed-in user's effective permissions, for deciding what to render.
 *
 *   const { can, ready } = useCan()
 *   {ready && can("quotations", "create") && <Button>New quotation</Button>}
 *
 * This is presentation only. Hiding a button is not access control — every route
 * handler re-checks with `requireCan`. `ready` exists so callers can avoid flashing a
 * control before permissions have loaded.
 *
 * Deduped by SWR, so a page with thirty guarded controls still makes one request.
 */
export function useCan() {
  const { data, isLoading, error } = useSWR<MePermissions>("/api/me/permissions", fetcher, {
    revalidateOnFocus: false,
    // Role changes must take effect without signing out, so this is allowed to go
    // stale briefly but is revalidated on reconnect and on navigation back.
    revalidateOnReconnect: true,
    dedupingInterval: 30_000,
  })

  const granted = new Set(data?.permissions ?? [])

  return {
    /** False until permissions have loaded, so nothing is rendered optimistically. */
    ready: !isLoading && !error && !!data,
    isLoading,
    role: data?.role ?? null,
    /** Module keys the user can read — the basis for navigation. */
    modules: data?.modules ?? [],
    can: (module: string, action: string) => granted.has(`${module}:${action}`),
    /** Any action at all on a module, i.e. "should this appear in the nav". */
    canAccess: (module: string) => (data?.modules ?? []).includes(module),
  }
}
