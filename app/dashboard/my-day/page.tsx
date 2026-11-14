import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { can } from "@/lib/api-auth"
import MyDay from "@/components/todos/my-day"
import PersonalTodos from "@/components/todos/personal-todos"

export const metadata: Metadata = { title: "My Day" }

/**
 * Everyone has a day to plan, so this page needs no permission to open — the API
 * self-scopes to the signed-in person. `todos:read` only adds the team view.
 */
export default async function MyDayPage() {
  const session = await getServerSession(authOptions)
  const canSeeTeam = await can(session, "todos", "read")
  // Offered to roles granted personal_todos (Manager and Team Lead by default). The API
  // checks the same permission and scopes every item to its owner.
  const canKeepPersonal = await can(session, "personal_todos", "read")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">My Day</h1>
        <p className="text-sm text-muted-foreground">
          What you plan to do today. Tasks assigned to you and due today appear here
          automatically; your manager gets a summary at 7pm.
        </p>
      </div>

      <MyDay canSeeTeam={canSeeTeam} />

      {canKeepPersonal && <PersonalTodos />}
    </div>
  )
}
