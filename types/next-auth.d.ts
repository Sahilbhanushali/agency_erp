// types/next-auth.d.ts

import NextAuth, { DefaultSession, DefaultJWT } from "next-auth"

/**
 * `role` is nullable: an account can exist with no role, which is what happens when the
 * role it held is deleted. It was typed as `string` while `lib/auth.ts` substituted
 * "CLIENT" for the missing case, so the type was only honest because of a lie in the
 * data. Authorization reads the role from the database (`roleOf` in lib/api-auth.ts);
 * this value is for display and is only as fresh as the sign-in that produced it.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string | null
      roleId?: string | null
    } & DefaultSession["user"]
  }

  interface User {
    role: string | null
    roleId?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role: string | null
    roleId?: string | null
    /** Epoch ms of sign-in; compared against User.passwordChangedAt in lib/auth.ts. */
    authTime?: number
  }
}
