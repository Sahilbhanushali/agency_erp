import { getServerSession } from "next-auth"
import type { Session } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { type Action, namesSatisfying } from "@/lib/permissions/catalog"

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
 * ADMIN is a bootstrap safety net, not the authorization model.
 *
 * Authorization is data-driven: the ADMIN role is granted every permission in the
 * catalog explicitly, so `can()` resolves through the database like every other role.
 * This check remains only so that a partially seeded or mid-migration catalog cannot
 * lock every administrator out of the screen used to fix it. It is the ONE place a role
 * name carries weight — nowhere else should compare role names to decide access.
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


/**
 * Can this user perform `action` on `module`?
 *
 *   await can(session, "quotations", "update")
 *
 * Resolves through the canonical `module:action` permission and any legacy name that
 * implied it, so roles work identically before and after the permission migration.
 */
export async function can(
  session: Session | null,
  module: string,
  action: Action | string,
): Promise<boolean> {
  if (!session?.user) return false
  if ((session.user as { role?: string }).role === "ADMIN") return true

  const accepted = namesSatisfying(module, action)
  if (accepted.length === 0) {
    // An unknown module/action pair is a programming error. Denying is the safe
    // reading: a typo must never silently authorise.
    console.error(`[authz] unknown permission requested: ${module}:${action}`)
    return false
  }

  const held = await permissionsFor(session)
  return accepted.some((name) => held.includes(name))
}

/**
 * Route-handler guard for one module action. The counterpart to `requirePermission`,
 * which takes a flat legacy name.
 *
 *   const auth = await requireCan("invoices", "delete")
 *   if (!auth.ok) return auth.response
 */
export async function requireCan(module: string, action: Action | string): Promise<AuthResult> {
  const auth = await requireSession()
  if (!auth.ok) return auth

  if (!(await can(auth.session, module, action))) {
    return { ok: false, response: forbidden() }
  }
  return auth
}

/**
 * Every module action this user holds, as `module:action` strings.
 * Used to build navigation and to hydrate the client-side permission hook in one call,
 * rather than asking the server once per button.
 */
export async function effectivePermissions(session: Session | null): Promise<string[]> {
  if (!session?.user) return []

  const { MODULES, permissionName } = await import("@/lib/permissions/catalog")
  const isAdmin = (session.user as { role?: string }).role === "ADMIN"
  const held = isAdmin ? null : new Set(await permissionsFor(session))

  const granted: string[] = []
  for (const m of MODULES) {
    for (const a of m.actions) {
      if (isAdmin) {
        granted.push(permissionName(m.key, a.action))
        continue
      }
      const accepted = namesSatisfying(m.key, a.action)
      if (accepted.some((name) => held!.has(name))) granted.push(permissionName(m.key, a.action))
    }
  }
  return granted
}
