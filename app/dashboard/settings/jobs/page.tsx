import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { ArrowLeft } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { can } from "@/lib/api-auth"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import JobsManager from "@/components/jobs/jobs-manager"

export const metadata = { title: "Scheduled jobs" }

/**
 * Settings -> Scheduled jobs.
 *
 * A server component so the permission is checked before anything renders; the editing
 * surface below is the only part that needs to be interactive.
 */
export default async function ScheduledJobsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/signin")
  if (!(await can(session, "settings", "read"))) redirect("/dashboard")

  const editable = await can(session, "settings", "update")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduled jobs"
        description="Decide when each automatic email runs, in which timezone, and who receives it."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/dashboard/settings">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to settings
          </Link>
        </Button>
      </PageHeader>

      <JobsManager editable={editable} />
    </div>
  )
}
