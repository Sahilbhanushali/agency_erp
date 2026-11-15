import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { rateLimited } from "@/lib/realtime/hub"
import { VaultError, needsReseal, openSecret, sealSecret } from "@/lib/credentials/vault"
import { unlockSecondsLeft } from "@/lib/credentials/unlock"
import { clientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store, max-age=0" }

/**
 * Reveal one credential's password and notes, and write down who looked.
 *
 * Needs credentials:reveal (listing needs only :read), a recent re-entry of the
 * caller's own password (see /api/credentials/unlock), and stays under a rate limit, so
 * a borrowed session cannot dump the vault. Never cached.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("credentials", "reveal")
  if (!auth.ok) return auth.response

  if (unlockSecondsLeft(request, auth.userId) === 0) {
    return NextResponse.json(
      { error: "Confirm your password to reveal credentials.", code: "LOCKED" },
      { status: 403, headers: noStore },
    )
  }
  if (rateLimited(auth.userId, "credentials:reveal", 30, 60_000)) {
    return NextResponse.json({ error: "Too many reveals in a minute. Wait and try again." }, { status: 429, headers: noStore })
  }

  try {
    const { id } = await context.params
    const credential = await prisma.credential.findUnique({
      where: { id },
      select: { id: true, label: true, platform: true, password: true, notes: true },
    })
    if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore })

    let password: string
    let notes: string | null
    try {
      password = openSecret(credential.password, "password")
      notes = credential.notes ? openSecret(credential.notes, "notes") : null
    } catch (error) {
      if (!(error instanceof VaultError)) throw error
      console.error("[credentials] reveal could not open a secret:", { id, reason: error.message })
      return NextResponse.json(
        { error: "This credential cannot be decrypted. It may have been tampered with or saved under another key; re-enter it." },
        { status: 409, headers: noStore },
      )
    }

    // Values still in an older format are upgraded the first time anyone reads them.
    if (needsReseal(credential.password) || (credential.notes && needsReseal(credential.notes))) {
      await prisma.credential.update({
        where: { id },
        data: { password: sealSecret(password, "password"), ...(notes ? { notes: sealSecret(notes, "notes") } : {}) },
        select: { id: true },
      })
    }

    await logAuditAction({
      userId: String(auth.userId),
      action: "CREDENTIAL_REVEALED",
      entityType: "Credential",
      entityId: id,
      newValues: JSON.stringify({ label: credential.label, platform: credential.platform }),
      ipAddress: clientIp(request.headers) || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ password, notes }, { headers: noStore })
  } catch (error) {
    console.error("[credentials] reveal failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500, headers: noStore })
  }
}
