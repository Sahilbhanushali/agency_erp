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

/**
 * 401, not 403: the account is no longer a valid identity, so the client should sign
 * out rather than offer a retry. `deactivated` lets the dashboard end the session
 * instead of leaving a half-working shell on screen.
 */
const deactivated = () =>
  NextResponse.json(
    { error: "This account has been deactivated.", deactivated: true },
    { status: 401 },
  )

/**
 * This user's role and its permissions, read from the database.
 *
 * Never from the session token. `role` is written into the JWT once, at sign-in, and
 * never refreshed — so an administrator changing somebody's role does not reach their
 * session until they sign out and back in. Trusting the token meant an account demoted
 * out of ADMIN kept the superuser shortcut below for the life of its session, and an
 * account whose role was deleted still claimed to hold it.
 */
export async function roleOf(
  session: Session | null,
): Promise<{ roleName: string | null; permissions: string[]; active: boolean }> {
  const id = Number(session?.user?.id)
  if (!Number.isFinite(id)) return { roleName: null, permissions: [], active: false }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      isActive: true,
      role: {
        select: {
          name: true,
          permissions: { select: { permission: { select: { name: true } } } },
        },
      },
    },
  })

  // Sessions are JWTs that outlive a deactivation by up to their whole lifetime, so
  // the flag has to be read here — where every guarded route already pays for one
  // database round trip — rather than trusted from the token. A deactivated account
  // holds no permissions and is not ADMIN, whatever its role still says.
  if (!user || !user.isActive) return { roleName: null, permissions: [], active: false }

  return {
    roleName: user.role?.name ?? null,
    permissions: user.role?.permissions.map((rp) => rp.permission.name) ?? [],
    active: true,
  }
}

/** Permission names granted to this user's role. */
export async function permissionsFor(session: Session | null): Promise<string[]> {
  return (await roleOf(session)).permissions
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
  const { roleName, permissions } = await roleOf(session)
  if (roleName === "ADMIN") return true
  return permissions.includes(permission)
}

/** Signed in, nothing more. For reference data every staff screen needs. */
export async function requireSession(): Promise<AuthResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, response: unauthorized() }

  // Every other guard routes through here, so one check locks a deactivated account
  // out of the whole API rather than each handler having to remember.
  if (!(await roleOf(session)).active) return { ok: false, response: deactivated() }

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

  const accepted = namesSatisfying(module, action)
  if (accepted.length === 0) {
    // An unknown module/action pair is a programming error. Denying is the safe
    // reading: a typo must never silently authorise.
    console.error(`[authz] unknown permission requested: ${module}:${action}`)
    return false
  }

  // Role resolved from the database, not the session token — see roleOf().
  const { roleName, permissions } = await roleOf(session)
  if (roleName === "ADMIN") return true
  return accepted.some((name) => permissions.includes(name))
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
  // From the database, so a role assigned a moment ago appears without signing out.
  const { roleName, permissions } = await roleOf(session)
  const isAdmin = roleName === "ADMIN"
  const held = new Set(permissions)

  const granted: string[] = []
  for (const m of MODULES) {
    for (const a of m.actions) {
      if (isAdmin) {
        granted.push(permissionName(m.key, a.action))
        continue
      }
      const accepted = namesSatisfying(m.key, a.action)
      if (accepted.some((name) => held.has(name))) granted.push(permissionName(m.key, a.action))
    }
  }
  return granted
}

/**
 * How much of the agency's content this caller may see.
 *
 * `"all"` for the people who plan content across every client — which is exactly the
 * set holding `posts:create` — and `"own"` for everyone else: their assigned work, and
 * the projects of the client they are.
 *
 * This replaces the role-name lists that used to decide scope
 * (`userRole === "CLIENT"`, `["admin", "manager", "team lead", "social media manager"]`).
 * Those lists were the real defect behind "I granted three modules and the role still
 * sees everything": a role not named in the list fell through to the unscoped branch,
 * so any role created after the list was written got full visibility that no permission
 * had granted. `posts:read` cannot carry this decision, because a client login holds it
 * in order to see its own content.
 */
export async function contentScope(session: Session | null): Promise<"all" | "own"> {
  return (await can(session, "posts", "create")) ? "all" : "own"
}

/** Is this login a client contact rather than a member of the agency? */
export async function isClientContact(session: Session | null): Promise<boolean> {
  const email = session?.user?.email
  if (!email) return false
  const client = await prisma.client.findFirst({ where: { email }, select: { id: true } })
  return client !== null
}
