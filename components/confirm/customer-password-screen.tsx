"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight } from "lucide-react"
import { toast } from "sonner"

interface CustomerPasswordScreenProps {
  token: string
  projectName: string
  clientName?: string
  month?: number | null
  year?: number | null
  isLocked?: boolean
  isPasswordExpired?: boolean
  lockRemainingMinutes?: number
  onAuthenticated?: () => void
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

export function CustomerPasswordScreen({
  token,
  projectName,
  clientName,
  month,
  year,
  isLocked: initialIsLocked,
  isPasswordExpired: initialPasswordExpired,
  lockRemainingMinutes: initialMinutes,
  onAuthenticated,
}: CustomerPasswordScreenProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState(initialIsLocked || false)
  const [isPasswordExpired, setIsPasswordExpired] = useState(initialPasswordExpired || false)
  const [lockMinutes, setLockMinutes] = useState(initialMinutes || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim() || isLocked || isPasswordExpired) return

    setLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "AUTHENTICATE",
          password: password.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.isPasswordExpired) {
          setIsPasswordExpired(true)
          setErrorMsg(data.error || "Your access password has expired. Please contact the client representative for a new password.")
        } else if (res.status === 429) {
          setIsLocked(true)
          setLockMinutes(data.lockRemainingMinutes || 15)
          setErrorMsg(data.error || "Too many failed attempts. Please try again later.")
        } else {
          setErrorMsg(data.error || "Incorrect password. Please verify and try again.")
        }
        return
      }

      toast.success("Access granted!")
      if (onAuthenticated) {
        onAuthenticated()
      } else {
        window.location.reload()
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to verify password. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl border-slate-200 bg-white overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
        <CardHeader className="text-center pb-2 pt-6">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">
            {projectName}
          </CardTitle>
          {month && year && (
            <div className="text-sm font-semibold text-blue-600 mt-1">
              {MONTH_NAMES[month]} {year}
            </div>
          )}
          <CardDescription className="text-xs text-slate-500 mt-1">
            {clientName ? `Client: ${clientName} • ` : ""}Content Review
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4 px-6 pb-8">
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">
              This content is protected.
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter the password provided to you to access the content.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isPasswordExpired ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 text-center space-y-1.5">
              <div className="font-semibold text-amber-950 flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Password Expired
              </div>
              <p className="leading-relaxed">
                Your access password has expired. Please contact the client representative for a new password.
              </p>
            </div>
          ) : isLocked ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 text-center space-y-1">
              <div className="font-semibold">Security Lockout Active</div>
              <p>
                Too many failed attempts. Please wait {lockMinutes} minute{lockMinutes === 1 ? "" : "s"} before trying again, or contact your social media manager.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Input aria-label="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (errorMsg) setErrorMsg(null)
                    }}
                    placeholder="Enter provided password..."
                    disabled={loading || isLocked}
                    autoFocus
                    className="pr-10 text-sm font-mono tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !password.trim() || isLocked}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-10 shadow-sm"
              >
                {loading ? "Verifying..." : (
                  <>
                    Continue <ArrowRight className="w-4 h-4 ml-1.5" />
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="pt-2 text-center text-xs text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> End-to-end encrypted approval link
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
