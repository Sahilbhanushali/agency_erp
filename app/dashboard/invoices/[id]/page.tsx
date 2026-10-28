import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { ArrowLeft } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { hasPermission } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { invoiceDetailSelect, isInvoiceOverdue, paymentSummary, toNumber } from "@/lib/finance"
import { Button } from "@/components/ui/button"
import DocumentView from "@/components/finance/document-view"
import InvoiceActions from "@/components/finance/invoice-actions"
import PaymentHistory from "@/components/finance/payment-history"
import { InvoiceStatusBadge } from "@/components/finance/invoice-table"
import NoAccess from "@/components/finance/no-access"
import type { Payment } from "@/types/finance"

export const metadata: Metadata = { title: "Invoice" }

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!(await hasPermission(session, "View-invoices"))) return <NoAccess what="invoices" />

  const { id } = await params
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: invoiceDetailSelect })
  if (!invoice) notFound()

  const canManage = await hasPermission(session, "Manage-invoices")
  const summary = paymentSummary(invoice.totalAmount, invoice.payments, invoice.status)
  const overdue = isInvoiceOverdue(invoice, summary.balance)

  // Dates and Decimals cross to the client components as JSON-safe values.
  const payments = JSON.parse(JSON.stringify(invoice.payments)) as Payment[]

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-1">
          <Link href="/dashboard/invoices">
            <ArrowLeft className="mr-2 h-4 w-4" />
            All invoices
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{invoice.number}</h1>
          <InvoiceStatusBadge status={overdue ? "OVERDUE" : invoice.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {invoice.title} · {invoice.clientCompany?.name || invoice.client.company || invoice.client.name}
          {invoice.quotation && (
            <>
              {" · from "}
              <Link
                href={`/dashboard/quotations/${invoice.quotation.id}`}
                className="font-mono hover:underline"
              >
                {invoice.quotation.number}
              </Link>
            </>
          )}
        </p>
      </div>

      {canManage && (
        <InvoiceActions
          id={invoice.id}
          number={invoice.number}
          status={invoice.status}
          balance={summary.balance}
          currency={invoice.currency}
          shareToken={invoice.shareToken}
          shareExpiresAt={invoice.shareExpiresAt?.toISOString() ?? null}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] print:block">
        <div className="min-w-0 rounded-xl border border-border bg-muted/30 p-2 sm:p-6 print:border-0 print:bg-transparent print:p-0">
          <DocumentView document={invoice} kind="Invoice" />
        </div>

        <PaymentHistory
          invoiceId={invoice.id}
          payments={payments}
          total={toNumber(invoice.totalAmount)}
          paid={summary.paid}
          balance={summary.balance}
          currency={invoice.currency}
          canManage={canManage}
        />
      </div>
    </div>
  )
}
