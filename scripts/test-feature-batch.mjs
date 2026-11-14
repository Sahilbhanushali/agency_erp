/**
 * End-to-end tests for post editing, PPT posts, approval discussions and Canvas, against
 * a RUNNING app and the local seed data. Every request goes through the real HTTP API
 * with real NextAuth sessions.
 *
 *   npm run db:seed && npm run db:seed:dev       # once
 *   npm run dev                                   # in another terminal (or PORT=3100 …)
 *   npm run test:features:api                     # BASE_URL defaults to http://localhost:3000
 *
 * Creates its own posts, boards and two [E2E] test accounts (deactivated again at the
 * end — people are never deleted). Refuses to run against anything but a local database.
 */
import { test, after } from "node:test"
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import JSZip from "jszip"

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
const TAG = "[E2E-FEAT]"
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
)
const CHAT_ROOT = path.resolve(process.env.CHAT_STORAGE_DIR || path.join(process.cwd(), "storage", "chat"))

// ── HTTP ───────────────────────────────────────────────────────────────────────────

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
  async raw(p, { method = "GET", json, form, multipart } = {}) {
    const res = await fetch(BASE + p, {
      method,
      redirect: "manual",
      headers: {
        cookie: this.header(),
        ...(json ? { "content-type": "application/json" } : {}),
        ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      body: json ? JSON.stringify(json) : form ? new URLSearchParams(form) : multipart,
    })
    this.store(res)
    return res
  }
  async req(p, opts) {
    const res = await this.raw(p, opts)
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

// ── Fixtures ───────────────────────────────────────────────────────────────────────

/** A role holding exactly these permission names (created or reset each run). */
async function roleWith(name, permissionNames) {
  const perms = await prisma.permission.findMany({ where: { name: { in: permissionNames } }, select: { id: true } })
  const role = await prisma.role.upsert({ where: { name }, create: { name }, update: {}, select: { id: true } })
  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
  await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) })
  return role.id
}

/** A test account using the seed password hash; reactivated each run. */
async function account(email, name, roleId) {
  const { password } = await prisma.user.findUniqueOrThrow({ where: { email: "designer@seed.test" }, select: { password: true } })
  return prisma.user.upsert({
    where: { email },
    create: { email, name, password, roleId, isActive: true },
    update: { roleId, isActive: true, password },
    select: { id: true },
  })
}

const managerPerms = (
  await prisma.rolePermission.findMany({ where: { role: { name: "Manager" } }, select: { permission: { select: { name: true } } } })
).map((r) => r.permission.name)
const canvasPerms = ["canvas:read", "canvas:create", "canvas:update", "canvas:delete", "canvas:share"]
const plannerRole = await roleWith("[E2E] Planner", [...new Set([...managerPerms, ...canvasPerms])])
const viewerRole = await roleWith("[E2E] Canvas viewer", ["dashboard:read", "canvas:read"])
const plannerUser = await account("e2e-planner@seed.test", "E2E Planner", plannerRole)
const viewerUser = await account("e2e-viewer@seed.test", "E2E Viewer", viewerRole)

const anon = new Session()
const manager = await signIn("manager@seed.test")
const designer = await signIn("designer@seed.test")
const managerNc = await signIn("manager-nc@seed.test") // scoped: sees only posts attached to them
const planner = await signIn("e2e-planner@seed.test")
const viewer = await signIn("e2e-viewer@seed.test")

const project = await prisma.project.findFirst({
  where: { name: { startsWith: "[SEED] Acme" } },
  select: { id: true, clientId: true },
})
assert.ok(project, "seed project missing — run npm run db:seed:dev")
const designerUser = await prisma.user.findUniqueOrThrow({ where: { email: "designer@seed.test" }, select: { id: true } })
const managerUser = await prisma.user.findUniqueOrThrow({ where: { email: "manager@seed.test" }, select: { id: true } })

