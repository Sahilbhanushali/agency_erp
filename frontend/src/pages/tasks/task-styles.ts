import type { TaskPriority, TaskStatus } from "@/types/task";

/** The statuses this version works with; the approval states stay unused until the client portal exists. */
export const BOARD_COLUMNS: { status: TaskStatus; label: string }[] = [
    { status: "TODO", label: "To Do" },
    { status: "IN_PROGRESS", label: "In Progress" },
    { status: "IN_REVIEW", label: "In Review" },
    { status: "DONE", label: "Done" },
    { status: "CANCELLED", label: "Cancelled" },
];

/** Keeps a task with an approval status visible instead of dropping it off the board. */
export function toColumnStatus(status: TaskStatus): TaskStatus {
    return BOARD_COLUMNS.some((column) => column.status === status) ? status : "IN_REVIEW";
}

export const STATUS_STYLES: Record<TaskStatus, string> = {
    TODO: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30",
    IN_PROGRESS: "bg-info/15 text-info border-info/30",
    IN_REVIEW: "bg-warning/20 text-warning-foreground dark:text-warning border-warning/40",
    NEEDS_REVISION: "bg-warning/20 text-warning-foreground dark:text-warning border-warning/40",
    ADMIN_APPROVED: "bg-success/15 text-success border-success/30",
    CLIENT_PENDING: "bg-warning/20 text-warning-foreground dark:text-warning border-warning/40",
    DONE: "bg-success/15 text-success border-success/30",
    CANCELLED: "bg-destructive/15 text-destructive border-destructive/30",
};

export const PRIORITY_STYLES: Record<TaskPriority, string> = {
    LOW: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30",
    MEDIUM: "bg-info/15 text-info border-info/30",
    HIGH: "bg-warning/20 text-warning-foreground dark:text-warning border-warning/40",
    URGENT: "bg-destructive/15 text-destructive border-destructive/30",
};

export const PRIORITY_OPTIONS: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const statusLabel = (status: TaskStatus) =>
    BOARD_COLUMNS.find((column) => column.status === status)?.label ?? status.replace(/_/g, " ");
