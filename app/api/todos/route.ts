import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { can, requireSession } from "@/lib/api-auth"
import {
  carryOverUnfinished,
  dayStart,
  summarise,
  syncTasksDueToday,
  todoSelect,
} from "@/lib/todos/service"
import { todoCreateSchema } from "@/lib/validation/todo"

export const dynamic = "force-dynamic"

/**
 * Today's plan.
 *
 * Self-scoped by default: any signed-in person reads and writes their own day without
 * needing a permission, the same way attendance and leaves work. `todos:read` is what
 * lets a manager look at someone else's day via `?userId=` or `?team=1`.
 *
 * Opening your own list also mirrors in any task assigned to you and due today, and
 * carries over yesterday's unfinished work — both idempotent, so refreshing is safe.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const query = request.nextUrl.searchParams
    const date = dayStart(query.get("date") ?? undefined)
    const canSeeTeam = await can(auth.session, "todos", "read")

    const requested = Number(query.get("userId"))
    const wantsTeam = query.get("team") === "1"

    if ((wantsTeam || (requested && requested !== auth.userId)) && !canSeeTeam) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let sync = { added: 0, carried: 0 }
    if (!wantsTeam && (!requested || requested === auth.userId)) {
      const [{ added }, { carried }] = await Promise.all([
        syncTasksDueToday(auth.userId, date),
        carryOverUnfinished(auth.userId, date),
      ])
      sync = { added, carried }
    }

    const where = wantsTeam
      ? { date }
      : { date, userId: requested && canSeeTeam ? requested : auth.userId }

    const todos = await prisma.dailyTodo.findMany({
      where,
      select: todoSelect,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    })

    if (!wantsTeam) {
      return NextResponse.json({ date, todos, summary: summarise(todos), sync, canSeeTeam })
    }

    // Team view: grouped per person, so a manager reads one block each.
    const byUser = new Map<number, typeof todos>()
    for (const todo of todos) {
      const list = byUser.get(todo.user.id) ?? []
      list.push(todo)
      byUser.set(todo.user.id, list)
    }
    const team = Array.from(byUser.values()).map((list) => ({
      user: list[0].user,
      todos: list,
      summary: summarise(list),
    }))

    return NextResponse.json({ date, team, canSeeTeam })
  } catch (error) {
    console.error("[todos] list failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/** Add something to your own day. Planning for someone else needs todos:update. */
export async function POST(request: NextRequest) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = todoCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const targetUserId = Number(body?.userId) || auth.userId
    if (targetUserId !== auth.userId && !(await can(auth.session, "todos", "update"))) {
      return NextResponse.json(
        { error: "You can only plan your own day" },
        { status: 403 },
      )
    }

    const date = dayStart(parsed.data.date)

    if (parsed.data.taskId) {
      // A todo may only mirror a task that is actually assigned to that person.
      const task = await prisma.task.findFirst({
        where: { id: parsed.data.taskId, assignees: { some: { id: targetUserId } } },
        select: { id: true },
      })
      if (!task) {
        return NextResponse.json(
          { error: "That task is not assigned to this person" },
          { status: 422 },
        )
      }
    }

    const last = await prisma.dailyTodo.findFirst({
      where: { userId: targetUserId, date },
      orderBy: { position: "desc" },
      select: { position: true },
    })

    const todo = await prisma.dailyTodo.create({
      data: {
        userId: targetUserId,
        date,
        title: parsed.data.title,
        notes: parsed.data.notes,
        taskId: parsed.data.taskId ?? null,
        position: (last?.position ?? 0) + 1,
      },
      select: todoSelect,
    })

    return NextResponse.json({ todo }, { status: 201 })
  } catch (error) {
    console.error("[todos] create failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
