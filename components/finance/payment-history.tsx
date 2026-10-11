"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { formatMoney, toNumber } from "@/lib/finance"
import { PAYMENT_METHOD_LABELS, type Payment } from "@/types/finance"

/** Money received, newest first. Reversing a payment walks the invoice status back. */
export default function PaymentHistory({
  invoiceId,
  payments,
  total,
  paid,
  balance,
  currency,
  canManage,
}: {
  invoiceId: string
  payments: Payment[]
  total: number
  paid: number
  balance: number
  currency: string
  canManage: boolean
}) {
  const router = useRouter()
  const [reversing, setReversing] = useState<Payment | null>(null)
  const [busy, setBusy] = useState(false)

  const handleReverse = async () => {
    if (!reversing) return
    setBusy(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/payments/${reversing.id}`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? "Could not reverse the payment")
        return
      }
      toast.success(`Payment reversed — invoice is now ${String(data.status).toLowerCase()}`)
      setReversing(null)
      router.refresh()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusy(false)
    }
  }

  const money = (amount: number) => formatMoney(amount, currency)

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Payments</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Invoice total</dt>
            <dd className="tabular-nums">{money(total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Received</dt>
            <dd className="tabular-nums">{money(paid)}</dd>
          </div>
          <Separator />
          <div className="flex justify-between text-base font-semibold">
            <dt>{balance < 0 ? "Credit due to client" : "Balance due"}</dt>
            <dd className="tabular-nums">{money(Math.abs(balance))}</dd>
          </div>
        </dl>

        {payments.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nothing received yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium tabular-nums">
                    {money(toNumber(payment.amount))}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[payment.method]}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(payment.paidAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {payment.reference && ` · ${payment.reference}`}
                    {payment.recordedBy?.name && ` · recorded by ${payment.recordedBy.name}`}
                  </p>
                  {payment.notes && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{payment.notes}</p>
                  )}
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Reverse payment of ${money(toNumber(payment.amount))}`}
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => setReversing(payment)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={!!reversing} onOpenChange={(open) => !open && setReversing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reverse {reversing && money(toNumber(reversing.amount))}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the record of money received and moves the invoice back to part
              paid or sent. It is written to the audit log and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                handleReverse()
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reverse payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
