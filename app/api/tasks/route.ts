import { type NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { notifyTaskAssignees, taskSelect, validateTaskLinks } from "@/lib/tasks"
import { TASK_PRIORITIES, TASK_STATUSES, taskSchema } from "@/lib/validation/task"

export const dynamic = "force-dynamic"

/**
 * List tasks. Filters: `?status=`, `?priority=`, `?assigneeId=`, `?postId=`,
 * `?projectId=`, `?clientId=`, `?search=`, `?mine=1` (assigned to me),
 * `?createdByMe=1` (assigned by me), `?overdue=1`, `?due=overdue|today|week|none`,
 * and `?standalone=1` for internal tasks with no linked record.
 * Paged with `?page=` and `?limit=` (max 200).
 *
 * Only View-tasks is required: anyone who can open the module can read the board.
 */
export async function GET(request: NextRequest) {
  const auth = await requireCan("tasks", "read")
  if (!auth.ok) return auth.response

  try {
    const query = request.nextUrl.searchParams
    const page = Math.max(1, Number(query.get("page")) || 1)
    const limit = Math.min(200, Math.max(1, Number(query.get("limit")) || 100))
    const status = query.get("status")
    const priority = query.get("priority")
    const assigneeId = Number(query.get("assigneeId"))
    const search = query.get("search")?.trim()
    const due = query.get("due")
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(startOfToday.getTime() + 86_400_000)
    /** Due-date ranges, filtered in the database rather than in the browser. */
    const dueFilter: Prisma.TaskWhereInput =
      due === "overdue"
        ? { dueDate: { lt: now }, status: { notIn: ["DONE", "CANCELLED"] } }
        : due === "today"
          ? { dueDate: { gte: startOfToday, lt: endOfToday } }
          : due === "week"
            ? { dueDate: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 7 * 86_400_000) } }
            : due === "none"
              ? { dueDate: null }
              : {}

    const where: Prisma.TaskWhereInput = {
      ...dueFilter,
      ...(status && TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])
        ? { status: status as (typeof TASK_STATUSES)[number] }
        : {}),
      ...(priority && TASK_PRIORITIES.includes(priority as (typeof TASK_PRIORITIES)[number])
        ? { priority: priority as (typeof TASK_PRIORITIES)[number] }
        : {}),
      ...(query.get("postId") ? { postId: query.get("postId")! } : {}),
      // Tasks on the project itself or on any of its posts. Tasks created on a post
      // before projectId was derived from it have only a postId, and were invisible here.
      ...(query.get("projectId")
        ? { AND: [{ OR: [{ projectId: query.get("projectId")! }, { post: { projectId: query.get("projectId")! } }] }] }
        : {}),
      ...(query.get("clientId") ? { clientId: query.get("clientId")! } : {}),
      // A standalone task is one with no linked record at all.
      ...(query.get("standalone") === "1"
        ? { postId: null, projectId: null, clientId: null }
        : {}),
      ...(query.get("mine") === "1"
        ? { assignees: { some: { id: auth.userId } } }
        : Number.isFinite(assigneeId) && assigneeId > 0
          ? { assignees: { some: { id: assigneeId } } }
          : {}),
      // Work this person handed out, as opposed to work handed to them.
      ...(query.get("createdByMe") === "1" ? { createdById: auth.userId } : {}),
      // Overdue means past due and not yet finished — a done task is never overdue.
      ...(query.get("overdue") === "1"
        ? { dueDate: { lt: new Date() }, status: { notIn: ["DONE", "CANCELLED"] } }
        : {}),
      ...(search
        ? { OR: [{ title: { contains: search } }, { description: { contains: search } }] }
        : {}),
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        select: taskSelect,
        // Board order: column position first, then soonest due, then newest.
        orderBy: [{ position: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.task.count({ where }),
    ])

    return NextResponse.json({ tasks, total, page, limit })
  } catch (error) {
    console.error("[tasks] list failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireCan("tasks", "create")
  if (!auth.ok) return auth.response

  try {
    const parsed = taskSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }
    const input = parsed.data

    // Every reference from an untrusted caller is checked before the write, so a bad id
    // becomes a 422 instead of a foreign-key 500.
    const links = await validateTaskLinks(input)
    if ("error" in links) return NextResponse.json({ error: links.error }, { status: 422 })

    // New tasks go to the top of their column.
    const first = await prisma.task.findFirst({
      where: { status: input.status },
      orderBy: { position: "asc" },
      select: { position: true },
    })

    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate,
        completedAt: input.status === "DONE" ? new Date() : null,
        position: (first?.position ?? 0) - 1,
        createdById: auth.userId,
        postId: input.postId,
        // Follows the post when there is one, so post tasks always show on their project.
        projectId: links.projectId ?? null,
        clientId: input.clientId,
        assignees: { connect: input.assigneeIds.map((id) => ({ id })) },
      },
      select: taskSelect,
    })

    await notifyTaskAssignees(input.assigneeIds, task.id, task.title, auth.userId, {
      dueDate: task.dueDate,
      priority: task.priority,
      assignedBy: auth.session.user?.name ?? null,
    })

    await logAuditAction({
      userId: String(auth.userId),
      action: "CREATE",
      entityType: "Task",
      entityId: task.id,
      newValues: JSON.stringify({ title: task.title, assignees: input.assigneeIds }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error("[tasks] create failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
