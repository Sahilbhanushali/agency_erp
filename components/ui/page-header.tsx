import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  badge?: React.ReactNode
  children?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  badge,
  children,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 mb-6",
        className
      )}
      {...props}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{children}</div>
      )}
    </div>
  )
}
