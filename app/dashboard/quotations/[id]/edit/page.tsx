import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasPermission } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { quotationDetailSelect } from "@/lib/finance"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
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
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title={`Edit Quotation: ${quotation.number}`}
        description="Totals and GST breakdowns are automatically recalculated from the line items when saved."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href={`/dashboard/quotations/${quotation.id}`}>
            <ArrowLeft className="size-3.5" />
            View Document
          </Link>
        </Button>
      </PageHeader>

      <QuotationEditor quotation={serialised} />
    </div>
  )
}
