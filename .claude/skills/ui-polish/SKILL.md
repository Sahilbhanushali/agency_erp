---
name: ui-polish
description: Bring a page or component in this repo up to a premium, accessible standard — states, hierarchy, consistency, responsive behaviour. Use when building or reviewing UI under app/** or components/**, when the user says "polish", "make it look better", "UX", "design review", "accessibility", "a11y", "responsive", "empty state", "loading state", or reports a screen feeling rough or inconsistent.
---

# UI work in this repo

Tailwind + shadcn/ui on Radix, 51 primitives in `components/ui/`, `lucide-react` icons.
Compose from what exists; a new primitive is a last resort, a new dependency needs approval.

## Every screen owes four states

Build all four before calling a screen done:

- **Loading** — skeletons that match the real layout, so nothing jumps when data lands.
  Reserve space for images and avatars.
- **Empty** — say what this is and what to do next, with the action right there. Never a bare
  "No data".
- **Error** — what failed, and a way to retry. A silent `.catch()` that leaves an empty list
  is a bug: the user cannot tell broken from empty.
- **Success/populated** — the real thing, dense but readable.

Also cover per-control states: hover, focus-visible, active, disabled, and in-flight
(a submit button must disable and show progress, or double-submits happen).

## Hierarchy and consistency

- One obvious primary action per view; everything else is secondary or ghost.
- Reuse the existing heading sizes, spacing scale and radii. If a value isn't already used
  nearby, you are probably inventing one.
- Semantic headings (`h1` → `h2` → `h3`) in order. Don't pick a heading tag for its size.
- Status colors carry meaning consistently across the app — the same state must not be amber
  on one screen and sky on another.
- Numbers, dates and currency formatted the same way everywhere (`date-fns` is installed).
- Tables: right-align numbers, keep row actions in one predictable place, never restart row
  numbering per page.

## Accessibility — not optional

- Every input has a real `<label>` tied by `htmlFor`/`id`.
- Every icon-only button has `aria-label` naming the action and its target.
- Keyboard: tab order matches visual order, focus ring always visible, nothing traps focus,
  Escape closes overlays (Radix gives you this — don't fight it).
- WCAG AA contrast: 4.5:1 text, 3:1 UI edges. Light grey on white fails.
- Nothing below 12px. No meaning conveyed by color alone — pair it with text or an icon.
- Respect `prefers-reduced-motion`; animation is feedback, not decoration.

## Responsive

Check phone, tablet and desktop — don't just shrink the desktop layout.

- A wide table becomes stacked cards or a horizontally scrollable region with a sticky first
  column, never a squashed grid.
- Dialogs become full-height sheets on small screens.
- Touch targets ≥ 44px; 16px side gutters; no horizontal page scroll.
- Truncate with intent (`truncate`, `line-clamp-*`) and keep the full value in a `title`.

## Forms

react-hook-form + zod resolvers. Field-level errors inline next to the field — a toast alone
hides which field is wrong. Validate on submit, not on every keystroke. Keep labels visible
(placeholders are not labels). Destructive confirmations name the thing being destroyed.

## Performance of the UI itself

- `"use client"` only where interactivity truly lives, pushed to the smallest leaf. 100 of 147
  components in this repo are client components — don't add to that casually.
- `next/image` with explicit dimensions. Note `images.unoptimized: true` is set in
  `next.config.mjs`, so large source images ship as-is — flag oversized assets.
- Don't render thousands of rows; paginate or virtualize.

## Reviewing a screen

Report findings as: **what's wrong → why it matters to the user → the concrete fix**, ordered
by user impact. Separate "this is broken" from "this is taste". Never claim you checked
something visually unless you actually rendered it — if you only read the code, say so.
