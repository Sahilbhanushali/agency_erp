import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { ClientForm } from "@/components/forms/client-form"

export default async function NewClientPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/signin")
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title="Add New Client"
        description="Create an agency client organization profile for campaign tracking, project deliverables, and invoices."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/dashboard/clients">
            <ArrowLeft className="size-3.5" />
            Back to Clients
          </Link>
        </Button>
      </PageHeader>

      <div className="max-w-6xl">
        <ClientForm />
      </div>
    </div>
  )
}
