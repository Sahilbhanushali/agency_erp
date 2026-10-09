"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Users, Calendar, CheckCircle, XCircle, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DesignerPerformanceReport } from "@/components/designer-performance-report";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch report metrics");
  return res.json();
};

export default function ReportsPage() {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  // Generate last 12 months for dropdown
  const monthOptions = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      list.push({ value, label });
    }
    return list;
  }, []);

  const { data, error, isLoading } = useSWR(
    `/api/reports/metrics?timeframe=${selectedMonth}`,
    fetcher
  );

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Comprehensive insights into content workflow, approval rates, and team productivity.</p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-9 w-[180px] bg-card text-xs">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-medium cursor-pointer">
                All Time (Total)
              </SelectItem>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs font-medium cursor-pointer">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedMonth !== currentMonthKey && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedMonth(currentMonthKey)}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Reset to current month"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Posts</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="size-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-8 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{data?.totalPosts ?? 0}</div>
            )}
            <p className="text-[11px] text-muted-foreground font-medium">
              {selectedMonth === "all" ? "All time total" : "Selected month count"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Approval Rate</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="size-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-8 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{data?.approvalRate ?? "0"}%</div>
            )}
            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <TrendingUp className="size-3 text-emerald-600" />
              {selectedMonth === "all" ? "All time rate" : "Selected month rate"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Change Rate</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <XCircle className="size-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-8 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{data?.rejectionRate ?? "0"}%</div>
            )}
            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <TrendingDown className="size-3 text-rose-600" />
              {selectedMonth === "all" ? "All time rate" : "Selected month rate"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active Users</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Users className="size-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-8 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{data?.totalUsers ?? 0}</div>
            )}
            <p className="text-[11px] text-muted-foreground font-medium">Across {data?.totalClients ?? 0} clients</p>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <Card className="rounded-xl border border-border/70 bg-card shadow-2xs">
        <CardHeader className="pb-3 pt-5 px-6">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="font-medium">Workflow Efficiency</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Avg. Review Time</span>
                  <span>2.3 days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Revision Rate</span>
                  <span>18%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>On-time Delivery</span>
                  <span>94%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Content Performance</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Most Popular Type</span>
                  <Badge variant="secondary">Photo</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Peak Posting Time</span>
                  <span>2:00 PM</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Success Rate</span>
                  <span>96.2%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Team Productivity</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Posts per Designer</span>
                  <span>12.4/week</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Active Projects</span>
                  <span>8</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Workload Balance</span>
                  <span>Good</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DesignerPerformanceReport selectedPeriod={selectedMonth} onPeriodChange={setSelectedMonth} />
    </div>
  );
}
