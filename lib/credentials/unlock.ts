import crypto from "node:crypto"
import type { NextRequest, NextResponse } from "next/server"

/**
 * Step-up for revealing credentials: after re-entering their own password, a person
 * may reveal for UNLOCK_SECONDS. The proof is an httpOnly cookie holding
 * `userId.expiresAt.hmac`, signed with a key derived from CREDENTIALS_ENCRYPTION_KEY,
 * scoped to the credentials API and bound to the signed-in user — a stolen cookie is
 * useless with another session, and it expires on its own.
 */

export const UNLOCK_COOKIE = "cred_unlock"
export const UNLOCK_SECONDS = 10 * 60

function signingKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!secret || secret.trim().length < 32) throw new Error("CREDENTIALS_ENCRYPTION_KEY is missing or too short")
  // A separate key from the one that encrypts, derived so only one secret is managed.
  return crypto.createHmac("sha256", secret.trim()).update("credentials-unlock-v1").digest()
}

const mac = (payload: string) => crypto.createHmac("sha256", signingKey()).update(payload).digest("base64url")

export function setUnlockCookie(response: NextResponse, userId: number) {
  const expiresAt = Math.floor(Date.now() / 1000) + UNLOCK_SECONDS
  const payload = `${userId}.${expiresAt}`
  response.cookies.set(UNLOCK_COOKIE, `${payload}.${mac(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/credentials",
    maxAge: UNLOCK_SECONDS,
  })
  return expiresAt
}

export function clearUnlockCookie(response: NextResponse) {
  response.cookies.set(UNLOCK_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/api/credentials", maxAge: 0 })
}

/** Seconds left on this user's unlock, or 0 when locked. */
export function unlockSecondsLeft(request: NextRequest, userId: number): number {
  const value = request.cookies.get(UNLOCK_COOKIE)?.value
  const parts = value?.split(".") ?? []
  if (parts.length !== 3) return 0
  const [uid, exp, sig] = parts
  const expected = Buffer.from(mac(`${uid}.${exp}`))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return 0
  if (Number(uid) !== userId) return 0
  const left = Number(exp) - Math.floor(Date.now() / 1000)
  return left > 0 && left <= UNLOCK_SECONDS ? left : 0
}
