import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { rateLimited } from "@/lib/realtime/hub"
import { clearUnlockCookie, setUnlockCookie, unlockSecondsLeft } from "@/lib/credentials/unlock"
import { clientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const schema = z.object({ password: z.string().min(1, "Enter your password").max(200) }).strict()
const noStore = { "Cache-Control": "no-store" }

/** GET — how long the caller's reveal unlock has left (0 = locked). */
export async function GET(request: NextRequest) {
  const auth = await requireCan("credentials", "reveal")
  if (!auth.ok) return auth.response
  return NextResponse.json({ secondsLeft: unlockSecondsLeft(request, auth.userId) }, { headers: noStore })
}

/**
 * POST { password } — re-enter your own account password to reveal credentials for the
 * next 10 minutes. Attempts are rate limited and every failure is audited.
 */
export async function POST(request: NextRequest) {
  const auth = await requireCan("credentials", "reveal")
  if (!auth.ok) return auth.response

  if (rateLimited(auth.userId, "credentials:unlock", 5, 5 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429, headers: noStore })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter your password" }, { status: 422, headers: noStore })
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { password: true } })
  // Accounts without a password (invite not yet accepted) can never unlock.
  const valid = !!user?.password && (await bcrypt.compare(parsed.data.password, user.password))
  const audit = {
    userId: String(auth.userId),
    entityType: "Credential",
    entityId: "unlock",
    ipAddress: clientIp(request.headers) || "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  }
  if (!valid) {
    await logAuditAction({ ...audit, action: "CREDENTIALS_UNLOCK_FAILED" })
    return NextResponse.json({ error: "That password is not correct." }, { status: 403, headers: noStore })
  }

  const response = NextResponse.json({ ok: true }, { headers: noStore })
  const expiresAt = setUnlockCookie(response, auth.userId)
  await logAuditAction({ ...audit, action: "CREDENTIALS_UNLOCKED", newValues: JSON.stringify({ until: new Date(expiresAt * 1000).toISOString() }) })
  return response
}

/** DELETE — lock again now. */
export async function DELETE() {
  const auth = await requireCan("credentials", "read")
  if (!auth.ok) return auth.response
  const response = NextResponse.json({ ok: true }, { headers: noStore })
  clearUnlockCookie(response)
  return response
}
