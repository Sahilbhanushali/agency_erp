"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Search,
  FolderOpen,
  Calendar,
  AlertCircle,
  FileText,
  Users,
  Eye,
  CheckCircle2,
  RefreshCcw,
  LayoutGrid,
  Video,
  Link as LinkIcon,
} from "lucide-react";
import { getMediaUrl } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatusFilter =
  | "total"
  | "draft"
  | "pending"
  | "approved"
  | "overdue"
  | "changes";

enum PostStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SCHEDULED = "SCHEDULED",
  POSTED = "POSTED",
  RESUBMITTED = "RESUBMITTED",
  NEEDS_MINOR_CHANGE = "NEEDS_MINOR_CHANGE",
}

interface Task {
  id: string;
  title: string;
  caption?: string;
  type: string;
  status: string;
  scheduledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  project?: {
    id?: string;
    name?: string;
    client?: { name: string; avatar?: string };
  };
  assets: Array<{
    id: string;
    filename: string;
    url: string;
    createdAt?: string;
    type?: string;
    isReference?: boolean;
  }>;
  platforms?: Array<{ id: string; platform: string }>;
  assignedToId?: number;
  assignedTo?: { name: string; email: string };
  feedback?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

interface ProjectGroup {
  projectId: string;
  projectName: string;
  clientName: string;
  tasks: Task[];
  stats: {
    total: number;
    draft: number;
    pending: number;
    approved: number;
    overdue: number;
    thisWeek: number;
    nextWeek: number;
    rejected?: number;
  };
}

interface StatusTasksViewProps {
  status: StatusFilter;
  projectGroups: ProjectGroup[];
  onBack: () => void;
  mutate?: () => void;
}

// ─── Config ───────────────────────────────────────────────────────────────────

type StatusConfigItem = {
  label: string;
  description: string;
  badgeColor: string;
  headerGradient: string;
  icon: React.ReactNode;
  accentBorder: string;
  chipClass: string;
  emptyMsg: string;
};

const STATUS_CONFIG: Record<StatusFilter, StatusConfigItem> = {
  total: {
    label: "All Tasks",
    description: "Every task assigned to you across all projects",
    badgeColor: "bg-indigo-100 text-indigo-700 border-indigo-200",
    headerGradient: "from-indigo-500 to-blue-500",
    icon: <LayoutGrid className="h-5 w-5 text-white" />,
    accentBorder: "border-l-indigo-400",
    chipClass: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    emptyMsg: "No tasks assigned yet",
  },
  draft: {
    label: "Draft Tasks",
    description: "Tasks not yet started or in early creation stage",
    badgeColor: "bg-amber-100 text-amber-700 border-amber-200",
    headerGradient: "from-amber-500 to-orange-500",
    icon: <FileText className="h-5 w-5 text-white" />,
    accentBorder: "border-l-amber-400",
    chipClass: "bg-amber-50 text-amber-700 border border-amber-200",
    emptyMsg: "No draft tasks",
  },
  pending: {
    label: "Under Review",
    description: "Tasks submitted and awaiting approval",
    badgeColor: "bg-violet-100 text-violet-700 border-violet-200",
    headerGradient: "from-violet-500 to-purple-500",
    icon: <Eye className="h-5 w-5 text-white" />,
    accentBorder: "border-l-violet-400",
    chipClass: "bg-violet-50 text-violet-700 border border-violet-200",
    emptyMsg: "No tasks under review",
  },
  approved: {
    label: "I Approve Tasks",
    description: "Tasks that have been approved, scheduled or posted",
    badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    headerGradient: "from-emerald-500 to-teal-500",
    icon: <CheckCircle2 className="h-5 w-5 text-white" />,
    accentBorder: "border-l-emerald-400",
    chipClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    emptyMsg: "No approved tasks yet",
  },
  overdue: {
    label: "Overdue Tasks",
    description: "Tasks past their design due date that need immediate action",
    badgeColor: "bg-rose-100 text-rose-700 border-rose-200",
    headerGradient: "from-rose-500 to-red-500",
    icon: <AlertCircle className="h-5 w-5 text-white" />,
    accentBorder: "border-l-rose-400",
    chipClass: "bg-rose-50 text-rose-700 border border-rose-200",
    emptyMsg: "No overdue tasks – great job!",
  },
  changes: {
    label: "Changes Required",
    description: "Tasks sent back for revision or minor adjustments",
    badgeColor: "bg-slate-200 text-slate-700 border-slate-300",
    headerGradient: "from-slate-600 to-slate-700",
    icon: <RefreshCcw className="h-5 w-5 text-white" />,
    accentBorder: "border-l-slate-400",
    chipClass: "bg-slate-100 text-slate-700 border border-slate-300",
    emptyMsg: "No tasks requiring changes",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600 border border-slate-200",
    SUBMITTED: "bg-violet-100 text-violet-700 border border-violet-200",
    RESUBMITTED: "bg-violet-100 text-violet-700 border border-violet-200",
    APPROVED: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    SCHEDULED: "bg-teal-100 text-teal-700 border border-teal-200",
    POSTED: "bg-green-100 text-green-700 border border-green-200",
    REJECTED: "bg-rose-100 text-rose-700 border border-rose-200",
    NEEDS_MINOR_CHANGE: "bg-orange-100 text-orange-700 border border-orange-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    APPROVED: "I Approve",
    C_APPROVED: "C Approve",
    REJECTED: "Rejected",
    SCHEDULED: "Scheduled",
    POSTED: "Posted",
    RESUBMITTED: "Resubmitted",
    NEEDS_MINOR_CHANGE: "Minor Change",
  };
  return map[status] ?? status;
}

function filterTasksByStatus(tasks: Task[], status: StatusFilter): Task[] {
  const today = new Date();
  switch (status) {
    case "total":
      return tasks;
    case "draft":
      // Matches: tasks.filter(task => task.status === PostStatus.DRAFT)
      return tasks.filter((t) => t.status === PostStatus.DRAFT);
    case "pending":
      // Matches: SUBMITTED | RESUBMITTED
      return tasks.filter((t) =>
        [PostStatus.SUBMITTED, PostStatus.RESUBMITTED].includes(t.status as PostStatus)
      );
    case "approved":
      // Matches: APPROVED | SCHEDULED | POSTED
      return tasks.filter((t) =>
        [PostStatus.APPROVED, PostStatus.SCHEDULED, PostStatus.POSTED].includes(
          t.status as PostStatus
        )
      );
    case "overdue":
      // Only designDueDate — no scheduledAt fallback
      return tasks.filter((t) => {
        if (!(t as any).designDueDate) return false;
        const designDueDate = new Date((t as any).designDueDate);
        return (
          designDueDate < today &&
          [PostStatus.DRAFT, PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE].includes(
            t.status as PostStatus
          )
        );
      });
    case "changes":
      // Matches: rejected stat = REJECTED only
      return tasks.filter((t) =>
        t.status === PostStatus.REJECTED || t.status === PostStatus.NEEDS_MINOR_CHANGE
      );
    default:
      return tasks;
  }
}


// ─── Mini Task Card ───────────────────────────────────────────────────────────

function MiniTaskCard({
  task,
  accentBorder,
}: {
  task: Task;
  accentBorder: string;
}) {
  const today = new Date();
  const designDue = (task as any).designDueDate
    ? new Date((task as any).designDueDate)
    : null;
  const isOverdue = designDue ? designDue < today : false;
  const daysLeft = designDue
    ? Math.ceil((designDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const platformColors: Record<string, string> = {
    INSTAGRAM: "bg-pink-100 text-pink-700",
    FACEBOOK: "bg-blue-100 text-blue-700",
    TWITTER: "bg-sky-100 text-sky-700",
    LINKEDIN: "bg-blue-200 text-blue-800",
    YOUTUBE: "bg-red-100 text-red-700",
  };

  const imageAssets = task.assets?.filter((a) => !a.isReference) ?? [];

  return (
    <Link
      href={`/dashboard/projects/posts/${task.id}`}
      className={`group bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border-l-4 ${accentBorder} p-4 flex flex-col gap-3 cursor-pointer no-underline`}
    >
      {/* Title + Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-800 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {task.title}
          </h4>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
            {task.type}
          </span>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusBadgeClass(task.status)}`}
        >
          {getStatusLabel(task.status)}
        </span>
      </div>

      {/* Thumbnail strip */}
      {imageAssets.length > 0 && (
        <div className="flex gap-1.5 overflow-hidden">
          {imageAssets.slice(0, 3).map((asset) => {
            const isVideo = ["mp4", "mov", "webm", "avi", "mkv"].some((ext) =>
              asset.filename?.toLowerCase().endsWith(ext)
            );
            const isLink = asset.type === "link";

            return (
              <div
                key={asset.id}
                className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center relative"
              >
                {isLink ? (
                  <LinkIcon className="h-5 w-5 text-blue-500" />
                ) : isVideo ? (
                  <div className="flex flex-col items-center justify-center text-slate-500">
                    <Video className="h-5 w-5 text-slate-600" />
                  </div>
                ) : (
                  <img
                    src={getMediaUrl(asset.url)}
                    alt={asset.filename}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target.src.includes("localhost") || target.src.includes("127.0.0.1")) {
                        try {
                          const parsed = new URL(target.src);
                          const prodFallback = `https://automation.rndtechnosoft.com${parsed.pathname}`;
                          if (target.src !== prodFallback) {
                            target.src = prodFallback;
                            return;
                          }
                        } catch {}
                      }
                      target.style.display = "none";
                    }}
                  />
                )}
              </div>
            );
          })}
          {imageAssets.length > 3 && (
            <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <span className="text-[10px] text-slate-500 font-bold">
                +{imageAssets.length - 3}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-50">
        {/* Platforms */}
        <div className="flex gap-1 flex-wrap">
          {task.platforms && task.platforms.length > 0 ? (
            <>
              {task.platforms.slice(0, 2).map((p) => (
                <span
                  key={p.id}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                    platformColors[p.platform] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {p.platform.charAt(0) + p.platform.slice(1).toLowerCase()}
                </span>
              ))}
              {task.platforms.length > 2 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-slate-100 text-slate-500">
                  +{task.platforms.length - 2}
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] text-slate-400">—</span>
          )}
        </div>

        {/* Due date */}
        {designDue && (
          <div
            className={`flex items-center gap-1 text-[11px] font-medium ${
              isOverdue
                ? "text-rose-600"
                : daysLeft !== null && daysLeft <= 3
                ? "text-amber-600"
                : "text-slate-500"
            }`}
          >
            {isOverdue ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <Calendar className="h-3 w-3" />
            )}
            <span>
              {isOverdue
                ? `${Math.abs(daysLeft!)}d late`
                : daysLeft === 0
                ? "Due today"
                : `${daysLeft}d left`}
            </span>
          </div>
        )}
      </div>

      {/* Feedback */}
      {task.feedback && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-[11px] text-amber-700 line-clamp-2">
          💬 {task.feedback}
        </div>
      )}
    </Link>
  );
}

// ─── Project Section ──────────────────────────────────────────────────────────

function ProjectSection({
  project,
  tasks,
  config,
  defaultOpen,
}: {
  project: ProjectGroup;
  tasks: Task[];
  config: StatusConfigItem;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left border-l-4 ${config.accentBorder}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${config.headerGradient} shadow-sm`}
          >
            <FolderOpen className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800 text-sm truncate">
                {project.projectName}
              </span>
              <span className="text-[11px] text-slate-400">•</span>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 text-slate-400" />
                <span className="text-xs text-slate-500 truncate">{project.clientName}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${config.chipClass}`}>
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Tasks */}
      {open && (
        <div className="px-5 pb-5 pt-3 bg-slate-50/50 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {tasks.map((task) => (
              <MiniTaskCard
                key={task.id}
                task={task}
                accentBorder={config.accentBorder}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function StatusTasksView({
  status,
  projectGroups,
  onBack,
}: StatusTasksViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const config = STATUS_CONFIG[status];

  const projectsWithTasks = useMemo(() => {
    return projectGroups
      .map((group) => ({
        project: group,
        tasks: filterTasksByStatus(group.tasks, status),
      }))
      .filter(({ tasks, project }) => {
        if (tasks.length === 0) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            project.projectName.toLowerCase().includes(q) ||
            project.clientName.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [projectGroups, status, searchQuery]);

  const totalCount = projectsWithTasks.reduce((s, { tasks }) => s + tasks.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mt-0.5 hover:bg-slate-100 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${config.headerGradient} shadow-md shrink-0`}
            >
              {config.icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{config.label}</h1>
              <p className="text-slate-500 text-sm mt-0.5">{config.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary gradient bar */}
      <div
        className={`bg-gradient-to-r ${config.headerGradient} p-5 rounded-2xl text-white shadow-sm`}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-wider">
                Total Tasks
              </p>
              <p className="text-4xl font-extrabold mt-0.5">{totalCount}</p>
            </div>
            <div className="h-12 w-px bg-white/20" />
            <div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-wider">
                Projects
              </p>
              <p className="text-4xl font-extrabold mt-0.5">{projectsWithTasks.length}</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-white/90 text-sm font-semibold">
              {projectsWithTasks.length} project{projectsWithTasks.length !== 1 ? "s" : ""}{" "}
              with {config.label.toLowerCase()}
            </p>
            <p className="text-white/60 text-xs mt-1">
              Click a project header to expand or collapse
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by project or client..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 rounded-xl border-slate-200 bg-white shadow-sm"
        />
      </div>

      {/* Project list */}
      {projectsWithTasks.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50">
          <CardContent className="py-16 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FolderOpen className="h-8 w-8 text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-slate-700 font-semibold text-lg">No tasks found</p>
              <p className="text-slate-400 text-sm mt-1">
                {searchQuery
                  ? "No projects match your search"
                  : config.emptyMsg}
              </p>
            </div>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="mt-2 text-slate-500 hover:text-slate-700"
              >
                Clear search
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {projectsWithTasks.map(({ project, tasks }, idx) => (
            <ProjectSection
              key={project.projectId}
              project={project}
              tasks={tasks}
              config={config}
              defaultOpen={idx === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
