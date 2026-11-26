# itsmeDezino Agency ERP ("Agency OS") — Complete Project Guide

> **How to use this file:** paste it into Claude with a prompt like:
> *"This is my project. Act as an interviewer / study partner. Answer questions about it,
> explain any module in depth, and quiz me on the design decisions."*
> Everything here was taken from the source code (schema, `lib/`, `app/api/`, config
> files, in-code comments). Where something is an estimate or unverified it says so.

---

## 1. Elevator pitch (30 seconds)

A full-stack **operations platform for a digital-marketing agency**, built with
**Next.js 15 (App Router) + React 19 + TypeScript + Prisma + MariaDB/MySQL**.
It runs the whole agency in one app:

- **Content delivery** — campaigns → social posts → design files → internal approval →
  client approval through a secure share link → scheduling → **auto-publishing to Instagram**.
- **Agency business** — leads pipeline, clients, contracts, quotations, GST invoices,
  payments, expenses and profitability reports.
- **People / HR** — users & roles, recruitment (ATS + offer letters), attendance
  (biometric sync), leaves, a full **Indian payroll engine** (PF / ESI / PT / TDS), payslips.
- **Collaboration** — real-time team **chat** (Server-Sent Events), **canvas & mood boards**,
  daily plans / end-of-day reports, tasks, notifications.
- **Security** — data-driven **RBAC**, an **AES-256-GCM credentials vault**, audit logs,
  rate limiting, password-protected client share links with lockout.

## 2. Project in numbers

| Metric | Value |
|---|---|
| API route handlers (`app/api/**/route.ts`) | **238** |
| Pages (`page.tsx`) | **~69** (staff dashboard, auth, client portal, share pages) |
| Prisma models | **108** (+ ~40 enums) |
| Source lines (app, components, lib, hooks, types) | **~152k** |
| Permission modules in the RBAC catalog | **32** |
| Git history | 97 commits, Jul 2026 → Nov 2026 |
| Deployment | Single VPS, nginx → PM2 (Node), MariaDB 11.8 |

---

## 3. Tech stack (and why)

| Layer | Technology | Notes / why chosen |
|---|---|---|
| Framework | **Next.js 15.5, App Router**, Turbopack dev | One codebase serves pages *and* the REST API (`app/api/**`). Server Components by default. |
| UI | **React 19**, **Tailwind CSS v4**, **shadcn/ui + Radix UI**, `lucide-react` icons | Accessible primitives; ~51 shadcn components in `components/ui/`. |
| Language | **TypeScript 5** | Strict style; types inferred from Prisma and zod. |
| ORM / DB | **Prisma 6** on **MySQL / MariaDB 11.8** | Single Prisma client in `lib/prisma.ts`, extended with a write hook for live updates. Schema kept in sync with `prisma db push` (no migration history). |
| Auth | **NextAuth v4**, Credentials provider, **JWT sessions**, **bcrypt** | Custom JWT callback revokes sessions on password change; deactivation checked on every API call. |
| Data fetching | **SWR** on the client, `fetch` / direct Prisma in server components | Live refresh driven by SSE "invalidate" events. |
| Forms / validation | **react-hook-form + zod** (`lib/validation/*`) | Same zod schema validates client form and server body. |
| Real-time | **Server-Sent Events** (`app/api/events`) + in-process hub (`lib/realtime/hub.ts`) | Chat, presence, typing, read receipts, and cross-module "refetch" signals. |
| Email | **nodemailer** + React email templates (`components/emails/`) | SMTP settings stored per sender, passwords sealed in the vault. |
| Documents | **jsPDF + jspdf-autotable** (PDFs: payslips, offers, invoices), **ExcelJS / SheetJS (xlsx)** (exports/imports), **JSZip** | Payslip, offer letter, statutory report and bank-file generation. |
| Scheduling | **node-cron** in a separate PM2 process (`scripts/cron-job.js`) | Schedules are stored in the DB and editable from the UI. |
| External API | **Meta Instagram API (Instagram Login)** | OAuth connect, publish, insights, token refresh. |
| Crypto | Node `crypto` (AES-256-GCM, SHA-256, randomBytes), bcryptjs | Vault, token vault, share tokens. |
| Misc | date-fns, sonner / react-hot-toast, next-themes (dark mode), cmdk, react-day-picker | |
| Hosting | **nginx** reverse proxy → **PM2** (fork mode, 1 instance) on a VPS | See §9. |
| Tests | **node:test** (`node --test`) + custom `*.check.ts` self-checks + API E2E scripts | See §10. |

---

## 4. Architecture

