"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  Calendar,
  BarChart3,
  Activity,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  Eye,
  Edit3,
  MoreHorizontal,
  Filter,
  X,
  Pencil,
  Send,
  Loader2,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fetcher = async (url: string) => {
  const fullUrl = url;

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return await response.json();
};

const formatDate = (dateInput: string | Date): string => {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return 'Invalid Date';
    return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(date);
  } catch {
    return 'Invalid Date';
  }
};

const generateTypeOptions = () => {
  return [
    { value: "all", label: "All Types" },
    { value: "PHOTO", label: "Photo" },
    { value: "STORY", label: "Story" },
    { value: "REEL", label: "Reel" },
    { value: "CAROUSEL", label: "Carousel" },
    { value: "BLOG", label: "Linkedin/Article" },
  ];
};

const StatusCard = ({ icon: Icon, label, value, total, colorClass }: any) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-all hover:border-border hover:shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`flex size-8 items-center justify-center rounded-lg ${colorClass}`}>
          <Icon className="size-4 shrink-0" />
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground tabular-nums">/ {total}</span>
        </div>
        <div className="mt-2 space-y-1">
          <Progress value={percentage} className="h-1.5 bg-muted" />
          <p className="text-[10px] text-muted-foreground font-medium">{percentage}% completed</p>
        </div>
      </div>
    </div>
  );
};

const SimpleStatusCard = ({ icon: Icon, label, value, colorClass }: any) => {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-all hover:border-border hover:shadow-xs">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      </div>
      <div className={`flex size-9 items-center justify-center rounded-lg ${colorClass}`}>
        <Icon className="size-4 shrink-0" />
      </div>
    </div>
  );
};

