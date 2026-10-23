import { z } from "zod"

export const PERSONAL_TODO_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const

/** `datetime-local` sends "" when cleared; that means "no due date", not an error. */
const optionalDateTime = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? new Date(value) : null))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), "Enter a valid date")

export const personalTodoSchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(255),
  notes: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  priority: z.enum(PERSONAL_TODO_PRIORITIES).default("MEDIUM"),
  dueAt: optionalDateTime,
})

/** Partial edits, plus completion. userId is not a field here and never will be. */
export const personalTodoUpdateSchema = personalTodoSchema.partial().extend({
  completed: z.boolean().optional(),
})

export const personalTodoQuerySchema = z.object({
  status: z.enum(["open", "done", "all"]).default("open"),
  priority: z.enum(PERSONAL_TODO_PRIORITIES).optional(),
  due: z.enum(["overdue", "today", "upcoming", "none"]).optional(),
  q: z.string().trim().max(200).optional(),
})
