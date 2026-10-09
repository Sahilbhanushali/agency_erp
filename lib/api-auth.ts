import { getServerSession } from "next-auth"
import type { Session } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Route-handler guards. Every handler under app/api/** authenticates, then authorizes —
 * being signed in is not permission to act. The only exceptions are app/api/auth/**,
 * app/api/share/** (token-authenticated) and public upload reads.
 *
 * Usage:
 *   const auth = await requirePermission("Manage-settings")
 *   if (!auth.ok) return auth.response
 *   // auth.session / auth.userId are safe to use from here
 */
export type AuthResult =
  | { ok: true; session: Session; userId: number }
  | { ok: false; response: NextResponse }

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 })

const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 })

/** Permission names granted to this user's role. */
export async function permissionsFor(session: Session | null): Promise<string[]> {
  const id = Number(session?.user?.id)
  if (!Number.isFinite(id)) return []

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      role: { select: { permissions: { select: { permission: { select: { name: true } } } } } },
    },
  })
  return user?.role?.permissions.map((rp) => rp.permission.name) ?? []
}

/**
 * ADMIN is treated as a superuser so a partially seeded permission catalog cannot lock
 * administrators out — the rest of the codebase already relies on that convention.
 */
export async function hasPermission(
  session: Session | null,
  permission: string,
): Promise<boolean> {
  if (!session?.user) return false
  if ((session.user as { role?: string }).role === "ADMIN") return true
  return (await permissionsFor(session)).includes(permission)
}

/** Signed in, nothing more. For reference data every staff screen needs. */
export async function requireSession(): Promise<AuthResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, response: unauthorized() }
  return { ok: true, session, userId: Number(session.user.id) }
}

/** Signed in AND holding the named permission. */
export async function requirePermission(permission: string): Promise<AuthResult> {
  const auth = await requireSession()
  if (!auth.ok) return auth
  if (!(await hasPermission(auth.session, permission))) {
    return { ok: false, response: forbidden() }
  }
  return auth
}
