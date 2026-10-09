import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none transition-colors overflow-hidden tracking-tight",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-destructive/20 bg-destructive/10 text-destructive dark:bg-destructive/20 dark:border-destructive/30",
        outline:
          "border-border/80 text-muted-foreground bg-background hover:bg-accent hover:text-foreground",
        success:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20 dark:border-emerald-500/30",
        warning:
          "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20 dark:border-amber-500/30",
        info:
          "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 dark:bg-blue-500/20 dark:border-blue-500/30",
        purple:
          "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400 dark:bg-violet-500/20 dark:border-violet-500/30",
        neutral:
          "border-border/60 bg-muted/60 text-muted-foreground",
      },
      size: {
        default: "px-2.5 py-0.5 text-[11px]",
        sm: "px-2 py-0.25 text-[10px]",
        lg: "px-3 py-1 text-xs",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean
  dot?: boolean
  dotColor?: string
}

function Badge({
  className,
  variant,
  size,
  asChild = false,
  dot = false,
  dotColor,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full shrink-0",
            dotColor || "bg-current"
          )}
        />
      )}
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }
