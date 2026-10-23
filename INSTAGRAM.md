# Instagram publishing & insights

Connects client Instagram accounts, schedules posts to them, and pulls back performance
numbers. Built on **Meta's Instagram API with Instagram Login** — no third-party
scheduling service is involved, and no client ever gives us their password.

---

## Setup checklist

Nothing in this module works until all five steps are done. They are in order.

### 1. Create the Meta app

In the [Meta App Dashboard](https://developers.facebook.com/apps), create an app and add
the **Instagram** product with **Business Login for Instagram**.

Request these three permissions — only these, because Meta reviews each one and asking
for messaging or ads would cost approval time for capability this module never uses:

| Permission | Why |
|---|---|
| `instagram_business_basic` | Identify the connected account |
| `instagram_business_content_publish` | Publish posts |
| `instagram_business_manage_insights` | Read reach, views, engagement |

The connected account must be a **professional** (Business or Creator) Instagram
account. A personal account cannot be published to through any API.

### 2. Register the redirect URI

Add this to the app's **Business login settings → OAuth redirect URIs**, character for
character — Meta rejects anything that does not match exactly:

```
https://<your-domain>/api/social/instagram/callback
```

### 3. Fill in the environment variables

All four are documented in `.env.example`:

| Variable | Notes |
|---|---|
| `INSTAGRAM_APP_ID` | From the App Dashboard |
| `INSTAGRAM_APP_SECRET` | Server-side only. Never `NEXT_PUBLIC_*` |
| `INSTAGRAM_REDIRECT_URI` | Must equal what you registered in step 2 |
| `INSTAGRAM_TOKEN_KEY` | ≥32 chars. Encrypts stored tokens (AES-256-GCM) |

`NEXT_PUBLIC_BASE_URL` must also point at a **publicly reachable** address. Instagram
downloads the media from this server when it publishes, so `localhost` cannot work —
scheduling refuses it up front with an explanation rather than letting it fail at Meta
minutes later.

> **`INSTAGRAM_TOKEN_KEY` is not rotatable in place.** Every stored token is encrypted
> with it. Change it and every client must authorise again. It is deliberately separate
> from `NEXTAUTH_SECRET` for exactly this reason — see "Why not `lib/encryption.ts`".

### 4. Sync the permission catalog

The module adds a `social_accounts` module with `read`/`create`/`update`/`delete`.
**No role is granted these automatically** — there are no legacy aliases, so nothing
silently inherits the ability to publish in a client's name.

Go to **Roles & Permissions**. If the database is behind the catalog a banner appears;
click **Sync catalog**. That creates the permission rows and re-grants ADMIN. Then tick
`social_accounts` for any other role that needs it.

Until this is done the sidebar entries stay hidden, because navigation is built from
`module:read` — the same permission the pages and APIs enforce.

### 5. Check the scheduled jobs

Three jobs are registered in `lib/jobs/registry.ts` and managed from
**Settings → Scheduled jobs**. The cron supervisor (`scripts/cron-job.js`) must be
running, with `CRON_SECRET` set to at least 16 characters.

| Job | Default | What it does |
|---|---|---|
| `instagram-publish-queue` | every minute | Publishes due posts, retries failures |
| `instagram-insights-sync` | every 6 hours | Pulls account and per-post numbers |
| `instagram-token-refresh` | daily 03:15 | Renews tokens before the 60-day window closes |

**The token refresh is load-bearing, not housekeeping.** A long-lived token lasts 60
days and once it lapses it cannot be renewed at all — the client has to authorise again.

---

## How publishing works

Instagram has no idempotency key, and publishing is a two-step protocol: create a
container, then publish it. A worker dying in that gap, or two workers taking the same
row, would put the same creative on a client's feed twice. Three things prevent it:

1. **`postId` is unique** on `instagram_publish_jobs`, so a post cannot be queued twice.
   Re-scheduling updates the existing row.
2. **Claiming is a conditional `UPDATE ... WHERE status = 'PENDING'`**, so exactly one
   worker can take a row. Verified against MySQL: 8 concurrent workers, 1 claim.
3. **The container id is written before publishing is attempted.** A resumed job asks
   Meta what became of that container instead of starting over — a container reporting
   `PUBLISHED` is already live, so the job reconciles rather than publishing again.

A post is only marked published once Meta has returned a media id. "Do not mark content
as published until success has been verified" is the whole point of the queue.

### Job states

`PENDING` → `CLAIMED` → `PROCESSING` → `PUBLISHED`, with `FAILED` and `CANCELLED` as the
other terminal states. A job can be cancelled only while `PENDING`; once a worker owns
it a container may already exist at Meta.

Retries use exponential backoff (2 min, 4, 8, …) capped at one hour, five attempts by
default. Waiting on Meta to transcode does **not** consume an attempt.

---

## Verified API facts

Read from Meta's live documentation, not recalled. Re-check these when bumping
`IG_API_VERSION` (currently pinned to **v26.0** in `lib/instagram/client.ts`).

### Publishing

| | |
|---|---|
| Create container | `POST /<IG_ID>/media` |
| Publish | `POST /<IG_ID>/media_publish` with `creation_id` |
| Container status | `GET /<CONTAINER_ID>?fields=status_code` |
| Rate limit | `GET /<IG_ID>/content_publishing_limit` |

- **JPEG is the only image format Instagram accepts.** PNG and WebP are rejected by
  Meta. Scheduling refuses them up front.
- Containers **expire after 24 hours** if not published.
- Meta recommends polling container status about once a minute, for at most five.
- Carousels take 2–20 children.

### Insights

- **`impressions` is deprecated** for v22.0+ and, since 21 April 2025, for every version
  on media created after 2 July 2024. **`views` replaces it.** Same for `plays`,
  `video_views` and `clips_replays_count` on reels → `views` and
  `ig_reels_avg_watch_time`.
- **Only `reach` supports `metric_type=time_series`.** Everything else collapses any
  date range into a single `total_value`, which is why the sync job walks one day at a
  time — handing it a week would file a week's total under one date.
- Numbers are revised for **up to 48 hours**, so the sync re-reads recent days.
- **Story insights exist for 24 hours** and are then gone from Meta permanently. This is
  why insights are stored in our own tables rather than fetched on page load.
- Accounts under 100 followers omit some metrics. A story seen by fewer than 5 accounts
  returns error code 10. Carousel *children* have no insights. All three are normal and
  are skipped quietly.

### Known contradictions in Meta's own docs

- The rate-limit section says **100** API-published posts per rolling 24 hours; the
  carousel section says **50**. The queue uses whatever cap the account itself reports
  via `content_publishing_limit` and waits rather than guessing.
- The account-insights page lists `follower_type` for `views` but `follow_type` in its
  breakdown section, and uses both `breakdown` and `breakdowns`.

---

## Security notes

- **Tokens never leave the server**, not even encrypted. Every endpoint that returns an
  account uses an explicit `select` that omits `accessTokenEnc`, so no future field
  addition can widen into leaking one. Exactly two routes select it —
  `instagram/refresh-tokens` and `instagram/sync-insights` — and both decrypt it to call
  Meta and return only counts, never an account object.
- **The OAuth callback** burns its state row before exchanging the code, so two
  simultaneous callbacks cannot both proceed. It refuses to move an account that is
  already connected to a different client.
- **Logs are redacted** — `redactSecrets()` strips access tokens, authorization codes
  and the app secret from anything that reaches a log or a stored error message.
- **Publishing controls never render for clients.** The composer is mounted by the
  dashboard post page, not inside `PostDetail`, which is also rendered on the public
  share link and in the client portal. Being absent from that component tree is a
  stronger guarantee than a conditional.

### Why not `lib/encryption.ts`

That helper was unsuitable for these tokens on three counts, so
`lib/instagram/token-vault.ts` exists instead:

1. it derives its key from `NEXTAUTH_SECRET`, so rotating that secret would silently
   break every stored token;
2. it uses unauthenticated AES-256-CBC, which cannot detect tampering;
3. it **returns its input unchanged when decryption fails**, which would hand a
   corrupted ciphertext to Meta as if it were a token.

---

## Verification

```bash
npm run check:instagram   # token vault + publish rules (~45 assertions)
npx tsc --noEmit          # the build does not typecheck; see CLAUDE.md
```

`npm run check:instagram` covers the token vault (round-trip, tamper detection, wrong
key, redaction) and the publish rules (JPEG-only, private-address refusal, carousel
bounds, backoff growth and cap). Neither needs credentials or a database.

---

## Not yet exercised against the live API

Everything here is doc-derived and has **not been run against Meta**. Expect the first
real connection to need adjustment. The two most likely spots:

- **Stories container shape.** Meta's content-publishing page names `media_type=STORIES`
  but never names the media URL parameter for it. `image_url` / `video_url` is the
  consistent shape and what this uses, but it is the one call that could not be
  confirmed verbatim.
- **Crash reconciliation matches a published container to its media by caption.** If one
  account has two posts with identical captions it could attach the wrong media id. It
  runs only after a worker dies mid-publish, and it never causes a double post — worst
  case the recorded permalink is wrong.
