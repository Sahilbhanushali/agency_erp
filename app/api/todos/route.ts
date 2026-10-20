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
import { todoCreateSchema, todoQuerySchema } from "@/lib/validation/todo"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

/**
 * Today's plan and Team Todo Management.
 *
 * Self-scoped by default for regular users: any signed-in person reads and writes
 * their own day without needing a permission.
 *
 * Administrators and managers holding `todos:read` can view the comprehensive
 * management table with server-side pagination, debounced search, and multi-filters.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const canSeeTeam = await can(auth.session, "todos", "read")
    const canUpdate = await can(auth.session, "todos", "update")
    const canDelete = await can(auth.session, "todos", "delete")

    const isTableQuery =
      searchParams.table === "1" ||
      searchParams.table === "true" ||
      searchParams.format === "table" ||
      Boolean(searchParams.page) ||
      Boolean(searchParams.pageSize) ||
      Boolean(searchParams.search) ||
      Boolean(searchParams.status) ||
      Boolean(searchParams.priority) ||
      Boolean(searchParams.blocked && searchParams.blocked !== "all") ||
      Boolean(searchParams.startDate) ||
      Boolean(searchParams.endDate)

    const wantsTeamLegacy = searchParams.team === "1" && !isTableQuery

    // Table / Administrator Management View
    if (isTableQuery) {
      if (!canSeeTeam) {
        return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 })
      }

      const queryParsed = todoQuerySchema.safeParse(searchParams)
      const q = queryParsed.success ? queryParsed.data : {
        page: 1,
        pageSize: 20,
        sortBy: "date" as const,
        sortOrder: "desc" as const,
        blocked: "all" as const,
      }

      const page = q.page ?? 1
      const pageSize = q.pageSize ?? 20
      const skip = (page - 1) * pageSize
      const take = pageSize

      const where: Prisma.DailyTodoWhereInput = {}

      // Search across todo title, description notes, and user name
      if (q.search) {
        where.OR = [
          { title: { contains: q.search } },
          { notes: { contains: q.search } },
          { user: { name: { contains: q.search } } },
        ]
      }

      // Filter by user
      if (q.userId) {
        where.userId = q.userId
      }

      // Filter by status
      if (q.status && q.status !== "ALL") {
        const statuses = q.status.split(",").map((s) => s.trim()) as Prisma.EnumTodoStatusFilter["in"]
        where.status = { in: statuses }
      }

      // Filter by priority
      if (q.priority && q.priority !== "ALL") {
        const priorities = q.priority.split(",").map((p) => p.trim()) as Prisma.EnumTaskPriorityFilter["in"]
        where.priority = { in: priorities }
      }

      // Filter by blocked status
      if (q.blocked === "blocked") {
        where.OR = [
          { status: "BLOCKED" },
          { blockers: { some: { status: { in: ["OPEN", "IN_PROGRESS"] } } } },
          { blocker: { not: null } },
        ]
      } else if (q.blocked === "unblocked") {
        where.AND = [
          { status: { not: "BLOCKED" } },
          { blockers: { none: { status: { in: ["OPEN", "IN_PROGRESS"] } } } },
        ]
      }

      // Filter by date range or single date
      if (q.startDate && q.endDate) {
        where.date = {
          gte: dayStart(q.startDate),
          lte: dayStart(q.endDate),
        }
      } else if (q.startDate) {
        where.date = { gte: dayStart(q.startDate) }
      } else if (q.endDate) {
        where.date = { lte: dayStart(q.endDate) }
      } else if (q.date) {
        where.date = dayStart(q.date)
      }

      // Sorting
      let orderBy: Prisma.DailyTodoOrderByWithRelationInput[] = []
      if (q.sortBy === "date") {
        orderBy = [{ date: q.sortOrder }, { createdAt: "desc" }]
      } else if (q.sortBy === "priority") {
        orderBy = [{ priority: q.sortOrder }, { date: "desc" }]
      } else if (q.sortBy === "status") {
        orderBy = [{ status: q.sortOrder }, { date: "desc" }]
      } else if (q.sortBy === "title") {
        orderBy = [{ title: q.sortOrder }]
      } else if (q.sortBy === "createdAt") {
        orderBy = [{ createdAt: q.sortOrder }]
      } else if (q.sortBy === "updatedAt") {
        orderBy = [{ updatedAt: q.sortOrder }]
      } else {
        orderBy = [{ date: "desc" }, { createdAt: "desc" }]
      }

      const [todos, total, statusAggregates] = await Promise.all([
        prisma.dailyTodo.findMany({
          where,
          select: todoSelect,
          orderBy,
          skip,
          take,
        }),
        prisma.dailyTodo.count({ where }),
        prisma.dailyTodo.findMany({
          where,
          select: { status: true, progress: true, blocker: true, blockers: { select: { status: true } } },
        }),
      ])

      return NextResponse.json({
        todos,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        summary: summarise(statusAggregates),
        canSeeTeam,
        canUpdate,
        canDelete,
      })
    }

    // Legacy grouped team view
    if (wantsTeamLegacy) {
      if (!canSeeTeam) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const date = dayStart(searchParams.date ?? undefined)
      const todos = await prisma.dailyTodo.findMany({
        where: { date },
        select: todoSelect,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      })

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

      return NextResponse.json({ date, team, canSeeTeam, canUpdate, canDelete })
    }

    // Personal Todo View
    const date = dayStart(searchParams.date ?? undefined)
    const requested = Number(searchParams.userId)
    const targetUserId = requested && canSeeTeam ? requested : auth.userId

    // Only sync if viewing own day
    let sync = { added: 0, carried: 0 }
    if (targetUserId === auth.userId) {
      const [{ added }, { carried }] = await Promise.all([
        syncTasksDueToday(auth.userId, date),
        carryOverUnfinished(auth.userId, date),
      ])
      sync = { added, carried }
    }

    const todos = await prisma.dailyTodo.findMany({
      where: { date, userId: targetUserId },
      select: todoSelect,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({
      date,
      todos,
      summary: summarise(todos),
      sync,
      canSeeTeam,
      canUpdate,
      canDelete,
    })
  } catch (error) {
    console.error("[todos] list failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/**
 * Add a todo item.
 * Regular users plan their own day.
 * Administrators / managers with `todos:update` can plan for others.
 */
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

    const targetUserId = parsed.data.userId || auth.userId
    if (targetUserId !== auth.userId && !(await can(auth.session, "todos", "update"))) {
      return NextResponse.json(
        { error: "Forbidden: you can only plan your own day" },
        { status: 403 },
      )
    }

    const date = dayStart(parsed.data.date)

    if (parsed.data.taskId) {
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
        priority: parsed.data.priority,
        status: parsed.data.status,
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
