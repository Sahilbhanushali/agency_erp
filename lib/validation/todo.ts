import { z } from "zod"

export const TODO_STATUSES = ["PENDING", "IN_PROGRESS", "BLOCKED", "DONE", "CARRIED_OVER"] as const

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v === "" ? undefined : v))

export const todoCreateSchema = z.object({
  title: z.string().trim().min(1, "Say what you plan to do").max(255),
  notes: optionalText,
  /** Defaults to today on the server; the client never decides what "today" is. */
  date: z.string().trim().optional(),
  taskId: z.string().trim().optional().nullable(),
})

export const todoUpdateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  notes: optionalText,
  status: z.enum(TODO_STATUSES).optional(),
  progress: z.coerce.number().int().min(0, "0 at least").max(100, "100 at most").optional(),
  blocker: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  position: z.coerce.number().int().optional(),
})
