import type { Metadata } from "next"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { Plus } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { hasPermission } from "@/lib/api-auth"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import QuotationTable from "@/components/finance/quotation-table"
import NoAccess from "@/components/finance/no-access"

export const metadata: Metadata = { title: "Quotations" }

export default async function QuotationsPage() {
  const session = await getServerSession(authOptions)
  if (!(await hasPermission(session, "View-quotations"))) return <NoAccess what="quotations" />
  const canManage = await hasPermission(session, "Manage-quotations")

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title="Quotations & Proposals"
        description="Formal priced proposals issued to clients with GST tax itemization, shareable links, and letterhead."
      >
        {canManage && (
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/dashboard/quotations/new">
              <Plus className="size-3.5" />
              New Quotation
            </Link>
          </Button>
        )}
      </PageHeader>

      <QuotationTable />
    </div>
  )
}
