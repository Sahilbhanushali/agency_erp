import type { Metadata } from "next"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { Plus } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { can } from "@/lib/api-auth"
import { Button } from "@/components/ui/button"
import InvoiceTable from "@/components/finance/invoice-table"
import NoAccess from "@/components/finance/no-access"

export const metadata: Metadata = { title: "Invoices" }

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions)
  if (!(await can(session, "invoices", "read"))) return <NoAccess what="invoices" />
  const canCreate = await can(session, "invoices", "create")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Tax invoices your companies issue, with GST, payments and a client link.
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/invoices/new">
              <Plus className="mr-2 h-4 w-4" />
              New invoice
            </Link>
          </Button>
        )}
      </div>

      <InvoiceTable />
    </div>
  )
}