const defaultZeroStats = {
  totalStrategy: 0,
  contentWritten: 0,
  contentApproved: 0,
  contentPending: 0,
  contentRejected: 0,
  contentResubmitted: 0,
  designAssigned: 0,
  designSubmitted: 0,
  designApproved: 0,
  designPending: 0,
  designRejected: 0,
  posted: 0,
  scheduled: 0,
  readyToSchedule: 0,
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [selectedType, setSelectedType] = useState<string>("all");

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

  const swrKey = status === "authenticated" && session?.user?.id
    ? `/api/dashboard?type=${selectedType}`
    : null;

  const { data: dashboardData, error: dashboardError, isLoading: dashboardLoading } = useSWR(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  const processedRecentPosts = useMemo(() => {
    if (!dashboardData?.recentPosts) return [];

    let posts = [...dashboardData.recentPosts];

    if (selectedMonth !== "all") {
      const [year, monthNum] = selectedMonth.split('-').map(Number);
      posts = posts.filter((post: any) => {
        const postDate = new Date(post.scheduledAt || post.createdAt);
        return postDate.getFullYear() === year && (postDate.getMonth() + 1) === monthNum;
      });
    }

    return posts
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10);
  }, [dashboardData?.recentPosts, selectedMonth]);

  const typeOptions = generateTypeOptions();

  const aggregateMonthlyStats = (year: string) => {
    if (!dashboardData?.monthlyBreakdown) return defaultZeroStats;
    const yearPrefix = `${year}-`;
    const aggregated = { ...defaultZeroStats };
    
    Object.entries(dashboardData.monthlyBreakdown).forEach(([key, stats]: [string, any]) => {
      if (key.startsWith(yearPrefix)) {
        aggregated.totalStrategy += stats.totalPosts || 0;
        aggregated.contentWritten += stats.contentWritten || 0;
        aggregated.contentApproved += stats.contentApproved || 0;
        aggregated.contentPending += stats.contentPending || 0;
        aggregated.contentRejected += stats.contentRejected || 0;
        aggregated.contentResubmitted += stats.contentResubmitted || 0;
        
        aggregated.designAssigned += stats.designAssigned || 0;
        aggregated.designSubmitted += stats.designSubmitted || 0;
        aggregated.designApproved += stats.designApproved || 0;
        aggregated.designPending += stats.designPending || 0;
        aggregated.designRejected += stats.designRejected || 0;
        
        aggregated.posted += stats.posted || 0;
        aggregated.scheduled += stats.scheduled || 0;
        aggregated.readyToSchedule += stats.approved || 0;
      }
    });
    return aggregated;
  };

  const currentStrategyStats = useMemo(() => {
    if (selectedMonth === "all") {
      return dashboardData?.strategyStats || defaultZeroStats;
    }
    if (selectedMonth.endsWith("-all")) {
      return aggregateMonthlyStats(selectedMonth.split("-")[0]);
    }
    const monthly = dashboardData?.monthlyBreakdown?.[selectedMonth];
    if (!monthly) return defaultZeroStats;
    return {
      totalStrategy: monthly.totalPosts || monthly.total || 0,
      contentWritten: monthly.contentWritten || 0,
      contentApproved: monthly.contentApproved || 0,
      contentPending: monthly.contentPending || 0,
      contentRejected: monthly.contentRejected || 0,
      contentResubmitted: monthly.contentResubmitted || 0,
    };
  }, [dashboardData, selectedMonth]);

  const currentDesignStats = useMemo(() => {
    if (selectedMonth === "all") {
      return dashboardData?.designStats || defaultZeroStats;
    }
    if (selectedMonth.endsWith("-all")) {
      return aggregateMonthlyStats(selectedMonth.split("-")[0]);
    }
    const monthly = dashboardData?.monthlyBreakdown?.[selectedMonth];
    if (!monthly) return defaultZeroStats;
    return {
      designAssigned: monthly.designAssigned || 0,
      designSubmitted: monthly.designSubmitted || 0,
      designApproved: monthly.designApproved || 0,
      designPending: monthly.designPending || 0,
      designRejected: monthly.designRejected || 0,
    };
  }, [dashboardData, selectedMonth]);

  const currentPostingStats = useMemo(() => {
    if (selectedMonth === "all") {
      return dashboardData?.postingStats || defaultZeroStats;
    }
    if (selectedMonth.endsWith("-all")) {
      return aggregateMonthlyStats(selectedMonth.split("-")[0]);
    }
    const monthly = dashboardData?.monthlyBreakdown?.[selectedMonth];
    if (!monthly) return defaultZeroStats;
    return {
      posted: monthly.posted || 0,
      scheduled: monthly.scheduled || 0,
      readyToSchedule: monthly.approved || 0,
    };
  }, [dashboardData, selectedMonth]);

  if (status === "loading" || dashboardLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    router.push("/auth/signin?callbackUrl=/dashboard");
    return null;
  }

  if (dashboardError) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <AlertTriangle className="size-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Error Loading Dashboard</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-5">{dashboardError.message}</p>
            <Button size="sm" onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center text-xs font-medium text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading dashboard data...
      </div>
    );
  }

  const userRole = session.user.role || "USER";

  const getStatusBadgeVariant = (postStatus: string) => {
    switch (postStatus) {
      case "APPROVED":
      case "POSTED":
        return "success";
      case "SCHEDULED":
        return "warning";
      case "REJECTED":
        return "destructive";
      case "SUBMITTED":
        return "info";
      default:
        return "neutral";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      {/* Header */}
      <PageHeader
        title="Dashboard Overview"
        description={`Welcome back, ${session.user.name}. Overview of content planning, design approvals, and social publishing.`}
        badge={
          <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
            {userRole}
          </Badge>
        }
      >
        {/* Month & Post Type Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger aria-label="Filter by month" className="h-8 w-[160px] bg-card text-xs">
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

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger aria-label="Filter by post type" className="h-8 w-[140px] bg-card text-xs">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs font-medium cursor-pointer">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(selectedMonth !== currentMonthKey || selectedType !== "all") && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setSelectedMonth(currentMonthKey);
                setSelectedType("all");
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              Reset Filters
            </Button>
          )}

          <Button asChild size="sm" className="gap-1.5">
            <Link href="/dashboard/projects/posts/new">
              <Plus className="size-3.5" />
              New Post
            </Link>
          </Button>
        </div>
      </PageHeader>

      {/* Content Status Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Content Pipeline</h2>
          </div>
          <Badge variant="neutral" className="text-[10px]">
            Total Strategy Posts: {currentStrategyStats.totalStrategy}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatusCard
            icon={FileText}
            label="Content Written"
            value={currentStrategyStats.contentWritten}
            total={currentStrategyStats.totalStrategy}
            colorClass="bg-primary/10 text-primary"
          />
          <StatusCard
            icon={CheckCircle}
            label="Content Approved"
            value={currentStrategyStats.contentApproved}
            total={currentStrategyStats.totalStrategy}
            colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <SimpleStatusCard
            icon={Clock}
            label="Pending Review"
            value={currentStrategyStats.contentPending}
            colorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          />
          <SimpleStatusCard
            icon={AlertTriangle}
            label="Changes Required"
            value={currentStrategyStats.contentRejected}
            colorClass="bg-rose-500/10 text-rose-600 dark:text-rose-400"
          />
          <SimpleStatusCard
            icon={Loader2}
            label="Resubmitted"
            value={currentStrategyStats.contentResubmitted}
            colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
        </div>
      </div>

      {/* Design Status Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="size-4 text-violet-500" />
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Design Workflow</h2>
          </div>
          <Badge variant="neutral" className="text-[10px]">
            Designs Assigned: {currentDesignStats.designAssigned}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatusCard
            icon={Pencil}
            label="Design Assigned"
            value={currentDesignStats.designAssigned}
            total={currentDesignStats.designAssigned}
            colorClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          />
          <StatusCard
            icon={Send}
            label="Design Submitted"
            value={currentDesignStats.designSubmitted}
            total={currentDesignStats.designAssigned}
            colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
          <StatusCard
            icon={CheckCircle}
            label="Design Approved"
            value={currentDesignStats.designApproved}
            total={currentDesignStats.designAssigned}
            colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <SimpleStatusCard
            icon={Clock}
            label="Pending Review"
            value={currentDesignStats.designPending}
            colorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          />
          <SimpleStatusCard
            icon={AlertTriangle}
            label="Changes Required"
            value={currentDesignStats.designRejected}
            colorClass="bg-rose-500/10 text-rose-600 dark:text-rose-400"
          />
        </div>
      </div>

      {/* Posting & Schedule Status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Ready to Schedule</p>
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{currentPostingStats.readyToSchedule}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Calendar className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Scheduled Posts</p>
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{currentPostingStats.scheduled}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Published / Posted</p>
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{currentPostingStats.posted}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity Feed */}
      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Latest post updates across projects</CardDescription>
            </div>
            <Button asChild variant="ghost" size="xs" className="gap-1 text-muted-foreground hover:text-foreground">
              <Link href="/dashboard/projects">
                <Eye className="size-3.5" /> View All Projects
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {processedRecentPosts.length > 0 ? (
            <div className="divide-y divide-border/60">
              {processedRecentPosts.map((post: any) => {
                if (!post?.id) return null;
                return (
                  <div key={post.id} className="flex items-center justify-between gap-4 p-3.5 sm:px-5 hover:bg-muted/40 transition-colors">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <Link href={`/dashboard/projects/posts/${post.id}`} className="font-medium text-xs sm:text-sm text-foreground hover:text-primary transition-colors line-clamp-1">
                          {post.title}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground/80">{post.project.client?.name || "No Client"}</span>
                          <span>•</span>
                          <span>{post.createdBy?.name || 'Deleted User'}</span>
                          <span>•</span>
                          <span className="tabular-nums">{formatDate(post.updatedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(post.status)} dot className="text-[10px]">
                        {post.status}
                      </Badge>
                      <Button asChild variant="ghost" size="icon-xs" title="Edit Post">
                        <Link href={`/dashboard/projects/posts/${post.id}`}>
                          <Edit3 className="size-3.5 text-muted-foreground" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                icon={FileText}
                title="No posts found"
                description="Create content posts to start tracking design assets and approval flows."
                actionLabel="Create First Post"
                actionHref="/dashboard/projects/posts/new"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
