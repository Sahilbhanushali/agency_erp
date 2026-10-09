# Deploying itsmeDezino Agency ERP (Next.js) to the VPS

Goes live at **`https://internalagencyos.itsmedigital.in`** — a new host, so this is an
install, not a cutover.

Nothing existing is touched: the old NestJS + React/Vite stack keeps serving
`api.itsmedezino.com` on port 4021, and `itsmedezino.com` (the marketing website) is a
different project entirely. The new app gets its own directory, its own port and its own
nginx vhost. If it does not work, nothing is broken — you just do not point anyone at it.

SSL is left to you: the vhost below is HTTP only, so add the certificate once it answers
on port 80.

---

## 1. What you are putting up

| | |
|---|---|
| URL | `https://internalagencyos.itsmedigital.in` |
| App directory | `/var/www/projects/itsme/agency_erp_next` |
| Process | PM2 `itsmedezinoagencyerp`, port **3008** |
| Serving | **not static** — `next start` renders the pages *and* `/api/**` in one Node process |
| Uploads | `public/uploads/` inside the app directory |
| Schema | **no migration history** — `prisma db push` |

Two things that differ from the old stack:

- **Nothing is static.** nginx proxies everything; it serves no files from disk. If PM2
  is down the whole app is down, where before the UI still loaded and only the API failed.
- **The API is not a separate origin.** It is `internalagencyos.itsmedigital.in/api/**`,
  same host as the pages. There is no `api.` subdomain for this app.

---

## 2. DNS first

```bash
dig +short internalagencyos.itsmedigital.in
```

That must return the VPS IP before nginx or SSL will do anything useful. Add an `A`
record (and `AAAA` if you serve IPv6) alongside your other `itsmedigital.in` subdomains.

---

## 3. STOP — read this before touching the database

This app has a **different Prisma schema** from the Nest app. `prisma db push` rewrites
whatever database `DATABASE_URL` points at to match `prisma/schema.prisma`. Pointed at
the live `agency_erp` database, it can drop columns and tables the old app still needs.

Decide now:

- **Fresh database (recommended, and what these steps assume).** The old app keeps
  running on its own data, untouched.
- **Reusing the live data.** Do not run `db push` until you have a dump and have read
  the SQL it intends to run:
  ```bash
  npx prisma migrate diff --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/schema.prisma --script
  ```

Take a dump either way:

```bash
mysqldump -u USER -p --single-transaction --routines agency_erp \
  > ~/agency_erp-$(date +%F).sql
```

For a fresh database:

```sql
CREATE DATABASE itsme_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'itsme_erp'@'localhost' IDENTIFIED BY 'a-strong-password';
GRANT ALL PRIVILEGES ON itsme_erp.* TO 'itsme_erp'@'localhost';
FLUSH PRIVILEGES;
```

---

## 4. Get the code onto the server

```bash
cd /var/www/projects/itsme
git clone <your-repo-url> agency_erp_next
cd agency_erp_next
git checkout dev          # or main, whichever you are shipping
node -v                   # Next 15 needs 18.18+; 20 LTS or 22 is better
```

`ecosystem.config.js` expects exactly `/var/www/projects/itsme/agency_erp_next`. Using a
different path means changing `APP_DIR` at the top of that file.

---

## 5. Environment

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

`.env.example` documents all 21 variables. The ones that must be right:

```ini
DATABASE_URL="mysql://itsme_erp:a-strong-password@localhost:3306/itsme_erp"

# openssl rand -base64 32
NEXTAUTH_SECRET="<long random string>"
# The exact public URL, https, no trailing slash — sign-in callbacks are checked against it
NEXTAUTH_URL="https://internalagencyos.itsmedigital.in"

NEXT_PUBLIC_BASE_URL="https://internalagencyos.itsmedigital.in"
NEXT_PUBLIC_APP_URL="https://internalagencyos.itsmedigital.in"
NEXT_PUBLIC_API_URL="https://internalagencyos.itsmedigital.in/api"

# Client share links live on this same host at /share/** — read the warning below
SHARE_DOMAIN=""
SHARE_BASE_URL="https://internalagencyos.itsmedigital.in"
NEXT_PUBLIC_SHARE_BASE_URL="https://internalagencyos.itsmedigital.in"
CONFIRM_DOMAIN=""
```

### The two share variables that will bite you

Clients open quotations and content approvals without logging in, from a tokenised
`/share/**` URL. On a single host with no `share.` subdomain:

- **`SHARE_DOMAIN` must stay empty.** `middleware.ts` treats any request whose host
  equals `SHARE_DOMAIN` as a client share request and returns **403 for `/dashboard`,
  `/auth`, `/clients` and `/calendar`**. Set it to this host and you lock everyone out
  of the app.
