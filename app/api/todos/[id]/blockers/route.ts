import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { can, requireSession } from "@/lib/api-auth"
import { blockerSelect, syncTodoBlockerState, todoSelect } from "@/lib/todos/service"
import { blockerCreateSchema } from "@/lib/validation/todo"

export const dynamic = "force-dynamic"

/**
 * List all blockers for a todo.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const todo = await prisma.dailyTodo.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!todo) return NextResponse.json({ error: "Todo not found" }, { status: 404 })

    const isOwner = todo.userId === auth.userId
    const canSee = await can(auth.session, "todos", "read")
    if (!isOwner && !canSee) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 })
    }

    const blockers = await prisma.todoBlocker.findMany({
      where: { todoId: id },
      select: blockerSelect,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ blockers })
  } catch (error) {
    console.error("[blockers] list failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/**
 * Add a new blocker to a todo.
 *
 * Scoped to owner or users holding `todos:update`.
 * Automatically sets the parent DailyTodo's status to BLOCKED.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const body = await request.json()
    const parsed = blockerCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const todo = await prisma.dailyTodo.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!todo) return NextResponse.json({ error: "Todo not found" }, { status: 404 })

    const isOwner = todo.userId === auth.userId
    const canUpdate = await can(auth.session, "todos", "update")
    if (!isOwner && !canUpdate) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 })
    }

    const isResolved = parsed.data.status === "RESOLVED"
    const blocker = await prisma.todoBlocker.create({
      data: {
        todoId: id,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        impact: parsed.data.impact,
        assistanceRequired: parsed.data.assistanceRequired,
        responsibleParty: parsed.data.responsibleParty,
        expectedResolution: parsed.data.expectedResolution,
        status: parsed.data.status,
        resolutionNotes: parsed.data.resolutionNotes,
        resolvedAt: isResolved ? new Date() : null,
      },
      select: blockerSelect,
    })

    // Synchronize parent DailyTodo status and blocker summary
    await syncTodoBlockerState(id)

    const updatedTodo = await prisma.dailyTodo.findUnique({
      where: { id },
      select: todoSelect,
    })

    return NextResponse.json({ blocker, todo: updatedTodo }, { status: 201 })
  } catch (error) {
    console.error("[blockers] create failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
