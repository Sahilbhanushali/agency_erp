import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditAction } from "@/lib/audit"
import { can, hasPermission, requireCan } from "@/lib/api-auth"
import { sendOnboardingInviteEmail } from "@/lib/email"
import bcrypt from "bcryptjs"
import crypto from "crypto"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCan("users", "read")
    if (!auth.ok) return auth.response
    const session = auth.session

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
        password: true,
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
      hasPassword: !!user.password,
      createdAt: user.createdAt,
      assignedProjects: user.assignedProjects.map((project: any) => ({ name: project.name, id: project.id.toString() })),
    }))

    return NextResponse.json(formattedUsers)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("users", "create")
    if (!auth.ok) return auth.response
    const session = auth.session

    const body = await request.json()
    const { name, email, role, password, sendInvite = true } = body

    // Validate input
    if (!name || !email || !role) {
      return NextResponse.json({ error: "Name, email, and role are required" }, { status: 400 })
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

    let hashedPassword: string | null = null
    const shouldSendInvite = sendInvite || !password

    if (password && !shouldSendInvite) {
      hashedPassword = await bcrypt.hash(password, 10)
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roleId: roleObj.id,
      },
      include: {
        role: { select: { name: true } },
      },
    })

    let inviteSent = false
    let inviteError: string | null = null

    // If onboarding invite is requested or no password was provided:
    if (shouldSendInvite) {
      try {
        const setupToken = crypto.randomBytes(32).toString("hex")
        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000) // 48 hours validity

        // Clean any pre-existing tokens for this email
        await prisma.passwordReset.deleteMany({ where: { email } })

        // Store setup token
        await prisma.passwordReset.create({
          data: {
            email,
            token: setupToken,
            expiresAt,
          },
        })

        // Dispatch onboarding email
        await sendOnboardingInviteEmail({
          email,
          name,
          role: roleObj.name,
          token: setupToken,
        })

        inviteSent = true
      } catch (err: any) {
        console.error("Failed to send onboarding email:", err)
        inviteError = err.message || "Failed to dispatch email"
      }
    }

    // Log audit action
    await logAuditAction({
      userId: String(session.user.id),
      action: "CREATE",
      entityType: "User",
      entityId: String(user.id),
      newValues: JSON.stringify({
        name,
        email,
        role,
        inviteSent,
        hasPassword: !!hashedPassword,
      }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({
      message: inviteSent
        ? "User registered and onboarding invitation email sent successfully"
        : "User created successfully",
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        role: user.role?.name,
        hasPassword: !!user.password,
      },
      inviteSent,
      inviteError,
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}