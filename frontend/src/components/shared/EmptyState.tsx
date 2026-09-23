import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: LucideIcon;
  };
  children?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-xl border border-dashed border-border bg-card/50",
        className
      )}
    >
      {Icon && (
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted/80 text-muted-foreground mb-4 ring-1 ring-border">
          <Icon className="w-6 h-6" />
        </div>
      )}

      <h3 className="text-base font-semibold text-foreground tracking-tight">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-5">
          {action.onClick ? (
            <Button onClick={action.onClick} size="sm" className="gap-2">
              {ActionIcon && <ActionIcon className="w-4 h-4" />}
              <span>{action.label}</span>
            </Button>
          ) : action.href ? (
            <Button asChild size="sm" className="gap-2">
              <a href={action.href}>
                {ActionIcon && <ActionIcon className="w-4 h-4" />}
                <span>{action.label}</span>
              </a>
            </Button>
          ) : null}
        </div>
      )}

      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