- **`SHARE_BASE_URL` and `NEXT_PUBLIC_SHARE_BASE_URL` must be set.** Left blank,
  `lib/export-link.ts` builds the share host by swapping the first DNS label for
  `share`, turning `internalagencyos.itsmedigital.in` into `share.itsmedigital.in` — a
  host that does not exist. Every client link you generated would be dead.

Set correctly, links come out as
`https://internalagencyos.itsmedigital.in/share/document/<token>`, and the middleware
lets `/share/**` and `/api/share/**` through without a session on any host.

### Two values you must not change later

- **`NEXTAUTH_SECRET`** — `lib/encryption.ts` derives its AES key from this, so rotating
  it makes every stored SMTP password undecryptable.
- **`SMTP_PASSWORD_ENCRYPTION_KEY`** — same.

Anything prefixed `NEXT_PUBLIC_` is compiled into the browser bundle: never put a secret
behind that prefix, and rebuild after changing one.

---

## 6. Install, schema, seed, build

```bash
cd /var/www/projects/itsme/agency_erp_next

npm ci                 # .npmrc already sets legacy-peer-deps
npx prisma generate
npm run db:push        # create the tables
npm run db:seed        # 26 permissions + ADMIN role + the admin account
npm run build
```

### The seed

`npm run db:seed` creates exactly three things and nothing else:

- the 26 permissions the app checks for,
- the `ADMIN` role, holding all 26,
- one user — `admin@gmail.com` / `admin@123`, bcrypt-hashed.

No clients, projects, posts or sample rows. It is idempotent: run it again after
pulling new code and it adds any new permissions without disturbing existing grants or
data.

**Change that password at first sign-in.** It is a published default on an account that
holds every permission.

### Wiping and starting over

```bash
npm run db:fresh       # prisma db push --force-reset && node prisma/seed.mjs
```

**This drops every table in the database and recreates them empty, then seeds the one
admin.** Every client, project, post, asset record, quotation and invoice is gone, and
there is no undo.

Three things to know before you ever type it:

- It is for a wrong-footed first install or a development reset. Not for production.
- It does **not** touch `public/uploads/` — the files stay on disk while every database
  row referencing them disappears. Clear that directory too if you want a true reset.
- Prisma now refuses `--force-reset` when it detects an AI agent running it, so this is
  a command you run yourself, deliberately.

Take a dump first, every time:

```bash
mysqldump -u itsme_erp -p --single-transaction itsme_erp > ~/itsme_erp-$(date +%F).sql
```

### If the build is killed

OOM — 2 GB is tight for a Next build:

```bash
NODE_OPTIONS=--max-old-space-size=1536 npm run build
```

`next.config.mjs` already sets `experimental.cpus: 1` and `images.unoptimized: true`, so
no `sharp` build is needed.

### Bringing the old uploads across

`public/uploads/` is gitignored, so a fresh clone has none. The old app kept them in
`backend/uploads/`:

```bash
mkdir -p public/uploads
sudo rsync -av /var/www/projects/itsme/agency_erp/backend/uploads/ public/uploads/
sudo chown -R $USER:$USER public/uploads
```

Then **check it against the data** — this app stores filenames and resolves them under
`public/uploads/`, while the old rows may hold full paths or a different folder layout.
Open a few assets in the UI before calling this done. If the paths do not line up the
files are safe; only the references need fixing.

Skip this entirely if you started on a fresh database.

---

## 7. Start it with PM2

```bash
sudo mkdir -p /var/log/pm2
ss -ltnp | grep 3008        # must print nothing — the port has to be free

cd /var/www/projects/itsme/agency_erp_next
pm2 start ecosystem.config.js
pm2 save
pm2 startup                 # run the command it prints, once, so it survives reboot

pm2 status
pm2 logs itsmedezinoagencyerp --lines 50
```

`cwd` in `ecosystem.config.js` is load-bearing: every upload path in this app resolves
through `process.cwd()`, so starting PM2 from the wrong directory writes files where
nothing can serve them. Do not drop it.

The daily designer and delay-report emails (`scripts/cron-job.js`) are commented out in
`ecosystem.config.js`. Uncomment that block and re-run
`pm2 start ecosystem.config.js && pm2 save` when you want them.

---

## 8. Smoke test before nginx

```bash
curl -I  http://127.0.0.1:3008/                      # 200, or 307 to /auth/signin
curl -i  http://127.0.0.1:3008/api/companies         # 401 {"error":"Unauthorized"}
```

A 401 on `/api/companies` is the correct answer — it proves the route guards are
running. A 200 with data there would mean something is badly wrong.

---

## 9. The nginx vhost

Ready to use: `deploy/nginx/internalagencyos.itsmedigital.in.conf` in this repo. It is
syntax-checked with `nginx -t`, and its routing was verified against a stub upstream.

