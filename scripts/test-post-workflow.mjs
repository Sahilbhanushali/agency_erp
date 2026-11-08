/**
 * End-to-end tests for the post approval workflow, against a RUNNING app and the local
 * seed data. Every request goes through the real HTTP API with real NextAuth sessions.
 *
 *   npm run db:seed && npm run db:seed:dev       # once
 *   npm run dev                                   # in another terminal (or PORT=3100 …)
 *   npm run test:workflow:api                     # BASE_URL defaults to http://localhost:3000
 *
 * Creates its own posts in the seed project and deletes them afterwards. Refuses to run
 * against anything but a local database.
 */
import { test, after } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname
  } catch {
    return ""
  }
})()
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error("Refusing to run: DATABASE_URL is not a local database.")
  process.exit(1)
}

const prisma = new PrismaClient()
const created = []

// ── HTTP helpers ─────────────────────────────────────────────────────────────────
class Session {
  cookies = new Map()
  store(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";")
      const i = pair.indexOf("=")
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1))
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ")
  }
  async req(path, { method = "GET", json, form } = {}) {
    const res = await fetch(BASE + path, {
      method,
      redirect: "manual",
      headers: {
        cookie: this.header(),
        ...(json ? { "content-type": "application/json" } : {}),
        ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      body: json ? JSON.stringify(json) : form ? new URLSearchParams(form) : undefined,
    })
    this.store(res)
    let body = null
    try {
      body = await res.json()
    } catch {}
    return { status: res.status, body }
  }
}

async function signIn(email, password = "test@1234") {
  const s = new Session()
  const { body } = await s.req("/api/auth/csrf")
  await s.req("/api/auth/callback/credentials", {
    method: "POST",
    form: { csrfToken: body.csrfToken, email, password, json: "true", callbackUrl: BASE + "/dashboard" },
  })
  const me = await s.req("/api/auth/session")
  assert.ok(me.body?.user?.email, `could not sign in as ${email} — run the seeds first`)
  return s
}

const anon = new Session()
const manager = await signIn("manager@seed.test")
const designer = await signIn("designer@seed.test")
const managerNc = await signIn("manager-nc@seed.test") // every permission except posts:create

const project = await prisma.project.findFirst({
  where: { name: { startsWith: "[SEED] Acme" } },
  select: { id: true, clientId: true },
})
assert.ok(project, "seed project missing — run npm run db:seed:dev")
const designerUser = await prisma.user.findUnique({ where: { email: "designer@seed.test" }, select: { id: true } })

async function makePost({ status = "DRAFT", requiresClientApproval = false, type = "PHOTO", assignDesigner = true } = {}) {
  const post = await prisma.post.create({
    data: {
      title: `[WF-TEST] ${type} ${status} ${requiresClientApproval ? "client" : "internal"}`,
      caption: "Original caption",
      type,
      status,
      designerHeadApproval: status,
      requiresClientApproval,
      projectId: project.id,
      ...(assignDesigner ? { assignedToId: designerUser.id, assignedUsers: { connect: [{ id: designerUser.id }] } } : {}),
    },
    select: { id: true },
  })
  created.push(post.id)
  return post.id
}
const act = (s, id, action, extra = {}) => s.req(`/api/posts/${id}/workflow`, { method: "POST", json: { action, ...extra } })
const statusOf = async (id) => (await prisma.post.findUnique({ where: { id }, select: { status: true } })).status
const future = () => new Date(Date.now() + 86400000).toISOString()

after(async () => {
  await prisma.exportLink.deleteMany({ where: { feedback: "[WF-TEST]" } })
  // Through the app's own DELETE, which removes the task logs, approval flows and comments
  // the legacy routes attach to a post. Also sweeps fixtures left by an interrupted run.
  const leftovers = await prisma.post.findMany({ where: { title: { startsWith: "[WF-TEST]" } }, select: { id: true } })
  for (const { id } of leftovers) {
    const res = await manager.req(`/api/posts/${id}`, { method: "DELETE" })
    if (res.status !== 200) console.warn(`cleanup: could not delete ${id} (${res.status})`)
  }
  await prisma.$disconnect()
})

