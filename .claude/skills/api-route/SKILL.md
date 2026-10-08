---
name: api-route
description: Write or review a Next.js route handler in this repo so it is authenticated, authorized, validated and safe. Use when adding, changing or auditing anything under app/api/**, when a route touches roles/permissions/users/share tokens, or when the user says "API route", "endpoint", "secure this route", "auth check", "403", "401", or "audit the API".
---

# Route handlers in this repo

74 handlers live under `app/api/**/route.ts`. **22 of them currently have no auth check at
all**, including `POST /api/roles`, `POST|DELETE /api/role-permission` and
`PATCH /api/users/[id]/role` — anonymous privilege escalation. Assume the surrounding code is
not a safe template. Follow this instead.

## The order of checks — never reorder

1. **Authenticate**
   ```ts
   const session = await getServerSession(authOptions)
   if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
   ```
2. **Authorize** — does this specific user hold the permission this action needs?
   Resolve through `User.roleId → Role → RolePermission → Permission`. A 401 is not a
   substitute for a 403: being logged in is not permission to change roles.
3. **Validate** — parse the body/query with zod before use:
   ```ts
   const parsed = Schema.safeParse(await request.json())
   if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 })
   ```
   `formData()` routes (e.g. `app/api/posts/route.ts`) need the same rigour — every
   `formData.get()` is an untrusted string.
4. **Check ownership/visibility** — a valid id from an untrusted caller is still untrusted.
   Confirm the caller may see or modify that specific record before the write.
5. **Act**, then **audit** — call `lib/audit.ts` for permission changes, deletions and
   approve/reject decisions.

## Responses

| Situation | Status | Body |
|---|---|---|
| not signed in | 401 | `{ error: "Unauthorized" }` |
| signed in, lacks permission | 403 | `{ error: "Forbidden" }` |
| record missing (or not visible to caller) | 404 | `{ error: "Not found" }` |
| invalid input | 422 | `{ error: "...", details? }` |
| conflict (duplicate, FK in use) | 409 | `{ error: "<what blocks it>" }` |
| server fault | 500 | `{ error: "Something went wrong" }` — log the real error server-side |

Never return 200 for a failure. Never return a Prisma error message, SQL or stack trace to
the client — `P2002`, `P2003` and `P2025` should become 409/409/404 with a human sentence.

## Prisma hygiene

- Import `prisma` from `@/lib/prisma`. Never construct a `PrismaClient`.
- `select` or `include` only the fields the response needs. Never return `password`.
- One round trip: fetch relations with `include`, not in a loop. Parallelize independent
  queries with `Promise.all`.
- Paginate anything list-shaped; no unbounded `findMany` on a growing table.
- Multi-step writes that must not half-apply go in `prisma.$transaction`.
- Deletes are real deletes here. Rows owned by a parent should cascade in the schema;
  a delete blocked by a foreign key is a 409 with a message naming what references it.

## Public routes — the only exceptions

`app/api/auth/**` (NextAuth + register/forgot/reset), `app/api/share/**`, and public upload
reads. `share` routes are **token-authenticated**: look the `ExportLink` token up, verify it
has not expired or been revoked, and return only the fields that page renders. A share token
must never reach staff-only data.

## Reviewing an existing route

Walk it in this order and report concrete findings:

1. Is there a session check? Is there a *permission* check beyond it?
2. Could another user's id be passed in and acted on?
3. Is every input parsed, or is a raw string reaching Prisma / the filesystem / an email?
4. Does any response carry fields the caller should not see?
5. Status codes honest? Prisma errors translated?
6. N+1 or unbounded query?
7. Does a privileged mutation write an audit entry?

Finish by stating exactly what you verified and what you could not.
