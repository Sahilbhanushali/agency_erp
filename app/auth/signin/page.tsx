"use client"

import type React from "react"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthShell } from "@/components/auth/auth-shell"
import { AlertCircle, Lock, Mail } from "lucide-react"
import { BrandLogo } from "@/components/brand/brand-logo"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  // Set when the dashboard ended the session because the account was deactivated.
  // Without this the person is bounced to a blank sign-in form with no explanation
  // and simply tries again.
  const [error, setError] = useState(
    searchParams.get("reason") === "deactivated"
      ? "This account has been deactivated. Contact an administrator if you think that is wrong."
      : "",
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl,
        redirect: false,
      })

      if (result?.ok) {
        window.location.href = result.url || callbackUrl
      } else {
        setError("Invalid email or password. Please check your credentials.")
      }
    } catch (error) {
      console.error("Sign in error:", error)
      setError("An unexpected error occurred during sign in. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell>
      <Card className="w-full shadow-2xs border-border/70">
        <CardHeader className="text-center pb-4">
          {/* The first screen anyone sees should carry the real mark. */}
          <BrandLogo size={72} priority className="mx-auto mb-3 size-16" />
          <CardTitle className="text-lg">Sign In</CardTitle>
          <CardDescription className="text-xs">
            Enter your email and password to access your agency workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">Email Address</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="name@agency.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 text-xs pl-9"
                  required
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 text-xs pl-9"
                  required
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              </div>
            </div>
            <Button type="submit" size="default" className="w-full font-medium" loading={isLoading}>
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
