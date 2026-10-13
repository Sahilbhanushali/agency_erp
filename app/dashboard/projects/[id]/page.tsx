"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Filter,
  Calendar,
  Users,
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  Target,
  Image as ImageIcon,
  Video,
  Film,
  Camera,
  ArrowLeft,
  Edit,
  Plus,
  Building2,
  Mail,
  Phone,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";
import { getMediaUrl } from "@/lib/utils";
import MediaPopup from "@/components/mediaPopup";
import { useBreadcrumbTitle } from "@/lib/route-labels";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import TaskPanel from "@/components/tasks/task-panel";

type Post = {
  id: string;
  title: string;
  caption: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  createdById: string;
  assignedToId: string;
};

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
};

type Manager = {
  id: number;
  email: string;
  name: string;
  roleId?: number;
  avatar: string | null;
  password?: string;
  createdAt: string;
  updatedAt: string;
};

type Project = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  clientId: string;
  managerId: number;
  client: Client;
  manager: Manager;
  posts: Post[];
  postTypes: Record<string, number>;
};

const getPostTypeIcon = (type: string) => {
  const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
    reel: Film,
    story: Camera,
    video: Video,
    carousel: ImageIcon,
    photo: ImageIcon,
    article: BarChart3,
  };
  return iconMap[type.toLowerCase()] || BarChart3;
};

