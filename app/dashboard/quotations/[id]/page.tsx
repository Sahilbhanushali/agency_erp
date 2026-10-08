import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { ArrowLeft } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { hasPermission } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { quotationDetailSelect } from "@/lib/finance"
import { Button } from "@/components/ui/button"
import DocumentView from "@/components/finance/document-view"
import QuotationActions from "@/components/finance/quotation-actions"
import { QuotationStatusBadge } from "@/components/finance/quotation-table"
import NoAccess from "@/components/finance/no-access"

export const metadata: Metadata = { title: "Quotation" }

export default async function QuotationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!(await hasPermission(session, "View-quotations"))) return <NoAccess what="quotations" />

  const { id } = await params
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    select: quotationDetailSelect,
  })
  if (!quotation) notFound()

  const canManage = await hasPermission(session, "Manage-quotations")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-1">
            <Link href="/dashboard/quotations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All quotations
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{quotation.number}</h1>
            <QuotationStatusBadge status={quotation.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {quotation.title} · {quotation.client.company || quotation.client.name}
          </p>
        </div>
      </div>

      {canManage && (
        <QuotationActions
          id={quotation.id}
          number={quotation.number}
          status={quotation.status}
          shareToken={quotation.shareToken}
          shareExpiresAt={quotation.shareExpiresAt?.toISOString() ?? null}
        />
      )}

      <div className="rounded-xl border border-border bg-muted/30 p-2 sm:p-6 print:border-0 print:bg-transparent print:p-0">
        <DocumentView document={quotation} kind="Quotation" />
      </div>
    </div>
  )
}
