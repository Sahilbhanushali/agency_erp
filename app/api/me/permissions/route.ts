import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { effectivePermissions, requireSession, roleOf } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

/**
 * The caller's own effective permissions as `module:action` strings, plus the module
 * keys they can read (for building navigation).
 *
 * Scoped to the session — it takes no user id, so there is nothing to tamper with.
 * This is what the client hook consumes; it decides what to *render*, never what is
 * *allowed*. Every mutation is independently authorised server-side.
 */
export async function GET() {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const session = await getServerSession(authOptions)
    const [permissions, { roleName }] = await Promise.all([
      effectivePermissions(session),
      roleOf(session),
    ])

    const modules = Array.from(
      new Set(permissions.filter((p) => p.endsWith(":read")).map((p) => p.split(":")[0])),
    )

    return NextResponse.json(
      {
        permissions,
        modules,
        // From the database, not the sign-in token: a role assigned after this person
        // signed in has to be reported, and a deleted one has to stop being reported.
        role: roleName,
      },
      // Permission-sensitive and per-user: never let a shared cache serve one user's
      // permissions to another.
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("[me/permissions] failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