async function pptx(slideTitles) {
  const zip = new JSZip()
  zip.file("[Content_Types].xml", "<Types/>")
  zip.file("ppt/presentation.xml", "<p:presentation/>")
  slideTitles.forEach((t, i) =>
    zip.file(
      `ppt/slides/slide${i + 1}.xml`,
      `<p:sld xmlns:a="a" xmlns:p="p"><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp></p:sld>`,
    ),
  )
  return zip.generateAsync({ type: "nodebuffer" })
}

/** Creates a post through the real create endpoint (multipart), assigned to the designer. */
async function createPost(type, { file } = {}) {
  const form = new FormData()
  form.append("title", `${TAG} ${type} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
  form.append("caption", "Original caption #launch")
  form.append("type", type)
  form.append("projectId", project.id)
  form.append("platforms", JSON.stringify(type === "PPT" ? [] : ["INSTAGRAM"]))
  form.append("assignedToIds", JSON.stringify([designerUser.id]))
  if (file) form.append("assets", new Blob([file.bytes], { type: file.type }), file.name)
  const res = await manager.req("/api/posts", { method: "POST", multipart: form })
  assert.equal(res.status, 201, `create ${type}: ${JSON.stringify(res.body)}`)
  return res.body.id
}

const act = (s, id, action, extra = {}) => s.req(`/api/posts/${id}/workflow`, { method: "POST", json: { action, ...extra } })
const postRow = (id) => prisma.post.findUniqueOrThrow({ where: { id }, select: { status: true, version: true, caption: true } })
const edits = (id) => prisma.postStatusChange.findMany({ where: { postId: id, action: "EDIT" }, orderBy: { createdAt: "asc" } })
const uploadPath = (url) => path.join(process.cwd(), "public", "uploads", url.replace(/^\/?api\/uploads\//, ""))

after(async () => {
  const boards = await prisma.canvas.findMany({ where: { title: { startsWith: TAG } }, select: { id: true } })
  for (const { id } of boards) {
    const res = await planner.req(`/api/canvases/${id}`, { method: "DELETE" })
    if (res.status !== 200) await prisma.canvas.delete({ where: { id } }).catch(() => {})
  }
  const posts = await prisma.post.findMany({ where: { title: { startsWith: TAG } }, select: { id: true } })
  for (const { id } of posts) {
    const res = await manager.req(`/api/posts/${id}`, { method: "DELETE" })
    if (res.status !== 200) console.warn(`cleanup: could not delete post ${id} (${res.status})`)
  }
  await prisma.user.updateMany({ where: { email: { in: ["e2e-planner@seed.test", "e2e-viewer@seed.test"] } }, data: { isActive: false } })
  await prisma.$disconnect()
})

// ── 1. Post editing ────────────────────────────────────────────────────────────────

for (const type of ["PHOTO", "REEL", "CAROUSEL", "PPT"]) {
  test(`${type}: created post can be edited, and the edit is in the history`, async () => {
    const id = await createPost(type)
    const res = await manager.req(`/api/posts/${id}`, { method: "PUT", json: { caption: `Edited ${type} caption #new`, notes: "tone it down" } })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal((await postRow(id)).caption, `Edited ${type} caption #new`)
    const [edit] = await edits(id)
    assert.ok(edit, "an EDIT history row was written")
    assert.equal(edit.actorId, managerUser.id)
    assert.deepEqual(edit.metadata.changes, ["caption", "notes"])
  })
}

test("edit permissions: assignee may edit; out-of-scope 404; anonymous 401", async () => {
  const id = await createPost("PHOTO")
  assert.equal((await designer.req(`/api/posts/${id}`, { method: "PUT", json: { caption: "Designer tweak" } })).status, 200)
  assert.equal((await managerNc.req(`/api/posts/${id}`, { method: "PUT", json: { caption: "nope" } })).status, 404)
  assert.equal((await anon.req(`/api/posts/${id}`, { method: "PUT", json: { caption: "nope" } })).status, 401)
  assert.equal((await postRow(id)).caption, "Designer tweak")
})

