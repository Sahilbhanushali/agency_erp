import type { ReactNode } from "react"
import { guardPage } from "@/lib/permissions/guard"

/**
 * Server-side read guard for everything under this segment, including nested detail and
 * edit pages. It lives in a layout because the page itself is a client component and
 * cannot authorise before rendering.
 *
 * This is independent of the sidebar: hiding a link stops nobody from typing the URL.
 * The matching API routes authorise separately — neither check substitutes for the other.
 */
export default async function Layout({ children }: { children: ReactNode }) {
  const gate = await guardPage("payroll", "read", "payroll")
  if (!gate.ok) return gate.response

  return <>{children}</>
}
