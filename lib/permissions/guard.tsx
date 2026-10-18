import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { can } from "@/lib/api-auth"
import type { Action } from "@/lib/permissions/catalog"
import NoAccess from "@/components/finance/no-access"

/**
 * Page-level authorization for server components.
 *
 *   const gate = await guardPage("quotations", "read")
 *   if (!gate.ok) return gate.response
 *
 * A hidden navigation link is not protection — someone can type the URL. This runs on
 * the server before any data is fetched, so an unauthorized visitor never receives the
 * protected data in page props either.
 *
 * It is deliberately NOT a replacement for the check in the route handler: the page and
 * its API are separate entry points and each authorises for itself.
 */
export async function guardPage(
  module: string,
  action: Action | string = "read",
  label?: string,
): Promise<{ ok: true } | { ok: false; response: React.ReactElement }> {
  const session = await getServerSession(authOptions)
  if (await can(session, module, action)) return { ok: true }
  return { ok: false, response: <NoAccess what={label ?? module} /> }
}
