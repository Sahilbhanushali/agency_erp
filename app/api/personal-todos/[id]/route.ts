import { NextResponse, type NextRequest } from "next/server"
import { requireCan } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { personalTodoUpdateSchema } from "@/lib/validation/personal-todo"

/**
 * Edit or delete one of your own todos.
 *
 * Writes go through updateMany/deleteMany with the owner in the `where`, so another
 * person's id matches nothing and answers 404 — indistinguishable from an id that does
 * not exist, which is the point: it confirms nothing about anyone else's list.
 */
export const dynamic = "force-dynamic"

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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("personal_todos", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const parsed = personalTodoUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }
  const { completed, ...fields } = parsed.data

  const { count } = await prisma.personalTodo.updateMany({
    where: { id, userId: auth.userId },
    data: {
      ...fields,
      ...(completed === undefined ? {} : { completedAt: completed ? new Date() : null }),
    },
  })
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const item = await prisma.personalTodo.findFirst({ where: { id, userId: auth.userId }, select: SELECT })
  return NextResponse.json({ item })
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("personal_todos", "read")
  if (!auth.ok) return auth.response
  const { id } = await context.params

  const { count } = await prisma.personalTodo.deleteMany({ where: { id, userId: auth.userId } })
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
