import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditAction } from "@/lib/audit"
import bcrypt from "bcryptjs"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    // Uncomment if you want admin-only access
    // if (!session?.user?.id || session.user.role !== "ADMIN") {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // }

    // Extract role(s) from query params
    const { searchParams } = new URL(request.url)
    const roleParam = searchParams.get("role")

    let whereClause = {}

    if (roleParam) {
      // Support multiple roles: /api/users?role=Designer,Video%20Editor
      const roles = roleParam.split(",").map((r) => r.trim())
      whereClause = {
        role: {
          name: { in: roles },
        },
      }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
        avatar: true,
        createdAt: true,
        assignedProjects: { select: { name: true, id: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const formattedUsers = users.map((user: any) => ({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      role: user.role?.name || null,
      avatar: user.avatar,
      createdAt: user.createdAt,
      assignedProjects: user.assignedProjects.map((project: any) => ({ name: project.name, id: project.id.toString() })),
    }))

    return NextResponse.json(formattedUsers)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  } finally {
    // await prisma.$disconnect()
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !["ADMIN", "MANAGER", "Manager"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, email, password, role } = await request.json()

    // Validate input
    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Check if role exists
    const roleObj = await prisma.role.findUnique({ where: { name: role } })
    if (!roleObj) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roleId: roleObj.id, // Use roleId
      },
    })

    // Log audit action
    await logAuditAction({
      userId: session.user.id.toString(),
      action: "CREATE",
      entityType: "User",
      entityId: user.id.toString(),
      newValues: JSON.stringify({ name, email, role }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({
      message: "User created successfully",
      user: { id: user.id.toString(), name: user.name, email: user.email, role },
    })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  } finally {
    // await prisma.$disconnect()
  }
}