import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { taskReorderSchema } from "@/lib/validation/task"

export const dynamic = "force-dynamic"

/**
 * Persist a kanban column's order after a drag. The client sends the whole column, so
 * one request settles both the moved card's new status and every neighbour's position.
 * All in a transaction: a half-applied reorder would leave the board scrambled.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireCan("tasks", "update")
  if (!auth.ok) return auth.response

  try {
    const parsed = taskReorderSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }
    const { status, taskIds } = parsed.data

    // Only ids that actually exist are written, so a stale board cannot 500 the request.
    const existing = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true },
    })
    const known = new Set(existing.map((task) => task.id))
    const ordered = taskIds.filter((id) => known.has(id))

    // Captured before the write so the audit entry can say what actually changed.
    const before = await prisma.task.findMany({
      where: { id: { in: ordered } },
      select: { id: true, status: true },
    })
    const moved = before.filter((task) => task.status !== status)

    await prisma.$transaction(
      ordered.map((id, position) =>
        prisma.task.update({
          where: { id },
          data: {
            position,
            status,
            // Keep completedAt honest when a card is dragged into or out of Done.
            ...(status === "DONE" ? { completedAt: new Date() } : { completedAt: null }),
          },
        }),
      ),
    )

    // Sync blocker reason to any linked DailyTodo items if marked BLOCKED
    if (status === "BLOCKED" && parsed.data.blockerReason && moved.length > 0) {
      const movedIds = moved.map((t) => t.id)
      const linkedTodos = await prisma.dailyTodo.findMany({
        where: { taskId: { in: movedIds } },
        select: { id: true },
      })
      for (const lt of linkedTodos) {
        await prisma.dailyTodo.update({
          where: { id: lt.id },
          data: { status: "BLOCKED", blocker: parsed.data.blockerReason },
        })
        await prisma.todoBlocker.create({
          data: {
            todoId: lt.id,
            title: parsed.data.blockerReason,
            category: (parsed.data.blockerCategory as any) || "TECHNICAL_ISSUE",
            status: "OPEN",
          },
        })
      }
    }

    // A drag is how most status changes happen, so it has to leave a trail — without
    // this, the only record of a task moving was its updatedAt timestamp.
    if (moved.length > 0) {
      await logAuditAction({
        userId: String(auth.userId),
        action: "UPDATE",
        entityType: "Task",
        entityId: moved.map((task) => task.id).join(","),
        oldValues: JSON.stringify(moved.map((task) => ({ id: task.id, status: task.status }))),
        newValues: JSON.stringify({ status }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      })
    }

    return NextResponse.json({ updated: ordered.length, skipped: taskIds.length - ordered.length })
  } catch (error) {
    console.error("[tasks] reorder failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