// ── Authorization ──────────────────────────────────────────────────────────────────
test("unauthenticated edit/delete/approve are refused (401)", async () => {
  const id = await makePost({ status: "SUBMITTED" })
  assert.equal((await anon.req(`/api/posts/${id}`, { method: "PUT", json: { status: "POSTED" } })).status, 401)
  assert.equal((await anon.req(`/api/posts/${id}`, { method: "DELETE" })).status, 401)
  assert.equal((await act(anon, id, "APPROVE")).status, 401)
  assert.equal(await statusOf(id), "SUBMITTED")
})

test("an employee without posts:approve cannot approve (403), but can submit", async () => {
  const id = await makePost({ status: "DRAFT" })
  assert.equal((await act(designer, id, "SUBMIT")).status, 200)
  const res = await act(designer, id, "APPROVE")
  assert.equal(res.status, 403)
  assert.equal(await statusOf(id), "SUBMITTED")
})

test("a scoped approver cannot act on a post outside their scope (404, no existence leak)", async () => {
  // manager-nc lacks posts:create, so is scoped to attached posts — and is attached to none.
  const id = await makePost({ status: "SUBMITTED", assignDesigner: false })
  assert.equal((await act(managerNc, id, "APPROVE")).status, 404)
  assert.equal(await statusOf(id), "SUBMITTED")
})

test("the generic edit endpoint ignores status fields", async () => {
  const id = await makePost({ status: "SUBMITTED" })
  const res = await manager.req(`/api/posts/${id}`, { method: "PUT", json: { status: "POSTED", designerHeadApproval: "APPROVED", notes: "n" } })
  assert.equal(res.status, 200)
  assert.equal(await statusOf(id), "SUBMITTED")
})

test("the legacy status route cannot jump straight to POSTED or C_APPROVED", async () => {
  const id = await makePost({ status: "DRAFT" })
  assert.equal((await manager.req(`/api/posts/${id}/status`, { method: "PATCH", json: { status: "POSTED" } })).status, 409)
  assert.equal((await manager.req(`/api/posts/${id}/status`, { method: "PATCH", json: { status: "C_APPROVED" } })).status, 409)
  assert.equal(await statusOf(id), "DRAFT")
})

// ── Lifecycle ──────────────────────────────────────────────────────────────────────
test("client approval OFF: manager approves → ready → schedule → publish (confirmed)", async () => {
  const id = await makePost({ status: "SUBMITTED" })
  assert.equal((await act(manager, id, "APPROVE")).status, 200)
  const wf = await manager.req(`/api/posts/${id}/workflow`)
  assert.equal(wf.body.stage, "READY_TO_SCHEDULE")
  assert.ok(wf.body.actions.includes("SCHEDULE"))

  assert.equal((await act(manager, id, "SCHEDULE", { scheduledAt: future() })).status, 200)
  assert.equal(await statusOf(id), "SCHEDULED")

  // Scheduled is not published, and publish needs an explicit confirmation.
  assert.equal((await manager.req(`/api/posts/${id}/publish`, { method: "POST", json: {} })).status, 422)
  assert.equal(await statusOf(id), "SCHEDULED")
  assert.equal((await manager.req(`/api/posts/${id}/publish`, { method: "POST", json: { confirmed: true, platform: "Instagram" } })).status, 200)
  assert.equal(await statusOf(id), "POSTED")
})

test("client approval ON: manager approval waits for the client; cannot be scheduled", async () => {
  const id = await makePost({ status: "SUBMITTED", requiresClientApproval: true })
  assert.equal((await act(manager, id, "APPROVE")).status, 200)
  assert.equal(await statusOf(id), "APPROVED")
  const wf = await manager.req(`/api/posts/${id}/workflow`)
  assert.equal(wf.body.stage, "PENDING_CLIENT")
  assert.equal((await act(manager, id, "SCHEDULE", { scheduledAt: future() })).status, 409)
  assert.equal((await manager.req(`/api/posts/${id}/schedule`, { method: "PATCH", json: { scheduledAt: future() } })).body.scheduled, false)
  assert.equal(await statusOf(id), "APPROVED")
  // Staff cannot fake the client's decision.
  assert.equal((await act(manager, id, "CLIENT_APPROVE")).status, 403)
})

