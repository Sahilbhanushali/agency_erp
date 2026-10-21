import { NextResponse } from "next/server"
import { requireCan } from "@/lib/api-auth"
import { LONG_LIVED_TOKEN_DAYS } from "@/lib/instagram/client"
import { prisma } from "@/lib/prisma"

/**
 * Connected social accounts.
 *
 * The select list is explicit and deliberately omits accessTokenEnc. Tokens never
 * leave the server — not even encrypted — so no response shape can be widened into
 * leaking one by someone adding a field later.
 */
export async function GET(request: Request) {
  const auth = await requireCan("social_accounts", "read")
  if (!auth.ok) return auth.response

  const clientId = new URL(request.url).searchParams.get("clientId")

  const accounts = await prisma.socialAccount.findMany({
    where: {
      ...(clientId === "agency" ? { clientId: null } : clientId ? { clientId } : {}),
    },
    select: {
      id: true,
      platform: true,
      igUserId: true,
      username: true,
      accountType: true,
      profilePictureUrl: true,
      status: true,
      statusMessage: true,
      scopes: true,
      lastSyncedAt: true,
      tokenExpiresAt: true,
      disconnectedAt: true,
      createdAt: true,
      client: { select: { id: true, name: true } },
      connectedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { username: "asc" }],
  })

  const now = Date.now()
  return NextResponse.json({
    accounts: accounts.map((a) => ({
      ...a,
      // Computed here so every surface counts the days the same way.
      daysUntilExpiry: a.tokenExpiresAt
        ? Math.floor((a.tokenExpiresAt.getTime() - now) / 86_400_000)
        : null,
      needsAttention: a.status === "REAUTH_REQUIRED" || a.status === "ERROR",
    })),
    tokenLifetimeDays: LONG_LIVED_TOKEN_DAYS,
  })
}
