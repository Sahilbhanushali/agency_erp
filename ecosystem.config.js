/**
 * PM2 process definition for itsmeDezino Agency ERP (Next.js).
 *
 * Unlike the old stack, the frontend is NOT static — `next start` serves the pages
 * and /api/** from one Node process, so nginx proxies everything to it.
 *
 *   pm2 start ecosystem.config.js
 *   pm2 save && pm2 startup
 *
 * See DEPLOY.md for the full first-deploy and cutover steps.
 */
// The directory this config file sits in — so the app works wherever you deploy it
// (agency_erp, agency_erp_next, anywhere) without editing this line. cwd is not
// cosmetic: every upload path resolves through process.cwd(), so a wrong value writes
// files where nothing can serve them. Override with APP_DIR=/path pm2 start ... if you
// ever need to.
const APP_DIR = process.env.APP_DIR || __dirname;

module.exports = {
  apps: [
    {
      name: "itsmedezinoagencyerp",

      // cwd is not optional: every upload path resolves through process.cwd()
      // (lib/storage.ts, app/api/assets/**, app/api/clients/**), so starting from
      // anywhere else writes files outside public/uploads and silently 404s them.
      cwd: APP_DIR,

      script: "npm",
      args: "start", // next start -p $PORT

      // Fork, not cluster: Prisma opens a connection pool per worker, which MySQL's
      // max_connections will feel long before a 1-vCPU VPS gains anything.
      exec_mode: "fork",
      instances: 1,

      autorestart: true,
      max_restarts: 10,
      min_uptime: "20s",
      max_memory_restart: "1G",
      watch: false,

      // Reads .env from cwd; only PORT lives here so the nginx upstream and the app
      // can never disagree. Confirm it is free before the first start:
      //   ss -ltnp | grep 3008
      env: {
        NODE_ENV: "production",
        PORT: 3008,
      },

      error_file: "/var/log/pm2/itsmedezinoagencyerp.error.log",
      out_file: "/var/log/pm2/itsmedezinoagencyerp.out.log",
      time: true,
    },
    // Disabled for now — uncomment to re-enable the daily designer and delay
    // report emails (scripts/cron-job.js). After uncommenting:
    //   pm2 start ecosystem.config.js && pm2 save
    // {
    //   // Daily designer + delay report emails (scripts/cron-job.js, node-cron).
    //   // Separate process so an API restart never skips a scheduled send.
    //   name: "itsmedezinoagencyerp-cron",
    //   cwd: APP_DIR,
    //   script: "node",
    //   args: "scripts/cron-job.js",
    //   exec_mode: "fork",
    //   instances: 1,
    //   autorestart: true,
    //   min_uptime: "20s",
    //   max_memory_restart: "256M",
    //   watch: false,
    //   env: {
    //     NODE_ENV: "production",
    //   },
    //   error_file: "/var/log/pm2/itsmedezinoagencyerp-cron.error.log",
    //   out_file: "/var/log/pm2/itsmedezinoagencyerp-cron.out.log",
    //   time: true,
    // },
  ],
};
