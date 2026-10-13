"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatMoney } from "@/lib/finance"
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/types/finance"

/**
 * Record a payment against an invoice. The amount defaults to the full balance, since
 * settling in full is the common case; the status is recalculated server-side.
 */
export default function PaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  balance,
  currency,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceNumber: string
  balance: number
  currency: string
}) {
  const router = useRouter()
  const [amount, setAmount] = useState(String(balance))
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10))
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount(String(balance))
    setMethod("BANK_TRANSFER")
    setReference("")
    setNotes("")
    setPaidAt(new Date().toISOString().slice(0, 10))
    setErrors({})
  }, [open, balance])

  const over = Number(amount) > balance

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method,
          reference: reference || undefined,
          notes: notes || undefined,
          paidAt: paidAt || null,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 422 && data.details) {
          setErrors(data.details)
          toast.error("Check the highlighted fields")
        } else {
          toast.error(data.error ?? "Could not record the payment")
        }
        return
      }

      toast.success(
        data.balance > 0
          ? `Recorded. ${formatMoney(data.balance, currency)} still due.`
          : `${invoiceNumber} settled in full`,
      )
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              {invoiceNumber} — {formatMoney(balance, currency)} outstanding.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="payment-amount">Amount *</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? "payment-amount-error" : undefined}
                className="mt-1"
              />
              {errors.amount && (
                <p id="payment-amount-error" className="mt-1 text-xs text-destructive">
                  {errors.amount[0]}
                </p>
              )}
              {over && !errors.amount && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  This is more than the outstanding balance — the invoice will show a credit.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="payment-method">Method</Label>
                <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
                  <SelectTrigger id="payment-method" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {PAYMENT_METHOD_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payment-date">Received on</Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={paidAt}
                  onChange={(event) => setPaidAt(event.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="payment-reference">Reference</Label>
              <Input
                id="payment-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="UTR, cheque number or transaction id"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="payment-notes">Notes</Label>
              <Textarea
                id="payment-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Internal only — not printed on the invoice."
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
