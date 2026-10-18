import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hasPermission, requireCan, requireSession } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { notifyTaskAssignees, taskSelect, validateTaskLinks } from "@/lib/tasks"
import { taskSelfUpdateSchema, taskUpdateSchema } from "@/lib/validation/task"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("tasks", "read")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const task = await prisma.task.findUnique({ where: { id }, select: taskSelect })
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ task })
  } catch (error) {
    console.error("[tasks] read failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/**
 * Two levels of write access:
 *   - Manage-tasks edits anything.
 *   - An assignee without it may still move their own task's status, because being
 *     handed work has to come with the ability to report on it. Any other field in
 *     the body is refused rather than silently ignored.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const body = await request.json()

    const existing = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        completedAt: true,
        assignees: { select: { id: true } },
      },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const canManage = await hasPermission(auth.session, "Manage-tasks")
    const isAssignee = existing.assignees.some((user) => user.id === auth.userId)

    if (!canManage) {
      if (!isAssignee) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

      const selfParsed = taskSelfUpdateSchema.safeParse(body)
      if (!selfParsed.success || Object.keys(body).length !== 1) {
        return NextResponse.json(
          { error: "You can only change the status of a task assigned to you" },
          { status: 403 },
        )
      }

      const task = await applyUpdate(id, { status: selfParsed.data.status }, existing.status)
      await logAuditAction({
        userId: String(auth.userId),
        action: "UPDATE",
        entityType: "Task",
        entityId: id,
        oldValues: JSON.stringify({ status: existing.status }),
        newValues: JSON.stringify({ status: task.status }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      })
      return NextResponse.json({ task })
    }

    const parsed = taskUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }
    const input = parsed.data

    const problem = await validateTaskLinks(input)
    if (problem) return NextResponse.json({ error: problem }, { status: 422 })

    const task = await applyUpdate(id, input, existing.status)

    // Notify only people newly added to the task.
    if (input.assigneeIds) {
      const before = new Set(existing.assignees.map((user) => user.id))
      await notifyTaskAssignees(
        input.assigneeIds.filter((userId) => !before.has(userId)),
        id,
        task.title,
        auth.userId,
      )
    }

    await logAuditAction({
      userId: String(auth.userId),
      action: "UPDATE",
      entityType: "Task",
      entityId: id,
      oldValues: JSON.stringify({ title: existing.title, status: existing.status }),
      newValues: JSON.stringify({ title: task.title, status: task.status }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ task })
  } catch (error) {
    console.error("[tasks] update failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("tasks", "delete")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, title: true, status: true },
    })
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.task.delete({ where: { id } })

    await logAuditAction({
      userId: String(auth.userId),
      action: "DELETE",
      entityType: "Task",
      entityId: id,
      oldValues: JSON.stringify({ title: task.title, status: task.status }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ message: "Task deleted" })
  } catch (error) {
    console.error("[tasks] delete failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/**
 * `completedAt` is derived, never sent by the client: it is stamped when a task first
 * reaches DONE and cleared when it leaves, so "when was this finished" stays truthful.
 */
async function applyUpdate(
  id: string,
  input: Partial<{
    title: string
    description?: string
    status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED"
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
    dueDate: Date | null
    assigneeIds: number[]
    postId: string | null
    projectId: string | null
    clientId: string | null
  }>,
  previousStatus: string,
) {
  const becameDone = input.status === "DONE" && previousStatus !== "DONE"
  const leftDone = input.status !== undefined && input.status !== "DONE" && previousStatus === "DONE"

  return prisma.task.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      ...(input.postId !== undefined ? { postId: input.postId } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(becameDone ? { completedAt: new Date() } : {}),
      ...(leftDone ? { completedAt: null } : {}),
      ...(input.assigneeIds
        ? { assignees: { set: input.assigneeIds.map((userId) => ({ id: userId })) } }
        : {}),
    },
    select: taskSelect,
  })
}
