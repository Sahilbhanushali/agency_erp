import { z } from "zod"

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"] as const
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const

/** Blank strings from HTML inputs mean "not set", not "empty value". */
const optionalId = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value === "" || value === undefined ? null : value))

/** `<input type="date">`/`datetime-local` sends "" when cleared. */
const optionalDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? new Date(value) : null))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), "Enter a valid date")

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(255),
  description: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  status: z.enum(TASK_STATUSES).default("TODO"),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  dueDate: optionalDate,
  /** User ids. An empty list is allowed — an unassigned task is a valid backlog item. */
  assigneeIds: z.array(z.coerce.number().int().positive()).max(20).default([]),
  // All three null = a standalone internal task.
  postId: optionalId,
  projectId: optionalId,
  clientId: optionalId,
  blockerReason: z.string().trim().max(2000).optional().nullable(),
  blockerCategory: z.string().trim().optional().nullable(),
})

export const taskUpdateSchema = taskSchema.partial()

/** What an assignee may change on their own task without Manage-tasks. */
export const taskSelfUpdateSchema = z.object({
  status: z.enum(TASK_STATUSES),
  blockerReason: z.string().trim().max(2000).optional().nullable(),
  blockerCategory: z.string().trim().optional().nullable(),
})

export const taskReorderSchema = z.object({
  status: z.enum(TASK_STATUSES),
  /** Task ids in their new top-to-bottom order within that column. */
  taskIds: z.array(z.string().trim().min(1)).max(500),
  blockerReason: z.string().trim().max(2000).optional().nullable(),
  blockerCategory: z.string().trim().optional().nullable(),
})

export type TaskInput = z.infer<typeof taskSchema>
