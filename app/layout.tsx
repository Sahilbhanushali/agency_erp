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
    /**
     * `app/favicon.ico` is picked up by Next automatically and covers older browsers.
     * The SVG is listed first so browsers that support it use the sharp version, and
     * the 96px PNG is the fallback for those that do not.
     */
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-96x96.png", type: "image/png", sizes: "96x96" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
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
        <Toaster
          position="top-right"
          containerStyle={{ zIndex: 99999, position: "fixed" }}
          toastOptions={{
            duration: 3500,
            className: "text-xs font-medium shadow-lg border border-border bg-card text-foreground",
            success: {
              iconTheme: {
                primary: "#10b981",
                secondary: "#ffffff",
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#ffffff",
              },
            },
          }}
        />
      </body>
    </html>
  )
}
