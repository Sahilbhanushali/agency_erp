import type React from "react"
import { LayoutDashboard } from "lucide-react"

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 selection:bg-primary/20 selection:text-primary">
      {/* Background subtle radial glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl dark:bg-primary/10" />
      
      <div className="relative w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <LayoutDashboard className="size-5" />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">itsmeDezino</h1>
            <p className="text-xs text-muted-foreground font-medium">Agency Workspace Platform</p>
          </div>
        </div>

        {children}
      </div>
    </main>
  )
}