test("client approves via share link → schedulable; client request-changes → back to editing", async () => {
  const a = await makePost({ status: "APPROVED", requiresClientApproval: true })
  const b = await makePost({ status: "APPROVED", requiresClientApproval: true })
  const link = await prisma.exportLink.create({
    data: { token: `wf-test-${Date.now()}`, projectId: project.id, clientId: project.clientId, postIds: [a, b], feedback: "[WF-TEST]" },
  })
  const client = new Session()
  const ok = await client.req(`/api/share/${link.token}`, { method: "POST", json: { action: "APPROVE_POST", postId: a, name: "Test Client" } })
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  assert.equal(await statusOf(a), "C_APPROVED")
  // Approving twice is refused rather than recorded twice.
  assert.equal((await client.req(`/api/share/${link.token}`, { method: "POST", json: { action: "APPROVE_POST", postId: a } })).status, 409)
  assert.equal((await act(manager, a, "SCHEDULE", { scheduledAt: future() })).status, 200)

  const rc = await client.req(`/api/share/${link.token}`, { method: "POST", json: { action: "REQUEST_CHANGES_POST", postId: b, feedback: "Change the headline" } })
  assert.equal(rc.status, 200)
  assert.equal(await statusOf(b), "NEEDS_MINOR_CHANGE")

  const timeline = await prisma.postStatusChange.findMany({ where: { postId: a, action: "CLIENT_APPROVE" } })
  assert.equal(timeline.length, 1)
  assert.equal(timeline[0].actorType, "CLIENT")
  assert.equal(timeline[0].actorName, "Test Client")
})

test("client 'confirm all' only approves posts awaiting the client (regression)", async () => {
  const scheduled = await makePost({ status: "SCHEDULED", requiresClientApproval: true })
  const draft = await makePost({ status: "DRAFT", requiresClientApproval: true })
  const pending = await makePost({ status: "APPROVED", requiresClientApproval: true })
  const outside = await makePost({ status: "APPROVED", requiresClientApproval: true })
  const link = await prisma.exportLink.create({
    data: { token: `wf-test-all-${Date.now()}`, projectId: project.id, postIds: [scheduled, draft, pending], feedback: "[WF-TEST]" },
  })
  const client = new Session()
  // The client tries to widen the scope with a post outside the link.
  const res = await client.req(`/api/share/${link.token}`, {
    method: "POST",
    json: { action: "CONFIRM", name: "Test Client", approvedPostIds: [scheduled, draft, pending, outside] },
  })
  assert.equal(res.status, 200)
  assert.equal(await statusOf(scheduled), "SCHEDULED", "a scheduled post must not be knocked back")
  assert.equal(await statusOf(draft), "DRAFT", "an unfinished post must not be client-approved")
  assert.equal(await statusOf(pending), "C_APPROVED")
  assert.equal(await statusOf(outside), "APPROVED", "a post outside the link must not be touched")
})

test("rejection and change requests need a reason and block scheduling", async () => {
  const id = await makePost({ status: "SUBMITTED" })
  assert.equal((await act(manager, id, "REJECT")).status, 422)
  assert.equal((await act(manager, id, "REJECT", { reason: "Off brief" })).status, 200)
  assert.equal((await act(manager, id, "SCHEDULE", { scheduledAt: future() })).status, 409)
  const id2 = await makePost({ status: "SUBMITTED" })
  assert.equal((await act(manager, id2, "REQUEST_CHANGES", { reason: "Fix typo" })).status, 200)
  assert.equal(await statusOf(id2), "NEEDS_MINOR_CHANGE")
  assert.equal((await act(designer, id2, "SUBMIT")).status, 200)
  assert.equal(await statusOf(id2), "RESUBMITTED")
})

