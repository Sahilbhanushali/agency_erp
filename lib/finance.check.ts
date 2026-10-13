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

// ---------------------------------------------------------------------------
// Invoice payment arithmetic
// ---------------------------------------------------------------------------
import { isInvoiceOverdue, paymentSummary } from "./finance"

// Nothing paid on a sent invoice: full balance, status untouched.
const unpaid = paymentSummary(1000, [], "SENT")
assert.equal(unpaid.paid, 0)
assert.equal(unpaid.balance, 1000)
assert.equal(unpaid.status, "SENT")

// Part paid becomes PARTIAL and the balance is the remainder.
const part = paymentSummary(1000, [{ amount: 250 }, { amount: 100.5 }], "SENT")
assert.equal(part.paid, 350.5)
assert.equal(part.balance, 649.5)
assert.equal(part.status, "PARTIAL")

// Paid to the paisa is PAID, not PARTIAL — a float comparison must not leave 0.01 behind.
const exact = paymentSummary(105.05, [{ amount: 100.05 }, { amount: 5 }], "PARTIAL")
assert.equal(exact.paid, 105.05)
assert.equal(exact.balance, 0)
assert.equal(exact.status, "PAID")

// Overpayment is still PAID, and the balance goes negative rather than being clamped —
// a credit the agency owes back is real information, not something to hide.
const over = paymentSummary(1000, [{ amount: 1200 }], "SENT")
assert.equal(over.balance, -200)
assert.equal(over.status, "PAID")

// A cancelled invoice is closed: money arriving does not reopen it.
assert.equal(paymentSummary(1000, [{ amount: 1000 }], "CANCELLED").status, "CANCELLED")
// A draft has not been issued, so it is not reinterpreted either.
assert.equal(paymentSummary(1000, [{ amount: 1000 }], "DRAFT").status, "DRAFT")

// Deleting the last payment must walk a PAID invoice back, not leave it PAID.
assert.equal(paymentSummary(1000, [], "PAID").status, "SENT")

// A zero-total invoice is not automatically PAID.
assert.equal(paymentSummary(0, [], "SENT").status, "SENT")

// Overdue: only while money is still owed, and only once issued.
const past = "2020-01-01"
assert.equal(isInvoiceOverdue({ dueDate: past, status: "SENT" }, 500), true)
assert.equal(isInvoiceOverdue({ dueDate: past, status: "PARTIAL" }, 500), true)
assert.equal(isInvoiceOverdue({ dueDate: past, status: "SENT" }, 0), false)
assert.equal(isInvoiceOverdue({ dueDate: past, status: "PAID" }, 0), false)
assert.equal(isInvoiceOverdue({ dueDate: past, status: "DRAFT" }, 500), false)
assert.equal(isInvoiceOverdue({ dueDate: null, status: "SENT" }, 500), false)
assert.equal(isInvoiceOverdue({ dueDate: "2099-01-01", status: "SENT" }, 500), false)

console.log("finance.check.ts — invoice payment assertions passed")
