import { z } from "zod"

export const TODO_STATUSES = ["PENDING", "IN_PROGRESS", "BLOCKED", "DONE", "CARRIED_OVER"] as const
export type TodoStatus = (typeof TODO_STATUSES)[number]

export const TODO_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const
export type TaskPriority = (typeof TODO_PRIORITIES)[number]

export const BLOCKER_CATEGORIES = [
  "DEPENDENCY",
  "APPROVAL_PENDING",
  "TECHNICAL_ISSUE",
  "MISSING_INFORMATION",
  "RESOURCE_ISSUE",
  "OTHER",
] as const
export type BlockerCategory = (typeof BLOCKER_CATEGORIES)[number]

export const BLOCKER_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const
export type BlockerStatus = (typeof BLOCKER_STATUSES)[number]

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v === "" ? undefined : v))

const optionalNullableText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v === "" ? null : v))

export const todoCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  notes: optionalText,
  date: z.string().trim().optional(),
  priority: z.enum(TODO_PRIORITIES).default("MEDIUM"),
  status: z.enum(TODO_STATUSES).default("PENDING"),
  taskId: z.string().trim().optional().nullable(),
  userId: z.coerce.number().int().positive().optional(),
})

export const todoUpdateSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").max(255).optional(),
  notes: optionalNullableText,
  date: z.string().trim().optional(),
  priority: z.enum(TODO_PRIORITIES).optional(),
  status: z.enum(TODO_STATUSES).optional(),
  progress: z.coerce.number().int().min(0, "0 at least").max(100, "100 at most").optional(),
  blocker: optionalNullableText,
  position: z.coerce.number().int().optional(),
  userId: z.coerce.number().int().positive().optional(),
})

export const blockerCreateSchema = z.object({
  title: z.string().trim().min(1, "Blocker title is required").max(255),
  description: optionalText,
  category: z.enum(BLOCKER_CATEGORIES).default("TECHNICAL_ISSUE"),
  impact: optionalText,
  assistanceRequired: optionalText,
  responsibleParty: optionalText,
  expectedResolution: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v) : null)),
  status: z.enum(BLOCKER_STATUSES).default("OPEN"),
  resolutionNotes: optionalText,
})

export const blockerUpdateSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").max(255).optional(),
  description: optionalNullableText,
  category: z.enum(BLOCKER_CATEGORIES).optional(),
  impact: optionalNullableText,
  assistanceRequired: optionalNullableText,
  responsibleParty: optionalNullableText,
  expectedResolution: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? undefined : v ? new Date(v) : null)),
  status: z.enum(BLOCKER_STATUSES).optional(),
  resolutionNotes: optionalNullableText,
})

export const todoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  priority: z.string().trim().optional(),
  blocked: z.enum(["all", "blocked", "unblocked"]).default("all"),
  userId: z.coerce.number().int().positive().optional(),
  date: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  sortBy: z.enum(["date", "priority", "status", "title", "createdAt", "updatedAt"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  team: z.enum(["0", "1"]).optional(),
})
