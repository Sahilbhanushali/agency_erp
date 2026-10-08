import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasPermission } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { quotationDetailSelect } from "@/lib/finance"
import { Alert, AlertDescription } from "@/components/ui/alert"
import QuotationEditor from "@/components/finance/quotation-editor"
import NoAccess from "@/components/finance/no-access"
import type { QuotationDetail } from "@/types/finance"

export const metadata: Metadata = { title: "Edit quotation" }

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!(await hasPermission(session, "Manage-quotations"))) {
    return <NoAccess what="editing quotations" />
  }

  const { id } = await params
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    select: quotationDetailSelect,
  })
  if (!quotation) notFound()

  if (quotation.status === "CONVERTED") {
    return (
      <Alert>
        <AlertDescription>
          {quotation.number} has been converted to an invoice, so it can no longer be edited.
        </AlertDescription>
      </Alert>
    )
  }

  // Dates and Decimals cross to the client component as JSON-safe values.
  const serialised = JSON.parse(JSON.stringify(quotation)) as QuotationDetail

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit <span className="font-mono">{quotation.number}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Totals are recalculated from the line items when you save.
        </p>
      </div>

      <QuotationEditor quotation={serialised} />
    </div>
  )
}
