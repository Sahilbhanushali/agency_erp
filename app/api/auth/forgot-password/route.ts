import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetEmail } from "@/lib/email"
import { issuePasswordToken } from "@/lib/password-token"
import { clientIp, isRateLimited } from "@/lib/rate-limit"

const schema = z.object({ email: z.string().trim().email().max(254) })

// Identical for every outcome so the response never reveals whether an account exists.
const GENERIC_MESSAGE = "If an account with that email exists, we've sent password reset instructions."
const TOO_MANY = "Too many reset requests. Please wait a few minutes and try again."

export async function POST(request: NextRequest) {
  // Per IP: stops one client from spraying many addresses.
  if (isRateLimited(`forgot:ip:${clientIp(request.headers)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 })
  }
  const { email } = parsed.data

  // Per email: stops anyone flooding one inbox. Counted before the account lookup, so
  // a 429 is the same for existing and unknown addresses and reveals nothing.
  if (isRateLimited(`forgot:email:${email.toLowerCase()}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { email: true, isActive: true },
    })

    // Unknown and deactivated accounts get the same answer and no email.
    if (!user || !user.isActive) {
      return NextResponse.json({ message: GENERIC_MESSAGE })
    }

    // Only the newest link is valid: issuing a new one revokes any earlier ones.
    const resetToken = await issuePasswordToken(user.email, 60 * 60 * 1000) // 1 hour

    // A send failure must not change the response, or it would reveal that the account exists.
    try {
      await sendPasswordResetEmail(user.email, resetToken)
    } catch (error) {
      console.error("Password reset email failed to send:", error)
    }

    return NextResponse.json({ message: GENERIC_MESSAGE })
  } catch (error) {
    console.error("Password reset request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
