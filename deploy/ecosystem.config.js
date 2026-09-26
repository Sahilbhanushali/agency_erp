/**
 * PM2 process definition for AgencyOS.
 *
 * Only the NestJS API is a process — the frontend is a static Vite build that
 * nginx serves directly, so it needs no runtime.
 *
 *   pm2 start deploy/ecosystem.config.js
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'itsme-agencyos-api',

      // cwd matters: FilesService resolves uploads from process.cwd(), so running
      // from anywhere else would scatter uploaded files outside backend/uploads.
      cwd: '/var/www/projects/itsme/backend',

      // `nest build` emits dist/src/main.js, not dist/main.js — prisma/*.ts sits in
      // the tsconfig include, so tsc keeps the shared root directory.
      script: 'dist/src/main.js',

      // Fork, not cluster: each worker opens its own Prisma connection pool, which
      // a small VPS and MySQL's max_connections will feel before you gain anything.
      // Raise `instances` only after watching DB connections under real load.
      exec_mode: 'fork',
      instances: 1,

      autorestart: true,
      max_restarts: 10,
      min_uptime: '20s',
      max_memory_restart: '512M',

      // Reads backend/.env via @nestjs/config; only the port is set here so the
      // nginx upstream and the app can never disagree about it.
      //
      // 5417 is deliberately off the beaten track — this VPS runs other projects,
      // and the app's own default (5007) is the kind of number something else
      // will eventually claim. Confirm it is free before first start:
      //   ss -ltnp | grep 5417
      env: {
        NODE_ENV: 'production',
        PORT: 5417,
      },

      error_file: '/var/log/pm2/itsme-agencyos-api.error.log',
      out_file: '/var/log/pm2/itsme-agencyos-api.out.log',
      time: true,
    },
  ],
};
