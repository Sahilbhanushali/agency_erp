import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { generateSecureToken, getConfirmBaseUrl } from "@/lib/export-link"

export const dynamic = "force-dynamic"

/**
 * A share token is a credential: 256 bits of randomness, an expiry, and revocable.
 * `/share/**` is allowed unauthenticated on both the main host and the share subdomain,
 * so this one path works from either.
 */
const shareUrlFor = (token: string, origin: string | null) =>
  `${getConfirmBaseUrl(origin)}/share/document/${token}`

/** Issue a client link, or rotate the existing one. `?days=` sets the lifetime (1–365). */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("Manage-quotations")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const days = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 30))

    const existing = await prisma.quotation.findUnique({
      where: { id },
      select: { id: true, number: true, shareToken: true },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const token = generateSecureToken()
    await prisma.quotation.update({
      where: { id },
      data: {
        shareToken: token,
        shareExpiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    })

    await logAuditAction({
      userId: String(auth.userId),
      action: existing.shareToken ? "SHARE_ROTATED" : "SHARE_CREATED",
      entityType: "Quotation",
      entityId: id,
      newValues: JSON.stringify({ number: existing.number, days }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({
      url: shareUrlFor(token, request.nextUrl.origin),
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      rotated: !!existing.shareToken,
    })
  } catch (error) {
    console.error("[quotations] share failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/** Revoke the link. The old token stops working immediately. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("Manage-quotations")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const existing = await prisma.quotation.findUnique({
      where: { id },
      select: { id: true, number: true },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.quotation.update({
      where: { id },
      data: { shareToken: null, shareExpiresAt: null },
    })

    await logAuditAction({
      userId: String(auth.userId),
      action: "SHARE_REVOKED",
      entityType: "Quotation",
      entityId: id,
      oldValues: JSON.stringify({ number: existing.number }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ message: "Link revoked" })
  } catch (error) {
    console.error("[quotations] revoke failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
