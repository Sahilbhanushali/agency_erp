import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { can, requireCan, requireSession } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import {
  notifyTaskAssignees,
  notifyTaskStatusChange,
  taskAccess,
  taskSelect,
  validateTaskLinks,
} from "@/lib/tasks"
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
 * Three levels of write access, resolved by taskAccess() in lib/tasks.ts:
 *   - `tasks:update` edits any task.
 *   - The task's creator edits their own task in full. Ownership, not a permission:
 *     it confers nothing on anyone else's work.
 *   - An assignee may move that task's status, because being handed work has to come
 *     with the ability to report on it. Any other field is refused rather than
 *     silently ignored.
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
        createdById: true,
        assignees: { select: { id: true } },
      },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // `hasPermission` matches a legacy name exactly, so a role created in the
    // permission matrix — holding tasks:update and never "Manage-tasks" — was told it
    // could not manage tasks. The client resolves that alias correctly, so the Edit
    // button appeared and then the save was refused.
    const canManage = await can(auth.session, "tasks", "update")
    const access = taskAccess(existing, auth.userId, canManage)

    if (access.level === "none") {
      return NextResponse.json({ error: `Forbidden: ${access.reason}` }, { status: 403 })
    }

    if (access.level === "status") {
      // Assignees and the person who created the task may move it, nothing more.
      const selfParsed = taskSelfUpdateSchema.safeParse(body)
      const allowedKeys = new Set(["status", "blockerReason", "blockerCategory"])
      const hasOnlyAllowed = Object.keys(body).every((k) => allowedKeys.has(k))
      if (!selfParsed.success || !hasOnlyAllowed) {
        return NextResponse.json(
          { error: `You can only change the status of this task (${access.reason})` },
          { status: 403 },
        )
      }

      const task = await applyUpdate(id, { status: selfParsed.data.status }, existing.status)

      // Sync blocker to linked daily todos if task is marked BLOCKED
      if (selfParsed.data.status === "BLOCKED" && selfParsed.data.blockerReason) {
        const linkedTodos = await prisma.dailyTodo.findMany({
          where: { taskId: id },
          select: { id: true },
        })
        for (const lt of linkedTodos) {
          await prisma.dailyTodo.update({
            where: { id: lt.id },
            data: { status: "BLOCKED", blocker: selfParsed.data.blockerReason },
          })
          await prisma.todoBlocker.create({
            data: {
              todoId: lt.id,
              title: selfParsed.data.blockerReason,
              category: (selfParsed.data.blockerCategory as any) || "TECHNICAL_ISSUE",
              status: "OPEN",
            },
          })
        }
      }

      if (selfParsed.data.status !== existing.status) {
        await notifyTaskStatusChange(
          id,
          task.title,
          existing.status,
          selfParsed.data.status,
          auth.userId,
          auth.session.user?.name ?? null,
          {
            assigneeIds: existing.assignees.map((a) => a.id),
            createdById: existing.createdById,
          },
        )
      }

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
        { dueDate: task.dueDate, priority: task.priority, assignedBy: auth.session.user?.name ?? null },
      )
    }

    if (input.status && input.status !== existing.status) {
      await notifyTaskStatusChange(
        id,
        task.title,
        existing.status,
        input.status,
        auth.userId,
        auth.session.user?.name ?? null,
        { assigneeIds: existing.assignees.map((a) => a.id), createdById: existing.createdById },
      )

      if (input.status === "BLOCKED" && (input.blockerReason || body.blockerReason)) {
        const reason = input.blockerReason || body.blockerReason
        const category = input.blockerCategory || body.blockerCategory || "TECHNICAL_ISSUE"
        const linkedTodos = await prisma.dailyTodo.findMany({
          where: { taskId: id },
          select: { id: true },
        })
        for (const lt of linkedTodos) {
          await prisma.dailyTodo.update({
            where: { id: lt.id },
            data: { status: "BLOCKED", blocker: reason },
          })
          await prisma.todoBlocker.create({
            data: {
              todoId: lt.id,
              title: reason,
              category,
              status: "OPEN",
            },
          })
        }
      }
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
