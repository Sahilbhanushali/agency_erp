// app/dashboard/DesignerDashboard.tsx
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
  Target,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Edit3,
  MoreHorizontal
} from "lucide-react";
import Link from "next/link";
import PostTimingBadge from "@/components/posts/postTimingBadge";

interface Stat {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  trend?: string;
  trendValue?: number;
  previousValue?: string;
  progress?: number;
}

interface Post {
  id: string;
  title: string;
  status: string;
  type: string;
  platforms: string[];
  updatedAt: string | Date;
  project: {
    client: {
      name: string;
    };
  };
  createdBy: {
    name: string;
  };
}

interface DashboardData {
  totalPosts: number;
  pendingPosts: number;
  approvedPosts: number;
  rejectedPosts: number;
  recentPosts: Post[];
  scheduledPosts: number;
  postedThisWeek: number;
  activeProjects: number;
  postedLastWeek: number;
  totalProjects: number;
  metrics: any;
}

// Fetcher function
const fetcher = async (url: string) => {
  const fullUrl = url;
  console.log("📡 Fetching Designer Dashboard URL:", fullUrl);
  
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

    console.error(`❌ API Error for ${url}:`, {
      status: response.status,
      statusText: response.statusText,
      error: errorMessage,
    });

    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log("✅ Designer Dashboard Data Received:", data);
  return data;
};

const formatDate = (dateInput: string | Date): string => {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', dateInput);
      return 'Invalid Date';
    }
    return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error, 'Input:', dateInput);
    return 'Invalid Date';
  }
};