test("editing an approved post needs confirmation and restarts approval", async () => {
  const id = await createPost("PHOTO")
  assert.equal((await act(designer, id, "SUBMIT")).status, 200)
  assert.equal((await act(manager, id, "APPROVE")).status, 200)
  const before = await postRow(id)

  const refused = await manager.req(`/api/posts/${id}`, { method: "PUT", json: { caption: "Sneaky change" } })
  assert.equal(refused.status, 409)
  assert.equal(refused.body.code, "REAPPROVAL_REQUIRED")
  assert.equal((await postRow(id)).caption, before.caption, "nothing saved without confirmation")

  const ok = await manager.req(`/api/posts/${id}`, { method: "PUT", json: { caption: "Approved change", confirmReapproval: true } })
  assert.equal(ok.status, 200)
  const after = await postRow(id)
  assert.equal(after.status, "RESUBMITTED")
  assert.ok(after.version > before.version, "version bumped so the old approval does not carry over")
  assert.equal(await prisma.postStatusChange.count({ where: { postId: id, action: "EDIT_INVALIDATE" } }), 1)
})

test("changes requested → creator edits → resubmits", async () => {
  const id = await createPost("REEL")
  assert.equal((await act(designer, id, "SUBMIT")).status, 200)
  assert.equal((await act(manager, id, "REQUEST_CHANGES", { reason: "Shorter hook please" })).status, 200)
  assert.equal((await postRow(id)).status, "NEEDS_MINOR_CHANGE")
  assert.equal((await designer.req(`/api/posts/${id}`, { method: "PUT", json: { caption: "Shorter hook" } })).status, 200)
  assert.equal((await act(designer, id, "SUBMIT")).status, 200)
  assert.ok(["SUBMITTED", "RESUBMITTED"].includes((await postRow(id)).status))
})

// ── 2. PPT ─────────────────────────────────────────────────────────────────────────

test("PPT: upload, preview, replace — the previous version stays downloadable", async () => {
  const pptxType = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  const id = await createPost("PPT", { file: { bytes: await pptx(["Concept", "Palette"]), type: pptxType, name: "deck-v1.pptx" } })
  const [v1] = await prisma.asset.findMany({ where: { postId: id }, select: { id: true, url: true } })
  assert.ok(v1, "deck stored as an asset")

  const preview = await designer.req(`/api/posts/${id}/assets/${v1.id}/preview?part=summary`)
  assert.equal(preview.status, 200, JSON.stringify(preview.body))
  assert.equal(preview.body.slideCount, 2)
  assert.deepEqual(preview.body.slides.map((s) => s.title), ["Concept", "Palette"])
  assert.equal((await anon.req(`/api/posts/${id}/assets/${v1.id}/preview?part=summary`)).status, 401)
  assert.equal((await managerNc.req(`/api/posts/${id}/assets/${v1.id}/preview?part=summary`)).status, 404)

  // Replace before submission: remove v1, upload v2.
  const form = new FormData()
  form.append("removedAssets", JSON.stringify([v1.id]))
  form.append("assets", new Blob([await pptx(["Concept v2", "Palette", "Type"])], { type: pptxType }), "deck-v2.pptx")
  const replaced = await designer.req(`/api/posts/${id}`, { method: "PUT", multipart: form })
  assert.equal(replaced.status, 200, JSON.stringify(replaced.body))

  const [edit] = await edits(id)
  assert.equal(edit.metadata.replacedAssets?.[0]?.url, v1.url, "history points at the previous deck")
  assert.ok(existsSync(uploadPath(v1.url)), "previous deck kept on disk")
  const [v2] = await prisma.asset.findMany({ where: { postId: id }, select: { id: true } })
  assert.equal((await designer.req(`/api/posts/${id}/assets/${v2.id}/preview?part=summary`)).body.slideCount, 3)

  // The PPT goes through the same approval workflow.
  assert.equal((await act(designer, id, "SUBMIT")).status, 200)
  assert.equal((await act(manager, id, "APPROVE")).status, 200)
})

// ── 3. Approval discussions ────────────────────────────────────────────────────────

const discussion = (s, id, query = "") => s.req(`/api/posts/${id}/discussion${query}`)
const say = (s, id, body, extra = {}) => s.req(`/api/posts/${id}/discussion`, { method: "POST", json: { body, ...extra } })

