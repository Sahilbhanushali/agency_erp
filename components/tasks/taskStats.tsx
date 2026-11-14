import React from "react";
import { Eye } from "lucide-react";

export type StatusFilter =
  | "total"
  | "draft"
  | "pending"
  | "approved"
  | "overdue"
  | "changes";

interface TaskStats {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  approvedOnly?: number;
  postedOnly?: number;
  overdue: number;
  thisWeek: number;
  nextWeek: number;
  rejected: number;
}

interface TaskStatsGridProps {
  stats: TaskStats;
  onViewStatus?: (status: StatusFilter) => void;
}

export default function TaskStatsGrid({ stats, onViewStatus }: TaskStatsGridProps) {
  const cards: Array<{
    label: string;
    blurb: string;
    count: number;
    bg: string;
    text: string;
    sub: string;
    num: string;
    statusKey: StatusFilter;
    extra?: React.ReactNode;
  }> = [
    {
      label: "Total Assigned",
      blurb: "All your tasks",
      count: stats.total,
      bg: "border-primary/20 bg-primary/5",
      text: "text-primary",
      sub: "text-muted-foreground",
      num: "text-foreground",
      statusKey: "total",
    },
    {
      label: "Draft",
      blurb: "Not yet started",
      count: stats.draft,
      bg: "border-border bg-card",
      text: "text-foreground",
      sub: "text-muted-foreground",
      num: "text-foreground",
      statusKey: "draft",
    },
    {
      label: "Overdue",
      blurb: "Needs immediate action",
      count: stats.overdue,
      bg: "border-destructive/20 bg-destructive/5",
      text: "text-destructive",
      sub: "text-muted-foreground",
      num: "text-destructive",
      statusKey: "overdue",
    },
    {
      label: "Under Review",
      blurb: "Awaiting approval",
      count: stats.pending,
      bg: "border-info/20 bg-info/5",
      text: "text-info",
      sub: "text-muted-foreground",
      num: "text-foreground",
      statusKey: "pending",
    },
    {
      label: "Approved",
      blurb: "Ready / Scheduled / Posted",
      count: stats.approved,
      bg: "border-success/20 bg-success/5",
      text: "text-success",
      sub: "text-muted-foreground",
      num: "text-success",
      statusKey: "approved",
      extra:
        stats.approvedOnly !== undefined ? (
          <div className="mt-2 flex gap-2 rounded border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground">
            <span>{stats.approvedOnly} Apprv</span>
            <span>•</span>
            <span>{stats.postedOnly} Sched/Post</span>
          </div>
        ) : null,
    },
    {
      label: "Rejected",
      blurb: "Needs revision",
      count: stats.rejected || 0,
      bg: "border-border bg-muted",
      text: "text-foreground",
      sub: "text-muted-foreground",
      num: "text-foreground",
      statusKey: "changes",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`
            ${card.bg} relative flex min-h-[140px] flex-col justify-between rounded-xl border p-4
            transition-colors duration-150 hover:border-primary/40
          `}
        >
          {/* View icon button */}
          {onViewStatus && (
            <button
              onClick={() => onViewStatus(card.statusKey)}
              aria-label={`View ${card.label} tasks`}
              className="absolute right-3 top-3 rounded-md border border-border bg-card p-1.5 text-primary transition-colors hover:bg-accent"
              title={`View ${card.label}`}
            >
              <Eye className="size-3.5" />
            </button>
          )}

          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${card.text}`}>
              {card.label}
            </p>
            <p className={`mt-1.5 text-xs leading-snug ${card.sub}`}>
              {card.blurb}
            </p>
          </div>
          <div>
            <span className={`mt-4 block text-3xl font-semibold tabular-nums tracking-tight ${card.num}`}>
              {card.count}
            </span>
            {card.extra && card.extra}
          </div>
        </div>
      ))}
    </div>
  );
}
