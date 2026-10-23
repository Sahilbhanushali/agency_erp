import type { ReactNode } from "react"
import { guardPage } from "@/lib/permissions/guard"

/** Verifying documents needs users:approve — Admin, Manager or an HR role. */
export default async function Layout({ children }: { children: ReactNode }) {
  const gate = await guardPage("users", "approve", "document verification")
  if (!gate.ok) return gate.response

  return <>{children}</>
}
