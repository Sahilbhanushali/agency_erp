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
      bg: "bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-400",
      text: "text-white",
      sub: "text-indigo-100",
      num: "text-white",
      statusKey: "total",
    },
    {
      label: "Draft",
      blurb: "Not yet started",
      count: stats.draft,
      bg: "bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-400",
      text: "text-white",
      sub: "text-amber-100",
      num: "text-white",
      statusKey: "draft",
    },
    {
      label: "Overdue",
      blurb: "Needs immediate action",
      count: stats.overdue,
      bg: "bg-gradient-to-br from-rose-600 via-rose-500 to-pink-400",
      text: "text-white",
      sub: "text-rose-100",
      num: "text-white",
      statusKey: "overdue",
    },
    {
      label: "Under Review",
      blurb: "Awaiting approval",
      count: stats.pending,
      bg: "bg-gradient-to-br from-violet-600 via-violet-500 to-purple-400",
      text: "text-white",
      sub: "text-violet-100",
      num: "text-white",
      statusKey: "pending",
    },
    {
      label: "I Approve",
      blurb: "Ready / Scheduled / Posted",
      count: stats.approved,
      bg: "bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400",
      text: "text-white",
      sub: "text-emerald-100",
      num: "text-white",
      statusKey: "approved",
      extra:
        stats.approvedOnly !== undefined ? (
          <div className="flex gap-2 text-[10px] mt-2 font-medium bg-white/20 p-1.5 rounded text-white backdrop-blur-sm">
            <span>{stats.approvedOnly} Apprv</span>
            <span>•</span>
            <span>{stats.postedOnly} Sched/Post</span>
          </div>
        ) : null,
    },
    {
      label: "Changes",
      blurb: "Needs revision",
      count: stats.rejected || 0,
      bg: "bg-gradient-to-br from-slate-700 via-slate-600 to-slate-500",
      text: "text-white",
      sub: "text-slate-300",
      num: "text-white",
      statusKey: "changes",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`
            ${card.bg} rounded-2xl p-5 flex flex-col justify-between
            min-h-[165px] shadow-sm hover:shadow-md
            transition-shadow duration-300 relative group
          `}
        >
          {/* View icon button */}
          {onViewStatus && (
            <button
              onClick={() => onViewStatus(card.statusKey)}
              className="absolute top-3 right-3 transition-all duration-200
                         bg-white/20 hover:bg-white/35 rounded-lg p-1.5 backdrop-blur-sm
                         border border-white/20 hover:border-white/40 hover:scale-110"
              title={`View ${card.label}`}
            >
              <Eye className="h-3.5 w-3.5 text-white" />
            </button>
          )}

          <div>
            <p className={`text-[11px] font-extrabold uppercase tracking-wider ${card.text}`}>
              {card.label}
            </p>
            <p className={`text-[13px] font-semibold mt-1.5 leading-snug ${card.sub}`}>
              {card.blurb}
            </p>
          </div>
          <div>
            <span className={`text-4xl font-extrabold tracking-tight mt-4 block ${card.num}`}>
              {card.count}
            </span>
            {card.extra && card.extra}
          </div>
        </div>
      ))}
    </div>
  );
}