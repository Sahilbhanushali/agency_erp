import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number | ReactNode;
  icon: LucideIcon;
  change?: {
    value: string | number;
    trend: "up" | "down" | "neutral";
    label?: string;
  };
  description?: string;
  color?: "primary" | "emerald" | "amber" | "rose" | "sky" | "indigo";
  sparklineData?: number[];
  className?: string;
  onClick?: () => void;
}

const COLOR_MAP = {
  primary: {
    badge: "bg-primary/10 text-primary border-primary/20",
    stroke: "oklch(0.585 0.22 264.02)",
  },
  emerald: {
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    stroke: "#10b981",
  },
  amber: {
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    stroke: "#f59e0b",
  },
  rose: {
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    stroke: "#f43f5e",
  },
  sky: {
    badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    stroke: "#0ea5e9",
  },
  indigo: {
    badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    stroke: "#6366f1",
  },
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  change,
  description,
  color = "primary",
  sparklineData,
  className,
  onClick,
}: StatCardProps) {
  const styles = COLOR_MAP[color] ?? COLOR_MAP.primary;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs transition-all duration-200 hover:shadow-sm flex flex-col justify-between",
        onClick && "cursor-pointer hover:border-primary/40",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg border",
            styles.badge
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums">
          {value}
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <div className="w-20 h-8 shrink-0">
            <svg
              viewBox="0 0 100 32"
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient
                  id={`sparkline-grad-${label}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={styles.stroke} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={styles.stroke} stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {(() => {
                const min = Math.min(...sparklineData);
                const max = Math.max(...sparklineData);
                const range = max - min || 1;
                const points = sparklineData
                  .map((val, idx) => {
                    const x = (idx / (sparklineData.length - 1)) * 100;
                    const y = 28 - ((val - min) / range) * 24;
                    return `${x},${y}`;
                  })
                  .join(" ");

                const areaPath = `M 0,30 L ${points} L 100,30 Z`;

                return (
                  <>
                    <path
                      d={areaPath}
                      fill={`url(#sparkline-grad-${label})`}
                    />
                    <polyline
                      fill="none"
                      stroke={styles.stroke}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={points}
                    />
                  </>
                );
              })()}
            </svg>
          </div>
        )}
      </div>

      {(change || description) && (
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-1.5 text-xs">
          {change && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                change.trend === "up" && "text-emerald-600 dark:text-emerald-400",
                change.trend === "down" && "text-rose-600 dark:text-rose-400",
                change.trend === "neutral" && "text-muted-foreground"
              )}
            >
              {change.trend === "up" ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : change.trend === "down" ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : null}
              {change.value}
            </span>
          )}

          <span className="text-muted-foreground truncate">
            {change?.label ?? description}
          </span>
        </div>
      )}
    </div>
  );
}
