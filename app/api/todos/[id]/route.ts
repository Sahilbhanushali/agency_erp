import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { can, requireSession } from "@/lib/api-auth"
import { todoSelect } from "@/lib/todos/service"
import { todoUpdateSchema } from "@/lib/validation/todo"

export const dynamic = "force-dynamic"

/**
 * Update progress, record a blocker, or finish an item.
 *
 * Owner or `todos:update`. Progress and status are kept consistent here rather than
 * trusted from the client: marking something done sets 100% and stamps completedAt,
 * and reopening it clears the stamp — otherwise a report would show work "completed"
 * at a time it was not.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const parsed = todoUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }
    const input = parsed.data

    const existing = await prisma.dailyTodo.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, taskId: true },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isOwner = existing.userId === auth.userId
    if (!isOwner && !(await can(auth.session, "todos", "update"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const becameDone = input.status === "DONE" && existing.status !== "DONE"
    const leftDone = input.status !== undefined && input.status !== "DONE" && existing.status === "DONE"

    const todo = await prisma.dailyTodo.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        // A recorded blocker implies being blocked, unless the caller said otherwise
        // in the same request.
        ...(input.blocker !== undefined
          ? {
              blocker: input.blocker,
              ...(input.blocker && !input.status ? { status: "BLOCKED" as const } : {}),
            }
          : {}),
        ...(input.progress !== undefined ? { progress: input.progress } : {}),
        ...(becameDone ? { progress: 100, completedAt: new Date(), blocker: null } : {}),
        ...(leftDone ? { completedAt: null } : {}),
      },
      select: todoSelect,
    })

    // Finishing the day's entry for a task finishes the task too, so the two cannot
    // disagree about whether the work is done.
    if (becameDone && existing.taskId) {
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

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const existing = await prisma.dailyTodo.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (existing.userId !== auth.userId && !(await can(auth.session, "todos", "update"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Removes the day's entry only. The underlying Task, if any, is untouched.
    await prisma.dailyTodo.delete({ where: { id } })
    return NextResponse.json({ message: "Removed from today" })
  } catch (error) {
    console.error("[todos] delete failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
