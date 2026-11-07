import crypto from "crypto"
import { prisma } from "@/lib/prisma"

/**
 * One-time password tokens (reset links and onboarding invites), stored hashed.
 *
 * A token is a credential: anyone holding it can set the account's password. Only its
 * SHA-256 is written to `password_resets.token`, so a leaked database row, backup or
 * query log cannot be replayed. The raw token exists only in the emailed link.
 * SHA-256 (not bcrypt) is right here: the token is 256 random bits, so there is nothing
 * to brute-force, and a deterministic hash keeps the lookup an indexed equality.
 */
export function hashPasswordToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex")
}

/** Issues a fresh token for `email`, revoking any earlier ones. Returns the raw token to email. */
export async function issuePasswordToken(email: string, ttlMs: number): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex")
  await prisma.$transaction([
    prisma.passwordReset.deleteMany({ where: { email } }),
    prisma.passwordReset.create({
      data: { email, token: hashPasswordToken(rawToken), expiresAt: new Date(Date.now() + ttlMs) },
    }),
  ])
  return rawToken
}

/** The unexpired token record matching a raw token from a link, or null. */
export function findValidPasswordToken(rawToken: string) {
  return prisma.passwordReset.findFirst({
    where: { token: hashPasswordToken(rawToken), expiresAt: { gt: new Date() } },
    select: { id: true, email: true },
  })
}

/**
 * Sets a new password, stamps `passwordChangedAt` (which ends every existing session —
 * see lib/auth.ts) and burns every outstanding token for the email, in one transaction.
 */
export function setPasswordAndRevoke(userId: number, email: string, hashedPassword: string) {
  return prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    }),
    prisma.passwordReset.deleteMany({ where: { email } }),
  ])
}
