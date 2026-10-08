import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasPermission } from "@/lib/api-auth"
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New quotation</h1>
        <p className="text-sm text-muted-foreground">
          The number is assigned when you save, from the issuing company&apos;s own series.
        </p>
      </div>

      <QuotationEditor prefill={{ companyId, clientId }} />
    </div>
  )
}
