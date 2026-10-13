import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { decrypt } from "@/lib/encryption"

export const dynamic = "force-dynamic"

/**
 * Reveal one password, and write down who looked.
 *
 * This exists so the list endpoint does not have to return secrets. Reading a stored
 * credential is itself a sensitive act: one password, one request, one audit row — and
 * no-store headers so it never lands in a shared cache or the browser's back-forward
 * cache.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("View-credentials")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const credential = await prisma.credential.findUnique({
      where: { id },
      select: { id: true, label: true, platform: true, userId: true, password: true },
    })
    if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const password = decrypt(credential.password)
    if (password === null || password === undefined) {
      // A value that will not decrypt usually means NEXTAUTH_SECRET was rotated,
      // since lib/encryption.ts derives its key from it.
      return NextResponse.json(
        { error: "This password cannot be decrypted. It may need to be re-entered." },
        { status: 409 },
      )
    }

    await logAuditAction({
      userId: String(auth.userId),
      action: "CREDENTIAL_REVEALED",
      entityType: "Credential",
      entityId: id,
      newValues: JSON.stringify({ label: credential.label, platform: credential.platform }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json(
      { password },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    )
  } catch (error) {
    console.error("[credentials] reveal failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
