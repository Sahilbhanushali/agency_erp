import { cn } from "@/lib/utils";
import { useState } from "react";

export interface DataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface TrendChartProps {
  data: DataPoint[];
  title?: string;
  subtitle?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  color?: string;
  secondaryColor?: string;
  height?: number;
  showGrid?: boolean;
  className?: string;
}

export default function TrendChart({
  data,
  title,
  subtitle,
  valuePrefix = "",
  valueSuffix = "",
  color = "oklch(0.585 0.22 264.02)",
  height = 200,
  showGrid = true,
  className,
}: TrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-xs text-muted-foreground",
          className
        )}
        style={{ height }}
      >
        No chart data available
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const secondaryValues = data.map((d) => d.secondaryValue ?? 0);
  const hasSecondary = data.some((d) => d.secondaryValue !== undefined);

  const allVals = hasSecondary ? [...values, ...secondaryValues] : values;
  const maxVal = Math.max(...allVals, 10);
  const minVal = 0;
  const range = maxVal - minVal;

  const width = 600;
  const svgHeight = height;
  const paddingX = 30;
  const paddingY = 24;
  const chartW = width - paddingX * 2;
  const chartH = svgHeight - paddingY * 2;

  const getX = (index: number) => {
    if (data.length <= 1) return paddingX + chartW / 2;
    return paddingX + (index / (data.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    return paddingY + chartH - ((val - minVal) / range) * chartH;
  };

  // Generate path
  const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`);
  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `M ${getX(0)},${getY(0)} L ${points.join(" L ")} L ${getX(
    data.length - 1
  )},${getY(0)} Z`;

  const activePoint = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className={cn("w-full flex flex-col", className)}>
      {(title || subtitle) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && (
              <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {activePoint && (
            <div className="text-end">
              <span className="text-xs text-muted-foreground">
                {activePoint.label}:{" "}
              </span>
              <span className="text-sm font-bold text-foreground font-mono">
                {valuePrefix}
                {activePoint.value.toLocaleString()}
                {valueSuffix}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="90%" stopColor={color} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {showGrid && (
            <g className="stroke-border/50" strokeDasharray="3 3">
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = paddingY + chartH * ratio;
                return (
                  <line
                    key={i}
                    x1={paddingX}
                    y1={y}
                    x2={width - paddingX}
                    y2={y}
                  />
                );
              })}
            </g>
          )}

          {/* Fill area */}
          <path d={areaPath} fill="url(#area-gradient)" />

          {/* Main Line */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive points & hover line */}
          {hoveredIndex !== null && (
            <line
              x1={getX(hoveredIndex)}
              y1={paddingY}
              x2={getX(hoveredIndex)}
              y2={paddingY + chartH}
              stroke="currentColor"
              className="text-muted-foreground/40"
              strokeDasharray="2 2"
              strokeWidth="1.5"
            />
          )}

          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.value);
            const isHovered = hoveredIndex === i;

            return (
              <g key={i}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5.5 : 3.5}
                  fill={isHovered ? color : "var(--card)"}
                  stroke={color}
                  strokeWidth={isHovered ? "2.5" : "2"}
                  className="transition-all duration-150 cursor-pointer"
                />
                {/* Invisible larger hover hit area */}
                <rect
                  x={cx - 15}
                  y={0}
                  width={30}
                  height={svgHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* X Axis Labels */}
        <div className="flex justify-between items-center px-4 pt-2 text-[10px] text-muted-foreground font-mono">
          {data.map((d, i) => (
            <span
              key={i}
              className={cn(
                "transition-colors",
                hoveredIndex === i ? "text-foreground font-semibold" : ""
              )}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
