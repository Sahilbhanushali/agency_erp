// Run: npm run test:ip (Node strips the types; no extra tooling)
import { test } from "node:test"
import assert from "node:assert/strict"
import { clientIp } from "./rate-limit.ts"

const h = (init: Record<string, string>) => new Headers(init)

test("takes the hop our proxy appended, not what the client wrote", () => {
  // The client sent "1.2.3.4"; the proxy appended the address it really saw.
  assert.equal(clientIp(h({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" })), "203.0.113.9")
  assert.equal(clientIp(h({ "x-forwarded-for": "203.0.113.9" })), "203.0.113.9")
  assert.equal(clientIp(h({ "x-forwarded-for": " 1.2.3.4 ,  203.0.113.9 , " })), "203.0.113.9")
})

test("falls back to X-Real-IP, then 'unknown'", () => {
  assert.equal(clientIp(h({ "x-real-ip": "198.51.100.7" })), "198.51.100.7")
  assert.equal(clientIp(h({})), "unknown")
})
