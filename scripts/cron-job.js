/**
 * Scheduled job supervisor.
 *
 * Nothing is scheduled in this file. It asks the running app what to run and when
 * (`GET /api/jobs/schedule`), reconciles its node-cron tasks against that answer every
 * minute, and reports each outcome back (`POST /api/jobs/schedule`). An administrator
 * changing a time or a recipient list in Settings takes effect on the next poll — no
 * deploy, no restart, no editing this file.
 *
 *   pm2 start ecosystem.config.js        # runs this alongside the app
 *   CRON_SECRET=... node scripts/cron-job.js
 *
 * Needs CRON_SECRET to match the app's. It holds no database credentials of its own:
 * everything goes through the app, so jobs run exactly the code path the UI runs.
 */
const cron = require('node-cron');

const APP_URL = (process.env.CRON_TARGET_URL || `http://127.0.0.1:${process.env.PORT || 3008}`).replace(/\/+$/, '');
const SECRET = process.env.CRON_SECRET;
const POLL_MS = 60_000;

/** key -> { task, cronExpression, timezone } */
const scheduled = new Map();

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

async function app(path, init = {}) {
  const res = await fetch(`${APP_URL}${path}`, {
    ...init,
    headers: { 'x-cron-secret': SECRET, 'Content-Type': 'application/json', ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function report(key, startedAt, ok, message, trigger) {
  try {
    await app('/api/jobs/schedule', {
      method: 'POST',
      body: JSON.stringify({ key, ok, message: String(message).slice(0, 2000), trigger, startedAt }),
    });
  } catch (error) {
    // The run already happened; failing to record it must not look like a failed run.
    log(`[${key}] could not record the result: ${error.message}`);
  }
}

/**
 * Run one job and record what happened.
 *
 * Two kinds exist: an endpoint the app exposes, and a script in this directory. Both
 * end up in the same run history, so "did last night's report go out?" has one answer.
 */
async function runJob(job, trigger) {
  const startedAt = new Date().toISOString();
  log(`[${job.key}] running (${trigger})`);
  try {
    let message;
    if (job.endpoint) {
      const result = await app(job.endpoint, { method: 'POST' });
      message = JSON.stringify(result).slice(0, 500);
    } else if (job.script) {
      const mod = require(job.script.module);
      const fn = mod[job.script.fn];
      if (typeof fn !== 'function') throw new Error(`${job.script.module} has no ${job.script.fn}`);
      // Recipients are resolved by the app, which can read the permission catalogue.
      await fn(job.recipients || []);
      message = job.recipients?.length
        ? `sent to ${job.recipients.join(', ')}`
        : 'completed';
    } else {
      throw new Error('job has neither an endpoint nor a script');
    }
    log(`[${job.key}] ok — ${message}`);
    await report(job.key, startedAt, true, message, trigger);
  } catch (error) {
    log(`[${job.key}] failed — ${error.message}`);
    await report(job.key, startedAt, false, error.message, trigger);
  }
}

/** Bring the live node-cron tasks in line with what the app says they should be. */
function reconcile(jobs) {
  const wanted = new Set();

  for (const job of jobs) {
    if (!job.isEnabled) continue;
    wanted.add(job.key);

    const existing = scheduled.get(job.key);
    if (existing && existing.cronExpression === job.cronExpression && existing.timezone === job.timezone) {
      continue;
    }
    if (existing) {
      existing.task.stop();
      log(`[${job.key}] rescheduling: ${existing.cronExpression} ${existing.timezone} -> ${job.cronExpression} ${job.timezone}`);
    }
    try {
      const task = cron.schedule(job.cronExpression, () => runJob(job, 'schedule'), {
        timezone: job.timezone,
      });
      scheduled.set(job.key, { task, cronExpression: job.cronExpression, timezone: job.timezone });
      log(`[${job.key}] scheduled ${job.cronExpression} (${job.timezone})`);
    } catch (error) {
      // A bad expression must not take the other jobs down with it.
      log(`[${job.key}] refused by node-cron: ${error.message}`);
      scheduled.delete(job.key);
    }
  }

  for (const [key, entry] of scheduled) {
    if (wanted.has(key)) continue;
    entry.task.stop();
    scheduled.delete(key);
    log(`[${key}] disabled — unscheduled`);
  }
}

async function poll() {
  let jobs;
  try {
    ({ jobs } = await app('/api/jobs/schedule'));
  } catch (error) {
    // The app may be restarting. Keep the current schedule and try again shortly.
    log(`could not reach ${APP_URL}: ${error.message}`);
    return;
  }

  reconcile(jobs);

  // "Run now" from the admin screen arrives as a timestamp on the row, so a manual run
  // uses the same code, recipients and history as a scheduled one.
  for (const job of jobs) {
    if (job.runRequestedAt) await runJob(job, 'manual');
  }
}

if (!SECRET || SECRET.length < 16) {
  console.error('CRON_SECRET is missing or shorter than 16 characters — refusing to start.');
  console.error('Generate one with:  openssl rand -hex 32   and set it for both the app and this process.');
  process.exit(1);
}

log(`Scheduled job supervisor started. Reading schedules from ${APP_URL} every ${POLL_MS / 1000}s.`);
poll();
setInterval(poll, POLL_MS);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log(`${signal} — stopping ${scheduled.size} scheduled job(s)`);
    for (const entry of scheduled.values()) entry.task.stop();
    process.exit(0);
  });
}