export default function DesignerDashboard({ searchParams }: { searchParams: { [key: string]: string | undefined } }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  console.log("🔄 Designer Dashboard Session Status:", status);
  console.log("👤 Designer User:", session?.user?.email, session?.user?.role);

  // Use SWR to fetch dashboard data
  const { data: dashboardData, error: dashboardError, isLoading: dashboardLoading } = useSWR<DashboardData>(
    status === "authenticated" && session?.user?.id ? "/api/dashboard" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      onError: (error) => {
        console.error("❌ Designer Dashboard SWR error:", error);
      },
    }
  );

  // Loading state
  if (status === "loading" || dashboardLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="lg:col-span-3 h-60 rounded-xl" />
        </div>
      </div>
    );
  }

  // Authentication check
  if (status === "unauthenticated" || !session?.user) {
    const callbackUrl = searchParams.festivals ? `/dashboard/festivals` : "/dashboard";
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    return null;
  }

  // Error state
  if (dashboardError) {
    return (
      <div className="py-12 flex items-center justify-center">
        <Card className="shadow-2xs max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-10 px-6">
            <h3 className="text-base font-semibold text-foreground mb-1">Error Loading Dashboard</h3>
            <p className="text-xs text-muted-foreground text-center mb-4">{dashboardError.message}</p>
            <Button size="sm" onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No data yet
  if (!dashboardData) {
    return (
      <div className="py-12 flex items-center justify-center text-xs text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  const userRole = session.user.role || "USER";
  
  const { 
    totalPosts, 
    pendingPosts, 
    approvedPosts, 
    rejectedPosts,
    recentPosts, 
    scheduledPosts, 
    postedThisWeek, 
    activeProjects,
    postedLastWeek,
    totalProjects,
    metrics
  } = dashboardData;

  // Calculate trends
  const weeklyTrend = postedLastWeek > 0 ? ((postedThisWeek - postedLastWeek) / postedLastWeek) * 100 : 0;
  const approvalRate = metrics?.designApprovalRate
    ? Math.round(metrics.designApprovalRate * 100)
    : totalPosts > 0
      ? Math.round((approvedPosts / totalPosts) * 100)
      : 0;
  const completionRate = totalProjects > 0 ? Math.round(((totalProjects - activeProjects) / totalProjects) * 100) : 0;

  const primaryStats: Stat[] = [
    {
      title: "Assigned Tasks",
      value: totalPosts.toString(),
      description: "Total assigned to you",
      icon: FileText,
      color: "text-blue-600",
      // No trend: this used to show a fixed "+12%" against an invented baseline of 89%
      // of the current count. There is no history to compare with, so nothing is shown.
    },
    {
      title: "Pending Work",
      value: pendingPosts.toString(),
      description: "Awaiting your action",
      icon: Clock,
      color: "text-amber-600",
      // The label comes from the real count; there is no arrow, because nothing here
      // measures change over time.
      trend: pendingPosts > 10 ? "High" : "Normal",
    },
    {
      title: "Submitted This Week",
      value: postedThisWeek.toString(),
      description: "Designs submitted",
      icon: TrendingUp,
      color: "text-green-600",
      trend: weeklyTrend > 0 ? `+${Math.round(weeklyTrend)}%` : `${Math.round(weeklyTrend)}%`,
      trendValue: weeklyTrend,
      previousValue: postedLastWeek.toString(),
    },
    {
      title: "Approval Rate",
      value: `${approvalRate}%`,
      description: "Designs approved",
      icon: CheckCircle,
      color: "text-emerald-600",
      trend: approvalRate > 80 ? "Excellent" : approvalRate > 60 ? "Good" : "Needs attention",
    },
  ];

  const secondaryStats: Stat[] = [
    {
      title: "Active Projects",
      value: activeProjects.toString(),
      description: "You're assigned to",
      icon: Users,
      color: "text-purple-600",
      progress: completionRate,
    },
    {
      title: "Scheduled",
      value: scheduledPosts.toString(),
      description: "Your designs ready to publish",
      icon: Calendar,
      color: "text-indigo-600",
    },
    {
      title: "Revisions Needed",
      value: rejectedPosts.toString(),
      description: "Designs rejected",
      icon: AlertTriangle,
      color: "text-red-600",
    },
  ];

  const statusConfig = {
    DRAFT: { color: "bg-muted text-foreground border-border", label: "Draft" },
    SUBMITTED: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Submitted" },
    APPROVED: { color: "bg-green-100 text-green-700 border-green-200", label: "Approved" },
    REJECTED: { color: "bg-red-100 text-red-700 border-red-200", label: "Rejected" },
    SCHEDULED: { color: "bg-purple-100 text-purple-700 border-purple-200", label: "Scheduled" },
    POSTED: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Published" },
  } as const;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <Badge variant="outline" className="text-xs">
              {userRole}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Welcome back, <span className="font-medium text-foreground">{session.user.name}</span>
          </p>
          {searchParams.festivals && (
            <Badge className="mt-2 bg-blue-50 text-blue-700 border-blue-200">
              Festivals View Active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {primaryStats.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden border-0 shadow-sm bg-card hover:shadow-md transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg bg-muted/50`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                <p className="text-sm text-muted-foreground">{stat.description}</p>
              </div>
              
              {stat.trend && (
                <div className="flex items-center gap-2">
                  {stat.trendValue !== undefined && (
                    <div className={`flex items-center gap-1 text-sm ${
                      stat.trendValue > 0 ? 'text-green-600' : stat.trendValue < 0 ? 'text-red-600' : 'text-muted-foreground'
                    }`}>
                      {stat.trendValue > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : stat.trendValue < 0 ? (
                        <ArrowDownRight className="h-3 w-3" />
                      ) : (
                        <Activity className="h-3 w-3" />
                      )}
                      <span className="font-medium">{stat.trend}</span>
                    </div>
                  )}
                  {stat.previousValue && (
                    <span className="text-xs text-muted-foreground">vs {stat.previousValue}</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Stats & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Secondary Stats */}
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-4">
          {secondaryStats.map((stat) => (
            <Card key={stat.title} className="border-0 shadow-sm bg-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-muted/50`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
                {stat.progress !== undefined && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Completion</span>
                      <span className="font-medium">{stat.progress}%</span>
                    </div>
                    <Progress value={stat.progress} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions - Tailored for designers/video editors */}
        <Card className="lg:col-span-3 border-0 shadow-sm bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/tasks" className="block">
              <Button className="w-full justify-start gap-3 h-12" variant="outline">
                <Target className="h-4 w-4" />
                Assigned Tasks
              </Button>
            </Link>
            <Link href="/dashboard/calendar" className="block">
              <Button className="w-full justify-start gap-3 h-12" variant="outline">
                <Calendar className="h-4 w-4" />
                My Schedule
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-0 shadow-sm bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
              <CardDescription>Latest assigned content updates</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2">
                <Eye className="h-4 w-4" />
                View All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {recentPosts?.length > 0 ? (
              recentPosts.map((post: Post, index: number) => {
                if (!post?.id || !post?.title || !post?.status || !post?.updatedAt) {
                  console.warn('Invalid post data:', post);
                  return null;
                }
                return (
                  <div key={post.id}>
                    <div className="flex items-center justify-between py-4 hover:bg-muted/50 -mx-6 px-6 rounded-lg transition-colors">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`p-2 rounded-lg ${
                          post.status === 'APPROVED' ? 'bg-green-50' :
                          post.status === 'REJECTED' ? 'bg-red-50' :
                          post.status === 'SCHEDULED' ? 'bg-purple-50' :
                          post.status === 'POSTED' ? 'bg-emerald-50' :
                          'bg-blue-50'
                        }`}>
                          <FileText className={`h-4 w-4 ${
                            post.status === 'APPROVED' ? 'text-green-600' :
                            post.status === 'REJECTED' ? 'text-red-600' :
                            post.status === 'SCHEDULED' ? 'text-purple-600' :
                            post.status === 'POSTED' ? 'text-emerald-600' :
                            'text-blue-600'
                          }`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <Link href={`/dashboard/posts/${post.id}`} className="font-medium text-foreground hover:text-blue-600 transition-colors line-clamp-1">
                            {post.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">{post.project.client?.name || "No Client"}</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-sm text-muted-foreground">{post.createdBy?.name || 'Deleted User'}</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-xs text-muted-foreground">{formatDate(post.updatedAt)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {post.type}
                            </Badge>
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
                        <PostTimingBadge post={post as any} />
                        <Badge 
                          variant="outline"
                          className={statusConfig[post.status as keyof typeof statusConfig]?.color || "bg-muted text-foreground"}
                        >
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
                    {index < recentPosts.length - 1 && <Separator />}
                  </div>
                );
              }).filter(Boolean)
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No assigned content yet</p>
                <Link href="/dashboard/posts?assigned=me">
                  <Button className="gap-2">
                    <Target className="h-4 w-4" />
                    View Assigned
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