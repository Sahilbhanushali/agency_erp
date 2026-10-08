// app/dashboard/page.tsx
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
  ArrowDownRight,
  Eye,
  Edit3,
  MoreHorizontal,
  Filter,
  X,
  Pencil,
  Send,
  Loader
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

// Fetcher function
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
  } catch (error) {
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

const StatusCard = ({ icon: Icon, label, value, total, color, bgColor }: any) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:shadow-sm transition-all">
      <div className={`${bgColor} dark:bg-card p-3 rounded-lg`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">/ {total}</p>
        </div>
        <div className="mt-2 space-y-1">
          <Progress value={percentage} className="h-1.5" />
          <p className="text-xs text-muted-foreground">{percentage}% complete</p>
        </div>
      </div>
    </div>
  );
};

const SimpleStatusCard = ({ icon: Icon, label, value, color, bgColor }: any) => {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:shadow-sm transition-all">
      <div className={`${bgColor} dark:bg-card p-3 rounded-lg`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
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
  // Default to current month so current month's count is shown by default
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [selectedType, setSelectedType] = useState<string>("all");

  // Generate last 12 months for the dropdown (matching Project Summary style)
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
        aggregated.totalStrategy += stats.totalPosts || 0; // Use totalPosts to match actual post count for the year
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
        aggregated.readyToSchedule += stats.approved || 0; // readyToSchedule is mapped from approved in month breakdown
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
      totalStrategy: monthly.totalPosts || monthly.total || 0, // Using actual total posts or strategy target
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
      <div className="space-y-8 p-6 bg-background min-h-screen">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 px-6">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-medium text-foreground mb-2">Error Loading Dashboard</h3>
            <p className="text-muted-foreground text-center mb-4">{dashboardError.message}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl font-medium text-foreground">Loading dashboard...</div>
      </div>
    );
  }

  const userRole = session.user.role || "USER";

  const statusConfig = {
    DRAFT: { color: "bg-muted text-muted-foreground border-border", label: "Draft" },
    SUBMITTED: { color: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800", label: "Submitted" },
    APPROVED: { color: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800", label: "Approved" },
    REJECTED: { color: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800", label: "Changes" },
    SCHEDULED: { color: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800", label: "Scheduled" },
    POSTED: { color: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", label: "Published" },
  } as const;

  return (
    <div className="space-y-6 p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <Badge variant="outline" className="text-xs">{userRole}</Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Welcome back, <span className="font-medium text-foreground">{session.user.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
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
                className="h-9 px-2"
                title="Reset to current month"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedType("all")} className="h-9 px-2">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

        </div>
      </div>

      {/* Content Status */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b bg-muted/50 dark:bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">Content Status</CardTitle>
                <CardDescription>Content writing and approval workflow (from contentStatus)</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              Total Posts: {currentStrategyStats.totalStrategy}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatusCard
              icon={FileText}
              label="Content Written"
              value={currentStrategyStats.contentWritten}
              total={currentStrategyStats.totalStrategy}
              color="text-blue-600 dark:text-blue-300"
              bgColor="bg-blue-50 dark:bg-blue-900/20"
            />
            <StatusCard
              icon={CheckCircle}
              label="Content Approved"
              value={currentStrategyStats.contentApproved}
              total={currentStrategyStats.totalStrategy}
              color="text-green-600 dark:text-green-300"
              bgColor="bg-green-50 dark:bg-green-900/20"
            />
            <SimpleStatusCard
              icon={Clock}
              label="Pending Review"
              value={currentStrategyStats.contentPending}
              color="text-amber-600 dark:text-amber-300"
              bgColor="bg-amber-50 dark:bg-amber-900/20"
            />
            <SimpleStatusCard
              icon={AlertTriangle}
              label="Changes"
              value={currentStrategyStats.contentRejected}
              color="text-red-600 dark:text-red-300"
              bgColor="bg-red-50 dark:bg-red-900/20"
            />
            <SimpleStatusCard
              icon={Loader}
              label="Resubmitted"
              value={currentStrategyStats.contentResubmitted}
              color="text-purple-600 dark:text-purple-300"
              bgColor="bg-purple-50 dark:bg-purple-900/20"
            />
          </div>
        </CardContent>
      </Card>

      {/* Design Status */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b bg-muted/50 dark:bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <Pencil className="h-5 w-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">Design Status</CardTitle>
                <CardDescription>Design creation and approval workflow (from status field)</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              Designs Assigned: {currentDesignStats.designAssigned}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatusCard
              icon={Pencil}
              label="Design Assigned"
              value={currentDesignStats.designAssigned}
              total={currentDesignStats.designAssigned}
              color="text-purple-600 dark:text-purple-300"
              bgColor="bg-purple-50 dark:bg-purple-900/20"
            />
            <StatusCard
              icon={Send}
              label="Design Submitted"
              value={currentDesignStats.designSubmitted}
              total={currentDesignStats.designAssigned}
              color="text-indigo-600 dark:text-indigo-300"
              bgColor="bg-indigo-50 dark:bg-indigo-900/20"
            />
            <StatusCard
              icon={CheckCircle}
              label="Design Approved"
              value={currentDesignStats.designApproved}
              total={currentDesignStats.designAssigned}
              color="text-green-600 dark:text-green-300"
              bgColor="bg-green-50 dark:bg-green-900/20"
            />
            <SimpleStatusCard
              icon={Clock}
              label="Pending Review"
              value={currentDesignStats.designPending}
              color="text-amber-600 dark:text-amber-300"
              bgColor="bg-amber-50 dark:bg-amber-900/20"
            />
            <SimpleStatusCard
              icon={AlertTriangle}
              label="Changes"
              value={currentDesignStats.designRejected}
              color="text-red-600 dark:text-red-300"
              bgColor="bg-red-50 dark:bg-red-900/20"
            />
          </div>
        </CardContent>
      </Card>

      {/* Posted & Scheduled */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b bg-muted/50 dark:bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
              <Calendar className="h-5 w-5 text-green-600 dark:text-green-300" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Posting & Schedule Status</CardTitle>
              <CardDescription>Content scheduling and publishing (status = SCHEDULED or POSTED)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-6 rounded-lg border bg-card hover:shadow-md transition-all">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Ready to Schedule</p>
                <p className="text-3xl font-bold text-foreground mt-2">{currentPostingStats.readyToSchedule}</p>
                <p className="text-xs text-muted-foreground mt-1">status = APPROVED</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-6 rounded-lg border bg-card hover:shadow-md transition-all">
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Scheduled</p>
                <p className="text-3xl font-bold text-foreground mt-2">{currentPostingStats.scheduled}</p>
                <p className="text-xs text-muted-foreground mt-1">status = SCHEDULED</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-6 rounded-lg border bg-card hover:shadow-md transition-all">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Posted</p>
                <p className="text-3xl font-bold text-foreground mt-2">{currentPostingStats.posted}</p>
                <p className="text-xs text-muted-foreground mt-1">status = POSTED</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Recent Activity</CardTitle>
              <CardDescription>Latest content updates and changes</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-2">
              <Eye className="h-4 w-4" />
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {processedRecentPosts.length > 0 ? (
              processedRecentPosts.map((post: any, index: number) => {
                if (!post?.id) return null;
                return (
                  <div key={post.id}>
                    <div className="flex items-center justify-between py-4 hover:bg-accent -mx-6 px-6 rounded-lg transition-colors">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`p-2 rounded-lg ${post.status === 'APPROVED' ? 'bg-green-50 dark:bg-green-900/20' :
                            post.status === 'REJECTED' ? 'bg-red-50 dark:bg-red-900/20' :
                              post.status === 'SCHEDULED' ? 'bg-purple-50 dark:bg-purple-900/20' :
                                post.status === 'POSTED' ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
                          }`}>
                          <FileText className={`h-4 w-4 ${post.status === 'APPROVED' ? 'text-green-600 dark:text-green-300' :
                              post.status === 'REJECTED' ? 'text-red-600 dark:text-red-300' :
                                post.status === 'SCHEDULED' ? 'text-purple-600 dark:text-purple-300' :
                                  post.status === 'POSTED' ? 'text-emerald-600 dark:text-emerald-300' : 'text-blue-600 dark:text-blue-300'
                            }`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <Link href={`/dashboard/projects/posts/${post.id}`} className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1">
                            {post.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">{post.project.client?.name || "No Client"}</span>
                            <span className="text-muted">•</span>
                            <span className="text-sm text-muted-foreground">{post.createdBy?.name || 'Deleted User'}</span>
                            <span className="text-muted">•</span>
                            <span className="text-xs text-muted-foreground">{formatDate(post.updatedAt)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">{post.type}</Badge>
                            {post.platforms?.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {post.platforms.slice(0, 2).join(", ")}
                                {post.platforms.length > 2 && ` +${post.platforms.length - 2}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={statusConfig[post.status as keyof typeof statusConfig]?.color || "bg-muted text-muted-foreground"}>
                          {statusConfig[post.status as keyof typeof statusConfig]?.label || post.status}
                        </Badge>
                        <Button variant="ghost" size="sm" className="gap-2">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {index < processedRecentPosts.length - 1 && <Separator />}
                  </div>
                );
              }).filter(Boolean)
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No content yet</p>
                <Link href="/dashboard/projects/posts/new">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create your first post
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}