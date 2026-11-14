import Link from "next/link"
import { MessagesSquare } from "lucide-react"

/** "3 new" pill linking straight to a post's discussion; renders nothing when read. */
export function UnreadDiscussionBadge({ postId, count }: { postId: string; count?: number }) {
  if (!count) return null
  return (
    <Link
      href={`/dashboard/projects/posts/${postId}?tab=discussion`}
      className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${count} unread discussion message${count === 1 ? "" : "s"}`}
      onClick={(e) => e.stopPropagation()}
    >
      <MessagesSquare className="size-3" aria-hidden="true" />
      {count > 99 ? "99+" : count}
    </Link>
  )
}
