// Run: npm run test:credentials (Node strips the types; no extra tooling)
import { test } from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { needsReseal, openSecret, sealSecret } from "./vault.ts"

process.env.CREDENTIALS_ENCRYPTION_KEY = "k".repeat(64)
process.env.NEXTAUTH_SECRET = "legacy-nextauth-secret"

test("round-trips, and the plaintext never appears in what is stored", () => {
  const sealed = sealSecret("hunter2 🔐 long-api-key-" + "x".repeat(500), "password")
  assert.ok(sealed.startsWith("cv1:"))
  assert.ok(!sealed.includes("hunter2"))
  assert.equal(openSecret(sealed, "password"), "hunter2 🔐 long-api-key-" + "x".repeat(500))
  assert.notEqual(sealSecret("same", "password"), sealSecret("same", "password"), "random IV per seal")
})

test("tampering, field swapping and a wrong key all throw instead of returning junk", () => {
  const sealed = sealSecret("secret", "password")
  const [p, iv, tag, data] = sealed.split(":")
  const flipped = data.slice(0, -1) + (data.endsWith("A") ? "B" : "A")
  assert.throws(() => openSecret(`${p}:${iv}:${tag}:${flipped}`, "password"), /integrity/)
  assert.throws(() => openSecret(sealed, "notes"), /integrity/, "a password cannot be opened as notes")
  assert.throws(() => openSecret(`${p}:${iv}:${tag}`, "password"), /malformed/)
  process.env.CREDENTIALS_ENCRYPTION_KEY = "j".repeat(64)
  assert.throws(() => openSecret(sealed, "password"), /integrity/)
  process.env.CREDENTIALS_ENCRYPTION_KEY = "k".repeat(64)
})

test("refuses to work without a proper dedicated key — no fallback", () => {
  const saved = process.env.CREDENTIALS_ENCRYPTION_KEY
  delete process.env.CREDENTIALS_ENCRYPTION_KEY
  assert.throws(() => sealSecret("x", "password"), /CREDENTIALS_ENCRYPTION_KEY/)
  process.env.CREDENTIALS_ENCRYPTION_KEY = "short"
  assert.throws(() => sealSecret("x", "password"), /too short/)
  process.env.CREDENTIALS_ENCRYPTION_KEY = saved
})

test("reads the legacy CBC format and plaintext rows so they can be re-sealed", () => {
  // Exactly what lib/encryption.ts used to write.
  const legacyKey = Buffer.from(crypto.createHash("sha256").update("legacy-nextauth-secret").digest("base64").slice(0, 32))
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-cbc", legacyKey, iv)
  const legacy = iv.toString("hex") + ":" + Buffer.concat([cipher.update("old-password"), cipher.final()]).toString("hex")

  assert.ok(needsReseal(legacy))
  assert.equal(openSecret(legacy, "password"), "old-password")
  assert.equal(openSecret("plain-old-value", "notes"), "plain-old-value")
  assert.ok(!needsReseal(sealSecret("x", "notes")))

  process.env.NEXTAUTH_SECRET = "rotated"
  assert.throws(() => openSecret(legacy, "password"), /could not be decrypted/, "a bad legacy value is not shown as the password")
  process.env.NEXTAUTH_SECRET = "legacy-nextauth-secret"
})

test("the cron scripts' opener reads exactly what the vault seals for SMTP", async () => {
  const { createRequire } = await import("node:module")
  const { openSmtpPassword } = createRequire(import.meta.url)("../../scripts/smtp-password.js")
  const sealed = sealSecret("smtp-app-password", "smtp")
  assert.equal(openSmtpPassword(sealed), "smtp-app-password")
  assert.throws(() => openSmtpPassword(sealSecret("x", "password")), "a credential password is not an SMTP password")
  assert.equal(openSmtpPassword("legacy-plain"), "legacy-plain")
})
