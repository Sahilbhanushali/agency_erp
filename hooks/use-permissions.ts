"use client"

import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((response) => response.json())

/**
 * The signed-in user's own permissions, for deciding what a client component renders.
 *
 * This is for UI only — every route handler re-checks server-side. Hiding a button is
 * not access control.
 *
 * Backed by `/api/me/permissions`, which resolves each `module:action` through the
 * catalog *and* the legacy names that imply it. The previous version read the raw grant
 * names, so a check only matched if the role happened to hold that exact string: a role
 * created in the permission matrix held `posts:update` and failed a `has("Manage-post")`
 * check, while an older role held `Manage-post` and failed `has("posts:update")`.
 *
 * `role` here comes from the session token and is only as fresh as the last sign-in, so
 * it is never used to decide anything — ADMIN is resolved from the permission set.
 */
export function usePermissions() {
  const { data, isLoading } = useSWR<{
    permissions?: string[]
    modules?: string[]
    role?: string | null
  }>("/api/me/permissions", fetcher, { revalidateOnFocus: false })

  const permissions = data?.permissions ?? []
  const modules = data?.modules ?? []
  const held = new Set(permissions)

  /** `can("posts", "publish")` — the same pair the server checks. */
  const can = (module: string, action: string) => held.has(`${module}:${action}`)

  return {
    permissions,
    modules,
    role: data?.role ?? null,
    isLoading,
    can,
    /** Whether this module is visible at all. */
    canSee: (module: string) => modules.includes(module),
    /**
     * Accepts either a canonical `module:action` or a legacy flat name. Legacy names
     * resolve through the catalog, so both styles keep working.
     */
    has: (name: string) => {
      if (held.has(name)) return true
      if (name.includes(":")) return false
      // A legacy name is satisfied when any action it used to imply is held.
      return permissions.some((p) => LEGACY_HINTS[name]?.includes(p) ?? false)
    },
  }
}

/**
 * The legacy names still checked in client components, mapped to the canonical actions
 * that replace them. Server-side this lives in the catalog's `legacy` arrays; this is
 * the small subset the UI still asks for by old name.
 */
const LEGACY_HINTS: Record<string, string[]> = {
  "Manage-tasks": ["tasks:update", "tasks:create", "tasks:delete"],
  "View-tasks": ["tasks:read"],
  "Manage-post": ["posts:update", "posts:create", "posts:delete"],
  "View-post": ["posts:read"],
  "View-posts": ["posts:read"],
  "Manage-projects": ["projects:update", "projects:create", "projects:delete"],
  "View-project": ["projects:read"],
  "Manage-clients": ["clients:update", "clients:create", "clients:delete"],
  "View-clients": ["clients:read"],
  "Manage-settings": ["settings:update"],
  "Manage-User": ["users:update"],
  "Manage-approvals": ["approvals:approve", "posts:approve"],
  "View-assets": ["assets:read"],
  "Manage-assets": ["assets:create", "assets:delete"],
  "View-reports": ["reports:read"],
  "View-calender": ["calendar:read"],
}