```
Browser (staff)          Browser (client, share subdomain)
     │                              │
     ▼                              ▼
  nginx (TLS, 100M upload limit, proxies everything; nothing static)
     │
     ▼
  Next.js process (PM2 "itsmedezinoagencyerp", port 3008)
   ├─ middleware.ts  → share-subdomain routing & blocking, legacy /confirm redirects,
   │                   stamps request method for the realtime layer
   ├─ app/dashboard/** (Server + Client Components, SWR)
   ├─ app/share/**, app/client-portal/**  (client-facing)
   ├─ app/api/**  (238 route handlers: authenticate → authorize → zod-validate → Prisma)
   ├─ lib/*       (domain services: posts workflow, payroll, chat, instagram, vault …)
   └─ /api/events (SSE stream per tab) ◄── lib/realtime/hub.ts
     │
     ▼
  Prisma client (+ $extends write hook → realtime invalidation)
     │
     ▼
  MariaDB 11.8                     public/uploads/ (local disk files)

  PM2 "itsmedezinoagencyerp-cron" (scripts/cron-job.js)
     └─ polls GET /api/jobs/schedule every minute, runs jobs by POSTing to the app
        with CRON_SECRET, reports results back
```

**Key architectural points**

1. **Monolith on purpose.** UI and API in one Next.js process; domain logic lives in
   `lib/` so routes stay thin.
2. **Single agency, many clients — no multi-tenancy.** There is no `tenantId`.
   `Client` is a customer; `Company` is the agency's own billing entity that issues invoices.
3. **Two audiences.** Staff use `/dashboard/**` (session auth). Clients use `/share/**` on a
   separate **share subdomain** (token auth). `middleware.ts` rewrites `share.<domain>/<token>`
   to `/share/<token>` and returns **403** for `/dashboard`, `/api/auth`, etc. on that host.
4. **Pure-rules modules.** State machines and calculations are written as import-free
   pure functions (`lib/posts/workflow-rules.ts`, `lib/finance.ts`,
   `lib/payroll/calculation-engine.ts`, `lib/chat/file-rules.ts`,
   `lib/instagram/media-rules.ts`) so they can be unit-tested without a DB and shared by
   server and UI.

---

## 5. Authentication & authorization (most-asked interview topic)

### Authentication — `lib/auth.ts`
- NextAuth **Credentials** provider: email + password, **bcrypt compare only**
  (a non-bcrypt stored value can never log in).
- **Deactivated users** (`User.isActive = false`) are refused *before* the password check,
  so they learn nothing about whether the password still works.
- **JWT sessions.** The JWT callback stores `authTime` at sign-in and on every session read
  compares it to `User.passwordChangedAt` → **changing a password revokes every older session**.
- `redirect` callback only allows same-origin / configured-origin URLs (no open redirect).
- Password reset / account setup use one-time tokens (`PasswordReset`, `Invite`,
  `lib/password-token.ts`); forgot-password is **rate-limited per IP**.

### Authorization — `lib/api-auth.ts` + `lib/permissions/catalog.ts`
- **RBAC:** `User → Role → RolePermission → Permission`.
- The **permission catalog** (`catalog.ts`) is the single source of truth: 32 modules in
  5 groups (Delivery, Agency, People, Finance, System), each with actions
  `read / create / update / delete` plus extras `approve, publish, share, convert, reveal, export, status`.
  Canonical names are `module:action` (e.g. `quotations:update`).
- **Migration story:** old permissions were `View-X` / `Manage-X` (manage = create+update+delete,
  inseparable). The catalog splits them into fine-grained actions but lists the legacy names
  per action, so **existing roles kept exactly their capability** — an additive migration,
  not a cutover. A `baseline` flag grants actions that used to be ungated (e.g. dashboard read)
  so they were not silently revoked.
- **Route guard pattern:**
  ```ts
  const auth = await requireCan("attendance", "update")
  if (!auth.ok) return auth.response   // 401 or 403
  ```
  Helpers: `requireSession()`, `requirePermission()`, `requireCan()`, `can()`, `contentScope()`.
- **Role is read from the DB on every request, never trusted from the JWT** — so a demotion or
  deactivation takes effect immediately, not at next login.
