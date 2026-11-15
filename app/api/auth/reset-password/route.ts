import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { logAuditAction } from "@/lib/audit"
import { findValidPasswordToken, setPasswordAndRevoke } from "@/lib/password-token"
import { clientIp } from "@/lib/rate-limit"

const schema = z.object({
  token: z.string().min(1).max(128),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(256, "Password is too long"),
})

const INVALID_TOKEN = "This reset link is invalid or has expired. Request a new one."

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Token and password are required"
    return NextResponse.json({ error: message }, { status: 400 })
  }
  const { token, password } = parsed.data

  try {
    const resetRecord = await findValidPasswordToken(token)
    if (!resetRecord) {
      return NextResponse.json({ error: INVALID_TOKEN }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: resetRecord.email },
      select: { id: true, isActive: true },
    })
    // A deactivated account stays locked out; resetting its password must not reopen it.
    if (!user || !user.isActive) {
      return NextResponse.json({ error: INVALID_TOKEN }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // Sets the password, signs out every existing session, and burns every outstanding
    // link for this email so neither this token nor an older one can be replayed.
    await setPasswordAndRevoke(user.id, resetRecord.email, hashedPassword)

    await logAuditAction({
      userId: String(user.id),
      action: "UPDATE",
      entityType: "User",
      entityId: String(user.id),
      oldValues: JSON.stringify({ action: "password_reset_used" }),
      newValues: JSON.stringify({ action: "password_reset_completed" }),
      ipAddress: clientIp(request.headers) || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ message: "Password reset successfully" })
  } catch (error) {
    console.error("Password reset error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
