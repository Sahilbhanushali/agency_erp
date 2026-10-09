import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ClientForm } from "@/components/forms/client-form"

export default async function NewClientPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/signin")
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-xs" asChild>
          <Link href="/dashboard/clients" title="Back to clients">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <UserPlus className="size-6 text-primary" />
            Add New Client
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create an agency client profile for project tracking and invoices
          </p>
        </div>
      </div>

      <ClientForm />
    </div>
  )
}