for (const type of ["PHOTO", "CAROUSEL", "REEL", "PPT"]) {
  test(`${type} approval: reviewer and creator talk in the post's own thread`, async () => {
    const id = await createPost(type)
    // The designer opens the post; from then on workflow decisions are noted in the thread.
    assert.equal((await discussion(designer, id)).status, 200)
    assert.equal((await act(designer, id, "SUBMIT")).status, 200)

    // Reviewer opens the approval and explains the change.
    const sent = await say(manager, id, "Please swap the hero image")
    assert.equal(sent.status, 201, JSON.stringify(sent.body))

    // Creator is notified and sees an unread indicator.
    const link = `/dashboard/projects/posts/${id}?tab=discussion`
    assert.equal(await prisma.notification.count({ where: { userId: designerUser.id, link, isRead: false } }), 1)
    const unread = await designer.req(`/api/posts/discussions/unread?postIds=${id}`)
    assert.equal(unread.body.counts[id], 1)

    // Creator replies in the same thread, with a reference attachment.
    const form = new FormData()
    form.append("body", "Swapped — see the reference")
    form.append("replyToId", sent.body.message.id)
    form.append("clientId", `e2e-${Date.now()}-${type}`)
    form.append("file", new Blob([PNG], { type: "image/png" }), "reference.png")
    const reply = await designer.req(`/api/posts/${id}/discussion`, { method: "POST", multipart: form })
    assert.equal(reply.status, 201, JSON.stringify(reply.body))
    assert.equal(reply.body.message.replyTo.id, sent.body.message.id)
    const attachment = reply.body.message.attachments[0]
    assert.ok(attachment, "attachment stored")

    // Reading clears the unread count and the notification.
    const thread = await discussion(designer, id)
    const lastSeq = thread.body.messages.at(-1).seq
    assert.equal((await designer.req(`/api/posts/${id}/discussion/read`, { method: "POST", json: { seq: lastSeq } })).status, 200)
    assert.equal((await designer.req(`/api/posts/discussions/unread?postIds=${id}`)).body.counts[id], undefined)
    assert.equal(await prisma.notification.count({ where: { userId: designerUser.id, link, isRead: false } }), 0)

    // Decision is written into the thread, and the thread survives approval.
    assert.equal((await act(manager, id, "APPROVE")).status, 200)
    const final = await discussion(manager, id)
    assert.equal(final.status, 200)
    const bodies = final.body.messages.map((m) => m.body)
    assert.ok(bodies.includes("Please swap the hero image"))
    assert.ok(bodies.includes("Swapped — see the reference"))
    assert.ok(bodies.some((b) => b?.includes("submitted it for approval")), "submission noted")
    assert.ok(bodies.some((b) => b?.includes("approved it")), "approval noted")
    const seqs = final.body.messages.map((m) => m.seq)
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b), "chronological")
    const sender = final.body.participants.find((p) => p.id === designerUser.id)
    assert.equal(sender?.role, "Designer", "sender role shown")

    // Attachment: members download it; people without access to the post cannot.
    assert.equal((await manager.raw(`/api/chat/attachments/${attachment.id}`)).status, 200)
    assert.equal((await managerNc.raw(`/api/chat/attachments/${attachment.id}`)).status, 404)
  })
}

test("changes requested are written into the discussion, linking feedback to the resubmission", async () => {
  const id = await createPost("PHOTO")
  assert.equal((await act(designer, id, "SUBMIT")).status, 200)
  assert.equal((await act(manager, id, "REQUEST_CHANGES", { reason: "Logo too small" })).status, 200)
  const thread = await discussion(designer, id)
  assert.ok(thread.body.messages.some((m) => m.type === "SYSTEM" && m.body.includes("requested changes") && m.body.includes("Logo too small")))
  assert.equal((await act(designer, id, "SUBMIT")).status, 200)
  // The thread opened with the change request, so the resubmission follows it there.
  const after = await discussion(designer, id)
  const notes = after.body.messages.filter((m) => m.type === "SYSTEM").map((m) => m.body)
  assert.ok(notes.findIndex((b) => b.includes("requested changes")) < notes.findIndex((b) => b.includes("submitted it")))
})

