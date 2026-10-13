"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import {
  Ban,
  Copy,
  Edit,
  IndianRupee,
  Link2,
  Link2Off,
  Loader2,
  Printer,
  RotateCcw,
  Send,
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
import PaymentDialog from "@/components/finance/payment-dialog"
import { INVOICE_TRANSITIONS } from "@/lib/finance"
import type { InvoiceStatus } from "@/types/finance"

/**
 * PAID and PARTIAL are absent on purpose — those come from recording payments, never
 * from a button, so the status can never contradict the money received.
 */
const STATUS_ACTIONS: Partial<
  Record<InvoiceStatus, { label: string; icon: typeof Send; confirm?: string }>
> = {
  SENT: { label: "Mark as sent", icon: Send },
  DRAFT: { label: "Back to draft", icon: RotateCcw },
  CANCELLED: {
    label: "Cancel invoice",
    icon: Ban,
    confirm: "Cancelling keeps the invoice and its history, but closes it.",
  },
}

export default function InvoiceActions({
  id,
  number,
  status,
  balance,
  currency,
  shareToken,
  shareExpiresAt,
}: {
  id: string
  number: string
  status: InvoiceStatus
  balance: number
  currency: string
  shareToken: string | null
  shareExpiresAt: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<InvoiceStatus | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  // window does not exist while this renders on the server.
  useEffect(() => {
    setShareUrl(shareToken ? `${window.location.origin}/share/document/${shareToken}` : null)
  }, [shareToken])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      toast.error("Could not reach the clipboard — copy the link from the field below")
      return false
    }
  }

  const changeStatus = async (next: InvoiceStatus) => {
    setBusy(next)
    try {
      const response = await fetch(`/api/invoices/${id}`, {
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
      const response = await fetch(`/api/invoices/${id}/share`, { method: "POST" })
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
      const response = await fetch(`/api/invoices/${id}/share`, { method: "DELETE" })
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

  const available = INVOICE_TRANSITIONS[status].filter((next) => next in STATUS_ACTIONS)
  const canTakePayment = balance > 0 && status !== "CANCELLED"

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {canTakePayment && (
          <Button size="sm" disabled={!!busy} onClick={() => setPayOpen(true)}>
            <IndianRupee className="mr-2 h-4 w-4" />
            Record payment
          </Button>
        )}

        {available.map((next) => {
          const action = STATUS_ACTIONS[next]!
          const Icon = action.icon
          return (
            <Button
              key={next}
              variant="outline"
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

        <Separator orientation="vertical" className="h-6" />

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

        {status !== "PAID" && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/invoices/${id}/edit`}>
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
              Expires{" "}
              {new Date(shareExpiresAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      )}

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        invoiceId={id}
        invoiceNumber={number}
        balance={balance}
        currency={currency}
      />

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming && STATUS_ACTIONS[confirming]?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming && STATUS_ACTIONS[confirming]?.confirm} {number} stays on record.
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
