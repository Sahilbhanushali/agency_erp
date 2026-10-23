"use client";

import { useLiveRefresh } from "@/hooks/use-live-refresh"

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  FileCheck2,
  CheckCircle2,
  UserCheck,
  TrendingUp,
  Clock,
  ArrowRight,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { HRMS_STAGES, STAGE_CONFIG, HrmsStage } from "@/lib/hrms/types";
import { formatCurrencyINR, formatDatePretty } from "@/lib/hrms/placeholder-engine";

interface DashboardStats {
  totalCandidates: number;
  activeJobOpenings: number;
  stageCounts: Record<string, number>;
  todayInterviewsCount: number;
  upcomingInterviewsCount: number;
  pendingOffersCount: number;
  acceptedOffersCount: number;
  offerAcceptanceRate: number;
  candidatesAwaitingOnboardingCount: number;
  recentlyUpdatedCandidates: any[];
  recentActivities: any[];
  upcomingInterviewsList: any[];
}

interface HrmsDashboardTabProps {
  onNavigateTab: (tab: string) => void;
  onSelectCandidate?: (candidateId: string) => void;
}

export function HrmsDashboardTab({ onNavigateTab, onSelectCandidate }: HrmsDashboardTabProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedJob, setSelectedJob] = useState("ALL");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedStage, setSelectedStage] = useState("ALL");

  const fetchStats = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (selectedJob !== "ALL") params.set("jobOpeningId", selectedJob);
      if (selectedDept !== "ALL") params.set("department", selectedDept);
      if (selectedStage !== "ALL") params.set("stage", selectedStage);

      const res = await fetch(`/api/hrms/stats?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load statistics");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Dashboard stats error:", err);
    } finally {
      setLoading(false);
    }
  };
  // Live: re-read when someone else changes what this shows.
  useLiveRefresh(() => fetchStats({ silent: true }), ["HrmsJobOpening", "HrmsCandidate", "HrmsApplication", "HrmsInterview", "HrmsOffer", "HrmsOnboarding"])

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/hrms/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate, selectedJob, selectedDept, selectedStage]);

  const departments = Array.from(new Set(jobs.map((j) => j.department))).filter(Boolean);

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedJob("ALL");
    setSelectedDept("ALL");
    setSelectedStage("ALL");
  };


  return (
    <div className="space-y-6">
      {/* Interactive Filters Bar */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-xs shadow-xs">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-1">
                <Filter className="size-3.5 text-primary" />
                <span>Filters:</span>
              </div>

              {/* Job Selector */}
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger className="h-8 text-xs w-[180px]">
                  <SelectValue placeholder="All Job Openings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Job Openings</SelectItem>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Department Selector */}
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="h-8 text-xs w-[150px]">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Stage Filter */}
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger className="h-8 text-xs w-[160px]">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Hiring Stages</SelectItem>
                  {HRMS_STAGES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date Pickers */}
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs w-[125px]"
                  title="Filter From Date"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs w-[125px]"
                  title="Filter To Date"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 self-end lg:self-auto">
              {(startDate || endDate || selectedJob !== "ALL" || selectedDept !== "ALL" || selectedStage !== "ALL") && (
                <Button variant="ghost" size="xs" onClick={resetFilters} className="text-xs text-muted-foreground">
                  Reset
                </Button>
              )}
              <Button
                variant="outline"
                size="xs"
                onClick={() => fetchStats()}
                disabled={loading}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metric Stat Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4">
        {/* Total Candidates */}
        <Card
          className="border-border/60 hover:border-primary/40 transition-all cursor-pointer shadow-xs"
          onClick={() => onNavigateTab("candidates")}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Candidates</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Users className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {stats?.totalCandidates ?? "..."}
              </span>
              <span className="text-xs text-muted-foreground">in talent pool</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Openings */}
        <Card
          className="border-border/60 hover:border-primary/40 transition-all cursor-pointer shadow-xs"
          onClick={() => onNavigateTab("jobs")}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Active Openings</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Briefcase className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {stats?.activeJobOpenings ?? "..."}
              </span>
              <span className="text-xs text-muted-foreground">positions open</span>
            </div>
          </CardContent>
        </Card>

        {/* Interviews Scheduled Today & Upcoming */}
        <Card
          className="border-border/60 hover:border-primary/40 transition-all cursor-pointer shadow-xs"
          onClick={() => onNavigateTab("interviews")}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Today's Interviews</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <CalendarCheck className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {stats?.todayInterviewsCount ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">
                ({stats?.upcomingInterviewsCount ?? 0} upcoming total)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Pending Offers & Acceptance Rate */}
        <Card
          className="border-border/60 hover:border-primary/40 transition-all cursor-pointer shadow-xs"
          onClick={() => onNavigateTab("offers")}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Pending Offers</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <FileCheck2 className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {stats?.pendingOffersCount ?? 0}
              </span>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                {stats?.offerAcceptanceRate ?? 0}% accepted
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Funnel & Stage Breakdown */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Hiring Pipeline Funnel</CardTitle>
              <CardDescription className="text-xs">
                Candidate distribution across the 15 recruitment lifecycle stages
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => onNavigateTab("pipeline")}
              className="gap-1 text-xs"
            >
              <span>Open Kanban Board</span>
              <ArrowRight className="size-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mt-2">
            {HRMS_STAGES.map((stage) => {
              const count = stats?.stageCounts?.[stage] || 0;
              const config = STAGE_CONFIG[stage];
              return (
                <div
                  key={stage}
                  onClick={() => onNavigateTab("pipeline")}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer hover:shadow-xs ${config.bg} ${config.border}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-semibold truncate ${config.color}`}>
                      {stage}
                    </span>
                    <Badge variant={config.badgeVariant} className="text-[10px] px-1.5 py-0 h-4 font-bold">
                      {count}
                    </Badge>
                  </div>
                  <div className="mt-2 w-full bg-background/50 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{
                        width: stats?.totalCandidates ? `${Math.min(100, (count / stats.totalCandidates) * 100)}%` : "0%",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout: Upcoming Interviews & Onboarding / Recent Candidates */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Upcoming Interviews Today & This Week */}
        <Card className="border-border/60 shadow-xs lg:col-span-1">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Upcoming Interviews</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onNavigateTab("interviews")}
                className="text-xs text-primary"
              >
                View Calendar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-2 space-y-3">
            {stats?.upcomingInterviewsList && stats.upcomingInterviewsList.length > 0 ? (
              stats.upcomingInterviewsList.map((interview) => (
                <div
                  key={interview.id}
                  className="rounded-lg border border-border/60 p-3 bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        {interview.candidate?.name}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">{interview.title}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {interview.type}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3 text-amber-500" />
                      {formatDatePretty(interview.scheduledDate)} at {interview.startTime}
                    </span>
                    {interview.meetingLink && (
                      <a
                        href={interview.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-0.5 text-[10px]"
                      >
                        Join <ExternalLink className="size-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No interviews scheduled for today or upcoming.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Center/Right: Onboarding Queue & Recently Updated Candidates */}
        <div className="space-y-6 lg:col-span-2">
          {/* Onboarding Banner Card */}
          <Card className="border-border/60 shadow-xs bg-linear-to-r from-blue-500/5 to-emerald-500/5">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
                    <UserCheck className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Candidates Awaiting Onboarding: {stats?.candidatesAwaitingOnboardingCount ?? 0}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Offers accepted. Ready for checklist verification and 1-click conversion to employee user accounts.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => onNavigateTab("onboarding")}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <span>Open Onboarding</span>
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recently Updated Candidates Table */}
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Recently Updated Candidate Records</CardTitle>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onNavigateTab("candidates")}
                  className="text-xs text-primary"
                >
                  View All Candidates
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <div className="divide-y divide-border/60">
                {stats?.recentlyUpdatedCandidates && stats.recentlyUpdatedCandidates.length > 0 ? (
                  stats.recentlyUpdatedCandidates.map((candidate) => {
                    const latestApp = candidate.applications?.[0];
                    const stageConfig = latestApp ? STAGE_CONFIG[latestApp.stage as HrmsStage] : null;

                    return (
                      <div
                        key={candidate.id}
                        onClick={() => onSelectCandidate?.(candidate.id)}
                        className="flex items-center justify-between py-3 hover:bg-muted/30 px-2 rounded-md transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                              {candidate.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground hover:text-primary transition-colors">
                                {candidate.name}
                              </span>
                              {candidate.experienceYears && (
                                <span className="text-[10px] text-muted-foreground">
                                  ({Number(candidate.experienceYears)} yrs exp)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {latestApp?.jobOpening?.title || candidate.currentTitle || "Applicant"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {stageConfig ? (
                            <Badge variant={stageConfig.badgeVariant} className="text-[10px]">
                              {latestApp.stage}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Applied
                            </Badge>
                          )}
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No candidate records found. Click "Load Sample Data" to populate.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recruitment Activity Stream */}
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <CardTitle className="text-sm font-semibold">Recruitment Activity Stream</CardTitle>
              <CardDescription className="text-xs">
                Audited stage transitions, interview ratings, and offer letter dispatches
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <div className="space-y-3 mt-2">
                {stats?.recentActivities && stats.recentActivities.length > 0 ? (
                  stats.recentActivities.slice(0, 5).map((act) => (
                    <div key={act.id} className="flex items-start gap-2.5 text-xs">
                      <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{act.title}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDatePretty(act.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{act.notes}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    No recent recruitment activities logged yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
