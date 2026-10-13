"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  Calendar,
  Lock,
  Mail,
  KeyRound,
  AlertTriangle,
  Send,
  X,
  ShieldCheck,
  AlertCircle,
  FileText,
  MessageCircle,
} from "lucide-react"
import { toast } from "sonner"
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog"

interface ExportLinkDialogProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
  monthFilter?: string
  yearFilter?: string
  postIds?: string[]
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "No expiration set"
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return "Invalid Date"

  const day = date.getDate()
  const month = MONTH_NAMES[date.getMonth() + 1]
  const year = date.getFullYear()
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12
  hours = hours ? hours : 12

  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false

  // 1. Try modern navigator.clipboard
  if (navigator?.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed:", err)
    }
  }

  // 2. Fallback using invisible textarea
  try {
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.position = "fixed"
    textArea.style.left = "-999999px"
    textArea.style.top = "-999999px"
    textArea.setAttribute("readonly", "")
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand("copy")
    document.body.removeChild(textArea)
    if (successful) return true
  } catch (err) {
    console.warn("document.execCommand fallback failed:", err)
  }

  return false
}

export function ExportLinkDialog({
  isOpen,
  onClose,
  projectId,
  projectName,
  monthFilter,
  yearFilter,
  postIds,
}: ExportLinkDialogProps) {
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [linkData, setLinkData] = useState<any>(null)
  const [clientEmail, setClientEmail] = useState<string | null>(null)
  const [clientPhone, setClientPhone] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)

  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [copiedCredentials, setCopiedCredentials] = useState(false)
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false)

  // Modal / Sub-view states
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [isRegeneratingPassword, setIsRegeneratingPassword] = useState(false)
  const [showEmailConfirm, setShowEmailConfirm] = useState(false)
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)

  // Expiration presets
  const [linkExpiryPreset, setLinkExpiryPreset] = useState<string>("30d")
  const [linkCustomExpiry, setLinkCustomExpiry] = useState<string>("")
  const [passwordExpiryPreset, setPasswordExpiryPreset] = useState<string>("same")
  const [passwordCustomExpiry, setPasswordCustomExpiry] = useState<string>("")

  const initDefaultCustomDates = () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    future.setHours(23, 59, 0, 0)
    const tzOffset = future.getTimezoneOffset() * 60000
    const localISOTime = new Date(future.getTime() - tzOffset).toISOString().slice(0, 16)
    setLinkCustomExpiry(localISOTime)
    setPasswordCustomExpiry(localISOTime)
  }

  const monthNum = monthFilter && monthFilter !== "all" ? parseInt(monthFilter, 10) : undefined
  const yearNum = yearFilter && yearFilter !== "all" ? parseInt(yearFilter, 10) : undefined

  useEffect(() => {
    if (isOpen && projectId) {
      initDefaultCustomDates()
      setIsCreatingNew(false)
      setIsRegeneratingPassword(false)
      setShowEmailConfirm(false)
      fetchActiveLink()
    } else {
      setLinkData(null)
      resetCopied()
    }
  }, [isOpen, projectId, monthFilter, yearFilter, postIds])

  const resetCopied = () => {
    setCopiedLink(false)
    setCopiedPassword(false)
    setCopiedCredentials(false)
    setCopiedWhatsApp(false)
  }

  const fetchActiveLink = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (monthNum) params.set("month", monthNum.toString())
      if (yearNum) params.set("year", yearNum.toString())
      if (postIds && postIds.length > 0) params.set("postIds", postIds.join(","))

      const res = await fetch(`/api/projects/${projectId}/export-link?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLinkData(data.link || null)
        setClientEmail(data.clientEmail || data.link?.clientEmail || null)
        setClientPhone(data.clientPhone || data.link?.clientPhone || null)
        setClientName(data.clientName || data.link?.clientName || null)
        if (!data.link) {
          setIsCreatingNew(true)
        }
      }
    } catch (err) {
      console.error("Failed to fetch active export link:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateLink = async (forceNew = false) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/export-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forceNew,
          month: monthNum,
          year: yearNum,
          postIds,
          linkExpiryPreset,
          linkCustomExpiry: linkExpiryPreset === "custom" ? linkCustomExpiry : null,
          passwordExpiryPreset,
          passwordCustomExpiry: passwordExpiryPreset === "custom" ? passwordCustomExpiry : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate export link")
      }

      setLinkData(data.link)
      setClientEmail(data.link?.clientEmail || clientEmail)
      setClientName(data.link?.clientName || clientName)
      setIsCreatingNew(false)
      toast.success(forceNew ? "Fresh export link and password generated!" : "Export link ready!")
    } catch (err: any) {
      toast.error(err.message || "Failed to generate link")
    } finally {
      setActionLoading(false)
    }
  }

  const handleExecutePasswordRegen = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/export-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regeneratePassword: true,
          passwordExpiryPreset,
          passwordCustomExpiry: passwordExpiryPreset === "custom" ? passwordCustomExpiry : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to regenerate password")
      }

      setLinkData(data.link)
      setIsRegeneratingPassword(false)
      toast.success("New password generated and old password invalidated!")
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate password")
    } finally {
      setActionLoading(false)
    }
  }

  const handleExecuteSendEmail = async (forceRegenerate = false) => {
    const emailToUse = linkData?.clientEmail || clientEmail
    if (!emailToUse) {
      toast.error("Client email address is not configured.")
      return
    }

    setEmailLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/export-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SEND_EMAIL",
          linkId: linkData?.id,
          password: linkData?.password || null,
          regenerateAndSend: forceRegenerate || !linkData?.password,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.details || "Unable to send email.")
      }

      if (data.link) {
        setLinkData(data.link)
      }

      toast.success(`✓ Email sent successfully to ${emailToUse}`)
      setShowEmailConfirm(false)
    } catch (err: any) {
      toast.error(err.message || "Unable to send email. The password has NOT been exposed or changed.")
    } finally {
      setEmailLoading(false)
    }
  }

  const handleRevokeLink = async () => {
    if (!linkData?.id) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/export-link?linkId=${linkData.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        throw new Error("Failed to revoke export link")
      }

      setLinkData(null)
      setIsCreatingNew(true)
      setShowRevokeConfirm(false)
      toast.success("Export link revoked successfully")
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke link")
    } finally {
      setActionLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!linkData?.confirmationUrl) return
    const success = await copyToClipboard(linkData.confirmationUrl)
    if (success) {
      setCopiedLink(true)
      toast.success("Confirmation URL copied to clipboard")
      setTimeout(() => setCopiedLink(false), 2000)
    } else {
      toast.error("Unable to copy URL. Please copy it manually.")
    }
  }

  const handleCopyPassword = async () => {
    if (!linkData?.password) return
    const success = await copyToClipboard(linkData.password)
    if (success) {
      setCopiedPassword(true)
      toast.success("Password copied to clipboard")
      setTimeout(() => setCopiedPassword(false), 2000)
    } else {
      toast.error("Unable to copy password. Please copy it manually.")
    }
  }

  // Handle Copy Credentials button click - guarantees password is included
  const handleCopyCredentialsClick = async () => {
    if (!linkData?.confirmationUrl) return

    const effectiveMonth = linkData?.month || monthNum
    const effectiveYear = linkData?.year || yearNum
    const monthYearText = effectiveMonth && effectiveYear ? `${MONTH_NAMES[effectiveMonth]} ${effectiveYear}` : ""

    // If password is in memory (decrypted from DB or newly generated), copy directly
    if (linkData.password) {
      const linkExp = formatDateTime(linkData.expiresAt)
      const pwdExp = formatDateTime(linkData.passwordExpiresAt || linkData.expiresAt)
      const credentialsText = `${projectName}\n${monthYearText ? `${monthYearText}\n\n` : "\n"}Confirmation Link:\n${linkData.confirmationUrl}\n\nPassword:\n${linkData.password}\n\nLink Expires:\n${linkExp}\n\nPassword Expires:\n${pwdExp}`

      const success = await copyToClipboard(credentialsText)
      if (success) {
        setCopiedCredentials(true)
        toast.success("Credentials copied to clipboard.")
        setTimeout(() => setCopiedCredentials(false), 2000)
      } else {
        toast.error("Unable to copy credentials. Please copy them manually.")
      }
      return
    }

    // Fallback: If legacy link has no decrypted password in DB, automatically generate one and copy full credentials
    await handleRegenerateAndCopy()
  }

  // Generate new password and immediately copy complete credentials
  const handleRegenerateAndCopy = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/export-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regeneratePassword: true,
          passwordExpiryPreset: "same",
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to regenerate password")
      }

      setLinkData(data.link)

      const effectiveMonth = data.link.month || monthNum
      const effectiveYear = data.link.year || yearNum
      const monthYearText = effectiveMonth && effectiveYear ? `${MONTH_NAMES[effectiveMonth]} ${effectiveYear}` : ""
      const linkExp = formatDateTime(data.link.expiresAt)
      const pwdExp = formatDateTime(data.link.passwordExpiresAt || data.link.expiresAt)
      const credentialsText = `${projectName}\n${monthYearText ? `${monthYearText}\n\n` : "\n"}Confirmation Link:\n${data.link.confirmationUrl}\n\nPassword:\n${data.link.password}\n\nLink Expires:\n${linkExp}\n\nPassword Expires:\n${pwdExp}`

      const success = await copyToClipboard(credentialsText)
      if (success) {
        setCopiedCredentials(true)
        toast.success("Credentials with new password copied to clipboard.")
        setTimeout(() => setCopiedCredentials(false), 2000)
      } else {
        toast.error("Unable to copy credentials. Please copy them manually.")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate password")
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Copy WhatsApp button click - copies URL and password
  const handleCopyWhatsAppClick = async () => {
    if (!linkData?.confirmationUrl) return

    // If password is in memory, copy directly
    if (linkData.password) {
      const greeting = clientName ? `Hello ${clientName},` : `Hello,`
      const whatsappText = `${greeting}\n\nWe have prepared the latest designs for your review. Kindly click on the secure link below and use the provided password to access and approve your posts.\n\n🔗 Confirmation Link:\n${linkData.confirmationUrl}\n\n🔒 Password:\n${linkData.password}\n\nThank you! ✨`

      const success = await copyToClipboard(whatsappText)

      if (success) {
        setCopiedWhatsApp(true)
        toast.success("WhatsApp message copied to clipboard.")
        setTimeout(() => setCopiedWhatsApp(false), 2000)
      } else {
        toast.error("Unable to copy. Please copy manually.")
      }
      return
    }

    // Fallback: If legacy link has no decrypted password in DB, automatically generate one
    await handleRegenerateAndCopyWhatsApp()
  }

  const handleRegenerateAndCopyWhatsApp = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/export-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regeneratePassword: true,
          passwordExpiryPreset: "same",
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to regenerate password")
      }

      setLinkData(data.link)

      const greeting = clientName ? `Hello ${clientName},` : `Hello,`
      const whatsappText = `${greeting}\n\nWe have prepared the latest designs for your review. Kindly click on the secure link below and use the provided password to access and approve your posts.\n\n🔗 Confirmation Link:\n${data.link.confirmationUrl}\n\n🔒 Password:\n${data.link.password}\n\nThank you! ✨`

      const success = await copyToClipboard(whatsappText)

      if (success) {
        setCopiedWhatsApp(true)
        toast.success("WhatsApp message copied to clipboard.")
        setTimeout(() => setCopiedWhatsApp(false), 2000)
      } else {
        toast.error("Unable to copy. Please copy manually.")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate password")
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpen = () => {
    if (!linkData?.confirmationUrl) return
    window.open(linkData.confirmationUrl, "_blank", "noopener,noreferrer")
  }

  // Determine status badges
  const isLinkRevoked = linkData?.status === "REVOKED"
  const isLinkExpired = !!(
    linkData?.isLinkExpired ||
    (linkData?.expiresAt && new Date(linkData.expiresAt) < new Date())
  )
  const isPasswordExpired = !!(
    linkData?.isPasswordExpired ||
    (linkData?.passwordExpiresAt && new Date(linkData.passwordExpiresAt) < new Date())
  )

  const activeEmailRecipient = linkData?.clientEmail || clientEmail

  const effectiveMonth = linkData?.month || monthNum
  const effectiveYear = linkData?.year || yearNum

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 leading-tight">
                Customer Confirmation Link
              </DialogTitle>
              <div className="mt-1">
                <span className="font-semibold text-sm text-slate-800">{projectName}</span>
                {effectiveMonth && effectiveYear && (
                  <span className="block text-xs font-semibold text-blue-600">
                    {MONTH_NAMES[effectiveMonth]} {effectiveYear}
                  </span>
                )}
                {clientName && (
                  <span className="block text-[11px] text-slate-500">
                    Client: {clientName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-xs">Checking existing link...</span>
          </div>
        ) : showEmailConfirm ? (
          /* ======================================================= */
          /* EMAIL CLIENT RECIPIENT CONFIRMATION VIEW                */
          /* ======================================================= */
          <div className="space-y-4 py-2">
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-lg space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-950">
                <Mail className="w-4 h-4 text-blue-600" />
                Send Confirmation Email to Client
              </div>

              {activeEmailRecipient ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Confirmation URL, login password, and expiration dates will be emailed to:
                  </p>
                  <div className="p-2.5 bg-white border border-blue-200 rounded text-xs font-mono font-bold text-blue-950 select-all flex items-center justify-between">
                    <span>{clientName ? `${clientName} • ` : ""}{activeEmailRecipient}</span>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                      Configured
                    </Badge>
                  </div>

                  {linkData?.password ? (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-900 flex items-center gap-2">
                      <KeyRound className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Active password <strong className="font-mono">{linkData.password}</strong> will be sent.</span>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5 text-amber-950">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Fresh Password Will Be Generated
                      </div>
                      <p className="leading-snug text-amber-800">
                        The current password hash is encrypted in DB. Clicking <strong>Send Email</strong> will automatically generate a new secure password, email it to the client, and display it in this dashboard.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <div className="font-semibold">Client email address is not configured.</div>
                    <p className="text-[11px] text-red-600 mt-0.5">
                      Please configure the client email in Client settings, or copy and share credentials manually.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowEmailConfirm(false)}
                disabled={emailLoading}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleExecuteSendEmail(!linkData?.password)}
                disabled={emailLoading || !activeEmailRecipient}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 font-semibold"
              >
                {emailLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Sending Email...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    {linkData?.password ? "Send Email" : "Generate Password & Send Email"}
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : isCreatingNew ? (
          /* ======================================================= */
          /* CREATION / NEW LINK CONFIGURATION VIEW                  */
          /* ======================================================= */
          <div className="space-y-4 py-2">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-950 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Explicit Expiration Controls
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Configure independent expiration periods for the Confirmation URL and the Customer Access Password.
              </p>
            </div>

            {monthNum && yearNum && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>
                  Filtering for <span className="font-semibold text-slate-900">{MONTH_NAMES[monthNum]} {yearNum}</span> content.
                </span>
              </div>
            )}

            {/* 1. Link Expiration Selector */}
            <div className="space-y-2 p-3 border border-slate-200 rounded-lg bg-white">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" /> Link Expiration
                </label>
                <span className="text-[11px] text-slate-500">URL access validity</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: "1d", label: "1 Day" },
                  { id: "7d", label: "7 Days" },
                  { id: "30d", label: "30 Days" },
                  { id: "custom", label: "Custom Date" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLinkExpiryPreset(opt.id)}
                    className={`text-xs py-1.5 px-2 rounded font-medium border transition-colors ${
                      linkExpiryPreset === opt.id
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {linkExpiryPreset === "custom" && (
                <div className="pt-2">
                  <label className="text-[11px] text-slate-600 block mb-1">
                    Select custom date and time:
                  </label>
                  <Input
                    type="datetime-local"
                    value={linkCustomExpiry}
                    onChange={(e) => setLinkCustomExpiry(e.target.value)}
                    className="h-8 text-xs bg-slate-50"
                  />
                </div>
              )}
            </div>

            {/* 2. Password Expiration Selector */}
            <div className="space-y-2 p-3 border border-slate-200 rounded-lg bg-white">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" /> Password Expiration
                </label>
                <span className="text-[11px] text-slate-500">Independent security control</span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: "same", label: "Same as link" },
                  { id: "1d", label: "1 Day" },
                  { id: "7d", label: "7 Days" },
                  { id: "30d", label: "30 Days" },
                  { id: "custom", label: "Custom Date" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPasswordExpiryPreset(opt.id)}
                    className={`text-[11px] py-1.5 px-1.5 rounded font-medium border text-center transition-colors ${
                      passwordExpiryPreset === opt.id
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {passwordExpiryPreset === "custom" && (
                <div className="pt-2">
                  <label className="text-[11px] text-slate-600 block mb-1">
                    Select custom password expiration:
                  </label>
                  <Input
                    type="datetime-local"
                    value={passwordCustomExpiry}
                    onChange={(e) => setPasswordCustomExpiry(e.target.value)}
                    className="h-8 text-xs bg-slate-50"
                  />
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-2">
              {linkData && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreatingNew(false)}
                  disabled={actionLoading}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
              )}
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-sm"
                onClick={() => handleGenerateLink(true)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Generating Link & Password...
                  </>
                ) : (
                  "Generate Export Link & Password"
                )}
              </Button>
            </div>
          </div>
        ) : isRegeneratingPassword ? (
          /* ======================================================= */
          /* REGENERATE PASSWORD EXPIRY VIEW                         */
          /* ======================================================= */
          <div className="space-y-4 py-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
              <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Regenerate Customer Access Password
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                The current password will be immediately invalidated. Anyone currently logged in will be required to authenticate with the new password.
              </p>
            </div>

            <div className="space-y-2 p-3 border border-slate-200 rounded-lg bg-white">
              <label className="text-xs font-semibold text-slate-800 block">
                Choose New Password Expiration:
              </label>

              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: "same", label: "Same as link" },
                  { id: "1d", label: "1 Day" },
                  { id: "7d", label: "7 Days" },
                  { id: "30d", label: "30 Days" },
                  { id: "custom", label: "Custom Date" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPasswordExpiryPreset(opt.id)}
                    className={`text-[11px] py-1.5 px-1.5 rounded font-medium border text-center transition-colors ${
                      passwordExpiryPreset === opt.id
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {passwordExpiryPreset === "custom" && (
                <div className="pt-2">
                  <Input
                    type="datetime-local"
                    value={passwordCustomExpiry}
                    onChange={(e) => setPasswordCustomExpiry(e.target.value)}
                    className="h-8 text-xs bg-slate-50"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRegeneratingPassword(false)}
                disabled={actionLoading}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleExecutePasswordRegen}
                disabled={actionLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9 font-semibold"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Regenerating...
                  </>
                ) : (
                  "Confirm & Invalidate Old Password"
                )}
              </Button>
            </div>
          </div>
        ) : linkData ? (
          /* ======================================================= */
          /* ACTIVE / EXISTING LINK DISPLAY VIEW                     */
          /* ======================================================= */
          <div className="space-y-3.5 py-1">
            {/* Status Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {isLinkRevoked ? (
                <Badge className="bg-red-100 text-red-800 border-red-300 text-xs font-semibold">
                  ● Revoked
                </Badge>
              ) : isLinkExpired ? (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-semibold">
                  ● Expired
                </Badge>
              ) : linkData.status === "CONFIRMED" ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmed
                </Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-semibold">
                  ● Active
                </Badge>
              )}

              <Badge variant="outline" className="text-xs bg-white text-slate-700 border-slate-300 font-medium">
                <Lock className="w-3 h-3 mr-1 text-slate-500" /> Password Protected
              </Badge>
            </div>

            {/* Content Period Block */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Content Period
              </div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                {linkData.month && linkData.year
                  ? `${MONTH_NAMES[linkData.month]} ${linkData.year}`
                  : (effectiveMonth && effectiveYear ? `${MONTH_NAMES[effectiveMonth]} ${effectiveYear}` : "All Posts")}
              </div>
            </div>

            {/* Expirations */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Link Expires
                </div>
                <div className={`font-semibold text-xs ${isLinkExpired ? "text-amber-700 line-through" : "text-slate-900"}`}>
                  {formatDateTime(linkData.expiresAt)}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" /> Password Expires
                </div>
                <div className={`font-semibold text-xs ${isPasswordExpired ? "text-red-700 font-bold" : "text-slate-900"}`}>
                  {formatDateTime(linkData.passwordExpiresAt || linkData.expiresAt)}
                </div>
              </div>
            </div>

            {/* Confirmation URL Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Confirmation URL
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={linkData.confirmationUrl}
                  className="text-xs bg-slate-50 font-mono select-all text-slate-800 h-9"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpen}
                  className="shrink-0 h-9 px-3"
                  title="Open Link"
                >
                  <ExternalLink className="w-4 h-4 text-slate-600" />
                </Button>
              </div>
            </div>

            {/* Customer Password Card */}
            {linkData.password ? (
              <div className="p-3 bg-amber-50/80 border border-amber-300 rounded-lg space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    Customer Password
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold">
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="font-mono text-sm font-extrabold text-amber-950 tracking-wider bg-white px-2.5 py-1 rounded border border-amber-300 select-all">
                    {linkData.password}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyPassword}
                    className="h-7 text-xs border-amber-300 bg-white text-amber-900 hover:bg-amber-100 px-2"
                  >
                    {copiedPassword ? <Check className="w-3 h-3 mr-1 text-emerald-600" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedPassword ? "Copied" : "Copy Password"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1.5 font-medium">
                  <Lock className="w-3.5 h-3.5 text-slate-400" /> Password: <span className="font-mono text-slate-400 tracking-widest">••••••••••</span>
                </span>
                <span className="text-[11px] text-slate-400">Encrypted in DB</span>
              </div>
            )}

            {/* Row 1 Actions: [ Copy Link ] [ Copy Credentials ] [ Copy WhatsApp ] [ Send Email ] */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="text-xs h-9 text-slate-700 hover:bg-slate-100"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1 text-slate-500" />}
                {copiedLink ? "Copied" : "Copy Link"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyWhatsAppClick}
                className="text-xs h-9 text-emerald-700 hover:bg-emerald-50 border-emerald-200 font-medium"
              >
                {copiedWhatsApp ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <MessageCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />}
                Copy WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCredentialsClick}
                className="text-xs h-9 text-slate-700 hover:bg-slate-100 font-medium"
              >
                {copiedCredentials ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <FileText className="w-3.5 h-3.5 mr-1 text-slate-500" />}
                Copy Credentials
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!activeEmailRecipient) {
                    toast.error("Client email address is not configured.")
                    return
                  }
                  setShowEmailConfirm(true)
                }}
                disabled={emailLoading}
                className="text-xs h-9 text-slate-700 hover:bg-slate-100"
              >
                <Mail className="w-3.5 h-3.5 mr-1 text-blue-600" />
                {linkData?.lastEmailSentAt ? "Resend Email" : "Send Email"}
              </Button>
            </div>

            {/* Row 2 Actions: [ Regenerate Password ] [ Revoke Link ] */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRegeneratingPassword(true)}
                disabled={actionLoading}
                className="text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-200 h-8"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1 text-amber-600" />
                Regenerate Password
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRevokeConfirm(true)}
                disabled={actionLoading}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Revoke Link
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter className="border-t border-slate-100 pt-3 flex items-center justify-between sm:justify-between w-full">
          <div>
            {linkData && !isCreatingNew && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreatingNew(true)}
                disabled={actionLoading}
                className="text-xs text-slate-700 h-8"
                title="Configure and generate a completely new link"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                New Link
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      <DeleteConfirmationDialog
        isOpen={showRevokeConfirm}
        onClose={() => setShowRevokeConfirm(false)}
        onConfirm={handleRevokeLink}
        title="Revoke Customer Export Link?"
        itemName="Client Export Link"
        isLoading={actionLoading}
      />
    </Dialog>
  )
}