- `ADMIN` is a bootstrap safety net only (so a half-seeded catalog can't lock admins out).
  Everywhere else access is decided by permissions, never by role names.
- **Record-level scoping:** `contentScope()` returns `"all"` (planners) or `"own"`
  (designers see their assigned posts). Client contacts are detected via `isClientContact()`.
- Client UI uses `hooks/use-can.ts`, `use-permissions.ts`, and `lib/permissions/guard.tsx`
  to hide what the server would refuse anyway (server is the authority).
- A **permission matrix UI** (Roles & Permissions page) edits role grants; `sync.ts` syncs the
  catalog into the `Permission` table.

---

## 6. Modules — one by one

### 6.1 Projects (campaigns) & Posts — the core
- **Models:** `Project`, `ProjectStrategy`, `Post`, `PostPlatform`, `PostAssignment`,
  `PostStatusChange`, `Asset`, `Comment`, `TaskLog`.
- **Post types:** PHOTO, REEL, STORY, CAROUSEL, BLOG, PPT, CUSTOM.
  **Platforms:** Instagram, Facebook, X/Twitter, LinkedIn, Threads, YouTube, IGTV, GMB, Pinterest, Website.
- **Workflow state machine** (`lib/posts/workflow-rules.ts`, engine in `workflow.ts`):
  ```
  DRAFT ─submit→ SUBMITTED ─approve→ APPROVED ─┬─ (client approval off) → ready → SCHEDULED → POSTED
                   │  ├─reject→ REJECTED        └─ (client approval on) → pending client → C_APPROVED
                   │  └─request changes→ NEEDS_MINOR_CHANGE ─resubmit→ RESUBMITTED
  Any non-terminal state → CANCELLED → (reopen) DRAFT
  A material edit to an APPROVED/SCHEDULED post sends it back to RESUBMITTED.
  ```
  - 10 statuses, 14 actions, each action mapped to a required permission (`posts:approve` etc.).
  - "Pending client approval" is **derived** (APPROVED + `requiresClientApproval`), not a new
    status — so old rows kept their meaning when the toggle was added.
  - Users see a friendly **stage** (`stageOf()`), e.g. "Approved · ready to schedule".
- Design files uploaded per post (local disk), versioned; **PPT presentation preview**
  (`lib/posts/presentation-preview.ts`); per-post **discussion notes** with unread tracking.
- Bulk import, calendar view (`/dashboard/calendar`), festival posts.

### 6.2 Approvals
- **Internal:** `ApprovalFlow`, `ApprovalHistory`, multi-stage `ApprovalChain` / `ApprovalStep`
  (current stage index, final status), `ApprovalAttachment`.
- **Proofing:** `ProofAnnotation` / replies — pin comments at x/y **percentage** coordinates on
  an image, resolve them, versioned.
- Pending Approvals page and Designer-Head approval dialog. Approve/reject is audit-logged.

### 6.3 Client share links & client portal
- `ExportLink`: a **256-bit random token** (`crypto.randomBytes(32)`), optional project/client/
  month/postIds scope, status (ACTIVE, CONFIRMED, REVOKED, EXPIRED, CHANGES_REQUESTED),
  `expiresAt`, `revokedAt`.
- Optional **link password** (bcrypt hash) with **brute-force lockout**: failed attempts are
  counted and the link locks for **15 minutes**.
- Clients see a **lookbook** of posts and can **approve or request changes** only on posts that
  are waiting for them (`lib/posts/client-review.ts` is shared by both views and the server).
- Served on a separate share subdomain; middleware blocks every staff route there.
- Document share pages (`/share/document/[token]`), and a logged-in `/client-portal`.

### 6.4 Instagram publishing & insights (`lib/instagram/*`, see INSTAGRAM.md)
- **OAuth connect** via Meta "Instagram API with Instagram Login" (scopes: basic,
  content_publish, manage_insights only). OAuth `state` stored in `SocialOAuthState` (CSRF).
- **Tokens encrypted at rest** with AES-256-GCM under its own key (`INSTAGRAM_TOKEN_KEY`),
  separate from NEXTAUTH_SECRET so rotating one doesn't break the other. Secrets are redacted in logs.
- **Publishing queue** (`InstagramPublishJob`) designed so **a post can never be published twice**:
  1. `postId` is unique → a post can't be queued twice;
  2. workers **claim** a row with a conditional `UPDATE` → exactly one owner;
  3. the Meta **container id is saved before publishing**; a resumed job asks Meta what
     happened to that container instead of starting over.
  - Stale claims reclaimed after 15 min, exponential **backoff** capped at 1 h,
    container polled ~once a minute, Meta publishing **quota** checked.
- **Media rules** validated up front (aspect ratio, video limits, publicly reachable URL —
  `localhost` is refused because Meta downloads the media).
- Jobs: `instagram-publish-queue`, `instagram-insights-sync` (account + media insights),
  `instagram-token-refresh`.

### 6.5 Team chat (`lib/chat/*`, `app/api/chat/**`)
- Conversation types: **DIRECT, GROUP, APPROVAL** (approval threads tied to work).
- Features: messages, edit/delete, **reactions**, **forward**, replies, **read & delivered
  receipts** (per-member `seq` markers), **typing indicators**, **presence**, mute, clear chat,
  group members/roles, group avatars, message info, search, attachments.
- **Real-time via SSE**: one stream per tab; `hub.ts` keeps a map `userId → Set<send>`.
  The DB is the source of truth — messages are written first, events are just delivery;
  a reconnecting client re-reads over REST, so a dropped event costs nothing.
- **Concurrency fix:** MariaDB 11.8 with `innodb_snapshot_isolation=ON` makes an interactive
  transaction fail with **error 1020** if another transaction changed the row after its snapshot.
  Sending a message increments a per-conversation sequence counter (a contended row), and in a
  test **22 of 25 concurrent sends failed**. Fix: run that transaction at **READ COMMITTED**
  (`sendMessage()` in `lib/chat/service.ts`). Idempotent sends return `duplicate: true`.
- **Attachment safety** (`file-rules.ts`): file type detected from **magic bytes**, never the
  filename or Content-Type; extension must agree with bytes; **SVG and HTML are refused**
  (they execute script on our origin); stored names are generated.

### 6.6 Real-time "live refresh" for every module (`lib/realtime/invalidate.ts`)
- The Prisma client is wrapped with `$extends` so **every write** (create/update/delete/*Many)
  calls `noteWrite(model)`.
- Events say only *which models changed* (no ids, no data) → every tab refetches through its own
  permission-checked endpoints, so nothing leaks.
- Rules: publish **after the response** (Next `after()`) so the transaction committed;
  **never publish for writes made during a GET** (prevents refresh loops; middleware stamps the
  method); **coalesce** writes in a 150 ms window (500-row import → 1 event).
  Noisy models (AuditLog, JobRun, chat tables) are excluded.
- Client side: `hooks/use-live-refresh.ts` revalidates SWR keys.

### 6.6a SSE vs WebSockets — why this project uses SSE

**The endpoint:** `GET /api/events` (`app/api/events/route.ts`) opens one stream per tab for
any signed-in user (`requireSession()`). It returns a `ReadableStream` with
`Content-Type: text/event-stream`, writing `event: <type>\ndata: <json>\n\n`. A heartbeat every
**25 s** keeps nginx (60 s idle timeout) from closing it. The stream carries two kinds of traffic:
- **Chat events**, sent only to members of that conversation. The hub filters at the source, so
  opening the stream grants no chat access.
- **Invalidations** ("these models changed"), sent to everyone with no data.

**Difference between them**

| | SSE (Server-Sent Events) | WebSockets |
|---|---|---|
| Direction | **One way**: server → browser | **Two way**, full duplex |
| Protocol | Plain HTTP; the response stays open (`text/event-stream`) | HTTP handshake, then *upgrade* to the `ws://` / `wss://` protocol |
| Payload | Text only (we send JSON) | Text or binary |
| Reconnect | **Built in**: `EventSource` reconnects automatically | Write it yourself or use a library (Socket.IO) |
| Browser API | `new EventSource(url)` | `new WebSocket(url)` + your own message protocol |
| Auth | Normal cookies/session like any request | Cookies on handshake; auth usually hand-rolled |
| nginx / proxies | Normal HTTP; disable buffering, keep alive | Needs `Upgrade` / `Connection` headers |
| Server needs | Any HTTP server that can stream | A WS server; Next.js route handlers can't host one natively → separate process |
| Best for | Notifications, feeds, "data changed", chat delivery | Games, live cursors, high-frequency two-way traffic |
| Limit | ~6 connections per domain on HTTP/1.1 (none on HTTP/2) | No such limit |

**Why SSE here** (reason is in the route's own comment):
1. **Traffic is mostly server → client** (new messages, typing, receipts, presence,
   invalidations). Client → server actions (send message, react, typing ping) are ordinary POSTs.
2. **Security comes free:** every action is a normal API route with the same auth, permission
   check, zod validation, rate limiting and audit logging as the other 238 routes. WebSockets
   would need a second channel with its own auth and validation.
3. **No extra infrastructure:** App Router route handlers can stream, so it runs in the same
   process. No second server, no new dependency, simpler nginx — matters on a 1-vCPU VPS.
4. **Simple recovery:** `EventSource` reconnects itself; the DB is the source of truth, so after
   a reconnect the client re-reads what it missed over REST. A lost event costs nothing.

**Honest trade-off:** the hub (`lib/realtime/hub.ts`) is in one process's memory, so the app runs
as a single PM2 instance. Scaling out means Redis pub/sub behind the same `publish()` — which
WebSockets would need too, so it isn't a reason to choose them.

**When WebSockets would be right:** Figma-style live cursors / co-editing on the canvas, where
many tiny updates flow both ways every second.

**Interview one-liner:** "Our real-time traffic is mostly server-to-client, so SSE gave us push
over plain HTTP with built-in reconnect and no extra server. Client actions stay normal POSTs, so
every action goes through the same auth and validation as the rest of the API."

### 6.7 Canvas & Mood Boards (`lib/canvas/*`, `components/canvas/*`, `app/api/canvases/**`)

**What a mood board is for:** the *visual creative brief* of a campaign — colours, fonts,
reference images, do's and don'ts — in one place, so designers, managers and the client agree
on direction before any post is designed (fewer revision rounds).

**What it is built with:** **no canvas/whiteboard library** (no Fabric.js, Konva, Excalidraw,
tldraw) and no HTML `<canvas>`. It is plain **React + absolutely positioned `div`s + one CSS
transform + Pointer Events**.

| Piece | File | Job |
|---|---|---|
| Editor | `components/canvas/canvas-editor.tsx` | Pan, zoom, drag, resize, keyboard, saving |
| Element renderer | `canvas-element-view.tsx` | Draws image / text / note / swatch… |
| Panels | `canvas-inspector.tsx`, `canvas-panels.tsx` | Edit selected element; comments, members, activity |
| List / create | `canvas-list.tsx`, `create-canvas-dialog.tsx` | Choose Canvas or Mood board |
| Campaign link | `linked-boards.tsx` | Shows a campaign's mood boards on its post pages |
| Validation | `lib/canvas/schema.ts` | Strict zod schema per element type |
| Access | `lib/canvas/access.ts` | Who may read / edit / delete / share |
| DB | `Canvas`, `CanvasElement`, `CanvasMember`, `CanvasComment`, `CanvasActivity` | Storage |

**Data model**
- `Canvas`: title, `kind` (CANVAS | MOODBOARD), background colour, `version`, optional link to a
  client, project (campaign) or post.
- `CanvasElement`: `type` (IMAGE, TEXT, HEADING, NOTE, COLOR, LINK, SECTION) + `x, y, width,
  height, z` + `data` JSON whose shape depends on type (text + font size/colour/alignment, hex
  colour, image upload key *or* web URL, etc.). SECTION is a titled coloured frame grouping elements.

**Mood board = canvas + template.** Creating a `MOODBOARD` also inserts `moodboardElements()`:
9 coloured SECTION frames in a grid — Campaign theme & concept, Visual direction, Colour palette,
Typography, Image inspiration, Design references, Creative style, Content inspiration,
Notes & instructions — each with a hint note. A CANVAS starts empty. Everything else is identical.

**How the editor works**
1. **Pan & zoom with one transform.** State `view = { x, y, scale }`; all elements live inside one
   `div` with `transform: translate(x,y) scale(s)`. Panning/zooming changes only that value → GPU
   composited, smooth. Zoom 20 %–300 %; Ctrl/⌘ + wheel or trackpad pinch zooms **around the cursor**
   (`x' = cx − (cx − x)·k`); plain wheel pans. Dotted grid scales with zoom. "Fit to content"
   computes the bounding box and picks the scale.
2. **Elements** are `position:absolute` divs with `left/top/width/height` from the DB and
   `zIndex` from `z`.
3. **Drag / resize** with Pointer Events + `setPointerCapture` (one code path for mouse, touch,
   pen). Movement is divided by `scale` so dragging feels right at any zoom. Empty space pans,
   element moves, corner handle resizes.
4. **Keyboard / a11y:** Tab between elements, arrows nudge 1 px (Shift = 10 px), Delete asks to
   confirm, Esc deselects; zoom buttons have aria-labels.

**Saving**
- **Optimistic UI:** screen updates instantly, save runs in the background.
- Move/resize saved **once on pointer-up**, all moved elements in one
  `PATCH /api/canvases/:id/elements` (not on every mouse-move).
- Text edits **debounced 600 ms** → one PATCH per burst of typing.
- Header shows Saving… / Saved / error; on failure it refetches so you never see an unsaved state.
- Leaving the page flushes pending text with `fetch(..., { keepalive: true })`; `beforeunload`
  warns while a save is in flight.
- `Canvas.version` increments on board changes so stale writes can be detected.

**Collaboration**
- Uses the app-wide SSE live refresh: `useLiveRefresh(..., ["CanvasElement","Canvas","CanvasMember"])`
  → when someone else saves, open boards refetch via SWR.
- It **won't refetch mid-drag**, and elements you changed but haven't saved yet (a `dirty` set)
  keep your local version.
- So it is **near-real-time sync after each save**, *not* Figma-style live cursors or
  simultaneous typing in one element. Path to that: WebSockets + a CRDT such as **Yjs**.

**Security**
- `data` is JSON rendered in other users' browsers → **strict zod per type** (`.strict()` rejects
  unknown fields), links must be **http/https** (blocks `javascript:` / `data:` XSS), hex-only
  colours, coordinates capped at ±20 000, text lengths capped.
- Images: stored in **private storage** (not `public/`), type checked from file bytes
  (JPG/PNG/GIF/WebP, ≤ 15 MB), served by `/api/canvases/:id/images` only after an access check,
  `Cache-Control: private`.
- Access = permission (`canvas:read/update/delete/share`) **plus** role on the board (OWNER,
  EDITOR, VIEWER, or derived PLANNER for roles that plan all content). Client contacts see only
  boards shared with them. Every change logged to `CanvasActivity`.
- Also: comments, members, duplicate board.

**Interview one-liner:** "The canvas is a custom React editor with no canvas library — absolutely
positioned divs inside one container that pans and zooms with a single CSS transform, Pointer
Events for mouse, touch and pen with zoom-corrected deltas, optimistic updates saved in a batch on
pointer-up and debounced for text, strict zod validation because the JSON is rendered in other
users' browsers, and SSE live refresh that never overwrites what you're editing. A mood board is
the same editor seeded with a 9-section creative-brief template."

### 6.8 Tasks, Daily Plan, Personal Todos, My Day
- `Task` (TODO, IN_PROGRESS, BLOCKED, DONE, CANCELLED; priorities), overdue reminders at
  1/3/7/14 days.
- `DailyTodo` + `TodoBlocker` (categorized blockers) → automated **end-of-day report** emailed to
  each person's reporting manager.
- `PersonalTodo` private list; `/dashboard/my-day` page; work queue API.

### 6.9 CRM: Leads, Clients, Contracts
- **Leads pipeline:** NEW → CONTACTED → QUALIFIED → PROPOSAL_SENT → WON / LOST, with
  `LeadActivity` timeline; won leads convert to clients (`convert` action).
- **Clients:** `Client`, `ClientCompany`; per-client posts, credentials count, contacts.
- **Contracts & SOW:** DRAFT, ACTIVE, EXPIRING_SOON, EXPIRED, TERMINATED, RENEWED.

### 6.10 Finance: Companies, Quotations, Invoices, Payments, Expenses
- `lib/finance.ts` = **one money/tax engine** for quotations and invoices so they can never
  disagree. Rounds to 2 decimals at each boundary (kills float residue like 0.1*3).
- **GST**: `CGST_SGST` (split half/half, intra-state) or `IGST` (inter-state); discount → taxable → tax → total.
- **Quotation** status machine: DRAFT → SENT → ACCEPTED/REJECTED/EXPIRED → CONVERTED (to invoice).
- **Invoice** status: DRAFT, SENT, PARTIAL, PAID, OVERDUE, CANCELLED; `Payment` records with
  methods, payment summary and overdue detection; document numbering (`lib/document-number.ts`).
- **Expenses** by category (software, freelancers, ad spend, shoots, travel, hardware, payroll…)
  → **profitability / margin reports** (`/api/reports/profitability`).
- `npm run check:finance` compiles and runs a self-check of the engine.

### 6.11 HRMS / Recruitment (`lib/hrms/*`)
- ATS: `HrmsJobOpening`, `HrmsCandidate`, `HrmsApplication` (pipeline), candidate activity,
  `HrmsInterview` with multiple interviewers.
- **Offer letters:** letterheads, offer templates with a **placeholder engine**
  (`{{candidate.name}}`, `{{offer.annualCtc}}`…), offer revisions, PDF generation, onboarding.
- Employee documents (`UserDocument`), shareable document links.

### 6.12 Attendance & Leaves
- `Attendance` sources: API, MANUAL, **BIOMETRIC**, SYSTEM. **Device sync** via a pluggable
  provider (`attendance-provider.ts`), sync log per batch, **CSV import**.
- Shifts, weekly-off patterns, holidays, daily status engine (present/half-day/late etc.).
- **Regularization** requests (PENDING → approved/rejected).
- Leaves: `LeaveType`, `LeavePolicy`, `LeaveBalance`, **`LeaveLedger`** (every credit/debit),
  `LeaveRequest`, **comp-off**, balance adjustments.

### 6.13 Payroll (`lib/payroll/*`) — Indian statutory payroll
- **Pure, deterministic calculation engine** (`calculation-engine.ts`); money in **paise**
  (minor units) to avoid float errors.
- Salary components (earnings/deductions, fixed/percentage calculations), structures &
  templates, **salary revisions**, adjustments, **loans/advances with installments**.
- **Statutory defaults (India):** PF 12% employee; employer 3.67% EPF + 8.33% EPS + EDLI/admin,
  PF wage ceiling ₹15,000; ESI 0.75% / 3.25% under ₹21,000; **Professional Tax slabs**
  (₹175 / ₹200, ₹300 in February). Config is versioned in `StatutoryConfig`.
- **Payroll run lifecycle:** DRAFT → CALCULATED → UNDER_REVIEW → APPROVED → PAID → LOCKED,
  with a **readiness check** before running and `PayrollAuditLog`.
- Outputs: payslips (custom **payslip templates**, PDF), **PF ECR file** (EPFO `#~#` format),
  **ESI monthly return**, **PT summary**, **TDS 24Q** summary, **bank transfer files**
  (HDFC / ICICI / SBI / generic), **accounting journal export**.
- **Full & Final settlement** (FnF) for leaving employees; employee self-service.
- Phase-wise self-check scripts (`phase2..5.check.ts`, `engine.check.ts`).

### 6.14 Credentials vault (`lib/credentials/*`)
- Stores client logins (social accounts, hosting, etc.).
- **AES-256-GCM** with its own key (`CREDENTIALS_ENCRYPTION_KEY`, ≥32 chars); format
  `cv1:<iv>:<tag>:<ciphertext>`; the field name (`password` / `notes` / `smtp`) is bound as
  **GCM additional authenticated data**, so ciphertexts can't be swapped between fields.
  Tampered/wrong-key values **throw** instead of displaying garbage.
- Replaced an older design (CBC, key derived from NEXTAUTH_SECRET with a hardcoded fallback,
  returned ciphertext as the password on failure). A **reseal script** upgrades legacy rows.
- UX/security: revealing a password requires **re-entering your own password**, auto-hides
  after 30 s; copied passwords **auto-clear from the clipboard after 30 s**; spreadsheet export
  deliberately omits passwords; bulk import is validated and audit-logged.
- SMTP passwords were moved into the same vault and removed from API responses.

### 6.15 Notifications, email, audit
- `Notification` (in-app), email via nodemailer with React templates; SMTP config per sender
  (`SmtpDetails`), test-connection, comment/customer emails.
- `AuditLog` (`lib/audit.ts`) for permission changes, deletes, approvals; client IP from
  `clientIp()` which takes the **last** `X-Forwarded-For` hop (the one our proxy added) so it
  can't be spoofed by the client.
- `UserActivity`, `UserMetrics` → designer performance & delay reports.

### 6.16 Scheduled jobs (`lib/jobs/*`, `scripts/cron-job.js`)
- Registry of jobs (code defines *what*; DB defines *when / who / on-off*):
  `eod-todo-report`, `overdue-task-reminders`, `instagram-publish-queue`,
  `instagram-insights-sync`, `instagram-token-refresh`, `daily-designer-report`, `daily-delay-report`.
- Admins edit cron expression, timezone, recipients (auto = holders of a permission, or a
  manual list) in **Settings → Scheduled jobs**; history in `JobRun`.
- The supervisor process polls the app every minute and reconciles its node-cron tasks —
  **no deploy or restart to change a schedule**. Authenticated with `CRON_SECRET`; it holds
  no DB credentials, so jobs run the exact same code path as the UI.

### 6.17 Other modules
- **Users** (create/invite, role change, deactivate — **users are never deleted**, because
  deletion would cascade away payroll/attendance records an agency must keep),
  **Profile**, **Reports** (metrics, roles, profitability), **Festivals** calendar,
  **Shoot events**, **Utilities**, **Documents**, **Dashboard** home.

---

## 7. Data model highlights (`prisma/schema.prisma`, 108 models)

| Area | Main models |
|---|---|
| Identity / RBAC | User, Role, Permission, RolePermission, Invite, PasswordReset |
| Delivery | Project, ProjectStrategy, Post, PostPlatform, PostAssignment, PostStatusChange, Asset, Comment |
| Approvals | ApprovalFlow, ApprovalHistory, ApprovalChain, ApprovalStep, ApprovalAttachment, ProofAnnotation(+Reply) |
| Client-facing | Client, ClientCompany, ExportLink |
| CRM / Finance | Lead, LeadActivity, Contract, Company, Quotation(+Line), Invoice(+Line), Payment, Expense |
| HR | HrmsJobOpening, HrmsCandidate, HrmsApplication, HrmsInterview, HrmsOffer(+Revision), HrmsOnboarding, UserDocument |
| Attendance / Leave | Attendance, AttendanceRegularization, AttendanceSyncLog, Shift, WeeklyOffPattern, Holiday, LeaveType/Policy/Balance/Ledger/Request, CompOff |
| Payroll | SalaryComponent, SalaryStructure(+Template/Item), SalaryRevision, StatutoryConfig, PayrollSettings, PayrollRun, Payslip(+Line), LoanAdvance(+Installment), FullAndFinalSettlement, PayrollPayment, PayrollAuditLog |
| Collaboration | Conversation, ConversationMember, ChatMessage, ChatAttachment, ChatReaction, ChatReceiptMark, Canvas, CanvasElement/Member/Comment/Activity, Task, DailyTodo, TodoBlocker, PersonalTodo, Notification |
| Social | SocialAccount, SocialOAuthState, InstagramPublishJob, InstagramAccountInsight, InstagramMediaInsight |
| System | AuditLog, SmtpDetails, Credential, ScheduledJob, JobRun, UserActivity, UserMetrics |

**Data rules:** child rows cascade-delete with their parent (`onDelete: Cascade`); `User` is
the exception (deactivate via `isActive`). Contended counters use READ COMMITTED transactions.
Lists are paginated server-side; relations fetched with `include/select` to avoid N+1.

---

## 8. Security summary (talking points)

1. Every API route **authenticates then authorizes**; only `api/auth/**`, `api/share/**`
   (token-auth) and public upload reads skip it.
2. Roles/permissions and `isActive` read **from the DB per request**, not from the JWT.
3. **Session revocation** on password change via `authTime` vs `passwordChangedAt`.
4. **bcrypt** passwords; no plaintext fallback.
5. **zod** validation at the boundary; reject unknown fields.
6. **AES-256-GCM** vaults with separate keys per purpose (credentials, Instagram tokens) and AAD binding.
7. Share tokens = credentials: 256-bit, expiry, revocation, optional password, lockout.
8. Upload safety: magic-byte detection, no SVG/HTML, generated filenames, path-traversal-safe deletes (`lib/storage.ts`).
9. Spoof-resistant client IP for rate limits and audit logs.
10. OAuth `state` for Instagram; secrets only server-side (never `NEXT_PUBLIC_*`).
11. Audit log for sensitive actions.

---

## 9. Deployment & operations (DEPLOY.md, ecosystem.config.js, deploy/nginx)

- **VPS**, domain `internalagencyos.itsmedigital.in`, app dir under `/var/www/...`.
- **nginx** proxies everything (nothing static), `client_max_body_size 100M`, SSE-friendly config.
- **PM2** two processes:
  - `itsmedezinoagencyerp` — `next start` on port **3008**, **fork mode, 1 instance**
    (Prisma opens a pool per worker; a 1-vCPU box gains nothing from cluster mode, and the
    in-memory SSE hub / rate limiter assume one process). Memory restart at 1 GB.
  - `itsmedezinoagencyerp-cron` — the job supervisor (256 MB cap, capped restarts).
- `cwd` must be the app dir because uploads resolve via `process.cwd()`.
- `build:vps` sets `--max-old-space-size=1024` for low-RAM builds.
- Schema sync with `prisma db push` (no migrations) — dangerous against a shared DB, documented.
- Replaced an older **NestJS + React/Vite** stack, which keeps running side-by-side on its own domain.
- **Scaling path** (honest answer): move the SSE hub and rate limiter to **Redis pub/sub**,
  uploads to object storage (S3), then run multiple instances behind the load balancer.

---

## 10. Testing & quality

| Command | What it tests |
|---|---|
| `npm run test:workflow` | Post state machine (pure rules) |
| `npm run test:workflow:api` | Post workflow end-to-end against the API |
| `npm run test:features:api` | Feature batch E2E |
| `npm run test:presentation` | PPT preview logic |
| `npm run test:credentials` | Vault seal/open, tamper detection, cron SMTP opener |
| `npm run test:ip` | `clientIp()` proxy-hop parsing |
| `npm run check:finance` / `check:instagram` / `check:chat` | Compile + run self-checks for money engine, token vault & media rules, chat file rules |
| `npx tsc --noEmit`, `npm run lint` | Type-check & lint (the build is configured not to fail on these — run them yourself) |

---

## 11. Engineering challenges & how they were solved (STAR-ready)

1. **Concurrent chat sends failing (MariaDB error 1020).** Snapshot isolation made 22/25
   concurrent sends fail on the per-conversation counter → used READ COMMITTED for that
   transaction → all succeed, ordering preserved by `seq`.
2. **Never double-post to a client's Instagram.** No idempotency key at Meta + two-step
   protocol → unique postId, atomic claim via conditional UPDATE, persist container id before
   publish, resume by querying Meta.
3. **Live updates across 30+ modules without touching every route.** Hooked the single
   Prisma client; model-only events after commit, coalesced, skipped for GETs.
4. **Fine-grained permissions without breaking existing roles.** Catalog with legacy-name
   mapping + baseline flag → additive migration; DB-read roles so changes apply instantly.
5. **Insecure legacy credential storage.** Migrated from CBC + derived key + hardcoded fallback
   to AES-256-GCM with AAD, dedicated key, fail-closed decrypt, reseal script, reveal-with-password.
6. **Spoofable IPs in audit logs / rate limiting.** Switched to last X-Forwarded-For hop.
7. **Deleted users destroyed payroll history.** Replaced deletion with deactivation enforced
   at both sign-in and every API call (JWTs otherwise outlive the flag).
8. **Changing cron schedules required deploys.** DB-driven job registry + reconciling supervisor.
9. **Indian payroll correctness.** Pure engine in paise, versioned statutory config, generated
   government formats (ECR, ESI, PT, 24Q) and bank files, self-check suites per phase.

---

## 12. Known limitations / honest trade-offs

- Single instance: SSE hub and rate limiter are in-memory (fine for current scale; Redis to scale out).
- Uploads on local disk (`public/uploads/`), not object storage.
- No Prisma migration history (`db push`); baselining needed before `migrate`.
- `next.config.mjs` (per project notes) ignores TS/ESLint errors during build and sets
  `images.unoptimized: true` — type-check and lint must be run separately.
- `lib/export-link.ts` still derives its encryption key from `NEXTAUTH_SECRET` (with a hardcoded
  fallback) for share-link passwords; new secrets go through the GCM vault. Worth migrating.
- Many components are client components; ongoing effort to push `"use client"` to leaves.

---

## 13. Likely interview questions (ask Claude to expand any of these)

1. Walk me through the architecture. Why a Next.js monolith instead of separate frontend/backend?
2. How does authentication work? How do you revoke a JWT session?
3. Explain your RBAC design and how you migrated permissions without breaking roles.
4. How do you prevent IDOR / ensure a user only sees their own data?
5. How does the client share link stay secure without a login?
6. Explain the post approval state machine. Why is "pending client" not its own status?
7. How does real-time chat work? Why SSE and not WebSockets? What happens on reconnect?
8. How does every page update live after a write? How do you avoid refresh loops and data leaks?
9. Describe the MariaDB error 1020 problem and your fix. What are isolation levels?
10. How do you guarantee an Instagram post is published exactly once?
11. How are secrets encrypted? Why GCM over CBC? What is AAD?
12. How do you validate file uploads safely?
13. How does the payroll engine compute PF/ESI/PT? Why store money in paise?
14. How are GST totals calculated and rounded?
15. How are scheduled jobs managed and changed without a deploy?
16. How is it deployed? Why PM2 fork mode with one instance? How would you scale it?
17. What would you improve next? (Redis, S3, migrations, more tests, server components.)
18. Why soft-deactivate users but hard-delete everything else?
19. How do you test pure business logic vs the API?
20. What was the hardest bug you fixed in this project?
21. What is the difference between SSE, WebSockets and polling? When would you switch to WebSockets?
22. How did you build the canvas without a library? How do pan, zoom-around-cursor and drag-at-any-zoom work?
23. How does the canvas save without sending a request on every mouse move or keystroke?
24. How do two people editing the same board avoid overwriting each other? How would you make it truly real-time (CRDT / Yjs)?
25. What is a mood board and why does the agency need one?
