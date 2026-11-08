import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * What failed and a way to retry — so a failed load never looks like an empty list.
 * Pair with lib/fetcher.ts, which turns non-2xx responses into SWR errors.
 */
export function LoadError({
  what,
  error,
  onRetry,
  className = "",
}: {
  /** e.g. "leads" → "Could not load leads". */
  what: string
  error?: unknown
  onRetry?: () => void
  className?: string
}) {
  const detail = error instanceof Error ? error.message : null
  return (
    <div
      role="alert"
      className={`flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center ${className}`}
    >
      <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Could not load {what}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
