import {
  Film,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react"

/**
 * How a post's status and type look, in one place.
 *
 * These maps were copied into six screens (calendar, approvals, post grid, post
 * detail, group view, task status) and had already drifted — the calendar's copy
 * used `dark:text-slate-350`, `dark:border-blue-850` and similar shades that do not
 * exist in Tailwind, so five of the nine statuses fell back to their light-mode text
 * colour and became unreadable on a dark background.
 *
 * Only the calendar reads this today. The other five can adopt it with an import
 * swap; that is a separate change to files this task did not need to touch.
 */

export type PostStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "C_APPROVED"
  | "REJECTED"
  | "SCHEDULED"
  | "POSTED"
  | "NEEDS_MINOR_CHANGE"
  | "RESUBMITTED"

export type PostType = "PHOTO" | "REEL" | "STORY" | "CAROUSEL" | "CUSTOM"

interface StatusStyle {
  /** Shown to people. "I Approve"/"C Approve" read as nonsense outside the team. */
  label: string
  /** Badge classes. Every dark: variant below is a shade Tailwind actually ships. */
  badge: string
  /** A 2px rail on calendar entries, so status survives being skimmed at a glance. */
  rail: string
  /** Sort weight for grouping — furthest along first. */
  rank: number
}

export const POST_STATUS: Record<PostStatus, StatusStyle> = {
  POSTED: {
    label: "Published",
    badge:
      "bg-emerald-600 text-white border-emerald-700 dark:bg-emerald-700 dark:border-emerald-800",
    rail: "bg-emerald-600 dark:bg-emerald-500",
    rank: 0,
  },
  SCHEDULED: {
    label: "Scheduled",
    badge:
      "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800",
    rail: "bg-violet-500",
    rank: 1,
  },
  C_APPROVED: {
    label: "Client approved",
    badge:
      "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
    rail: "bg-emerald-500",
    rank: 2,
  },
  APPROVED: {
    label: "Internally approved",
    badge:
      "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800",
    rail: "bg-sky-500",
    rank: 3,
  },
  SUBMITTED: {
    label: "In review",
    badge:
      "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
    rail: "bg-blue-500",
    rank: 4,
  },
  RESUBMITTED: {
    label: "Resubmitted",
    badge:
      "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
    rail: "bg-blue-400",
    rank: 5,
  },
  NEEDS_MINOR_CHANGE: {
    label: "Minor changes",
    badge:
      "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
    rail: "bg-amber-500",
    rank: 6,
  },
  REJECTED: {
    label: "Changes requested",
    badge:
      "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800",
    rail: "bg-rose-500",
    rank: 7,
  },
  DRAFT: {
    label: "Draft",
    badge: "bg-muted text-muted-foreground border-border",
    rail: "bg-muted-foreground/40",
    rank: 8,
  },
}

/** Unknown statuses render as a draft rather than throwing or showing a blank chip. */
export const statusStyle = (status: string): StatusStyle =>
  POST_STATUS[status as PostStatus] ?? POST_STATUS.DRAFT

export const statusLabel = (status: string): string => statusStyle(status).label

/**
 * Lucide icons rather than the emoji this used to use: emoji render differently on
 * every platform, cannot inherit colour, and are read aloud by screen readers.
 */
export const POST_TYPE_ICON: Record<PostType, LucideIcon> = {
  PHOTO: ImageIcon,
  REEL: Film,
  STORY: Zap,
  CAROUSEL: GalleryHorizontalEnd,
  CUSTOM: Sparkles,
}

export const typeIcon = (type: string): LucideIcon =>
  POST_TYPE_ICON[type as PostType] ?? POST_TYPE_ICON.CUSTOM

export const typeLabel = (type: string): string =>
  type.charAt(0) + type.slice(1).toLowerCase()
