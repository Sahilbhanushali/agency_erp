import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { can } from "@/lib/api-auth"
import InvoiceEditor from "@/components/finance/invoice-editor"
import NoAccess from "@/components/finance/no-access"

export const metadata: Metadata = { title: "New invoice" }

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; clientId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!(await can(session, "invoices", "create"))) {
    return <NoAccess what="creating invoices" />
  }

  const { companyId, clientId } = await searchParams

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">New invoice</h1>
        <p className="text-sm text-muted-foreground">
          The number is assigned when you save, from the issuing company&apos;s own series.
        </p>
      </div>

      <InvoiceEditor prefill={{ companyId, clientId }} />
    </div>
  )
}
