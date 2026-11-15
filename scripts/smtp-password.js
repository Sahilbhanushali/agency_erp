/**
 * Opens a stored SMTP password for the plain-Node cron scripts, which cannot import the
 * TypeScript vault. Must read exactly what lib/credentials/vault.ts writes for the
 * "smtp" field; lib/credentials/vault.test.ts checks the two stay in step.
 *
 *   cv1:<iv>:<tag>:<ciphertext>  AES-256-GCM under CREDENTIALS_ENCRYPTION_KEY (current)
 *   U2FsdGVkX1…                  older crypto-js AES (read so the row keeps working)
 *   anything else                plaintext from before encryption existed
 */
const crypto = require("node:crypto")

// Public: it was in the source. Only ever used to read old rows, never to write.
const PUBLISHED_LEGACY_KEY = "your-32-byte-long-secret-key-here"

function openSmtpPassword(stored) {
  if (!stored) throw new Error("No SMTP password is stored")

  if (stored.startsWith("cv1:")) {
    const secret = process.env.CREDENTIALS_ENCRYPTION_KEY
    if (!secret || secret.trim().length < 32) throw new Error("CREDENTIALS_ENCRYPTION_KEY is missing or too short")
    const parts = stored.split(":")
    if (parts.length !== 4) throw new Error("Stored SMTP password has a malformed envelope")
    const [, iv, tag, data] = parts
    const decipher = crypto.createDecipheriv("aes-256-gcm", crypto.createHash("sha256").update(secret.trim()).digest(), Buffer.from(iv, "base64url"))
    decipher.setAAD(Buffer.from("smtp"))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")
  }

  if (stored.startsWith("U2FsdGVkX1")) {
    const CryptoJS = require("crypto-js")
    for (const key of [process.env.SMTP_PASSWORD_ENCRYPTION_KEY, PUBLISHED_LEGACY_KEY].filter(Boolean)) {
      try {
        const plain = CryptoJS.AES.decrypt(stored, key).toString(CryptoJS.enc.Utf8)
        if (plain) return plain
      } catch {
        // wrong key: try the next
      }
    }
    throw new Error("Stored SMTP password could not be decrypted; re-enter it in Settings → SMTP")
  }

  return stored
}

module.exports = { openSmtpPassword }
