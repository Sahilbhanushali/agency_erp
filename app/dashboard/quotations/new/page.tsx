import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasPermission } from "@/lib/api-auth"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import QuotationEditor from "@/components/finance/quotation-editor"
import NoAccess from "@/components/finance/no-access"

export const metadata: Metadata = { title: "New quotation" }

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; clientId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!(await hasPermission(session, "Manage-quotations"))) {
    return <NoAccess what="creating quotations" />
  }

  const { companyId, clientId } = await searchParams

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title="New Quotation"
        description="The document number will be automatically assigned when saved from the selected billing company's sequence."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/dashboard/quotations">
            <ArrowLeft className="size-3.5" />
            Back to Quotations
          </Link>
        </Button>
      </PageHeader>

      <QuotationEditor prefill={{ companyId, clientId }} />
    </div>
  )
}
