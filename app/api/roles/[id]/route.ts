import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export const dynamic = "force-dynamic"

/**
 * Rename or delete one role.
 *
 * Roles had no endpoint for either, so the only way to remove a leftover role was by
 * hand in the database — which is why a set of roles from an old demo seed was still
 * sitting in the list.
 */

const Patch = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(255).nullable().optional(),
})

/** ADMIN is the account that repairs a misconfigured role, so it must stay intact. */
const PROTECTED = "ADMIN"

async function loadRole(idParam: string) {
  const id = Number(idParam)
  if (!Number.isInteger(id) || id < 1) return null
  return prisma.role.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, _count: { select: { users: true } } },
  })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("roles", "update")
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const role = await loadRole(id)
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (role.name === PROTECTED) {
    return NextResponse.json(
      { error: "The ADMIN role cannot be renamed — it is the account that fixes a broken role." },
      { status: 409 },
    )
  }

  const parsed = Patch.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    )
  }
  if (parsed.data.name === PROTECTED) {
    return NextResponse.json({ error: "That name is reserved." }, { status: 409 })
  }

  try {
    const updated = await prisma.role.update({
      where: { id: role.id },
      data: parsed.data,
      select: { id: true, name: true, description: true },
    })

    await logAudit({
      action: "UPDATE",
      userId: String(auth.userId),
      details: `Role "${role.name}" renamed to "${updated.name}"`,
      metadata: { roleId: role.id },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A role with that name already exists." }, { status: 409 })
    }
    console.error("[roles] rename failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("roles", "delete")
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const role = await loadRole(id)
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (role.name === PROTECTED) {
    return NextResponse.json(
      { error: "The ADMIN role cannot be deleted — deleting it would lock everyone out." },
      { status: 409 },
    )
  }

  /**
   * A role still in use is not deleted silently. `User.roleId` is optional, so the
   * database would happily null it out and leave those people signed in with no
   * permissions at all and no indication why. Say who is affected and make the caller
   * move them first, unless they explicitly ask to unassign.
   */
  const reassign = request.nextUrl.searchParams.get("unassign") === "1"
  if (role._count.users > 0 && !reassign) {
    const holders = await prisma.user.findMany({
      where: { roleId: role.id },
      select: { id: true, name: true, email: true },
      take: 10,
    })
    return NextResponse.json(
      {
        error: `${role._count.users} ${role._count.users === 1 ? "person has" : "people have"} the "${role.name}" role. Give them another role first.`,
        users: holders,
      },
      { status: 409 },
    )
  }

  try {
    // RolePermission has no cascade on this side of the schema, so clear the grants in
    // the same transaction as the role, or a foreign key stops the delete half-way.
    await prisma.$transaction([
      prisma.user.updateMany({ where: { roleId: role.id }, data: { roleId: null } }),
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.role.delete({ where: { id: role.id } }),
    ])

    await logAudit({
      action: "DELETE",
      userId: String(auth.userId),
      details: `Role "${role.name}" deleted${role._count.users > 0 ? `, ${role._count.users} user(s) left without a role` : ""}`,
      metadata: { roleId: role.id },
    })

    return NextResponse.json({ deleted: true, unassigned: role._count.users })
  } catch (error) {
    console.error("[roles] delete failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
