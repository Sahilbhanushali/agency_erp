/**
 * Self-check for the money engine. No test runner in this repo, so run it directly:
 *   npm run check:finance
 */
import assert from "node:assert/strict"
import { computeTotals, formatMoney } from "./finance"

// Intra-state: 18% splits into 9% CGST + 9% SGST and the halves sum to the whole.
const intra = computeTotals({
  lineItems: [
    { quantity: 3, unitPrice: 1000 },
    { quantity: 1, unitPrice: 500 },
  ],
  discountPercent: 10,
  taxPercent: 18,
  taxType: "CGST_SGST",
})
assert.equal(intra.subtotal, 3500)
assert.equal(intra.discountAmount, 350)
assert.equal(intra.taxableAmount, 3150)
assert.equal(intra.taxAmount, 567)
assert.equal(intra.cgst + intra.sgst, intra.taxAmount)
assert.equal(intra.igst, 0)
assert.equal(intra.totalAmount, 3717)

// Inter-state: the whole tax lands on IGST, nothing on CGST/SGST.
const inter = computeTotals({
  lineItems: [{ quantity: 1, unitPrice: 1000 }],
  taxPercent: 18,
  taxType: "IGST",
})
assert.equal(inter.igst, 180)
assert.equal(inter.cgst, 0)
assert.equal(inter.sgst, 0)
assert.equal(inter.totalAmount, 1180)

// An odd number of paise must still split without losing or inventing money.
const odd = computeTotals({
  lineItems: [{ quantity: 1, unitPrice: 100.05 }],
  taxPercent: 5,
  taxType: "CGST_SGST",
})
assert.equal(odd.taxAmount, 5)
assert.equal(odd.cgst + odd.sgst, odd.taxAmount)
assert.equal(odd.totalAmount, 105.05)

// Float residue must never reach the total: 0.1 * 3 is not 0.30000000000000004 here.
const residue = computeTotals({ lineItems: [{ quantity: 3, unitPrice: 0.1 }] })
assert.equal(residue.subtotal, 0.3)
assert.equal(residue.totalAmount, 0.3)

// Empty and zero cases are a valid draft, not a crash.
const empty = computeTotals({ lineItems: [], discountPercent: 10, taxPercent: 18 })
assert.equal(empty.subtotal, 0)
assert.equal(empty.totalAmount, 0)

// A 100% discount zeroes the tax too.
const free = computeTotals({
  lineItems: [{ quantity: 2, unitPrice: 999.99 }],
  discountPercent: 100,
  taxPercent: 18,
})
assert.equal(free.taxableAmount, 0)
assert.equal(free.totalAmount, 0)

assert.match(formatMoney(3717, "INR"), /3,717/)
assert.equal(formatMoney(10, "NOT_A_CURRENCY"), "NOT_A_CURRENCY 10.00")

console.log("finance.check.ts — all assertions passed")