```bash
cd /var/www/projects/itsme/agency_erp_next
sudo cp deploy/nginx/internalagencyos.itsmedigital.in.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/internalagencyos.itsmedigital.in.conf \
           /etc/nginx/sites-enabled/

sudo nginx -t          # must say "syntax is ok" / "test is successful"
sudo systemctl reload nginx
```

`nginx -t` before every reload. A reload with a broken config takes the whole server
down, and this box also serves `itsmedezino.com`, `api.itsmedezino.com`, `niilkanth.com`
and the rest.

The three lines that matter in that file:

- `proxy_pass http://127.0.0.1:3008` — the only upstream; there is no `root`.
- `proxy_set_header Host $host` — NextAuth validates callbacks against it and
  `middleware.ts` reads it for share links. Never hardcode a value here.
- `client_max_body_size 100M` — nginx defaults to 1M, which rejects most image uploads.

It is HTTP only. Add SSL once `http://internalagencyos.itsmedigital.in` answers; the
`/.well-known/acme-challenge/` location is already in place for a webroot challenge.

---

## 10. Verify

```bash
curl -I  http://internalagencyos.itsmedigital.in/
curl -i  http://internalagencyos.itsmedigital.in/api/companies     # 401
```

Then in a browser, after SSL is on: sign in as `admin@gmail.com`, open Companies and
Quotations, create a quotation, issue a client link, open that link in a private window,
and upload one image so you can confirm the uploads path end to end.

Confirm you have disturbed nothing else:

```bash
curl -I https://itsmedezino.com
curl -I https://api.itsmedezino.com
```

### Retiring the old stack

Only when you are done with it, and never on the same day you go live:

```bash
pm2 list                     # find the old process name
pm2 stop <old-api-name>
pm2 save
```

Leave the old directory and the stopped process in place for a week or two. Disk is
cheaper than a rebuild.

### Rollback

There is nothing to roll back — the old app was never modified. If the new host misbehaves,
stop pointing people at it:

```bash
sudo rm /etc/nginx/sites-enabled/internalagencyos.itsmedigital.in.conf
sudo nginx -t && sudo systemctl reload nginx
pm2 stop itsmedezinoagencyerp
```

---

## 11. Routine deploys after this

```bash
cd /var/www/projects/itsme/agency_erp_next
git pull
npm ci
npx prisma generate
npm run db:push          # only when prisma/schema.prisma changed — see below
npm run build
pm2 reload itsmedezinoagencyerp
```

- `npm run build` **before** `pm2 reload`, never after. Reloading onto a half-written
  `.next` serves broken pages.
- There is no migration history here, so `db push` is the only path and it versions
  nothing. Before running it against production data, read what it plans to do:
  ```bash
  npx prisma migrate diff --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/schema.prisma --script
  ```
  Additive changes are safe; anything dropping a column or narrowing a type needs a dump
  first.
- `npm run check:finance` verifies the quotation/invoice money and GST arithmetic. It
  needs no database, so it is a safe pre-deploy check.
- Never `npm run db:fresh` on this server once it holds real work — it drops every
  table. `npm run db:seed` on its own is safe and idempotent.
- Never `git clean -fdx` or `rm -rf` the app directory — `.env` and `public/uploads/`
  live inside it and neither is in git.

---

## 12. Things that will bite you

| Symptom | Cause |
|---|---|
| 502 Bad Gateway | PM2 is not listening on 3008 — `pm2 status`, `ss -ltnp \| grep 3008`. |
| Whole app down, not just the API | PM2 is down. Nothing is static any more. |
| nginx serves the wrong site | DNS not pointing here yet, so the request falls through to `default`. |
| Sign-in loops, or "callback" errors | `NEXTAUTH_URL` is not the exact public https URL, or nginx is not passing `Host`. |
| Client links point at `share.itsmedigital.in` and are dead | `SHARE_BASE_URL` / `NEXT_PUBLIC_SHARE_BASE_URL` not set — step 5. |
| 403 on `/dashboard` and `/auth` for everyone | `SHARE_DOMAIN` was set to this host. It must be empty — step 5. |
| Share link asks for a login | `proxy_set_header Host $host` missing from the vhost. |
| Uploads 413 | `client_max_body_size` too small. |
| Uploads succeed then 404 | PM2 started from the wrong `cwd`; files landed outside `public/uploads/`. |
| Stored SMTP passwords stop working | `NEXTAUTH_SECRET` was rotated. |
| Build dies with no error | OOM. Add swap or cap with `NODE_OPTIONS=--max-old-space-size=1536`. |
| A `NEXT_PUBLIC_*` change has no effect | Baked in at build time. Rebuild. |

One honest caveat: `next.config.mjs` still has `typescript.ignoreBuildErrors: true` and
`eslint.ignoreDuringBuilds: true`, so **`npm run build` succeeding does not mean the code
type-checks** — there are 83 known type errors outstanding. Run `npx tsc --noEmit`
yourself if you want the real answer.
