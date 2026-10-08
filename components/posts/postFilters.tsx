"use client";

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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Filters</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search posts, captions, or clients..."
              className="pl-10 h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="resubmitted">Re-Submitted</SelectItem>
                <SelectItem value="approved">I Approve</SelectItem>
                <SelectItem value="c_approved">C Approve</SelectItem>
                <SelectItem value="rejected">Changes</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[120px] h-9 text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="photo">Photo</SelectItem>
                <SelectItem value="reel">Reel</SelectItem>
                <SelectItem value="story">Story</SelectItem>
                <SelectItem value="carousel">Carousel</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {!hideProjectFilter && (
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[120px] h-9 text-sm">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {uniqueProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[120px] h-9 text-sm">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {strategyYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">Filter by Month:</span>
            <Button
              variant={monthFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setMonthFilter("all")}
              className={`h-8 min-w-[50px] text-xs ${
                monthFilter === "all"
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "hover:bg-blue-100 dark:hover:bg-blue-950/40 dark:text-foreground"
              }`}
            >
              ALL
            </Button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
            {MONTHS.map((month) => {
              const plannedPosts = plannedPostsByMonth[month.number] || 0;
              const scheduledPosts = monthPostCounts[month.number] || 0;
              return (
                <Button
                  key={month.short}
                  variant={monthFilter === month.number ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMonthFilter(month.number)}
                  className={`h-10 text-xs ${
                    monthFilter === month.number
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "hover:bg-blue-100 dark:hover:bg-blue-950/40 dark:text-foreground"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span>{month.short}</span>
                    <span className="text-[10px] opacity-70">
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