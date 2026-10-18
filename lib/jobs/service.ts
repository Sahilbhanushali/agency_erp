import { prisma } from "@/lib/prisma"
import { namesSatisfying } from "@/lib/permissions/catalog"
import { JOB_REGISTRY, getJob, type JobDefinition } from "@/lib/jobs/registry"

/**
 * Reads and writes the administrator's scheduling choices.
 *
 * The registry is the list of jobs that exist; this module is the list of decisions
 * made about them. Rows are created on first read rather than by a seed script, so a
 * deployment that adds a job needs no migration step and a deleted row heals itself.
 */

/** Last time the scheduler process asked for the schedule, so the UI can say if it is up. */
let schedulerSeenAt: Date | null = null
export const markSchedulerSeen = () => {
  schedulerSeenAt = new Date()
}
export const getSchedulerSeenAt = () => schedulerSeenAt

const asIdArray = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((v): v is number => Number.isInteger(v)) : []

const asEmailArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []

/** Every job in the registry, with its stored configuration, creating rows as needed. */
export async function listJobs() {
  const existing = await prisma.scheduledJob.findMany({
    include: {
      updatedBy: { select: { id: true, name: true } },
      runs: {
        orderBy: { startedAt: "desc" },
        take: 5,
        select: { id: true, startedAt: true, finishedAt: true, ok: true, message: true, trigger: true },
      },
    },
  })
  const byKey = new Map(existing.map((row) => [row.key, row]))

  const missing = JOB_REGISTRY.filter((def) => !byKey.has(def.key))
  if (missing.length > 0) {
    await prisma.scheduledJob.createMany({
      data: missing.map((def) => ({
        key: def.key,
        label: def.label,
        description: def.description,
        cronExpression: def.defaultCron,
      })),
      skipDuplicates: true,
    })
    const created = await prisma.scheduledJob.findMany({
      where: { key: { in: missing.map((d) => d.key) } },
      include: { updatedBy: { select: { id: true, name: true } }, runs: true },
    })
    for (const row of created) byKey.set(row.key, row as (typeof existing)[number])
  }

  // Registry order, not insertion order — the screen should not reshuffle on a reseed.
  return JOB_REGISTRY.flatMap((def) => {
    const row = byKey.get(def.key)
    if (!row) return []
    return [{ definition: def, row }]
  })
}

export interface RecipientChoice {
  mode: "AUTO" | "EXPLICIT" | "BOTH"
  /** The addresses an administrator chose. Empty under AUTO. */
  emails: string[]
}

/**
 * Who one job should mail.
 *
 * The mode matters as much as the list: AUTO leaves the job's own routing alone (the
 * end-of-day report, for instance, follows each person's reporting line), EXPLICIT
 * replaces it, and BOTH adds to it. Collapsing these to one array would make "mail
 * nobody" and "mail whoever the job decides" indistinguishable.
 */
export async function recipientsFor(key: string): Promise<RecipientChoice | null> {
  const def = getJob(key)
  if (!def?.supportsRecipients) return null

  const row = await prisma.scheduledJob.findUnique({
    where: { key },
    select: { recipientMode: true, recipientUserIds: true, recipientEmails: true },
  })
  if (!row) return null

  const explicit: string[] = []
  if (row.recipientMode !== "AUTO") {
    const ids = asIdArray(row.recipientUserIds)
    if (ids.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { email: true },
      })
      explicit.push(...users.map((u) => u.email))
    }
    explicit.push(...asEmailArray(row.recipientEmails))
  }

  if (row.recipientMode === "EXPLICIT") return { mode: "EXPLICIT", emails: dedupe(explicit) }

  const auto = def.autoPermission
    ? (
        await prisma.user.findMany({
          where: {
            role: {
              permissions: {
                some: {
                  permission: {
                    name: { in: namesSatisfying(def.autoPermission.module, def.autoPermission.action) },
                  },
                },
              },
            },
          },
          select: { email: true },
        })
      ).map((u) => u.email)
    : []

  // BOTH: the job's own audience plus the chosen extras. AUTO with no automatic
  // audience of its own means the job keeps whatever it does internally.
  if (row.recipientMode === "BOTH") {
    return { mode: "BOTH", emails: dedupe([...auto, ...explicit]) }
  }
  return { mode: "AUTO", emails: dedupe(auto) }
}

const dedupe = (values: string[]) =>
  Array.from(new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean)))

/** What the scheduler process needs in order to run everything, and nothing else. */
export async function scheduleForRunner() {
  const jobs = await listJobs()
  return Promise.all(
    jobs.map(async ({ definition, row }) => ({
      key: row.key,
      cronExpression: row.cronExpression,
      timezone: row.timezone,
      isEnabled: row.isEnabled,
      runRequestedAt: row.runRequestedAt,
      endpoint: definition.endpoint ?? null,
      script: definition.script ?? null,
      // Resolved here, not in the scheduler: working out who holds a permission needs
      // the catalog, and the scheduler is a plain Node script with no access to it.
      // A script job cannot work out who holds a permission, so hand it the addresses.
      recipients: definition.script ? ((await recipientsFor(row.key))?.emails ?? null) : null,
    })),
  )
}

export type JobWithDefinition = Awaited<ReturnType<typeof listJobs>>[number]
export type { JobDefinition }
