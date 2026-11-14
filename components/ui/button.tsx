import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-sm active:bg-primary/95",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/30 dark:bg-destructive/80 dark:hover:bg-destructive",
        outline:
          "border border-border/80 bg-background shadow-2xs hover:bg-accent/70 hover:text-accent-foreground hover:border-border dark:bg-card/40 dark:hover:bg-accent/60",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent/70 hover:text-accent-foreground text-muted-foreground hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto font-normal",
        subtle: "bg-primary-subtle text-primary hover:bg-primary-subtle/80 font-medium",
      },
      size: {
        default: "h-9 px-3.5 py-2 has-[>svg]:px-3 text-xs sm:text-sm",
        xs: "h-7 rounded-md gap-1 px-2 text-xs",
        sm: "h-8 rounded-md gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-5 text-sm has-[>svg]:px-4",
        // Icon buttons look compact but get an invisible ≥40–44px tap area (::after),
        // so they meet touch-target guidance without changing any layout.
        icon: "size-9 relative after:absolute after:content-[''] after:-inset-1.5 after:rounded-[inherit]",
        "icon-sm": "size-8 relative after:absolute after:content-[''] after:-inset-1.5 after:rounded-[inherit]",
        "icon-xs": "size-7 relative after:absolute after:content-[''] after:-inset-2 after:rounded-[inherit]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Slot>
    )
  }

  return (
    <button
      data-slot="button"
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin shrink-0 text-current" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

export { Button, buttonVariants }