test("duplicate and concurrent approvals: exactly one succeeds", async () => {
  const id = await makePost({ status: "SUBMITTED" })
  const results = await Promise.all([act(manager, id, "APPROVE"), act(manager, id, "APPROVE"), act(manager, id, "APPROVE")])
  const codes = results.map((r) => r.status).sort()
  assert.deepEqual(codes, [200, 409, 409], JSON.stringify(results.map((r) => r.body)))
  assert.equal(await prisma.postStatusChange.count({ where: { postId: id, action: "APPROVE" } }), 1)
})

test("editing after approval invalidates it (with confirmation) and bumps the version", async () => {
  const id = await makePost({ status: "SUBMITTED" })
  await act(manager, id, "APPROVE")
  const before = await prisma.post.findUnique({ where: { id }, select: { version: true } })

  const blocked = await manager.req(`/api/posts/${id}`, { method: "PUT", json: { caption: "New caption" } })
  assert.equal(blocked.status, 409)
  assert.equal(blocked.body.code, "REAPPROVAL_REQUIRED")
  assert.equal(await statusOf(id), "APPROVED")

  const ok = await manager.req(`/api/posts/${id}`, { method: "PUT", json: { caption: "New caption", confirmReapproval: true } })
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  const afterEdit = await prisma.post.findUnique({ where: { id }, select: { status: true, version: true, caption: true } })
  assert.equal(afterEdit.status, "RESUBMITTED")
  assert.equal(afterEdit.version, before.version + 1)
  assert.equal(afterEdit.caption, "New caption")
  // The earlier approval is still on record, against the old version.
  const approvals = await prisma.postStatusChange.findMany({ where: { postId: id, action: "APPROVE" } })
  assert.equal(approvals.length, 1)
  assert.equal(approvals[0].version, before.version)
})

test("a stale screen cannot overwrite a newer version (409)", async () => {
  const id = await makePost({ status: "DRAFT" })
  await manager.req(`/api/posts/${id}`, { method: "PUT", json: { caption: "v1 edit" } })
  const res = await manager.req(`/api/posts/${id}`, { method: "PUT", json: { caption: "stale", expectedVersion: 99 } })
  assert.equal(res.status, 409)
  assert.equal(res.body.code, "STALE")
})

test("toggling client approval ON on a scheduled post sends it back to the client", async () => {
  const id = await makePost({ status: "SCHEDULED", requiresClientApproval: false })
  const res = await manager.req(`/api/posts/${id}`, { method: "PUT", json: { requiresClientApproval: true } })
  assert.equal(res.status, 200, JSON.stringify(res.body))
  const p = await prisma.post.findUnique({ where: { id }, select: { status: true, requiresClientApproval: true } })
  assert.equal(p.status, "APPROVED")
  assert.equal(p.requiresClientApproval, true)
  assert.equal(await prisma.postStatusChange.count({ where: { postId: id, action: "CLIENT_TOGGLE" } }), 1)
})

test("PPT content follows the same approval process", async () => {
  const id = await makePost({ status: "DRAFT", type: "PPT", requiresClientApproval: true })
  assert.equal((await act(designer, id, "SUBMIT")).status, 200)
  assert.equal((await act(designer, id, "APPROVE")).status, 403)
  assert.equal((await act(manager, id, "APPROVE")).status, 200)
  assert.equal((await act(manager, id, "SCHEDULE", { scheduledAt: future() })).status, 409)
})

test("every transition lands in the timeline with actor, from/to and version", async () => {
  const id = await makePost({ status: "DRAFT" })
  await act(designer, id, "SUBMIT")
  await act(manager, id, "REQUEST_CHANGES", { reason: "Tighter crop" })
  const wf = await manager.req(`/api/posts/${id}/workflow`)
  const [latest, first] = wf.body.timeline
  assert.equal(first.action, "SUBMIT")
  assert.equal(first.fromStatus, "DRAFT")
  assert.equal(first.toStatus, "SUBMITTED")
  assert.equal(latest.action, "REQUEST_CHANGES")
  assert.equal(latest.reason, "Tighter crop")
  assert.equal(latest.actor.name, "Seed Manager")
  assert.equal(typeof latest.version, "number")
})
