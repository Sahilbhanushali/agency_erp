import type { TaskPriority, TaskStatus } from "@/types/task";

export interface ColumnDefinition {
  status: TaskStatus;
  label: string;
  dotColor: string;
}

export const BOARD_COLUMNS: ColumnDefinition[] = [
  { status: "TODO", label: "To Do", dotColor: "bg-slate-400 dark:bg-slate-500" },
  { status: "IN_PROGRESS", label: "In Progress", dotColor: "bg-sky-500" },
  { status: "IN_REVIEW", label: "In Review", dotColor: "bg-amber-500" },
  { status: "DONE", label: "Done", dotColor: "bg-emerald-500" },
  { status: "CANCELLED", label: "Cancelled", dotColor: "bg-rose-500/70" },
];

export function toColumnStatus(status: TaskStatus): TaskStatus {
  return BOARD_COLUMNS.some((column) => column.status === status)
    ? status
    : "IN_REVIEW";
}

export const STATUS_STYLES: Record<TaskStatus, string> = {
  TODO: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-800",
  IN_PROGRESS: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60",
  IN_REVIEW: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
  NEEDS_REVISION: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
  ADMIN_APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
  CLIENT_PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
  DONE: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
};

export const PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW: "bg-slate-100 text-slate-600 border-slate-200/80 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  MEDIUM: "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/50",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",
  URGENT: "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50",
};

export const PRIORITY_OPTIONS: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const statusLabel = (status: TaskStatus) =>
  BOARD_COLUMNS.find((column) => column.status === status)?.label ??
  status.replace(/_/g, " ");
