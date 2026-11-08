"use client";

import { POST_CONTENT_TYPES } from "@/lib/posts/content-types";
import {useMemo} from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface PostFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  projectFilter: string;
  setProjectFilter: (value: string) => void;
  yearFilter: string;
  setYearFilter: (value: string) => void;
  monthFilter: number | "all";
  setMonthFilter: (value: number | "all") => void;
  uniqueProjects: Array<{ id: string; name: string }>;
  uniqueYears: string[]; // Note: This prop is kept for compatibility but will be overridden
  monthPostCounts: { [key: number]: number };
  projectStrategies?: Array<{
    id: number;
    month?: number;
    year?: number;
    total?: number;
    postTypes?: Record<string, number>;
  }>;
  hideProjectFilter?: boolean;
  defaultProjectTotal?: number;
}

const MONTHS = [
  { short: "JAN", full: "January", number: 1 },
  { short: "FEB", full: "February", number: 2 },
  { short: "MAR", full: "March", number: 3 },
  { short: "APR", full: "April", number: 4 },
  { short: "MAY", full: "May", number: 5 },
  { short: "JUN", full: "June", number: 6 },
  { short: "JUL", full: "July", number: 7 },
  { short: "AUG", full: "August", number: 8 },
  { short: "SEP", full: "September", number: 9 },
  { short: "OCT", full: "October", number: 10 },
  { short: "NOV", full: "November", number: 11 },
  { short: "DEC", full: "December", number: 12 },
];

export default function PostFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  projectFilter,
  setProjectFilter,
  yearFilter,
  setYearFilter,
  monthFilter,
  setMonthFilter,
  uniqueProjects,
  uniqueYears,
  monthPostCounts,
  projectStrategies = [],
  hideProjectFilter,
  defaultProjectTotal = 0,
}: PostFiltersProps) {
  // Derive unique years from projectStrategies
  const strategyYears = useMemo(() => {
    const years = new Set<string>();
    projectStrategies.forEach((strategy) => {
      if (strategy.year) {
        years.add(strategy.year.toString());
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [projectStrategies]);

  const plannedPostsByMonth = useMemo(() => {
    let earliestNonZeroDate = new Date(9999, 11);
    projectStrategies.forEach(s => {
      const total = s.total || (s.postTypes ? Object.values(s.postTypes).reduce((sum, count) => sum + count, 0) : 0);
      if (total > 0 && s.year && s.month) {
        const d = new Date(s.year, s.month - 1);
        if (d < earliestNonZeroDate) {
          earliestNonZeroDate = d;
        }
      }
    });

    return MONTHS.reduce((acc, month) => {
      const strategy = projectStrategies.find(
        (s) => s.month === month.number && s.year?.toString() === yearFilter
      );
      
      let monthTotal = 0;
      if (strategy) {
        if (strategy.total) {
          monthTotal = strategy.total;
        } else if (strategy.postTypes) {
          monthTotal = Object.values(strategy.postTypes).reduce((sum, count) => sum + count, 0);
        }
      }
      
      let isAfterOrEqualEarliest = false;
      if (yearFilter !== "all") {
         const currentDate = new Date(parseInt(yearFilter), month.number - 1);
         isAfterOrEqualEarliest = currentDate >= earliestNonZeroDate;
      }
      
      if (monthTotal === 0 && defaultProjectTotal > 0 && isAfterOrEqualEarliest) {
        monthTotal = defaultProjectTotal;
      }
      
      acc[month.number] = monthTotal;
      return acc;
    }, {} as { [key: number]: number });
  }, [projectStrategies, yearFilter, defaultProjectTotal]);

  

  return (
    <Card className="rounded-xl border border-border/70 bg-card shadow-2xs">
      <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
        <CardTitle className="text-sm font-semibold tracking-tight text-foreground uppercase tracking-wider text-muted-foreground">Filters & Navigation</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input aria-label="Search posts, captions, or clients"
              placeholder="Search posts, captions, or clients..."
              className="pl-9 h-9 text-xs bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Status" className="w-[125px] h-9 text-xs bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Status</SelectItem>
                <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                <SelectItem value="draft" className="text-xs">Draft</SelectItem>
                <SelectItem value="submitted" className="text-xs">Submitted</SelectItem>
                <SelectItem value="resubmitted" className="text-xs">Re-Submitted</SelectItem>
                <SelectItem value="approved" className="text-xs">Approved</SelectItem>
                <SelectItem value="c_approved" className="text-xs">Client approved</SelectItem>
                <SelectItem value="rejected" className="text-xs">Changes</SelectItem>
                <SelectItem value="scheduled" className="text-xs">Scheduled</SelectItem>
                <SelectItem value="posted" className="text-xs">Posted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger aria-label="Type" className="w-[120px] h-9 text-xs bg-background">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Types</SelectItem>
                {/* From the shared type list, so every real type (incl. PPT) is filterable
                    and none that does not exist (the old "Video") is offered. */}
                {POST_CONTENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value.toLowerCase()} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!hideProjectFilter && (
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger aria-label="Project" className="w-[130px] h-9 text-xs bg-background">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Projects</SelectItem>
                  {uniqueProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id} className="text-xs">
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger aria-label="Year" className="w-[110px] h-9 text-xs bg-background">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Years</SelectItem>
                {strategyYears.map((year) => (
                  <SelectItem key={year} value={year} className="text-xs">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/60">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Month Breakdown:</span>
            <Button
              variant={monthFilter === "all" ? "default" : "outline"}
              size="xs"
              onClick={() => setMonthFilter("all")}
              className={`h-7 px-2.5 text-xs font-semibold ${
                monthFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ALL
            </Button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
            {MONTHS.map((month) => {
              const plannedPosts = plannedPostsByMonth[month.number] || 0;
              const scheduledPosts = monthPostCounts[month.number] || 0;
              const isSelected = monthFilter === month.number;
              return (
                <Button
                  key={month.short}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMonthFilter(month.number)}
                  className={`h-9 px-1 text-xs transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : "bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex flex-col items-center leading-none gap-0.5">
                    <span className="text-xs font-semibold">{month.short}</span>
                    <span className="text-xs opacity-80 tabular-nums">
                      ({scheduledPosts}/{plannedPosts})
                    </span>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}