const getStatusBadge = (status: string) => {
  const normalized = status.toUpperCase();
  switch (normalized) {
    case "POSTED":
    case "APPROVED":
      return <Badge variant="success">{status}</Badge>;
    case "SCHEDULED":
      return <Badge variant="warning">{status}</Badge>;
    case "SUBMITTED":
      return <Badge variant="info">{status}</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export default function ProjectDetailsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useBreadcrumbTitle(id, project?.name);

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedLogo, setSelectedLogo] = useState<{ url: string; filename: string; type: string } | null>(null);

  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (!res.ok) throw new Error("Failed to fetch project");
        const data = await res.json();
        setProject(data);
      } catch (err) {
        console.error(err);
        setProject(null);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchProject();
  }, [id]);

  // Calculate comprehensive project statistics
  const projectStats = useMemo(() => {
    if (!project) return null;

    const posts = project.posts || [];
    const total = posts.length;

    const statusCounts = posts.reduce(
      (acc, post) => {
        let status = post.status.toLowerCase();
        if (status === "rejected") status = "changes";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { draft: 0, submitted: 0, approved: 0, changes: 0, scheduled: 0, posted: 0 } as Record<string, number>
    );

    const postTypeStats = Object.entries(project.postTypes || {}).reduce(
      (acc, [type, planned]) => {
        const typeLower = type.toLowerCase();
        acc[typeLower] = {
          planned,
          completed: 0,
          created: 0,
          remaining: planned,
          progressPercentage: 0,
          status: "not-started",
          isPlanned: true,
        };
        return acc;
      },
      {} as Record<
        string,
        {
          planned: number;
          completed: number;
          created: number;
          remaining: number;
          progressPercentage: number;
          status: string;
          isPlanned: boolean;
        }
      >
    );

    posts.forEach((post) => {
      const type = post.type.toLowerCase();
      if (!postTypeStats[type]) {
        postTypeStats[type] = {
          planned: 0,
          completed: 0,
          created: 0,
          remaining: 0,
          progressPercentage: 0,
          status: "unplanned",
          isPlanned: false,
        };
      }

      postTypeStats[type].created += 1;

      if (post.status.toLowerCase() === "posted" || post.status.toLowerCase() === "approved") {
        postTypeStats[type].completed += 1;
      }

      const planned = postTypeStats[type].planned;
      const completed = postTypeStats[type].completed;

      if (planned > 0) {
        postTypeStats[type].remaining = Math.max(0, planned - completed);
        postTypeStats[type].progressPercentage = Math.round((completed / planned) * 100);

        if (completed === 0) {
          postTypeStats[type].status = "not-started";
        } else if (completed < planned) {
          postTypeStats[type].status = "in-progress";
        } else {
          postTypeStats[type].status = "completed";
        }
      } else {
        postTypeStats[type].remaining = 0;
        postTypeStats[type].progressPercentage = 100;
        postTypeStats[type].status = "unplanned";
      }
    });

    const completedPosts = (statusCounts.posted || 0) + (statusCounts.approved || 0);
    const completionRate = total > 0 ? Math.round((completedPosts / total) * 100) : 0;

    const today = new Date().toDateString();
    const scheduledToday = posts.filter(
      (p) => p.scheduledAt && new Date(p.scheduledAt).toDateString() === today
    ).length;

    const now = new Date();
    const overduePosts = posts.filter(
      (p) =>
        p.scheduledAt &&
        new Date(p.scheduledAt) < now &&
        p.status.toLowerCase() !== "posted" &&
        p.status.toLowerCase() !== "approved"
    ).length;

    return {
      total,
      completionRate,
      scheduledToday,
      overduePosts,
      statusCounts,
      postTypeStats,
    };
  }, [project]);

  // Filter and sort posts
  const filteredAndSortedPosts = useMemo(() => {
    if (!project) return [];

    const filtered = (project.posts || []).filter((post) => {
      const matchesSearch =
        !searchQuery ||
        post.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.caption?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = !statusFilter || post.status === statusFilter;
      const matchesType = !typeFilter || post.type === typeFilter;

      const matchesDate =
        !dateFilter ||
        (() => {
          const postDate = new Date(post.createdAt).toDateString();
          const filterDate = new Date(dateFilter).toDateString();
          return postDate === filterDate;
        })();

      return matchesSearch && matchesStatus && matchesType && matchesDate;
    });

    filtered.sort((a, b) => {
      let aValue = (a[sortBy as keyof Post] || "") as string;
      let bValue = (b[sortBy as keyof Post] || "") as string;

      if (sortBy.includes("At") || sortBy.includes("Date")) {
        aValue = new Date(aValue || "").getTime().toString();
        bValue = new Date(bValue || "").getTime().toString();
      }

      const comparison = aValue.localeCompare(bValue);
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [project, searchQuery, statusFilter, dateFilter, typeFilter, sortBy, sortOrder]);

  const uniqueStatuses = useMemo(() => {
    if (!project?.posts) return [];
    return [...new Set(project.posts.map((post) => post.status))];
  }, [project]);

  const uniqueTypes = useMemo(() => {
    if (!project?.posts) return [];
    return [...new Set(project.posts.map((post) => post.type))];
  }, [project]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-12">
        <EmptyState
          icon={Search}
          title="Project Not Found"
          description="The requested project could not be found or you may not have access."
          actionLabel="Back to Projects"
          onAction={() => router.push("/dashboard/projects")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-start sm:items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => router.push("/dashboard/projects")}
            aria-label="Back to projects"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                {project.name}
              </h1>
              <Badge variant={project.isActive ? "success" : "secondary"}>
                {project.isActive ? "Active Campaign" : "Inactive"}
              </Badge>
            </div>
            {project.description && (
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl line-clamp-2">
                {project.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <Link href={`/dashboard/projects/${id}/edit`}>
              <Edit className="size-3.5 mr-1.5" />
              Edit Project
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="text-xs"
          >
            <Link href={`/dashboard/projects/posts/new?projectId=${id}`}>
              <Plus className="size-3.5 mr-1.5" />
              New Post
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total Posts</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                {projectStats?.total || 0}
              </p>
            </div>
            <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <BarChart3 className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-primary">
                {projectStats?.completionRate || 0}%
              </p>
            </div>
            <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Scheduled Today</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
                {projectStats?.scheduledToday || 0}
              </p>
            </div>
            <div className="size-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Calendar className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Overdue</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-destructive">
                {projectStats?.overduePosts || 0}
              </p>
            </div>
            <div className="size-10 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <Clock className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meta & Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Project Meta Card */}
        <Card className="shadow-2xs">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              Timeline & Scope
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Start Date</span>
              <span className="font-medium text-foreground">
                {new Date(project.startDate).toLocaleDateString("en-GB")}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">End Date</span>
              <span className="font-medium text-foreground">
                {project.endDate ? new Date(project.endDate).toLocaleDateString("en-GB") : "Ongoing"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium text-foreground">
                {project.endDate
                  ? `${Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24))} days`
                  : "Continuous"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Client Card */}
        <Card className="shadow-2xs">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Client
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {project.client ? (
              <div className="flex items-start gap-3">
                <Avatar
                  className="size-10 border border-border/80 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all shrink-0"
                  onClick={() => {
                    if (project.client.avatar) {
                      setSelectedLogo({
                        url: getMediaUrl(project.client.avatar),
                        filename: project.client.avatar.split("/").pop() || `${project.client.name}.jpg`,
                        type: "image",
                      });
                    }
                  }}
                >
                  {project.client.avatar && <AvatarImage src={getMediaUrl(project.client.avatar)} />}
                  <AvatarFallback className="text-xs bg-muted font-medium">
                    {project.client.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-0.5 text-xs truncate">
                  <p className="font-semibold text-foreground truncate">{project.client.name}</p>
                  <p className="text-muted-foreground truncate">{project.client.company || "No company name"}</p>
                  {project.client.email && (
                    <p className="text-muted-foreground flex items-center gap-1.5 truncate">
                      <Mail className="size-3 shrink-0" />
                      <span className="truncate">{project.client.email}</span>
                    </p>
                  )}
                  {project.client.phone && (
                    <p className="text-muted-foreground flex items-center gap-1.5 truncate">
                      <Phone className="size-3 shrink-0" />
                      <span>{project.client.phone}</span>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No client assigned</p>
            )}
          </CardContent>
        </Card>

        {/* Manager Card */}
        <Card className="shadow-2xs">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="size-4 text-primary" />
              Project Manager
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {project.manager ? (
              <div className="flex items-start gap-3">
                <Avatar className="size-10 border border-border/80 shrink-0">
                  {project.manager.avatar && <AvatarImage src={getMediaUrl(project.manager.avatar)} />}
                  <AvatarFallback className="text-xs bg-muted font-medium">
                    {project.manager.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-0.5 text-xs truncate">
                  <p className="font-semibold text-foreground truncate">{project.manager.name}</p>
                  <p className="text-muted-foreground truncate">{project.manager.email}</p>
                  <Badge variant="outline" className="text-[10px] mt-1">
                    Manager
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No manager assigned</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Post Types Targets Breakdown */}
      <Card className="shadow-2xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="size-4 text-primary" />
              Deliverables & Requirements Breakdown
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border/60">
                <tr className="text-left text-muted-foreground font-medium">
                  <th className="pb-2">Content Type</th>
                  <th className="pb-2 text-center">Target (Planned)</th>
                  <th className="pb-2 text-center">Created</th>
                  <th className="pb-2 text-center">Completed</th>
                  <th className="pb-2 text-center">Remaining</th>
                  <th className="pb-2 text-right">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {Object.entries(projectStats?.postTypeStats || {}).map(([type, stats]: [string, any]) => {
                  const IconComponent = getPostTypeIcon(type);
                  return (
                    <tr key={type} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 font-medium">
                        <div className="flex items-center gap-2 text-foreground">
                          <IconComponent className="size-3.5 text-muted-foreground" />
                          <span className="uppercase tracking-wide text-xs">{type}</span>
                          {!stats.isPlanned && (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                              Unplanned
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-center font-semibold tabular-nums text-foreground">
                        {stats.planned}
                      </td>
                      <td className="py-2.5 text-center font-semibold tabular-nums text-foreground">
                        {stats.created}
                      </td>
                      <td className="py-2.5 text-center font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {stats.completed}
                      </td>
                      <td className="py-2.5 text-center font-semibold tabular-nums">
                        <span className={stats.remaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                          {stats.remaining}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                stats.status === "completed"
                                  ? "bg-emerald-500"
                                  : stats.status === "in-progress"
                                  ? "bg-primary"
                                  : "bg-muted-foreground/40"
                              }`}
                              style={{ width: `${Math.min(stats.progressPercentage, 100)}%` }}
                            />
                          </div>
                          <span className="font-semibold text-foreground w-8 text-right">
                            {stats.progressPercentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {Object.keys(projectStats?.postTypeStats || {}).length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No content deliverables configured for this campaign.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Posts Management Section */}
      <Card className="shadow-2xs">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                Campaign Posts
              </CardTitle>
              <CardDescription className="text-xs">
                Showing {filteredAndSortedPosts.length} of {project.posts?.length || 0} total posts
              </CardDescription>
            </div>
            <Button asChild size="sm" className="text-xs self-start sm:self-auto">
              <Link href={`/dashboard/projects/posts/new?projectId=${id}`}>
                <Plus className="size-3.5 mr-1.5" />
                Add Post
              </Link>
            </Button>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search posts..."
                className="pl-8 h-8 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary outline-hidden"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary outline-hidden"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <Input
              type="date"
              className="h-8 text-xs"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />

            <div className="flex gap-1.5">
              <select
                className="flex-1 h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary outline-hidden"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="createdAt">Created Date</option>
                <option value="updatedAt">Updated Date</option>
                <option value="scheduledAt">Posting Date</option>
                <option value="title">Title</option>
                <option value="status">Status</option>
              </select>
              <Button
                variant="outline"
                size="icon-xs"
                className="h-8 w-8 shrink-0"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                aria-label="Toggle sort order"
              >
                <ArrowUpDown className="size-3.5" />
              </Button>
            </div>
          </div>

          {(searchQuery || statusFilter || dateFilter || typeFilter) && (
            <div className="pt-2">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("");
                  setDateFilter("");
                  setTypeFilter("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
              >
                Clear all filters
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-4">
          {filteredAndSortedPosts.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={Filter}
                title="No posts found"
                description={
                  project.posts?.length === 0
                    ? "No posts have been created for this project yet."
                    : "Try adjusting your search criteria or clearing filters."
                }
                action={
                  project.posts?.length === 0
                    ? {
                        label: "Create First Post",
                        onClick: () => router.push(`/dashboard/projects/posts/new?projectId=${id}`),
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredAndSortedPosts.map((post) => {
                const TypeIcon = getPostTypeIcon(post.type);
                return (
                  <div
                    key={post.id}
                    className="group border border-border/70 rounded-xl p-4 bg-card hover:bg-muted/30 hover:border-border transition-all flex flex-col justify-between gap-3 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Link
                          href={`/dashboard/projects/posts/${post.id}`}
                          className="font-medium text-xs sm:text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          <span className="line-clamp-1">{post.title || "Untitled Post"}</span>
                          <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </Link>
                        {getStatusBadge(post.status)}
                      </div>

                      {post.caption && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                          {post.caption}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <TypeIcon className="size-3 text-primary" />
                        <span className="font-medium text-foreground uppercase">{post.type}</span>
                      </div>

                      <div className="flex items-center gap-3 tabular-nums">
                        {post.scheduledAt && (
                          <span>
                            Due: {new Date(post.scheduledAt).toLocaleDateString("en-GB")}
                          </span>
                        )}
                        <span>
                          Created: {new Date(post.createdAt).toLocaleDateString("en-GB")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project-level work that is not a post: briefs, reporting, client calls. */}
      <TaskPanel link={{ projectId: id }} title="Project tasks" />

      <MediaPopup
        isOpen={!!selectedLogo}
        onClose={() => setSelectedLogo(null)}
        asset={selectedLogo}
      />
    </div>
  );
}