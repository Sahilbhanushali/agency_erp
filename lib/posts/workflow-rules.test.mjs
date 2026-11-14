// Run: npm run test:workflow   (node --test; Node strips the .ts types natively)
import { test } from "node:test"
import assert from "node:assert/strict"
import { decide, stageOf, isSchedulable } from "./workflow-rules.ts"

const post = (status, requiresClientApproval = false) => ({ status, requiresClientApproval })
const user = (p, action, extra = {}) => decide({ post: p, action, actorType: "USER", ...extra })
const client = (p, action, extra = {}) => decide({ post: p, action, actorType: "CLIENT", ...extra })
const ok = (d, to) => {
  assert.equal(d.ok, true, d.ok ? "" : d.message)
  assert.equal(d.to, to)
  return d
}
const refused = (d, code = "INVALID_TRANSITION") => {
  assert.equal(d.ok, false, "expected the transition to be refused")
  assert.equal(d.code, code)
}

test("draft → submit → pending approval", () => {
  ok(user(post("DRAFT"), "SUBMIT"), "SUBMITTED")
  assert.equal(stageOf(post("SUBMITTED")), "PENDING_APPROVAL")
})

test("manager approves, client approval OFF → ready to schedule → schedule", () => {
  const approved = post(ok(user(post("SUBMITTED"), "APPROVE"), "APPROVED").to, false)
  assert.equal(stageOf(approved), "READY_TO_SCHEDULE")
  assert.ok(isSchedulable(approved))
  ok(user(approved, "SCHEDULE"), "SCHEDULED")
})

test("manager approves, client approval ON → pending client, cannot be scheduled", () => {
  const approved = post(ok(user(post("SUBMITTED", true), "APPROVE"), "APPROVED").to, true)
  assert.equal(stageOf(approved), "PENDING_CLIENT")
  assert.equal(isSchedulable(approved), false)
  refused(user(approved, "SCHEDULE"))
  refused(user(approved, "PUBLISH"))
})

test("client approves after manager approval → schedulable", () => {
  const clientOk = post(ok(client(post("APPROVED", true), "CLIENT_APPROVE"), "C_APPROVED").to, true)
  assert.equal(stageOf(clientOk), "READY_TO_SCHEDULE")
  ok(user(clientOk, "SCHEDULE"), "SCHEDULED")
})

test("client requests changes → back to editing, reason required", () => {
  refused(client(post("APPROVED", true), "CLIENT_REQUEST_CHANGES"), "REASON_REQUIRED")
  ok(client(post("APPROVED", true), "CLIENT_REQUEST_CHANGES", { reason: "Logo too small" }), "NEEDS_MINOR_CHANGE")
})

test("client cannot approve before internal approval, or a post that needs no client approval", () => {
  refused(client(post("SUBMITTED", true), "CLIENT_APPROVE"))
  refused(client(post("APPROVED", false), "CLIENT_APPROVE"))
  refused(client(post("SCHEDULED", true), "CLIENT_APPROVE"))
  refused(client(post("POSTED", true), "CLIENT_APPROVE"))
})

test("an internal user cannot record a client decision; a client cannot approve internally", () => {
  refused(user(post("APPROVED", true), "CLIENT_APPROVE"), "FORBIDDEN_ACTOR")
  refused(client(post("SUBMITTED"), "APPROVE"), "FORBIDDEN_ACTOR")
})

test("manager rejects / requests changes, both need a reason, neither can be scheduled", () => {
  refused(user(post("SUBMITTED"), "REJECT"), "REASON_REQUIRED")
  const rejected = post(ok(user(post("SUBMITTED"), "REJECT", { reason: "Off brief" }), "REJECTED").to)
  refused(user(rejected, "SCHEDULE"))
  const changes = post(ok(user(post("RESUBMITTED"), "REQUEST_CHANGES", { reason: "Fix typo" }), "NEEDS_MINOR_CHANGE").to)
  refused(user(changes, "SCHEDULE"))
  ok(user(rejected, "SUBMIT"), "RESUBMITTED")
  ok(user(changes, "SUBMIT"), "RESUBMITTED")
})

test("duplicate approval is refused (second approve sees APPROVED)", () => {
  const first = ok(user(post("SUBMITTED"), "APPROVE"), "APPROVED")
  refused(user(post(first.to), "APPROVE"))
})

test("editing after approval invalidates it and bumps the version", () => {
  for (const status of ["APPROVED", "C_APPROVED", "SCHEDULED"]) {
    const d = ok(user(post(status, true), "EDIT_INVALIDATE"), "RESUBMITTED")
    assert.equal(d.bumpVersion, true)
  }
  const pending = ok(user(post("SUBMITTED"), "EDIT_INVALIDATE"), "SUBMITTED")
  assert.equal(pending.bumpVersion, true, "an edit while pending is a new version to review")
  assert.equal(ok(user(post("DRAFT"), "EDIT_INVALIDATE"), "DRAFT").bumpVersion, false)
  refused(user(post("POSTED"), "EDIT_INVALIDATE"))
  refused(user(post("CANCELLED"), "EDIT_INVALIDATE"))
})

test("scheduled never becomes published by approval; publish only from scheduled/ready", () => {
  refused(user(post("SCHEDULED"), "APPROVE"))
  ok(user(post("SCHEDULED"), "PUBLISH"), "POSTED")
  refused(user(post("SUBMITTED"), "PUBLISH"))
  refused(user(post("DRAFT"), "PUBLISH"))
})

test("unschedule returns to the matching approved state", () => {
  ok(user(post("SCHEDULED", false), "UNSCHEDULE"), "APPROVED")
  ok(user(post("SCHEDULED", true), "UNSCHEDULE"), "C_APPROVED")
})

test("client toggle recalculates the stage", () => {
  // OFF → ON while scheduled with no client approval: back to waiting for the client.
  const on = ok(user(post("SCHEDULED", false), "CLIENT_TOGGLE", { nextRequiresClientApproval: true }), "APPROVED")
  assert.equal(on.requiresClientApproval, true)
  // ...but a client approval for this version keeps it.
  ok(user(post("C_APPROVED", false), "CLIENT_TOGGLE", { nextRequiresClientApproval: true, clientApprovedCurrentVersion: true }), "C_APPROVED")
  // ON → OFF while pending client: same status, now ready.
  const off = ok(user(post("APPROVED", true), "CLIENT_TOGGLE", { nextRequiresClientApproval: false }), "APPROVED")
  assert.equal(stageOf(post(off.to, off.requiresClientApproval)), "READY_TO_SCHEDULE")
  refused(user(post("POSTED"), "CLIENT_TOGGLE", { nextRequiresClientApproval: true }))
})

test("cancel needs a reason and is terminal until reopened", () => {
  refused(user(post("SUBMITTED"), "CANCEL"), "REASON_REQUIRED")
  const cancelled = post(ok(user(post("SUBMITTED"), "CANCEL", { reason: "Campaign dropped" }), "CANCELLED").to)
  refused(user(cancelled, "SCHEDULE"))
  refused(user(cancelled, "SUBMIT"))
  ok(user(cancelled, "REOPEN"), "DRAFT")
  refused(user(post("POSTED"), "CANCEL", { reason: "x" }))
})

test("PPT follows the same rules (type-agnostic state machine)", () => {
  // decide() never looks at type, so a presentation goes through exactly this path.
  ok(user(post("DRAFT"), "SUBMIT"), "SUBMITTED")
  ok(user(post("SUBMITTED", true), "APPROVE"), "APPROVED")
})
