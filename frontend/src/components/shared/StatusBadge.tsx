import { cn } from "@/lib/utils";

type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "primary";

interface StatusConfig {
  label: string;
  variant: StatusVariant;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  // Common / Boolean
  ACTIVE: { label: "Active", variant: "success" },
  INACTIVE: { label: "Inactive", variant: "neutral" },
  TRUE: { label: "Active", variant: "success" },
  FALSE: { label: "Inactive", variant: "neutral" },

  // Tasks
  TODO: { label: "To Do", variant: "neutral" },
  IN_PROGRESS: { label: "In Progress", variant: "info" },
  IN_REVIEW: { label: "In Review", variant: "warning" },
  NEEDS_REVISION: { label: "Needs Revision", variant: "warning" },
  ADMIN_APPROVED: { label: "Approved", variant: "success" },
  CLIENT_PENDING: { label: "Client Pending", variant: "warning" },
  DONE: { label: "Done", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },

  // Priorities
  LOW: { label: "Low", variant: "neutral" },
  MEDIUM: { label: "Medium", variant: "info" },
  HIGH: { label: "High", variant: "warning" },
  URGENT: { label: "Urgent", variant: "danger" },

  // Projects
  DRAFT: { label: "Draft", variant: "neutral" },
  PLANNED: { label: "Planned", variant: "info" },
  CHANGES_REQUESTED: { label: "Changes Requested", variant: "warning" },

  // Sales pipeline
  NEW: { label: "New", variant: "neutral" },
  CONTACTED: { label: "Contacted", variant: "info" },
  QUALIFIED: { label: "Qualified", variant: "primary" },
  PROPOSAL: { label: "Proposal", variant: "warning" },
  NEGOTIATION: { label: "Negotiation", variant: "warning" },
  WON: { label: "Won", variant: "success" },
  LOST: { label: "Lost", variant: "neutral" },

  // Content production
  IDEA: { label: "Idea", variant: "neutral" },
  IN_DESIGN: { label: "In Design", variant: "info" },
  APPROVED: { label: "Approved", variant: "success" },
  SCHEDULED: { label: "Scheduled", variant: "primary" },
  PUBLISHED: { label: "Published", variant: "success" },
  PAUSED: { label: "Paused", variant: "warning" },
  ON_HOLD: { label: "On Hold", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  ARCHIVED: { label: "Archived", variant: "neutral" },

  // Invoices & Quotations
  SENT: { label: "Sent", variant: "info" },
  VIEWED: { label: "Viewed", variant: "info" },
  PARTIAL: { label: "Partial", variant: "warning" },
  PAID: { label: "Paid", variant: "success" },
  OVERDUE: { label: "Overdue", variant: "danger" },
  REFUNDED: { label: "Refunded", variant: "primary" },
  ACCEPTED: { label: "Accepted", variant: "success" },
  REJECTED: { label: "Rejected", variant: "danger" },
  EXPIRED: { label: "Expired", variant: "neutral" },

  // Users
  SUSPENDED: { label: "Suspended", variant: "danger" },
  INVITED: { label: "Invited", variant: "info" },
};

const VARIANT_STYLES: Record<
  StatusVariant,
  { badge: string; dot: string }
> = {
  success: {
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  warning: {
    badge:
      "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  danger: {
    badge:
      "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
    dot: "bg-rose-500 dark:bg-rose-400",
  },
  info: {
    badge:
      "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60",
    dot: "bg-sky-500 dark:bg-sky-400",
  },
  primary: {
    badge:
      "bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60",
    dot: "bg-indigo-500 dark:bg-indigo-400",
  },
  neutral: {
    badge:
      "bg-neutral-100 text-neutral-700 border-neutral-200/80 dark:bg-neutral-800/60 dark:text-neutral-300 dark:border-neutral-700/60",
    dot: "bg-neutral-400 dark:bg-neutral-500",
  },
};

interface StatusBadgeProps {
  status: string | boolean;
  label?: string;
  withDot?: boolean;
  className?: string;
}

export default function StatusBadge({
  status,
  label,
  withDot = true,
  className,
}: StatusBadgeProps) {
  const key =
    typeof status === "boolean"
      ? status
        ? "TRUE"
        : "FALSE"
      : String(status).toUpperCase();

  const config = STATUS_MAP[key] ?? {
    label: label ?? String(status),
    variant: "neutral" as StatusVariant,
  };

  const displayText = label ?? config.label;
  const styles = VARIANT_STYLES[config.variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium tracking-wide uppercase border transition-colors select-none",
        styles.badge,
        className
      )}
    >
      {withDot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", styles.dot)}
          aria-hidden="true"
        />
      )}
      <span>{displayText}</span>
    </span>
  );
}
