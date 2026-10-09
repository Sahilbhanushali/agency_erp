import * as React from "react"
import { LucideIcon, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
  action?: { label: string; onClick?: () => void; href?: string } | React.ReactNode
  children?: React.ReactNode
}

export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  action,
  children,
  className,
  ...props
}: EmptyStateProps) {
  const isObjectAction = action && typeof action === "object" && "label" in (action as any)
  const finalActionLabel = isObjectAction ? (action as any).label : actionLabel
  const finalOnAction = isObjectAction ? (action as any).onClick : onAction
  const finalActionHref = isObjectAction ? (action as any).href : actionHref
  const isCustomActionNode = action && !isObjectAction

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-8 sm:p-12 text-center animate-in fade-in-50 duration-200",
        className
      )}
      {...props}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted/80 text-muted-foreground mb-4 shadow-2xs">
        <Icon className="size-6 shrink-0" />
      </div>
      <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      {finalActionLabel && (finalOnAction || finalActionHref) && (
        <div className="mt-5">
          {finalActionHref ? (
            <Button asChild size="sm">
              <a href={finalActionHref}>{finalActionLabel}</a>
            </Button>
          ) : (
            <Button size="sm" onClick={finalOnAction}>
              {finalActionLabel}
            </Button>
          )}
        </div>
      )}
      {isCustomActionNode && <div className="mt-5">{action as React.ReactNode}</div>}
      {children}
    </div>
  )
}
