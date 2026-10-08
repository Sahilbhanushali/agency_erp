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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">Comprehensive insights into your post management performance</p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-medium cursor-pointer">
                All Time (Total)
              </SelectItem>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value} className="font-medium cursor-pointer">
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
              className="h-9 px-2 text-xs"
              title="Reset to current month"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold">{data?.totalPosts ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {selectedMonth === "all" ? "All time total" : "Selected month count"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold">{data?.approvalRate ?? "0"}%</div>
            )}
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              {selectedMonth === "all" ? "All time rate" : "Selected month rate"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Change Rate</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold">{data?.rejectionRate ?? "0"}%</div>
            )}
            <p className="text-xs text-muted-foreground">
              <TrendingDown className="inline h-3 w-3 mr-1" />
              {selectedMonth === "all" ? "All time rate" : "Selected month rate"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold">{data?.totalUsers ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">Across {data?.totalClients ?? 0} clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
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
