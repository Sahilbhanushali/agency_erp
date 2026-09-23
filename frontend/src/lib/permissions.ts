import type { AuthUser } from "@/context/AuthContext";

/** Mirrors the backend PermissionsGuard: SUPER_ADMIN bypasses granular permissions. */
export function can(user: AuthUser | null, permission: string): boolean {
  return user?.roleName === "SUPER_ADMIN" || !!user?.permissions.includes(permission);
}
