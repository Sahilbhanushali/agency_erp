import { type NextRequest, NextResponse } from "next/server"
import { requireCan } from "@/lib/api-auth";
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { logAuditAction } from "@/lib/audit"
import { clientIp } from "@/lib/rate-limit"

/**
 * Creates a staff account. Administrators only — this is not self-service signup:
 * the caller used to be able to pick their own role, unauthenticated, which allowed
 * anyone to mint an admin. The role now has to exist and is supplied as an id.
 */
export async function POST(request: NextRequest) {
  const auth = await requireCan("users", "create")
  if (!auth.ok) return auth.response

  try {
    const { name, email, password, roleId } = await request.json()

    if (!name || !email || !password || roleId === undefined || roleId === null) {
      return NextResponse.json(
        { error: "name, email, password and roleId are required" },
        { status: 422 },
      )
    }

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 422 },
      )
    }

    const parsedRoleId = Number(roleId)
    if (!Number.isInteger(parsedRoleId)) {
      return NextResponse.json({ error: "roleId must be a number" }, { status: 422 })
    }

    const role = await prisma.role.findUnique({
      where: { id: parsedRoleId },
      select: { id: true, name: true },
    })
    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 422 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      )
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(password, 10),
        roleId: role.id,
      },
      select: { id: true, name: true, email: true, role: { select: { id: true, name: true } } },
    })

    await logAuditAction({
      userId: String(auth.userId),
      action: "CREATE",
      entityType: "User",
      entityId: String(user.id),
      newValues: JSON.stringify({ name, email, roleId: role.id, role: role.name }),
      ipAddress: clientIp(request.headers) || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ message: "User created successfully", user }, { status: 201 })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
