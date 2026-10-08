"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // On customer share portal or share subdomain, skip SaaS NextAuth session polling
  const isSharePortal =
    pathname?.startsWith("/share") ||
    (typeof window !== "undefined" && window.location.hostname.startsWith("share."))

  if (isSharePortal) {
    return <>{children}</>
  }

  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}

