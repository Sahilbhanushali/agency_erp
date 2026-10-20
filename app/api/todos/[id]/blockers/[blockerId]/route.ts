import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { can, requireSession } from "@/lib/api-auth"
import { blockerSelect, syncTodoBlockerState, todoSelect } from "@/lib/todos/service"
import { blockerUpdateSchema } from "@/lib/validation/todo"

export const dynamic = "force-dynamic"

/**
 * Update a blocker's details, category, or status (Open -> In Progress -> Resolved).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; blockerId: string }> },
) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const { id, blockerId } = await context.params
    const body = await request.json()
    const parsed = blockerUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const blocker = await prisma.todoBlocker.findUnique({
      where: { id: blockerId },
      include: { todo: { select: { id: true, userId: true } } },
    })
    if (!blocker || blocker.todoId !== id) {
      return NextResponse.json({ error: "Blocker not found" }, { status: 404 })
    }

    const isOwner = blocker.todo.userId === auth.userId
    const canUpdate = await can(auth.session, "todos", "update")
    if (!isOwner && !canUpdate) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 })
    }

    const isNowResolved = parsed.data.status === "RESOLVED" && blocker.status !== "RESOLVED"
    const isReopened =
      parsed.data.status && parsed.data.status !== "RESOLVED" && blocker.status === "RESOLVED"

    const updatedBlocker = await prisma.todoBlocker.update({
      where: { id: blockerId },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
        ...(parsed.data.impact !== undefined ? { impact: parsed.data.impact } : {}),
        ...(parsed.data.assistanceRequired !== undefined
          ? { assistanceRequired: parsed.data.assistanceRequired }
          : {}),
        ...(parsed.data.responsibleParty !== undefined
          ? { responsibleParty: parsed.data.responsibleParty }
          : {}),
        ...(parsed.data.expectedResolution !== undefined
          ? { expectedResolution: parsed.data.expectedResolution }
          : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.resolutionNotes !== undefined
          ? { resolutionNotes: parsed.data.resolutionNotes }
          : {}),
        ...(isNowResolved ? { resolvedAt: new Date() } : {}),
        ...(isReopened ? { resolvedAt: null } : {}),
      },
      select: blockerSelect,
    })

    // Synchronize parent DailyTodo status and blocker summary
    await syncTodoBlockerState(id)

    const updatedTodo = await prisma.dailyTodo.findUnique({
      where: { id },
      select: todoSelect,
    })

    return NextResponse.json({ blocker: updatedBlocker, todo: updatedTodo })
  } catch (error) {
    console.error("[blockers] update failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/**
 * Delete a blocker.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; blockerId: string }> },
) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const { id, blockerId } = await context.params
    const blocker = await prisma.todoBlocker.findUnique({
      where: { id: blockerId },
      include: { todo: { select: { id: true, userId: true } } },
    })
    if (!blocker || blocker.todoId !== id) {
      return NextResponse.json({ error: "Blocker not found" }, { status: 404 })
    }

    const isOwner = blocker.todo.userId === auth.userId
    const canDelete =
      (await can(auth.session, "todos", "delete")) ||
      (await can(auth.session, "todos", "update"))

    if (!isOwner && !canDelete) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 })
    }

    await prisma.todoBlocker.delete({ where: { id: blockerId } })

    // Synchronize parent DailyTodo status and blocker summary
    await syncTodoBlockerState(id)

    const updatedTodo = await prisma.dailyTodo.findUnique({
      where: { id },
      select: todoSelect,
    })

    return NextResponse.json({ message: "Blocker removed successfully", todo: updatedTodo })
  } catch (error) {
    console.error("[blockers] delete failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
