import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { can } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { invoiceDetailSelect, toNumber } from "@/lib/finance"
import { Alert, AlertDescription } from "@/components/ui/alert"
import InvoiceEditor from "@/components/finance/invoice-editor"
import NoAccess from "@/components/finance/no-access"
import type { InvoiceDetail } from "@/types/finance"

export const metadata: Metadata = { title: "Edit invoice" }

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!(await can(session, "invoices", "update"))) {
    return <NoAccess what="editing invoices" />
  }

  const { id } = await params
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: invoiceDetailSelect })
  if (!invoice) notFound()

  const paid = invoice.payments.reduce((sum, p) => sum + toNumber(p.amount), 0)
  if (paid > 0) {
    return (
      <Alert>
        <AlertDescription>
          {invoice.number} has payments recorded against it, so its amounts are part of the
          client&apos;s records. Reverse those payments first if the figures were wrong.
        </AlertDescription>
      </Alert>
    )
  }

  const serialised = JSON.parse(JSON.stringify(invoice)) as InvoiceDetail

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Edit <span className="font-mono">{invoice.number}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Totals are recalculated from the line items when you save.
        </p>
      </div>

      <InvoiceEditor invoice={serialised} />
    </div>
  )
}
