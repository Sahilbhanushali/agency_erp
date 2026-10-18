/**
 * Calls one of the app's own scheduled-job endpoints over localhost.
 *
 * Why not import the service code directly: that required compiling TypeScript at
 * runtime, and `typescript` is a devDependency — so on a server installed with
 * `npm ci --omit=dev` the jobs would fail silently. An HTTP call to the running app
 * needs no build tooling and runs the exact code path the UI uses.
 *
 * Requires CRON_SECRET in the environment, matching the app's.
 */
const APP_URL = process.env.CRON_TARGET_URL || `http://127.0.0.1:${process.env.PORT || 3008}`;

async function runJob(name, path) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    console.error(`[cron:${name}] CRON_SECRET is missing or too short — refusing to run.`);
    return;
  }

  try {
    const res = await fetch(`${APP_URL}${path}`, {
      method: "POST",
      headers: { "x-cron-secret": secret, "Content-Type": "application/json" },
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[cron:${name}] HTTP ${res.status}: ${text.slice(0, 300)}`);
      return;
    }
    console.log(`[cron:${name}] ${text.slice(0, 300)}`);
  } catch (error) {
    // The app may be restarting; log and let the next scheduled run pick it up.
    console.error(`[cron:${name}] could not reach ${APP_URL}: ${error.message}`);
  }
}

module.exports = {
  sendEodTodoReport: () => runJob("eod-todo-report", "/api/todos/report"),
  sendTaskReminders: () => runJob("task-reminders", "/api/tasks/reminders"),
};
