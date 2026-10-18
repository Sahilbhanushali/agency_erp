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
  /** The authenticated mailbox. Use this as the From address so SPF/DKIM align. */
  fromMailbox: string
  /** Ready-to-use `"Name" <mailbox>` header. */
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
    fromMailbox: user,
    fromEmail: formatFrom(user),
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
    fromMailbox: config.username,
    fromEmail: formatFrom(config.username),
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

/* ------------------------------------------------------------------------- *
 * Sending
 * ------------------------------------------------------------------------- */

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

const looksLikeAddress = (value: string | undefined | null): boolean =>
  !!value && EMAIL_RE.test(value.trim())

/**
 * The display name on outgoing mail.
 *
 * `FROM_EMAIL` in this install is set to `itsmeDezino` — a brand name, not a mailbox.
 * That was going straight into the `From:` header, producing a header no receiver can
 * parse, which is on its own enough for Gmail and Outlook to bin the message. Treat a
 * non-address value as the name it obviously is.
 */
function senderName(): string {
  const configured = process.env.MAIL_FROM_NAME || process.env.FROM_EMAIL
  if (configured && !looksLikeAddress(configured)) return configured.trim()
  return "itsmeDezino"
}

/** A real mailbox to send as, or null when none is configured. */
export function fromEmailAddress(): string | null {
  for (const candidate of [process.env.FROM_EMAIL, process.env.SMTP_USER]) {
    if (looksLikeAddress(candidate)) return candidate!.trim()
  }
  return null
}

/**
 * `"Name" <mailbox>` — and the mailbox is always the account that authenticated.
 *
 * Deliverability depends on the From domain matching what SPF and DKIM authorise for
 * the sending server. Sending as a different address than the one we logged in with is
 * exactly the pattern spam filters are built to catch, so the authenticated mailbox
 * wins over anything configured.
 */
export function formatFrom(mailbox: string, name = senderName()): string {
  const safe = name.replace(/["\\\r\n]/g, "").trim()
  return safe ? `"${safe}" <${mailbox}>` : mailbox
}

/**
 * A readable plain-text version of an HTML body.
 *
 * Every message this app sent was HTML-only. A missing text/plain alternative is one of
 * the oldest and heaviest spam signals there is, and it is also what a screen reader or
 * a text-only client falls back to.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    // Keep the destination of a link; a bare label is useless without it.
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = label.replace(/<[^>]+>/g, "").trim()
      return text && !text.includes(href) ? `${text} (${href})` : href
    })
    .replace(/<(br|\/p|\/div|\/tr|\/h[1-6]|\/li)\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim()
}

export interface OutgoingMail {
  to: string | string[]
  subject: string
  html: string
  /** Generated from `html` when omitted. */
  text?: string
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
  attachments?: { filename: string; path?: string; content?: Buffer | string; cid?: string }[]
  /** Display name for this message, if it should differ from the default. */
  fromName?: string
  headers?: Record<string, string>
}

/**
 * Send one message, correctly.
 *
 * Every outgoing email goes through here so that the things which decide whether mail
 * is delivered or filtered are applied once instead of being re-derived (and got wrong)
 * at sixteen call sites. Those sites variously sent `From: " <addr>"` — a leading space
 * and no display name, which is a malformed header — `"Your App" <addr>`, and a bare
 * brand name where an address belongs.
 *
 * What this adds:
 *  - a well-formed `From` on the authenticated mailbox, so SPF and DKIM align
 *  - a text/plain alternative alongside the HTML
 *  - `Auto-Submitted`, so receivers and mailing lists know not to auto-reply
 *  - `Reply-To` kept separate from the sending identity
 */
export async function sendMail(message: OutgoingMail) {
  const { transporter, fromMailbox } = await resolveSmtp()

  return transporter.sendMail({
    from: formatFrom(fromMailbox, message.fromName),
    to: Array.isArray(message.to) ? message.to.join(", ") : message.to,
    cc: Array.isArray(message.cc) ? message.cc.join(", ") : message.cc,
    bcc: Array.isArray(message.bcc) ? message.bcc.join(", ") : message.bcc,
    replyTo: message.replyTo,
    subject: message.subject,
    html: message.html,
    text: message.text ?? htmlToText(message.html),
    attachments: message.attachments,
    headers: {
      // Nothing here is a reply to a human, and saying so stops out-of-office loops.
      "Auto-Submitted": "auto-generated",
      ...message.headers,
    },
  })
}
