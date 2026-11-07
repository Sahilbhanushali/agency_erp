import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { logAuditAction } from "@/lib/audit"
import { requireSession } from "@/lib/api-auth"
import { setPasswordAndRevoke } from "@/lib/password-token"

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(256),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters long")
    .max(256, "New password is too long"),
})

export async function PUT(request: NextRequest) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Current password and new password are required"
    return NextResponse.json({ error: message }, { status: 400 })
  }
  const { currentPassword, newPassword } = parsed.data

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, email: true, password: true },
    })
    if (!user || !user.password) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Hash comparison only — a stored value that is not a bcrypt hash never matches.
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    // Ends every existing session, including this one; the profile page signs back in
    // with the new password so only the *other* sessions are lost.
    await setPasswordAndRevoke(user.id, user.email, hashedNewPassword)

    await logAuditAction({
      userId: String(user.id),
      action: "UPDATE",
      entityType: "User",
      entityId: String(user.id),
      oldValues: JSON.stringify({ action: "password_change" }),
      newValues: JSON.stringify({ action: "password_changed" }),
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ message: "Password changed successfully" })
  } catch (error) {
    console.error("Password change error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
