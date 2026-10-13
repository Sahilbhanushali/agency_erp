"use client"

import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((response) => response.json())

/**
 * The signed-in user's own permissions, for deciding what a client component renders.
 *
 * This is for UI only — every route handler re-checks server-side. Hiding a button is
 * not access control.
 *
 * ADMIN is treated as a superuser to match `hasPermission` in lib/api-auth.ts, so a
 * partially seeded permission catalog cannot lock administrators out of their own UI.
 */
export function usePermissions() {
  const { data, isLoading } = useSWR<{ permissions?: string[]; role?: string | null }>(
    "/api/users/permissions",
    fetcher,
    { revalidateOnFocus: false },
  )

  const permissions = data?.permissions ?? []
  const isAdmin = data?.role === "ADMIN"

  return {
    permissions,
    role: data?.role ?? null,
    isLoading,
    has: (name: string) => isAdmin || permissions.includes(name),
  }
}
