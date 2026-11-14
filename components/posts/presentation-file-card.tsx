import { Download, Presentation } from "lucide-react"
import { getMediaUrl } from "@/lib/utils"
import { isPresentationUrl } from "@/lib/posts/content-types"

/** True for an uploaded .ppt/.pptx asset (by stored name, URL or MIME type). */
export function isPresentationAsset(asset: { url?: string | null; filename?: string | null; type?: string | null }) {
  return (
    !!asset.type?.includes("presentation") ||
    asset.type === "application/vnd.ms-powerpoint" ||
    isPresentationUrl(asset.filename ?? "") ||
    isPresentationUrl(asset.url ?? "")
  )
}

/**
 * Presentations cannot be rendered in the browser, so they show as a file with a
 * download link (served with Content-Disposition: attachment by /api/uploads).
 */
export function PresentationFileCard({
  asset,
  className = "",
}: {
  asset: { url: string; filename?: string | null; size?: number | null }
  className?: string
}) {
  const sizeMb = asset.size ? `${(asset.size / (1024 * 1024)).toFixed(1)} MB` : null
  return (
    <a
      href={getMediaUrl(asset.url)}
      download
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-orange-500/10 to-orange-500/5 p-4 text-center transition-colors hover:from-orange-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      aria-label={`Download presentation ${asset.filename ?? ""}`}
    >
      <Presentation className="size-10 text-orange-600 dark:text-orange-400" aria-hidden="true" />
      <span className="line-clamp-2 break-all text-xs font-medium text-foreground">{asset.filename ?? "Presentation"}</span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Download className="size-3" aria-hidden="true" />
        Download{sizeMb ? ` · ${sizeMb}` : ""}
      </span>
    </a>
  )
}
