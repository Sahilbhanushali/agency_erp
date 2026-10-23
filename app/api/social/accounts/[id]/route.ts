import { NextResponse } from "next/server"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { prisma } from "@/lib/prisma"

/**
 * Disconnects an account.
 *
 * The row is kept and marked DISCONNECTED rather than deleted: published posts
 * reference it, and losing the record would orphan that history. The token is
 * destroyed, which is the part that actually matters.
 *
 * Meta offers no server-side revocation for Instagram Login, so a user wanting the
 * authorisation itself withdrawn must remove this app from their Instagram settings.
 * The response says so rather than implying we revoked it.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCan("social_accounts", "delete")
  if (!auth.ok) return auth.response

  const { id } = await params
  const account = await prisma.socialAccount.findUnique({
    where: { id },
    select: { id: true, username: true, clientId: true, status: true },
  })
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  await prisma.socialAccount.update({
    where: { id },
    data: {
      status: "DISCONNECTED",
      statusMessage: null,
      // Overwritten, not nulled: the column is required, and an empty envelope fails
      // loudly in the vault if anything ever tries to use it.
      accessTokenEnc: "",
      tokenExpiresAt: null,
      tokenRefreshedAt: null,
      disconnectedAt: new Date(),
    },
  })

  await logAuditAction({
    userId: String(auth.userId),
    action: "DISCONNECT_SOCIAL_ACCOUNT",
    entityType: "SocialAccount",
    entityId: account.id,
    oldValues: JSON.stringify({ username: account.username, status: account.status }),
    newValues: JSON.stringify({ status: "DISCONNECTED" }),
  })

  return NextResponse.json({
    ok: true,
    message:
      `@${account.username} disconnected and its stored token destroyed. ` +
      "To withdraw the authorisation itself, remove this app from the Instagram account's settings.",
  })
}
