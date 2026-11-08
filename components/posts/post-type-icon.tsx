import { typeIcon, typeLabel } from "@/lib/post-status"

/**
 * The content-type icon, from the one map in lib/post-status.ts. Replaces five copies of
 * an emoji map: emoji render differently per platform, ignore the theme colour, and are
 * read aloud by screen readers.
 */
export function PostTypeIcon({ type, className = "size-4" }: { type: string; className?: string }) {
  const Icon = typeIcon(type)
  return <Icon className={className} aria-hidden="true" />
}

export { typeLabel }
