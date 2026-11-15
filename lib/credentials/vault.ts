import crypto from "node:crypto"

/**
 * Encryption for stored secrets: credential passwords and notes, and SMTP passwords.
 *
 * AES-256-GCM under a key used for nothing else (CREDENTIALS_ENCRYPTION_KEY), the same
 * design as lib/instagram/token-vault.ts. It replaces lib/encryption.ts for credentials,
 * which used unauthenticated CBC under a key derived from NEXTAUTH_SECRET — with a
 * hardcoded fallback when that was unset — and returned the ciphertext *as the
 * password* when decryption failed.
 *
 * Here a failure throws: a tampered, truncated or wrong-key value is never shown as if
 * it were the secret. Each value is bound to its field (password vs notes) through the
 * GCM additional data, so ciphertexts cannot be swapped between fields.
 *
 * Format: `cv1:<iv>:<tag>:<ciphertext>`, base64url.
 */

const PREFIX = "cv1"
const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12
const TAG_BYTES = 16

/** What a sealed value is, bound into the ciphertext so values cannot be swapped between uses. */
export type SecretField = "password" | "notes" | "smtp"

export class VaultError extends Error {}

function key(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!secret || secret.trim().length < 32) {
    throw new VaultError(
      "CREDENTIALS_ENCRYPTION_KEY is missing or too short (need at least 32 characters). " +
        "Generate one with: openssl rand -hex 32",
    )
  }
  return crypto.createHash("sha256").update(secret.trim()).digest()
}

export function sealSecret(plain: string, field: SecretField): string {
  if (!plain) throw new VaultError("Refusing to seal an empty secret")
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv)
  cipher.setAAD(Buffer.from(field))
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return [PREFIX, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":")
}

/** True when the stored value is not yet in the current format and should be re-sealed. */
export const needsReseal = (stored: string) => !stored.startsWith(`${PREFIX}:`)

/**
 * Opens a stored value. Reads the current format, plus the two older ones still in the
 * database until `npm run credentials:reseal` has run: lib/encryption.ts's CBC
 * `ivhex:cthex`, and plaintext rows written before encryption existed.
 */
export function openSecret(stored: string, field: SecretField): string {
  if (!stored) throw new VaultError("Nothing is stored")
  if (!needsReseal(stored)) {
    const parts = stored.split(":")
    if (parts.length !== 4) throw new VaultError("Stored secret has a malformed envelope")
    const [, ivB64, tagB64, dataB64] = parts
    const iv = Buffer.from(ivB64, "base64url")
    const tag = Buffer.from(tagB64, "base64url")
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new VaultError("Stored secret has a malformed envelope")
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key(), iv)
      decipher.setAAD(Buffer.from(field))
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8")
    } catch (error) {
      if (error instanceof VaultError) throw error
      throw new VaultError("Stored secret failed its integrity check (tampered, or sealed under another key)")
    }
  }
  return openLegacy(stored)
}

/** lib/encryption.ts's old format, read strictly: a failure throws instead of passing through. */
function openLegacy(stored: string): string {
  const match = /^([0-9a-f]{32}):((?:[0-9a-f]{32})+)$/i.exec(stored)
  if (!match) return stored // written before encryption existed: it IS the plaintext
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new VaultError("A legacy credential needs NEXTAUTH_SECRET to be read once and re-sealed")
  // Byte-for-byte the old derivation, so existing rows can be read and upgraded.
  const legacyKey = Buffer.from(crypto.createHash("sha256").update(String(secret)).digest("base64").slice(0, 32))
  try {
    const decipher = crypto.createDecipheriv("aes-256-cbc", legacyKey, Buffer.from(match[1], "hex"))
    return Buffer.concat([decipher.update(Buffer.from(match[2], "hex")), decipher.final()]).toString("utf8")
  } catch {
    throw new VaultError("A legacy credential could not be decrypted (NEXTAUTH_SECRET changed since it was saved)")
  }
}
