import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/api-auth"
import { resetSmtpCache, verifySmtp } from "@/lib/smtp"

export const dynamic = "force-dynamic"

/**
 * Does email actually work right now?
 *
 * This performs a real SMTP login (no message is sent), so it distinguishes
 * "configured" from "able to send" — the gap that let invitations fail silently.
 * The error text is the provider's own, because "535 Username and Password not
 * accepted" tells an administrator far more than "email failed".
 */
export async function GET() {
  const auth = await requirePermission("Manage-settings")
  if (!auth.ok) return auth.response

  resetSmtpCache()
  const result = await verifySmtp()

  if (result.ok) {
    return NextResponse.json({ ok: true, source: result.source })
  }
  // 200 with ok:false — the check ran successfully and the answer is "no".
  return NextResponse.json({ ok: false, error: result.error })
}
