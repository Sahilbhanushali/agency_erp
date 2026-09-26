# Deploying AgencyOS

Target: `internalagencyos.itsmedigital.in`
Server path: `/var/www/projects/itsme/`
API port: **5417** (loopback only — nginx is the only thing that talks to it)

```
/var/www/projects/itsme/
├── backend/          NestJS API (PM2 runs this)
│   ├── dist/src/main.js
│   ├── .env          ← secrets live here, never committed
│   └── uploads/      ← written at runtime, back this up
├── frontend/dist/    static build (nginx serves this)
└── deploy/           ecosystem.config.js + nginx/
```

## Why the API sits behind `/api`

The API mounts its controllers at the root — `/auth`, `/dashboard`, `/leads`,
`/approvals`, `/tasks` — and the SPA claims those exact same paths. They can only
share one origin if nginx separates them, so the API is proxied under `/api/` and
the prefix is stripped before the request reaches Nest.

That is why `frontend/.env.production` sets `VITE_API_URL=/api`. It is relative,
so the same bundle works on any hostname and there is no CORS to configure.

---

## 1. Prerequisites

```bash
node -v          # 20+
pm2 -v           # npm i -g pm2
nginx -v
mysql --version
ss -ltnp | grep 5417     # must print nothing
```

## 2. Get the code there

```bash
sudo mkdir -p /var/www/projects/itsme
sudo chown -R "$USER":"$USER" /var/www/projects/itsme
# git clone <repo> /var/www/projects/itsme   (or rsync your working copy)
cd /var/www/projects/itsme
```

## 3. Database

```bash
sudo mysql -e "CREATE DATABASE agency_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'agencyos'@'localhost' IDENTIFIED BY 'a-strong-password';"
sudo mysql -e "GRANT ALL PRIVILEGES ON agency_erp.* TO 'agencyos'@'localhost'; FLUSH PRIVILEGES;"
```

## 4. `backend/.env`

The app refuses to start if any of these is missing, and says which — that check
exists so a missing value fails at boot rather than halfway through creating a user.

```ini
DATABASE_URL="mysql://agencyos:a-strong-password@localhost:3306/agency_erp"

JWT_ACCESS_SECRET="<openssl rand -hex 32>"
JWT_REFRESH_SECRET="<a different openssl rand -hex 32>"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Used for CORS *and* for the links inside invite and password-reset emails,
# so it must be the public URL, not localhost.
FRONTEND_ORIGIN="https://internalagencyos.itsmedigital.in"

GMAIL_USER="..."
GMAIL_APP_PASSWORD="..."
MAIL_FROM="AgencyOS <no-reply@itsmedigital.in>"

# Encrypts social platform tokens at rest. Required before any social account
# can store credentials; everything else works without it.
TOKEN_ENCRYPTION_KEY="<openssl rand -hex 32>"
```

```bash
chmod 600 backend/.env
```

## 5. Install, migrate, build

```bash
cd /var/www/projects/itsme/backend
npm ci
npx prisma migrate deploy      # applies all 14 migrations
npx prisma generate
npm run build                  # emits dist/src/main.js
mkdir -p uploads && chmod 750 uploads

# First deploy only — creates permissions and the SUPER_ADMIN account.
# Change that password immediately afterwards (Profile → Security).
npx ts-node prisma/seed.ts

cd ../frontend
npm ci
npm run build                  # reads .env.production → VITE_API_URL=/api
```

## 6. Start the API

```bash
cd /var/www/projects/itsme
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup        # run the command it prints
pm2 logs itsme-agencyos-api --lines 50
curl -s localhost:5417 | head -c 100     # API answering on loopback
```

## 7. nginx + TLS

```bash
sudo ln -s /var/www/projects/itsme/deploy/nginx/internalagencyos.itsmedigital.in.conf \
           /etc/nginx/sites-enabled/internalagencyos.itsmedigital.in
sudo nginx -t
sudo systemctl reload nginx

# Point the A record at this server first, then:
sudo certbot --nginx -d internalagencyos.itsmedigital.in
```

Certbot rewrites the file in place to add the 443 block and the HTTP redirect.

## 8. Verify

```bash
curl -I  https://internalagencyos.itsmedigital.in            # 200, index.html
curl -sI https://internalagencyos.itsmedigital.in/api/       # API through the proxy
curl -s  https://internalagencyos.itsmedigital.in/api/auth/login \
     -X POST -H 'Content-Type: application/json' -d '{}'     # 400 with validation errors
```

A 400 from that last call is the goal: it proves nginx reached Nest and the
validation pipe ran. A 404 means the `/api/` location is not matching.

---

## Redeploying

```bash
cd /var/www/projects/itsme
git pull
cd backend  && npm ci && npx prisma migrate deploy && npm run build
cd ../frontend && npm ci && npm run build
pm2 reload itsme-agencyos-api
```

`index.html` is served with `no-store`, so browsers pick up a new build
immediately; the hashed files under `/assets/` are cached for a year.

## Things worth knowing

- **Swagger** is at `/api/api/docs` through the proxy (Nest mounts it at `/api/docs`
  and nginx adds its own prefix). Consider blocking it publicly.
- **Uploads** are written to `backend/uploads` and served only through authenticated
  API routes — nginx must not expose that directory. Include it in backups.
- **Scaling**: `instances: 1` in fork mode. Each extra worker opens its own Prisma
  pool, so raise it only while watching MySQL `max_connections`.
- **Nothing runs on a schedule.** Invoice-overdue reminders, recurring work and
  timed publishing all need a scheduler that is not installed yet.
