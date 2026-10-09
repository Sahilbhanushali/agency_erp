import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { SessionProvider } from "@/components/session-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Suspense } from "react"
import { Toaster } from "react-hot-toast"
import "./globals.css"

export const metadata: Metadata = {
  title: "itsmeDezino Agency ERP",
  description: "Content planning, design approvals and client sign-off.",
  icons: {
    icon: "/icon.svg",
  },
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={null}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <SessionProvider>{children}</SessionProvider>
          </ThemeProvider>
        </Suspense>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      </body>
    </html>
  )
}
