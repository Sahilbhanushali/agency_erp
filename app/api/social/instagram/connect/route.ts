import crypto from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireCan } from "@/lib/api-auth"
import { authorizationUrl } from "@/lib/instagram/client"
import { prisma } from "@/lib/prisma"

/** How long a half-finished handshake stays valid. Long enough to log in, short enough to matter. */
const STATE_TTL_MINUTES = 15

const bodySchema = z.object({
  /** Null/omitted connects the agency's own account. */
  clientId: z.string().cuid().nullish(),
  /** Set when re-authorising an account that already exists. */
  reconnectAccountId: z.string().cuid().nullish(),
  /** Relative path only — see the check below. */
  returnTo: z.string().max(500).optional(),
})

/**
 * Starts Instagram authorisation.
 *
 * Returns the URL rather than redirecting, because the caller is a fetch from the
 * accounts page: a 302 to instagram.com would be followed by fetch and fail CORS
 * instead of moving the browser.
 */
export async function POST(request: Request) {
  const auth = await requireCan("social_accounts", "create")
  if (!auth.ok) return auth.response

  let parsed
  try {
    parsed = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 422 })
  }

  // An open redirect here would hand an attacker a trusted hop. Only in-app paths.
  const returnTo =
    parsed.returnTo && parsed.returnTo.startsWith("/") && !parsed.returnTo.startsWith("//")
      ? parsed.returnTo
      : "/dashboard/social/accounts"

  if (parsed.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: parsed.clientId },
      select: { id: true },
    })
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })
  }

  if (parsed.reconnectAccountId) {
    const existing = await prisma.socialAccount.findUnique({
      where: { id: parsed.reconnectAccountId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  // The state is the CSRF defence, and binding it to the initiating user and client is
  // what stops a callback attaching an account to a client the caller never chose.
  const state = crypto.randomBytes(32).toString("hex")
  await prisma.socialOAuthState.create({
    data: {
      state,
      userId: auth.userId,
      clientId: parsed.clientId ?? null,
      reconnectAccountId: parsed.reconnectAccountId ?? null,
      returnTo,
      expiresAt: new Date(Date.now() + STATE_TTL_MINUTES * 60_000),
    },
  })

  // Opportunistic tidy-up; nothing depends on it having run.
  await prisma.socialOAuthState
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined)

  try {
    return NextResponse.json({ authorizationUrl: authorizationUrl(state) })
  } catch (error) {
    // Missing app credentials is a deployment problem, not something to show a user.
    console.error("[instagram/connect] cannot build authorization URL:", error)
    return NextResponse.json(
      { error: "Instagram is not configured on this server." },
      { status: 503 },
    )
  }
}
