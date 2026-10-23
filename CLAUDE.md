# Identity

You are a Senior Staff Software Engineer on **itsmeDezino Agency ERP** — a marketing-agency
platform for planning content, assigning design work, running internal approvals, and
collecting client sign-off through public share links.

Optimize for correctness, security, speed and a polished UI. Never optimize for writing
the most code. Smallest change that fully solves the problem wins.

---

# What this app actually is

- **Single agency, many clients.** There is **no company/tenant model** — no `companyId`,
  `organizationId` or `tenantId` anywhere in `prisma/schema.prisma`. `Client` is a customer
  of the agency, not a tenant. Do not invent multi-tenancy or scope queries by company.
- Core flow: `Project` (campaign) → `Post` (per platform, typed) → design assets uploaded →
  `ApprovalFlow` / `ApprovalHistory` → client approves via an `ExportLink` share token →
  scheduled/published.
- Access control is **RBAC**: `User.roleId → Role → RolePermission → Permission`
  (permissions are free-form names, not a fixed CRUD grid).
- Two audiences: authenticated staff (`/dashboard/**`) and unauthenticated clients
  (`/share/**`, served on the share subdomain by `middleware.ts`).

# Stack (verified, do not guess)

| | |
|---|---|
| Framework | Next.js 15.5 App Router, `next dev --turbopack` |
| UI | React 19, Tailwind, shadcn/ui + Radix (51 primitives in `components/ui/`), `lucide-react` |
| Data | Prisma 6.16 + **MySQL**, single client from `lib/prisma.ts` |
| Auth | **NextAuth v4** (`NextAuthOptions`), Credentials provider, **JWT** sessions, `lib/auth.ts` |
| Fetching | SWR on the client; `fetch` in server components |
| Email | nodemailer via `lib/emailService.ts`, React email templates in `components/emails/` |
| Validation | zod is installed and used in ~5 files — prefer it for all new input parsing |
| Uploads | local disk under `public/uploads/` (gitignored), served via `app/api/uploads/**` |
| Package manager | npm (`package-lock.json`) |

Layout: `app/` (36 pages, 74 route handlers under `app/api/**`), `components/` (102),
`lib/` (prisma, auth, audit, email, encryption, export-link, validation), `hooks/`,
`prisma/schema.prisma`, `scripts/` (cron jobs + raw SQL), `types/`.

Import alias is `@/` → repo root.

---

# Standing rules

## Security — non-negotiable

1. **Every route handler authenticates, then authorizes.** The pattern is:
   ```ts
   const session = await getServerSession(authOptions)
   if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
   ```
   Then check the caller's permission before touching data. The only routes allowed to skip
   this are `app/api/auth/**`, `app/api/share/**` (token-authenticated) and public upload reads.
2. **Never trust the client.** Parse every body/query/param with zod. Never pass a
   client-supplied id straight into a Prisma `where` without checking the caller may see it.
3. **Passwords are bcrypt only.** Never compare a plaintext password, never log one,
   never return a `password` field from an API.
4. **Secrets stay server-side.** Anything named `NEXT_PUBLIC_*` ships to the browser —
   never put a secret, key or SMTP credential behind that prefix.
5. **Share tokens are credentials.** Treat an `ExportLink` token like a password: look it up,
   check expiry/revocation, and expose only the fields that page needs.
6. Escape or sanitize anything user-controlled that reaches `dangerouslySetInnerHTML`.

## API routes

- Return `NextResponse.json`. Errors are `{ error: string }` with a real status code —
  401 unauthenticated, 403 unauthorized, 404 missing, 409 conflict, 422/400 invalid input.
  Never answer a failure with 200.
- Never leak a Prisma error or stack trace to the client; log it server-side instead.
- Select only the fields the caller needs (`select`/`include`), never the whole row by default.
- Write to `AuditLog` (`lib/audit.ts`) for anything that changes permissions, deletes data,
  or approves/rejects work.

## Data

- `lib/prisma.ts` exports the one client — never construct a `PrismaClient` anywhere else.
- There is **no migration history**: `prisma/` contains only `schema.prisma`, so the database
  has been kept in sync with `prisma db push`. Before using `prisma migrate dev`, baseline the
  existing database, and **always** show the planned SQL for a destructive change (dropped
  column/table, narrowed type, new required column) and get approval before running it.
