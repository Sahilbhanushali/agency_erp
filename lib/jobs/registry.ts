/**
 * The scheduled jobs an administrator can manage.
 *
 * `key` and how a job runs are fixed in code, because they point at real handlers.
 * Everything an administrator decides — when it runs, in which timezone, who the mail
 * goes to, whether it runs at all — lives in the `scheduled_jobs` table and is edited
 * from Settings → Scheduled jobs. Nothing here is a schedule; `defaultCron` only seeds
 * the row the first time the job is seen.
 */
export interface JobDefinition {
  key: string
  label: string
  description: string
  /** Seeds the row on first run. After that the stored expression wins. */
  defaultCron: string
  /** HTTP job: the scheduler POSTs this path with the cron secret. */
  endpoint?: string
  /** Script job: the scheduler requires this module and calls `fn(recipients)`. */
  script?: { module: string; fn: string }
  /** Whether the recipient choice reaches this job at all. */
  supportsRecipients: boolean
  /** Plain English for what "Automatic" means for this job, shown in the UI. */
  autoRecipients: string
  /** When mode is AUTO, resolve recipients from the holders of this permission. */
  autoPermission?: { module: string; action: string }
}

export const JOB_REGISTRY: JobDefinition[] = [
  {
    key: "eod-todo-report",
    label: "End-of-day work report",
    description:
      "What each person planned for the day, how far they got, and what blocked them.",
    defaultCron: "0 19 * * 1-5",
    endpoint: "/api/todos/report",
    supportsRecipients: true,
    autoRecipients: "each person's reporting manager, or everyone who may read daily plans",
  },
  {
    key: "overdue-task-reminders",
    label: "Overdue task reminders",
    description:
      "Nudges the people on a task when it is 1, 3, 7 or 14 days past its due date.",
    defaultCron: "30 9 * * 1-5",
    endpoint: "/api/tasks/reminders",
    // The audience is the task itself — reminding an uninvolved address would be noise.
    supportsRecipients: false,
    autoRecipients: "the task's assignees and whoever created it",
  },
  {
    key: "daily-designer-report",
    label: "Daily design submission report",
    description: "Designs submitted for approval today, grouped by designer.",
    defaultCron: "0 14 * * *",
    script: { module: "./dailyDesigner", fn: "sendDailyDesignerReport" },
    supportsRecipients: true,
    autoRecipients: "the Team Lead",
  },
  {
    key: "daily-delay-report",
    label: "Project delay alert",
    description: "Posts whose design is late against their scheduled publish date.",
    defaultCron: "0 21 * * *",
    script: { module: "./dailyDelayReport", fn: "sendDailyDelayReport" },
    supportsRecipients: true,
    autoRecipients: "everyone who may read reports",
    autoPermission: { module: "reports", action: "read" },
  },
]

export const getJob = (key: string) => JOB_REGISTRY.find((j) => j.key === key)

/**
 * Validate a five-field cron expression without adding a parser dependency.
 *
 * node-cron does the real parsing when the job is scheduled, inside a separate process.
 * This exists so a typo is rejected while the administrator is still looking at the
 * form, instead of quietly stopping the job until somebody reads the logs.
 */
export function isValidCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) return false

  const bounds: [number, number][] = [
    [0, 59], // minute
    [0, 23], // hour
    [1, 31], // day of month
    [1, 12], // month
    [0, 7], // day of week (7 == Sunday)
  ]

  return fields.every((field, i) => {
    const [min, max] = bounds[i]
    return field.split(",").every((part) => {
      const [range, step] = part.split("/")
      if (step !== undefined && (!/^\d+$/.test(step) || Number(step) < 1)) return false
      if (range === "*") return true
      const [from, to] = range.split("-")
      const valid = (v: string) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max
      if (to === undefined) return valid(from)
      return valid(from) && valid(to) && Number(from) <= Number(to)
    })
  })
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/**
 * Plain-English rendering of the shapes this app actually uses, so the admin screen can
 * confirm what was typed. Anything more exotic is echoed back unchanged rather than
 * described wrongly.
 */
export function describeCron(expression: string): string {
  const [minute, hour, dom, month, dow] = expression.trim().split(/\s+/)
  if (!minute || !hour) return expression
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) return expression
  if (dom !== "*" || month !== "*") return expression

  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`

  let when = "every day"
  if (dow === "1-5") when = "Monday to Friday"
  else if (dow === "6,0" || dow === "0,6") when = "Saturday and Sunday"
  else if (/^\d$/.test(dow)) when = `every ${DAYS[Number(dow) % 7]}`
  else if (dow !== "*") when = `on days ${dow}`

  return `${time}, ${when}`
}

/** The timezones worth offering — this is a single-office agency, not a SaaS. */
export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "UTC",
] as const
