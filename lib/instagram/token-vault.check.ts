/**
 * Self-check for the Instagram token vault. No test runner in this repo, so run it directly:
 *   npm run check:instagram
 */
import assert from "node:assert/strict"
import { openToken, redactSecrets, sealToken } from "./token-vault"

process.env.INSTAGRAM_TOKEN_KEY = "k".repeat(64)
process.env.INSTAGRAM_APP_SECRET = "super-secret-app-secret"

const token = "IGQVJYexample-long-lived-token-value"

// Round-trips, and the plaintext never appears in what we store.
const sealed = sealToken(token)
assert.equal(openToken(sealed), token)
assert.ok(!sealed.includes(token))

// Two seals of the same token differ, so equal tokens are not linkable at rest.
assert.notEqual(sealToken("same"), sealToken("same"))

// Tampering is detected rather than decrypting to plausible rubbish — the whole
// reason this uses GCM instead of the CBC in lib/encryption.ts.
const [iv, tag, data] = sealed.split(":")
const flipped = data.slice(0, -2) + (data.slice(-2) === "00" ? "11" : "00")
assert.throws(() => openToken(`${iv}:${tag}:${flipped}`))

// A value that was never sealed throws instead of being passed through as if valid.
assert.throws(() => openToken("not-sealed-at-all"), /sealed format/)
assert.throws(() => openToken(`${iv}:${tag}`), /sealed format/)

// A wrong key fails loudly rather than silently returning the ciphertext.
process.env.INSTAGRAM_TOKEN_KEY = "j".repeat(64)
assert.throws(() => openToken(sealed))
process.env.INSTAGRAM_TOKEN_KEY = "k".repeat(64)

// Refuses to operate unconfigured, rather than falling back to a dev key.
process.env.INSTAGRAM_TOKEN_KEY = ""
assert.throws(() => sealToken("value"), /INSTAGRAM_TOKEN_KEY/)
process.env.INSTAGRAM_TOKEN_KEY = "k".repeat(64)

// Nothing credential-shaped survives into a log line.
const noisy = redactSecrets(
  "access_token=IGQVJYabcdefghijklmnopqrstuvwxyz&code=AQBx123secret&client_secret=super-secret-app-secret",
)
assert.ok(!noisy.includes("IGQVJYabcdefghijklmnopqrstuvwxyz"))
assert.ok(!noisy.includes("AQBx123secret"))
assert.ok(!noisy.includes("super-secret-app-secret"))

// Including when Meta echoes the token back inside a JSON error body.
const body = redactSecrets({ error: { message: "bad" }, access_token: "IGQVJYsecretvaluehere12345" })
assert.ok(!body.includes("IGQVJYsecretvaluehere12345"))

console.log("token-vault.check.ts — Instagram token vault assertions passed")
