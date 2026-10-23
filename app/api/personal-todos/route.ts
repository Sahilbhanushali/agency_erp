import { NextResponse, type NextRequest } from "next/server"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { personalTodoQuerySchema, personalTodoSchema } from "@/lib/validation/personal-todo"

/**
 * The signed-in person's own todos. There is no way to ask for anyone else's: the
 * user id comes from the session, never from the request.
 */
export const dynamic = "force-dynamic"

/** A personal list, not a table to page through — but never unbounded. */
const MAX_ITEMS = 500

const SELECT = {
  id: true,
  title: true,
  notes: true,
  priority: true,
  dueAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export async function GET(request: NextRequest) {
  const auth = await requireCan("personal_todos", "read")
  if (!auth.ok) return auth.response

  const parsed = personalTodoQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Invalid filters" }, { status: 400 })
  const { status, priority, due, q } = parsed.data

  const now = new Date()
  const today = startOfDay(now)
  const tomorrow = new Date(today.getTime() + 86_400_000)

  const where: Record<string, unknown> = { userId: auth.userId }
  if (status === "open") where.completedAt = null
  if (status === "done") where.completedAt = { not: null }
  if (priority) where.priority = priority
  if (due === "overdue") {
    where.dueAt = { lt: now }
    where.completedAt = null // finished work is not overdue
  }
  if (due === "today") where.dueAt = { gte: today, lt: tomorrow }
  if (due === "upcoming") where.dueAt = { gte: tomorrow }
  if (due === "none") where.dueAt = null
  if (q) where.OR = [{ title: { contains: q } }, { notes: { contains: q } }]

  try {
    const [items, overdueCount, openCount] = await Promise.all([
      prisma.personalTodo.findMany({
        where,
        select: SELECT,
        // Open first, then soonest due (undated last), then newest.
        orderBy: [{ completedAt: "asc" }, { dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        take: MAX_ITEMS,
      }),
      prisma.personalTodo.count({ where: { userId: auth.userId, completedAt: null, dueAt: { lt: now } } }),
      prisma.personalTodo.count({ where: { userId: auth.userId, completedAt: null } }),
    ])
    return NextResponse.json({ items, overdueCount, openCount })
  } catch (error) {
    console.error("[personal-todos] list failed:", error)
    return NextResponse.json({ error: "Could not load your todos" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireCan("personal_todos", "read")
  if (!auth.ok) return auth.response

  const parsed = personalTodoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  try {
    const item = await prisma.personalTodo.create({
      data: { ...parsed.data, userId: auth.userId },
      select: SELECT,
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error("[personal-todos] create failed:", error)
    return NextResponse.json({ error: "Could not save the todo" }, { status: 500 })
  }
}