test("discussion access follows the post: anonymous 401, out-of-scope 404, kept out of the chat inbox", async () => {
  const id = await createPost("PHOTO")
  await say(manager, id, "Internal note")
  assert.equal((await discussion(anon, id)).status, 401)
  assert.equal((await discussion(managerNc, id)).status, 404)
  assert.equal((await say(managerNc, id, "let me in")).status, 404)
  const conv = await prisma.conversation.findUniqueOrThrow({ where: { postId: id }, select: { id: true } })
  // The generic chat routes refuse too, even if a membership row were to exist.
  await prisma.conversationMember.create({ data: { conversationId: conv.id, userId: (await prisma.user.findUniqueOrThrow({ where: { email: "manager-nc@seed.test" } })).id } })
  assert.equal((await managerNc.req(`/api/chat/conversations/${conv.id}/messages`)).status, 404)
  const inbox = await manager.req("/api/chat/conversations")
  if (inbox.status === 200) {
    const ids = (inbox.body.conversations ?? inbox.body).map((c) => c.id)
    assert.ok(!ids.includes(conv.id), "approval threads are not in the chat inbox")
  }
})

// ── 4. Canvas ──────────────────────────────────────────────────────────────────────

const board = (s, id) => s.req(`/api/canvases/${id}`)
const addEl = (s, id, el) => s.req(`/api/canvases/${id}/elements`, { method: "POST", json: el })