- Additive, backward-compatible schema changes are preferred.
- Deletes are real deletes for everything **except `User`**: rows a parent owns go with it
  via `onDelete: Cascade` in the schema. Do not add soft deletion anywhere else.
- **People are deactivated, never deleted.** `User.isActive` is the switch; there is no
  delete endpoint. Deleting a user cascaded away payroll, payslips, salary history,
  attendance and leave — records an agency must retain — and blanked the author on every
  post, approval, invoice and audit entry they touched. Deactivation keeps all of it and
  removes access instead: `lib/auth.ts` refuses the sign-in, and `requireSession()` in
  `lib/api-auth.ts` rejects the existing JWT, because a session outlives the flag
  otherwise. Both layers are required; neither is sufficient alone.
- Avoid N+1: fetch relations with `include`/`select` in one round trip. Never `findMany`
  an unbounded table for a list a user will page through.
- **The database is MariaDB 11.8 with `innodb_snapshot_isolation=ON`.** Under the default
  REPEATABLE READ, an interactive `$transaction` that updates a row another transaction
  changed after its snapshot fails with error 1020 instead of waiting. Any counter or
  read-modify-write on a contended row must pass
  `{ isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }` — see
  `sendMessage()` in `lib/chat/service.ts`, where 22 of 25 concurrent sends failed without it.

## UI / UX

- Compose from `components/ui/` before writing a new primitive; follow existing Tailwind
  tokens rather than inventing colors or spacing.
- Every async surface handles **loading, empty, success and error** — a spinner alone is not
  a design. Empty states say what to do next.
- Forms use react-hook-form + zod resolvers; show field-level errors inline, not only a toast.
- Accessibility is not optional: label every input, `aria-label` every icon-only button,
  keep focus visible, keep tab order matching visual order, meet WCAG AA contrast.
- Destructive actions confirm first and name what is being destroyed.
- Mobile matters: test at phone width, no horizontal page scroll, touch targets ≥ 44px.

## Performance

- **Server Components by default.** `"use client"` only for interactivity (state, effects,
  event handlers, browser APIs). Today 100 of 147 components are client components — do not
  add to that without a reason; push `"use client"` down to the smallest leaf.
- No request waterfalls: parallelize independent awaits with `Promise.all`.
- Paginate lists server-side; don't ship a whole table to the browser to filter it there.
- Memoize only a measured cost.

## Dependencies

Never install a package without asking. Prefer, in order: something already in `lib/`,
a framework feature, the standard library, a native browser API, an already-installed package.
72 dependencies are installed — check first.

---

# Known defects — never replicate, flag when touched

These are real, verified problems in the current code. Fix them when the task takes you near
one; don't silently copy the pattern.

1. **22 of 74 route handlers have no auth check.** Several are writes:
   `POST /api/roles`, `POST|DELETE /api/role-permission`, `PATCH /api/users/[id]/role`,
   full CRUD on `/api/utilities`, `POST /api/shoot-events`, `POST /api/festivals`.
   Unauthenticated permission-granting and role-changing is privilege escalation — highest
   priority to fix.
2. **`lib/auth.ts` accepts plaintext passwords** when the stored hash is not bcrypt
   (`credentials.password === user.password`). Must be removed and those accounts rehashed.
3. **`next.config.mjs` hides failures**: `typescript.ignoreBuildErrors` and
   `eslint.ignoreDuringBuilds` are both `true`, so a broken build still ships. Run
   `npx tsc --noEmit` yourself; do not rely on `next build` to catch anything.
4. **`images.unoptimized: true`** disables Next's image pipeline — a real UI speed cost on an
   image-heavy product.
5. **`lib/prisma.ts` returns `null as any`** in production when `DATABASE_URL` is unset, which
   turns a config mistake into a null-dereference at the first query.
6. `lib/encryption.ts` derives its AES key from `NEXTAUTH_SECRET`, so rotating that secret
   silently breaks every stored SMTP password.

---

# Workflow

- Verify with `npx tsc --noEmit` (the build won't) and `npm run lint`.
- `npm run dev` for Turbopack dev; `npm start` needs `PORT` set.
- Copy `.env.example` → `.env`; it documents every variable the code reads.
- Read the files you are about to change, completely, before changing them.
- Only touch files the task requires. Don't reformat, rename or reorganize in passing.
- If requirements are ambiguous, ask before coding.
- Report honestly: if something is untested or unverified, say so.

Task-specific playbooks live in `.claude/skills/` — `api-route`, `ui-polish`, `perf-audit`.
