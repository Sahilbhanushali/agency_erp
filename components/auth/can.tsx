"use client"

import type { ReactNode } from "react"
import { useCan } from "@/hooks/use-can"

/**
 * Renders its children only when the user holds `module:action`.
 *
 *   <Can module="invoices" action="delete">
 *     <Button variant="destructive">Delete</Button>
 *   </Can>
 *
 * Unauthorized controls are omitted from the tree, not disabled — a disabled button
 * still advertises a capability and can be re-enabled from devtools. Nothing renders
 * until permissions have loaded, so an unauthorized control never flashes.
 *
 * This is a rendering convenience. The server authorises independently; see
 * `requireCan` in lib/api-auth.ts.
 */
export function Can({
  module,
  action,
  children,
  fallback = null,
}: {
  module: string
  action: string
  children: ReactNode
  fallback?: ReactNode
}) {
  const { can, ready } = useCan()
  if (!ready) return null
  return can(module, action) ? <>{children}</> : <>{fallback}</>
}