test("mood board: create linked to a campaign, add, arrange, edit, comment, share, duplicate, delete", async () => {
  // Create from the template, linked to the campaign; the client follows the campaign.
  const created = await planner.req("/api/canvases", { method: "POST", json: { title: `${TAG} Diwali mood board`, kind: "MOODBOARD", projectId: project.id } })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const id = created.body.id
  assert.equal(created.body.client?.id, project.clientId)
  let b = await board(planner, id)
  assert.equal(b.body.canvas.elements.filter((e) => e.type === "SECTION").length, 9)
  assert.ok(b.body.canvas.elements.some((e) => e.data.title === "Colour palette"))

  // Text, colours and reference links.
  const text = await addEl(planner, id, { type: "TEXT", data: { text: "Warm, festive, gold accents" }, x: 20, y: 20 })
  assert.equal(text.status, 201)
  assert.equal((await addEl(planner, id, { type: "COLOR", data: { hex: "#F59E0B", label: "Marigold" } })).status, 201)
  assert.equal((await addEl(planner, id, { type: "LINK", data: { url: "https://example.com/inspo", title: "Inspo" } })).status, 201)
  assert.equal((await addEl(planner, id, { type: "LINK", data: { url: "javascript:alert(1)" } })).status, 422, "unsafe links refused")
  assert.equal((await addEl(planner, id, { type: "COLOR", data: { hex: "red" } })).status, 422)

  // Upload and place an image; it is served only to people who can see the board.
  const form = new FormData()
  form.append("file", new Blob([PNG], { type: "image/png" }), "ref.png")
  const upload = await planner.req(`/api/canvases/${id}/images`, { method: "POST", multipart: form })
  assert.equal(upload.status, 201, JSON.stringify(upload.body))
  const image = await addEl(planner, id, { type: "IMAGE", data: { storageKey: upload.body.storageKey, alt: "Reference" } })
  assert.equal(image.status, 201)
  const imgUrl = `/api/canvases/${id}/images?key=${encodeURIComponent(upload.body.storageKey)}`
  const served = await planner.raw(imgUrl)
  assert.equal(served.status, 200)
  assert.equal(served.headers.get("content-type"), "image/png")

  // Arrange (batch move) and edit content; both persist.
  const moved = await planner.req(`/api/canvases/${id}/elements`, { method: "PATCH", json: { elements: [{ id: text.body.id, x: 300, y: 400, width: 320 }, { id: image.body.id, x: 900, y: 50 }] } })
  assert.equal(moved.status, 200)
  assert.equal((await planner.req(`/api/canvases/${id}/elements/${text.body.id}`, { method: "PATCH", json: { data: { text: "Warm, festive", bold: true } } })).status, 200)
  b = await board(planner, id)
  const t = b.body.canvas.elements.find((e) => e.id === text.body.id)
  assert.deepEqual([t.x, t.y, t.width, t.data.text, t.data.bold], [300, 400, 320, "Warm, festive", true])

  // Access: not shared → invisible; viewer can comment but not edit; editor can edit.
  assert.equal((await board(viewer, id)).status, 404)
  assert.equal((await viewer.raw(imgUrl)).status, 404)
  assert.equal((await board(designer, id)).status, 403, "role without canvas access")
  assert.equal((await planner.req(`/api/canvases/${id}/members`, { method: "POST", json: { userId: viewerUser.id, role: "VIEWER" } })).status, 201)
  assert.equal((await board(viewer, id)).status, 200)
  assert.equal((await viewer.raw(imgUrl)).status, 200)
  assert.equal((await viewer.req(`/api/canvases/${id}/elements/${text.body.id}`, { method: "PATCH", json: { x: 1 } })).status, 403)
  const comment = await viewer.req(`/api/canvases/${id}/comments`, { method: "POST", json: { body: "Love the palette", elementId: image.body.id } })
  assert.equal(comment.status, 201)
  assert.equal((await planner.req(`/api/canvases/${id}/members`, { method: "POST", json: { userId: viewerUser.id, role: "EDITOR" } })).status, 201)
  assert.equal((await viewer.req(`/api/canvases/${id}/elements/${text.body.id}`, { method: "PATCH", json: { x: 310 } })).status, 200)
  assert.equal((await viewer.req(`/api/canvases/${id}`, { method: "DELETE" })).status, 403, "editors cannot delete")
  assert.equal(await prisma.notification.count({ where: { userId: viewerUser.id, link: `/dashboard/canvas/${id}` } }) >= 1, true)

  // Activity history records who did what.
  const activity = (await planner.req(`/api/canvases/${id}/activity`)).body.activity.map((a) => a.action)
  for (const action of ["CREATED", "ELEMENT_ADDED", "ELEMENT_UPDATED", "SHARED", "COMMENTED"]) assert.ok(activity.includes(action), action)

  // Duplicate: a separate board with its own copy of the image.
  const copy = await planner.req(`/api/canvases/${id}/duplicate`, { method: "POST" })
  assert.equal(copy.status, 201)
  const copyBoard = await board(planner, copy.body.id)
  const copyImage = copyBoard.body.canvas.elements.find((e) => e.type === "IMAGE")
  assert.notEqual(copyImage.data.storageKey, upload.body.storageKey)
  assert.equal(copyBoard.body.canvas.elements.length, b.body.canvas.elements.length)
  await prisma.canvas.update({ where: { id: copy.body.id }, data: { title: `${TAG} copy` } })

  // Delete: the board and its uploaded image file go; the copy keeps its own.
  assert.equal((await planner.req(`/api/canvases/${id}`, { method: "DELETE" })).status, 200)
  assert.equal((await board(planner, id)).status, 404)
  assert.ok(!existsSync(path.join(CHAT_ROOT, upload.body.storageKey)), "image file removed")
  assert.ok(existsSync(path.join(CHAT_ROOT, copyImage.data.storageKey)), "copy's image untouched")
})

test("canvas list shows only boards the caller may see", async () => {
  const mine = await planner.req("/api/canvases", { method: "POST", json: { title: `${TAG} private board` } })
  assert.equal(mine.status, 201)
  const viewerList = await viewer.req("/api/canvases")
  assert.equal(viewerList.status, 200)
  assert.ok(!viewerList.body.items.some((c) => c.id === mine.body.id))
  const plannerList = await planner.req(`/api/canvases?projectId=${project.id}`)
  assert.equal(plannerList.status, 200)
  assert.equal((await anon.req("/api/canvases")).status, 401)
  assert.equal((await viewer.req("/api/canvases", { method: "POST", json: { title: "nope" } })).status, 403)
})
