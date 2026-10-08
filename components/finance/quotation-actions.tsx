"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import {
  Check,
  Copy,
  Edit,
  Link2,
  Link2Off,
  Loader2,
  Printer,
  Send,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { QUOTATION_TRANSITIONS } from "@/lib/finance"
import type { QuotationStatus } from "@/types/finance"

/** Only the moves a person makes by hand; CONVERTED belongs to the conversion itself. */
const STATUS_ACTIONS: Partial<
  Record<QuotationStatus, { label: string; icon: typeof Send; confirm?: string }>
> = {
  SENT: { label: "Mark as sent", icon: Send },
  ACCEPTED: { label: "Mark accepted", icon: Check },
  REJECTED: { label: "Mark rejected", icon: X, confirm: "Record this quotation as rejected?" },
  DRAFT: { label: "Back to draft", icon: Edit },
  EXPIRED: { label: "Mark expired", icon: X },
}

export default function QuotationActions({
  id,
  number,
  status,
  shareToken,
  shareExpiresAt,
}: {
  id: string
  number: string
  status: QuotationStatus
  shareToken: string | null
  shareExpiresAt: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<QuotationStatus | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  // window does not exist while this renders on the server, so the absolute link is
  // assembled after mount rather than in the initial state.
  useEffect(() => {
    setShareUrl(shareToken ? `${window.location.origin}/share/document/${shareToken}` : null)
  }, [shareToken])

  const changeStatus = async (next: QuotationStatus) => {
    setBusy(next)
    try {
      const response = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? "Could not update the status")
        return
      }
      toast.success(`${number} is now ${next.toLowerCase()}`)
      setConfirming(null)
      router.refresh()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(null)
    }
  }

  const issueLink = async () => {
    setBusy("share")
    try {
      const response = await fetch(`/api/quotations/${id}/share`, { method: "POST" })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? "Could not create the link")
        return
      }
      setShareUrl(data.url)
      await copy(data.url)
      toast.success(data.rotated ? "New link copied — the old one no longer works" : "Link copied")
      router.refresh()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(null)
    }
  }

  const revokeLink = async () => {
    setBusy("revoke")
    try {
      const response = await fetch(`/api/quotations/${id}/share`, { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? "Could not revoke the link")
        return
      }
      setShareUrl(null)
      toast.success("Link revoked")
      router.refresh()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(null)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Clipboard needs a secure context; show the URL so it can still be copied by hand.
      toast.error("Could not reach the clipboard — copy the link from the field below")
      return false
    }
  }

  const available = QUOTATION_TRANSITIONS[status].filter((next) => next in STATUS_ACTIONS)

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {available.map((next) => {
          const action = STATUS_ACTIONS[next]!
          const Icon = action.icon
          return (
            <Button
              key={next}
              variant={next === "ACCEPTED" ? "default" : "outline"}
              size="sm"
              disabled={!!busy}
              onClick={() => (action.confirm ? setConfirming(next) : changeStatus(next))}
            >
              {busy === next ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Icon className="mr-2 h-4 w-4" />
              )}
              {action.label}
            </Button>
          )
        })}

        {available.length > 0 && <Separator orientation="vertical" className="h-6" />}

        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print / PDF
        </Button>

        <Button variant="outline" size="sm" disabled={!!busy} onClick={issueLink}>
          {busy === "share" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="mr-2 h-4 w-4" />
          )}
          {shareUrl ? "New client link" : "Client link"}
        </Button>

        {shareUrl && (
          <Button variant="ghost" size="sm" disabled={!!busy} onClick={revokeLink}>
            {busy === "revoke" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2Off className="mr-2 h-4 w-4" />
            )}
            Revoke
          </Button>
        )}

        {status !== "CONVERTED" && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/quotations/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
      </div>

      {shareUrl && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <label htmlFor="share-url" className="sr-only">
            Client link for {number}
          </label>
          <input
            id="share-url"
            readOnly
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent text-xs text-muted-foreground outline-none"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (await copy(shareUrl)) toast.success("Link copied")
            }}
          >
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copy
          </Button>
          {shareExpiresAt && (
            <span className="text-xs text-muted-foreground">
              Expires {new Date(shareExpiresAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      )}

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming && STATUS_ACTIONS[confirming]?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming && STATUS_ACTIONS[confirming]?.confirm} {number} stays on record either way.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                if (confirming) changeStatus(confirming)
              }}
              disabled={!!busy}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
