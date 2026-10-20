import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { can, requireSession } from "@/lib/api-auth"
import { dayStart, todoSelect } from "@/lib/todos/service"
import { todoUpdateSchema } from "@/lib/validation/todo"

export const dynamic = "force-dynamic"

/**
 * Update progress, priority, notes, status, or date of a todo.
 *
 * Scoped to owner or users holding `todos:update`.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const body = await request.json()
    const parsed = todoUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }
    const input = parsed.data

    const existing = await prisma.dailyTodo.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, taskId: true, progress: true },
    })
    if (!existing) return NextResponse.json({ error: "Todo not found" }, { status: 404 })

    const isOwner = existing.userId === auth.userId
    const canUpdate = await can(auth.session, "todos", "update")
    if (!isOwner && !canUpdate) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 })
    }

    const becameDone = input.status === "DONE" && existing.status !== "DONE"
    const leftDone = input.status !== undefined && input.status !== "DONE" && existing.status === "DONE"

    // If progress is set to 100 and status not specified, transition to DONE
    let finalStatus = input.status
    if (input.progress === 100 && !finalStatus && existing.status !== "DONE") {
      finalStatus = "DONE"
    }

    const todo = await prisma.dailyTodo.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.date !== undefined ? { date: dayStart(input.date) } : {}),
        ...(finalStatus !== undefined ? { status: finalStatus } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.progress !== undefined ? { progress: input.progress } : {}),
        ...(input.blocker !== undefined ? { blocker: input.blocker } : {}),
        ...(becameDone || finalStatus === "DONE"
          ? { progress: 100, completedAt: new Date(), blocker: null }
          : {}),
        ...(leftDone ? { completedAt: null } : {}),
      },
      select: todoSelect,
    })

    // If marked done, also complete linked task if any
    if ((becameDone || finalStatus === "DONE") && existing.taskId) {
      await prisma.task.update({
        where: { id: existing.taskId },
        data: { status: "DONE", completedAt: new Date() },
      })
    }

    return NextResponse.json({ todo })
  } catch (error) {
    console.error("[todos] update failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/**
 * Remove a todo item.
 *
 * Scoped to owner or users holding `todos:delete` (or `todos:update`).
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const existing = await prisma.dailyTodo.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!existing) return NextResponse.json({ error: "Todo not found" }, { status: 404 })

    const isOwner = existing.userId === auth.userId
    const canDelete =
      (await can(auth.session, "todos", "delete")) ||
      (await can(auth.session, "todos", "update"))

    if (!isOwner && !canDelete) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 })
    }

    // Cascades and removes associated TodoBlocker records automatically
    await prisma.dailyTodo.delete({ where: { id } })
    return NextResponse.json({ message: "Todo removed successfully" })
  } catch (error) {
    console.error("[todos] delete failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
