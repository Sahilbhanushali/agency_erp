import crypto from "crypto"

/**
 * Encryption for Instagram access tokens.
 *
 * Deliberately NOT lib/encryption.ts, for three reasons that matter for a credential
 * this app cannot re-derive:
 *
 *  1. That module keys off NEXTAUTH_SECRET. Rotating the session secret would make
 *     every stored token undecryptable — and because a long-lived Instagram token
 *     dies permanently after 60 days without a refresh, the recovery is "every client
 *     authorises again", not "re-encrypt".
 *  2. It uses AES-256-CBC, which is unauthenticated. GCM detects tampering instead of
 *     decrypting to plausible-looking rubbish.
 *  3. Its decrypt() returns the input unchanged on failure. A corrupt token would then
 *     be sent to Meta as if it were real, and the account would look broken rather
 *     than mis-stored. Here a failure throws.
 */

const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12
const TAG_BYTES = 16

function key(): Buffer {
  const secret = process.env.INSTAGRAM_TOKEN_KEY
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      "INSTAGRAM_TOKEN_KEY is missing or too short (need at least 32 characters). " +
        "Generate one with: openssl rand -hex 32",
    )
  }
  return crypto.createHash("sha256").update(secret).digest()
}

/** Returns `iv:tag:ciphertext`, all hex. */
export function sealToken(plain: string): string {
  if (!plain) throw new Error("Refusing to seal an empty token")

  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])

  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), enc.toString("hex")].join(":")
}

/** Throws if the payload was tampered with, truncated, or sealed under another key. */
export function openToken(sealed: string): string {
  const parts = sealed?.split(":") ?? []
  if (parts.length !== 3) {
    throw new Error("Stored Instagram token is not in the expected sealed format")
  }

  const [ivHex, tagHex, dataHex] = parts
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Stored Instagram token has a malformed envelope")
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8")
}

/**
 * Removes anything credential-shaped from text bound for a log or an error message.
 * Meta echoes the access token back inside some error payloads, so responses are run
 * through this before they are recorded anywhere.
 */
export function redactSecrets(input: unknown): string {
  let text = typeof input === "string" ? input : JSON.stringify(input ?? "")
  if (!text) return ""

  const patterns: [RegExp, string][] = [
    [/(access_token=)[^&\s"']+/gi, "$1[redacted]"],
    [/("access_token"\s*:\s*")[^"]+/gi, '$1[redacted]'],
    [/(client_secret=)[^&\s"']+/gi, "$1[redacted]"],
    [/("client_secret"\s*:\s*")[^"]+/gi, '$1[redacted]'],
    [/(\bcode=)[^&\s"']+/gi, "$1[redacted]"],
    // Long-lived Instagram tokens are long opaque strings; catch stragglers.
    [/\bIG[A-Za-z0-9_-]{20,}/g, "[redacted]"],
  ]
  for (const [re, replacement] of patterns) text = text.replace(re, replacement)

  const appSecret = process.env.INSTAGRAM_APP_SECRET
  if (appSecret) text = text.split(appSecret).join("[redacted]")

  return text
}
