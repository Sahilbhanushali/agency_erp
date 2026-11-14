"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"

/**
 * A single-measure trend over time.
 *
 * Hand-drawn SVG rather than a charting library: no charting dependency is installed
 * here and adding one needs asking first, and one series on one axis is about forty
 * lines of geometry. Deliberately one measure at a time — reach and interactions
 * differ by an order of magnitude, and putting them on two y-scales in one frame is
 * the classic way to imply a relationship that is not in the data.
 *
 * The series colour is the validated blue, checked against this app's own card
 * surfaces in both modes (contrast >= 3:1, inside the lightness band).
 */

export interface TrendPoint {
  date: string
  value: number | null
}

const PAD = { top: 12, right: 14, bottom: 24, left: 48 }
const HEIGHT = 240

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })
const full = new Intl.NumberFormat("en")

/** A round number at or above the peak, so the axis reads in human steps. */
function niceMax(value: number): number {
  if (value <= 0) return 10
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

export function InsightsChart({ points, label }: { points: TrendPoint[]; label: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  // Measured rather than a scaled viewBox, which would stretch the stroke and text.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(320, entry.contentRect.width))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const chart = useMemo(() => {
    const values = points.map((p) => p.value ?? 0)
    const max = niceMax(Math.max(...values, 0))
    const innerW = Math.max(width - PAD.left - PAD.right, 10)
    const innerH = HEIGHT - PAD.top - PAD.bottom

    const x = (i: number) =>
      PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
    const y = (v: number) => PAD.top + innerH - (v / max) * innerH

    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value ?? 0)}`).join(" ")
    const area =
      points.length > 0
        ? `${line} L${x(points.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`
        : ""

    return { max, innerH, x, y, line, area, ticks: [0, 0.25, 0.5, 0.75, 1] }
  }, [points, width])

  if (points.length === 0) {
    return (
      <div className="grid h-[240px] place-items-center rounded-lg border border-dashed border-border">
        <p className="text-sm text-muted-foreground">No data for this period yet.</p>
      </div>
    )
  }

  const active = hover !== null ? points[hover] : null

  return (
    <div className="space-y-2">
      <div ref={wrapRef} className="relative w-full">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${label} per day. Use the data table below for exact values.`}
          className="touch-none select-none overflow-visible"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect()
            const innerW = Math.max(width - PAD.left - PAD.right, 10)
            const ratio = (e.clientX - box.left - PAD.left) / innerW
            const index = Math.round(ratio * (points.length - 1))
            setHover(Math.min(Math.max(index, 0), points.length - 1))
          }}
        >
          {/* Recessive grid — present enough to read a value against, not to compete. */}
          {chart.ticks.map((t) => {
            const yy = PAD.top + chart.innerH - t * chart.innerH
            return (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={yy}
                  y2={yy}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={yy + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-xs tabular-nums"
                >
                  {compact.format(Math.round(chart.max * t))}
                </text>
              </g>
            )
          })}

          <path d={chart.area} fill="var(--viz-series)" opacity={0.12} />
          <path
            d={chart.line}
            fill="none"
            stroke="var(--viz-series)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Only the first, middle and last date are labelled; every date collides. */}
          {[0, Math.floor(points.length / 2), points.length - 1]
            .filter((i, idx, arr) => arr.indexOf(i) === idx && points[i])
            .map((i) => (
              <text
                key={i}
                x={chart.x(i)}
                y={HEIGHT - 6}
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                className="fill-muted-foreground text-xs"
              >
                {format(new Date(points[i].date), "d MMM")}
              </text>
            ))}

          {active && hover !== null && (
            <g pointerEvents="none">
              <line
                x1={chart.x(hover)}
                x2={chart.x(hover)}
                y1={PAD.top}
                y2={PAD.top + chart.innerH}
                className="stroke-muted-foreground"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {/* 2px surface ring, so the marker reads against the line beneath it. */}
              <circle
                cx={chart.x(hover)}
                cy={chart.y(active.value ?? 0)}
                r={5}
                fill="var(--viz-series)"
                className="stroke-card"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {active && hover !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-md"
            style={{ left: chart.x(hover), top: chart.y(active.value ?? 0) - 10 }}
            role="status"
          >
            <span className="block font-medium tabular-nums text-popover-foreground">
              {full.format(active.value ?? 0)}
            </span>
            <span className="block text-xs text-muted-foreground">
              {format(new Date(active.date), "EEE d MMM")}
            </span>
          </div>
        )}
      </div>

      {/* Identity and exact values without relying on reading a line. */}
      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        aria-expanded={showTable}
        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {showTable ? "Hide data table" : "Show data table"}
      </button>

      {showTable && (
        <div className="max-h-56 overflow-y-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">{label} per day</caption>
            <thead className="sticky top-0 bg-muted/60">
              <tr>
                <th scope="col" className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">
                  Date
                </th>
                <th scope="col" className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">
                  {label}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-t border-border">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal text-muted-foreground">
                    {format(new Date(p.date), "EEE d MMM yyyy")}
                  </th>
                  <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                    {p.value === null ? "—" : full.format(p.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
