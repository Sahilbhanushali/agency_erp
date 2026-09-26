import type { PostStatus } from "@/types/post";

/**
 * Calendar chips are too small for a full badge, so each status gets a colour
 * chosen to match the variant StatusBadge already uses for it.
 */
export const STATUS_CHIP: Record<PostStatus, { dot: string; chip: string }> = {
  IDEA: {
    dot: "bg-neutral-400",
    chip: "border-neutral-300 dark:border-neutral-700",
  },
  DRAFT: {
    dot: "bg-neutral-400",
    chip: "border-neutral-300 dark:border-neutral-700",
  },
  IN_DESIGN: { dot: "bg-sky-500", chip: "border-sky-400/60" },
  IN_REVIEW: { dot: "bg-amber-500", chip: "border-amber-400/60" },
  NEEDS_REVISION: { dot: "bg-orange-500", chip: "border-orange-400/60" },
  APPROVED: { dot: "bg-emerald-500", chip: "border-emerald-400/60" },
  SCHEDULED: { dot: "bg-primary", chip: "border-primary/50" },
  PUBLISHED: { dot: "bg-emerald-600", chip: "border-emerald-500/60" },
  CANCELLED: {
    dot: "bg-neutral-300 dark:bg-neutral-600",
    chip: "border-neutral-200 dark:border-neutral-700",
  },
};

export const CALENDAR_LEGEND: PostStatus[] = [
  "IDEA",
  "IN_DESIGN",
  "IN_REVIEW",
  "NEEDS_REVISION",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
];
