import type { Metadata } from "next"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { ListTodo, Workflow } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { can } from "@/lib/api-auth"
import TaskBoard from "@/components/tasks/task-board"
import WorkQueueView from "@/components/tasks/work-queue-view"
import NoAccess from "@/components/finance/no-access"

export const metadata: Metadata = { title: "Tasks" }

/**
 * Two distinct things live here, so they get a tab each rather than being merged:
 *   - Tasks: the standalone Task entity, a checklist you create and assign.
 *   - Post pipeline: assigned posts moving through PostStatus, a workflow.
 * The tab is a URL param, which keeps this a server component (so the permission check
 * stays server-side) and makes either view linkable.
 */
const VIEWS = [
  { key: "board", label: "Tasks", icon: ListTodo, href: "/dashboard/tasks" },
  { key: "pipeline", label: "Post pipeline", icon: Workflow, href: "/dashboard/tasks?view=pipeline" },
] as const

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!(await can(session, "tasks", "read"))) return <NoAccess what="tasks" />

    // Each action is checked separately now: a role can be allowed to move a task
  // through its statuses without being allowed to create or delete one.
  const perms = {
    create: await can(session, "tasks", "create"),
    update: await can(session, "tasks", "update"),
    delete: await can(session, "tasks", "delete"),
  }
  const { view } = await searchParams
  const active = view === "pipeline" ? "pipeline" : "board"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          {active === "board"
            ? "Work you create and assign — standalone, or attached to a post, project or client."
            : "Posts assigned to the team, grouped by project and moving through approval."}
        </p>
      </div>

      <nav aria-label="Task views" className="inline-flex rounded-lg border border-border p-1">
        {VIEWS.map((item) => {
          const Icon = item.icon
          const isActive = active === item.key
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {active === "board" ? <TaskBoard perms={perms} /> : <WorkQueueView />}
    </div>
  )
}
