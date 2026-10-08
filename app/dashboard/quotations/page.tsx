import type { Metadata } from "next"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { Plus } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { hasPermission } from "@/lib/api-auth"
import { Button } from "@/components/ui/button"
import QuotationTable from "@/components/finance/quotation-table"
import NoAccess from "@/components/finance/no-access"

export const metadata: Metadata = { title: "Quotations" }

export default async function QuotationsPage() {
  const session = await getServerSession(authOptions)
  if (!(await hasPermission(session, "View-quotations"))) return <NoAccess what="quotations" />
  const canManage = await hasPermission(session, "Manage-quotations")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotations</h1>
          <p className="text-sm text-muted-foreground">
            Priced proposals your companies issue to clients, with GST and a shareable link.
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/dashboard/quotations/new">
              <Plus className="mr-2 h-4 w-4" />
              New quotation
            </Link>
          </Button>
        )}
      </div>

      <QuotationTable />
    </div>
  )
}
