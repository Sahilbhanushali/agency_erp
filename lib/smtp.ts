import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"
import CryptoJS from "crypto-js"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/encryption"

/**
 * One place that decides how this app sends mail.
 *
 * Two bugs lived here before, and both silently swallowed every outbound email:
 *
 *  1. The SMTP password stored in `smtp_details` is encrypted at rest, but both callers
 *     passed it to nodemailer verbatim, so the provider rejected the login every time.
 *  2. The env fallback read `SMTP_PASSWORD`, a variable nothing sets — `.env.example`
 *     calls it `SMTP_PASS` — so it fell through to credentials hardcoded in the source.
 *
 * Those hardcoded credentials are gone. With nothing configured this throws, which is
 * the honest outcome: a caller can report "email is not set up" instead of claiming an
 * invitation was sent to a mailbox that never received one.
 */

/**
 * Stored SMTP passwords exist in three shapes across this database's history:
 * `lib/encryption.ts`'s `iv:ciphertext` hex, CryptoJS AES base64 (written by
 * app/api/smtp-config), and bare plaintext from before either existed. Read all three
 * rather than forcing a migration that would lock people out of their own mail.
 */
export function decryptSmtpPassword(stored: string): string {
  if (!stored) return stored

  // lib/encryption.ts — 32 hex chars of IV, a colon, then the ciphertext.
  if (/^[0-9a-f]{32}:/i.test(stored)) {
    const plain = decrypt(stored)
    // decrypt() returns its input unchanged when it cannot decrypt.
    if (plain && plain !== stored) return plain
  }

  // app/api/smtp-config/route.ts — CryptoJS AES, which always base64s this prefix.
  if (stored.startsWith("U2FsdGVkX1")) {
    try {
      const key =
        process.env.SMTP_PASSWORD_ENCRYPTION_KEY || "your-32-byte-long-secret-key-here"
      const plain = CryptoJS.AES.decrypt(stored, key).toString(CryptoJS.enc.Utf8)
      if (plain) return plain
    } catch {
      // fall through to treating it as plaintext
    }
  }

  return stored
}

export interface ResolvedSmtp {
  transporter: Transporter
  fromEmail: string
  /** Where the settings came from, for log lines and error messages. */
  source: string
}

/** Env-configured SMTP, accepting either spelling of the password variable. */
function fromEnv(): ResolvedSmtp | null {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  // SMTP_PASSWORD is the name the old code looked for; SMTP_PASS is the documented one.
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD
  if (!host || !user || !pass) return null

  const port = Number(process.env.SMTP_PORT) || 587
  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: { user, pass },
    }),
    fromEmail: process.env.FROM_EMAIL || user,
    source: `env (${host}:${port} as ${user})`,
  }
}

/** The active, verified SMTP configuration saved in the app's settings, if any. */
async function fromDatabase(): Promise<ResolvedSmtp | null> {
  const config = await prisma.smtpDetails.findFirst({
    where: { isActive: true, isVerified: true },
    orderBy: { updatedAt: "desc" },
    select: { host: true, port: true, username: true, password: true, encryption: true },
  })
  if (!config?.host || !config.username || !config.password) return null

  const password = decryptSmtpPassword(config.password)
  return {
    transporter: nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.encryption === "SSL" || config.port === 465,
      auth: { user: config.username, pass: password },
      ...(config.encryption === "TLS" ? { requireTLS: true } : {}),
    }),
    fromEmail: config.username,
    source: `settings (${config.host}:${config.port} as ${config.username})`,
  }
}

/**
 * Resolve a transporter that actually works.
 *
 * Saved settings are preferred, but they are *verified* first and env is used instead
 * when they fail. This matters: this install had an active, "verified" row whose stored
 * password was a regular Google account password — which Gmail has rejected for SMTP
 * since 2022 — while perfectly good credentials sat unused in .env. Preferring the
 * saved row unconditionally meant no email went out at all.
 *
 * A failing saved config is logged loudly rather than swallowed, so the fallback keeps
 * mail flowing without hiding that something needs fixing.
 */
let cached: { value: ResolvedSmtp; at: number } | null = null
const CACHE_MS = 5 * 60 * 1000

export async function resolveSmtp(options?: { force?: boolean }): Promise<ResolvedSmtp> {
  if (!options?.force && cached && Date.now() - cached.at < CACHE_MS) return cached.value

  const failures: string[] = []
  const candidates: { label: string; load: () => Promise<ResolvedSmtp | null> }[] = [
    { label: "saved settings", load: fromDatabase },
    { label: "environment", load: async () => fromEnv() },
  ]

  for (const candidate of candidates) {
    let resolved: ResolvedSmtp | null = null
    try {
      resolved = await candidate.load()
    } catch (error) {
      failures.push(`${candidate.label}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    if (!resolved) continue

    try {
      // The real handshake and login. "Configured" and "able to send" are not the same
      // thing, and only this tells them apart.
      await resolved.transporter.verify()
      cached = { value: resolved, at: Date.now() }
      return resolved
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : String(error)
      failures.push(`${candidate.label} (${resolved.source}): ${message}`)
      console.error(`[smtp] ${candidate.label} failed to authenticate — ${message}`)
    }
  }

  throw new Error(
    failures.length > 0
      ? `No working email configuration. ${failures.join(" | ")}`
      : "Email is not configured. Add an SMTP configuration in Settings, or set SMTP_HOST, SMTP_USER and SMTP_PASS.",
  )
}

/** Drops the cached transporter, e.g. after SMTP settings are saved. */
export function resetSmtpCache() {
  cached = null
}

/**
 * Prove the credentials work before claiming anything was sent. nodemailer's verify()
 * performs the real handshake and login, which is what distinguishes "configured" from
 * "actually able to send".
 */
export async function verifySmtp(): Promise<{ ok: true; source: string } | { ok: false; error: string }> {
  try {
    const { source } = await resolveSmtp({ force: true })
    return { ok: true, source }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
