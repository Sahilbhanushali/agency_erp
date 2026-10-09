---
name: perf-audit
description: Find and fix what makes this Next.js app slow — client/server component boundaries, request waterfalls, N+1 Prisma queries, unbounded lists, oversized images and bundle weight. Use when a page or endpoint feels slow, when the user says "performance", "slow", "optimize", "N+1", "bundle size", "too many requests", or before shipping a data-heavy screen.
---

# Performance in this repo

Next.js 15 App Router, Prisma + MySQL, SWR on the client. Measure before changing: find the
actual cost, then fix that. Do not scatter `useMemo` and call it optimization.

## 1. Server/client boundary — the biggest win here

**100 of 147 components carry `"use client"`.** That ships React, handlers and libraries to the
browser for UI that often only renders data.

- Default to a Server Component. Reach for `"use client"` only for state, effects, event
  handlers or browser APIs — then push it to the smallest leaf.
- A common fix: keep the page a server component that fetches and renders, and extract just
  the interactive bit (a dropdown, a dialog) into a small client child.
- A client component that only reads data should take it as props from a server parent instead
  of re-fetching it with SWR.
- Never import a server-only module (Prisma, `fs`, secrets) into a client component.

## 2. Request waterfalls

- Independent awaits run in parallel: `const [a, b] = await Promise.all([...])`.
- A client component fetching on mount costs an extra round trip after hydration — fetch on
  the server when the data isn't user-interactive.
- Two components fetching the same thing = two requests. Lift the fetch, or share one SWR key.
- Don't `await` inside a loop over ids.

## 3. Database

- **N+1**: any `await` inside `.map()`/`for` over rows. Replace with one query using
  `include`/`select`, or a single `findMany({ where: { id: { in: ids } } })`.
- `select` only the columns rendered. `Post`, `Asset` and `ApprovalHistory` rows are wide —
  don't pull blobs and notes to render a list.
- **Unbounded `findMany`** on a growing table (posts, assets, audit logs, notifications) is a
  time bomb. Paginate with `take`/`skip` or a cursor, and return a total.
- Aggregate in SQL — `count`, `groupBy`, `_sum` — not by loading rows and reducing in JS.
- Filter and sort in the query, not in JavaScript after fetching everything.
- Indexes: a `where`/`orderBy` on an unindexed column will table-scan. Check
  `prisma/schema.prisma` for `@@index` before adding a new filter to a hot list.

## 4. Images and assets

- `next/image` with width/height. Note `images.unoptimized: true` in `next.config.mjs` means
  no resizing or format conversion happens — an 8MB upload renders as 8MB. Flag that, and
  resize on upload if a screen shows many at once.
- Uploads live on local disk under `public/uploads/`; many per page means many requests.
- Icons come from `lucide-react` as named imports — never import whole icon sets.

## 5. Bundle

- Check what a heavy page pulls in: `recharts`, `xlsx`, rich text editors and PDF tooling are
  all large. Load them with `next/dynamic` at the point of use rather than at module top.
- Prefer `date-fns` function imports over wide ones.

## Method

1. Reproduce and state the symptom concretely (which page, which action, how slow).
2. Find where the time goes — count the queries, count the round trips, look at what's shipped.
   Reading code is enough to spot N+1s and boundary mistakes; say so if you did not measure.
3. Fix the dominant cost first, then re-check. One change at a time.
4. Verify with `npx tsc --noEmit` (`next build` ignores type errors in this repo) and confirm
   the screen still behaves.
5. Report before/after in real terms — queries, requests, bytes, or wall time — and be explicit
   about anything you improved by reasoning rather than measurement.
