
"use client";

import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/use-permissions";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Eye, ToggleLeft, ToggleRight, Search, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMediaUrl } from "@/lib/utils";
import MediaPopup from "@/components/mediaPopup";
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog";
import { ProjectTimingBadge } from "@/components/posts/postTimingBadge";
import { projectCompanyName } from "@/lib/client-company";

interface PostTypeCount {
  [key: string]: number;
}

interface PostAsset {
  id: string;
  isReference: boolean;
  createdAt?: string;
}

interface PostItem {
  id: string | number;
  createdAt: string;
  scheduledAt?: string | null;
  status?: string;
  assets?: PostAsset[];
}

interface Project {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string | null;
  isActive: boolean;
  postTypes: PostTypeCount;
  client: { id: string; name: string; company: string } | null;
  manager: { name: string } | null;
  posts: PostItem[];
  image?: string | null;
}

interface User {
  id: string;
  role: string;
}

const isValidDate = (dateString: string | undefined | null): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

const truncateWords = (text?: string | null, maxWords: number = 3): string => {
  if (!text) return "Unknown Company";
  const words = text.trim().split(/\s+/);
  if (words.length > maxWords) {
    return `${words.slice(0, maxWords).join(" ")}...`;
  }
  return text;
};

const fetcher = async (url: string) => {
  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}t=${Date.now()}`;
  console.log("Fetching URL:", fullUrl);
  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    console.error(`API Error for ${url}:`, {
      status: response.status,
      statusText: response.statusText,
      error: errorMessage,
    });

    throw new Error(errorMessage);
  }

  return response.json();
};

// Function to calculate total posts from postTypes
const calculateTotalPosts = (postTypes: PostTypeCount | undefined): number => {
  if (!postTypes) return 0;
  return Object.values(postTypes).reduce((sum, count) => sum + count, 0);
};

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const { can, role: userRole, isLoading: permissionsLoading } = usePermissions();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("Active");
  const [clientFilter, setClientFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState<string>(String(new Date().getMonth() + 1));
  const [yearFilter, setYearFilter] = useState<string>(String(new Date().getFullYear()));
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isNavigatingToEdit, setIsNavigatingToEdit] = useState<string | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<{ url: string; filename: string; type: string } | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);

  console.log("API URL:", process.env.NEXT_PUBLIC_API_URL);

  /**
   * Permissions come from `/api/me/permissions` via usePermissions().
   *
   * This page used to fetch `/api/users/role?id=...` and then
   * `/api/role-permission/role/<roleName>`. Both are administrative endpoints — they
   * require `users:update` and `roles:read` — so a role holding only this module's
   * permission got 403 from them and the page rendered "Forbidden" despite being
   * allowed in. They also returned legacy names like "Manage-projects", which a role
   * created in the permission matrix never holds.
   */


  // Was a role-name check; projects:read is the agency-wide view.
  const isAdminOrManager = can("projects", "read");

  const projectsUrl = session?.user?.id && !permissionsLoading
    ? `/api/projects?month=${monthFilter}&year=${yearFilter}${!isAdminOrManager ? `&userId=${session.user.id}` : ""}`
    : null;
  console.log("Projects URL:", projectsUrl);

  const { data: projects = [], error: projectsError, isLoading: projectsLoading } = useSWR<Project[]>(
    status === "authenticated" && session?.user?.id && !permissionsLoading ? projectsUrl : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      onError: (error) => {
        console.error("Projects SWR error:", error);
      },
    }
  );

  useEffect(() => {
    if (projectsError) {
      console.error("Failed to fetch projects:", projectsError);
      setError(`Failed to fetch projects: ${projectsError.message}`);
    }
  }, [projectsError]);

  const toggleProjectStatus = useCallback(
    async (projectId: string, isActive: boolean) => {
      if (isToggling === projectId) return;
      setIsToggling(projectId);

      try {
        console.log("Toggling project status for ID:", projectId, "to isActive:", !isActive);
        const project = projects.find((p) => p.id === projectId);
        if (!project) {
          throw new Error("Project not found");
        }

        mutate(
          projectsUrl,
          (currentProjects: Project[] | undefined) =>
            currentProjects?.map((proj) =>
              proj.id === projectId ? { ...proj, isActive: !isActive } : proj
            ),
          false
        );

        const payload = {
          id: projectId,
          isActive: !isActive,
        };
        console.log("Sending payload to /api/projects/toggle-status:", payload);

        const response = await fetch(`/api/projects/toggle-status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Source": "toggleProjectStatus",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to toggle project status: ${errorData.error || response.statusText}`);
        }

        console.log("Toggle successful for project ID:", projectId);
        mutate(projectsUrl);
        toast.success(`Project ${!isActive ? "activated" : "deactivated"} successfully`);
      } catch (error) {
        console.error("Error toggling project status:", error);
        mutate(projectsUrl);
        setError(error instanceof Error ? error.message : "Failed to toggle project status");
        toast.error(error instanceof Error ? error.message : "Failed to toggle project status");
      } finally {
        setIsToggling(null);
      }
    },
    [projectsUrl, isToggling, projects]
  );

  const handleDeleteProject = async (projectId: string) => {
    setIsDeleting(projectId);
    try {
      const response = await fetch(`/api/projects?id=${projectId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete project");
      }

      toast.success("Project deleted successfully");
      mutate(projectsUrl);
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete project");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEditNavigation = (projectId: string) => {
    setIsNavigatingToEdit(projectId);
    router.push(`/dashboard/projects/${projectId}/edit`);
    setTimeout(() => {
      setIsNavigatingToEdit((prev) => (prev === projectId ? null : prev));
    }, 5000);
  };

  const companyNames = Array.from(
    new Set(projects.map((project) => projectCompanyName(project)).filter((company): company is string => !!company))
  );

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      (project.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (projectCompanyName(project)?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" && project.isActive) ||
      (statusFilter === "Inactive" && !project.isActive);
    const matchesClient = clientFilter === "All" || projectCompanyName(project) === clientFilter;
    return matchesSearch && matchesStatus && matchesClient;
  });

  if (status === "loading" || permissionsLoading || projectsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32 mb-2" />
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "unauthenticated" || !session?.user?.id || error) {
    return (
      <div className="py-12">
        <EmptyState
          icon={AlertTriangle}
          title={status === "unauthenticated" || !session?.user?.id ? "Authentication Required" : "Error Loading Campaigns"}
          description={
            status === "unauthenticated" || !session?.user?.id
              ? "Please sign in to access agency projects and campaigns."
              : error || "An unexpected error occurred while loading projects."
          }
          actionLabel={status === "unauthenticated" || !session?.user?.id ? "Sign In" : "Retry"}
          onAction={() =>
            status === "unauthenticated" || !session?.user?.id
              ? router.push("/auth/signin")
              : window.location.reload()
          }
        />
      </div>
    );
  }

  const roleName = session.user.role || "Unknown";
  const canManageProjects = can("projects", "update") || can("projects", "create");

  const getProjectPostMetrics = (project: Project) => {
    if (!project.posts || !Array.isArray(project.posts)) {
      return { created: 0, designUploaded: 0, clientApproved: 0, scheduled: 0, posted: 0 };
    }

    const filtered = project.posts.filter((post: any) => {
      const dateStr = post.scheduledAt || post.createdAt;
      if (!dateStr) return false;
      const postDate = new Date(dateStr);
      if (isNaN(postDate.getTime())) return false;

      const yearMatch =
        yearFilter === "all" ||
        postDate.getFullYear() === parseInt(yearFilter as string) ||
        postDate.getUTCFullYear() === parseInt(yearFilter as string);
      const monthMatch =
        monthFilter === "all" ||
        postDate.getMonth() + 1 === parseInt(monthFilter as string) ||
        postDate.getUTCMonth() + 1 === parseInt(monthFilter as string);
      return yearMatch && monthMatch;
    });

    let designUploaded = 0;
    let clientApproved = 0;
    let scheduled = 0;
    let posted = 0;

    filtered.forEach((post: any) => {
      if (post.assets && post.assets.some((asset: any) => !asset.isReference)) {
        designUploaded++;
      }
      if (post.status === "C_APPROVED") {
        clientApproved++;
      } else if (post.status === "SCHEDULED") {
        scheduled++;
      } else if (post.status === "POSTED") {
        posted++;
      }
    });

    return {
      created: filtered.length,
      designUploaded,
      clientApproved,
      scheduled,
      posted,
    };
  };

  const getProjectPostsCount = (project: Project) => {
    return getProjectPostMetrics(project).created;
  };

  const totalTargetPosts = filteredProjects.reduce((sum, project) => {
    if (!project.isActive) return sum;
    return sum + calculateTotalPosts(project.postTypes);
  }, 0);

  const totalPostsCreated = filteredProjects.reduce((sum, project) => {
    if (!project.isActive) return sum;
    return sum + getProjectPostsCount(project);
  }, 0);


  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your clients&apos; social media campaigns and deliverables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageProjects && (
            <Link href="/dashboard/projects/new">
              <Button size="sm" className="gap-1.5 shadow-2xs">
                <Plus className="size-4" /> New Project
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Stats Bar & Filters Toolbar */}
      <div className="space-y-3">
        {/* Quick Stat Chips */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-fit">
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-2 shadow-2xs">
            <div className="size-2 rounded-full bg-primary" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Projects</span>
              <span className="text-base font-bold tabular-nums text-foreground">{filteredProjects.filter(p => p.isActive).length}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-2 shadow-2xs">
            <div className="size-2 rounded-full bg-blue-500" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Posts</span>
              <span className="text-base font-bold tabular-nums text-foreground">{totalTargetPosts}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-2 shadow-2xs">
            <div className="size-2 rounded-full bg-emerald-500" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posts Created</span>
              <span className="text-base font-bold tabular-nums text-foreground">{totalPostsCreated}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-2 shadow-2xs">
            <div className="size-2 rounded-full bg-amber-500" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completion</span>
              <span className="text-base font-bold tabular-nums text-foreground">
                {totalTargetPosts > 0 ? Math.round((totalPostsCreated / totalTargetPosts) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col items-stretch gap-2.5 rounded-xl border border-border/70 bg-card p-3 shadow-2xs md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects by name or company..."
              aria-label="Search projects by name or company"
              className="h-9 w-full bg-background pl-9 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Select value={yearFilter} onValueChange={(val) => setYearFilter(val)}>
              <SelectTrigger aria-label="Filter projects by year" className="h-9 w-[110px] bg-background text-xs">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Years</SelectItem>
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <SelectItem key={year} value={year.toString()} className="text-xs">{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={monthFilter} onValueChange={(val) => setMonthFilter(val)}>
              <SelectTrigger aria-label="Filter projects by month" className="h-9 w-[110px] bg-background text-xs">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Months</SelectItem>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <SelectItem key={month} value={month.toString()} className="text-xs">
                    {new Date(0, month - 1).toLocaleString('default', { month: 'short' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value: "All" | "Active" | "Inactive") => setStatusFilter(value)}>
              <SelectTrigger aria-label="Filter projects by status" className="h-9 w-[115px] bg-background text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="Active" className="text-xs">Active</SelectItem>
                <SelectItem value="Inactive" className="text-xs">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger aria-label="Filter projects by company" className="h-9 w-[140px] bg-background text-xs">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All" className="text-xs">All Companies</SelectItem>
                {companyNames.map((company) => (
                  <SelectItem key={company} value={company} className="text-xs">
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchQuery || yearFilter !== String(new Date().getFullYear()) || monthFilter !== String(new Date().getMonth() + 1) || statusFilter !== "Active" || clientFilter !== "All") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setYearFilter(String(new Date().getFullYear()));
                  setMonthFilter(String(new Date().getMonth() + 1));
                  setStatusFilter("Active");
                  setClientFilter("All");
                }}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {filteredProjects.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-2xs">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px] text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</TableHead>
                <TableHead className="min-w-[200px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project Name</TableHead>
                <TableHead className="min-w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Name</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Post Created</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Design</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">CA</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scheduled</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Post</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project, index) => {
                const metrics = getProjectPostMetrics(project);
                const monthPosts = project.posts?.filter((post: any) => {
                  const dateStr = post.scheduledAt || post.createdAt;
                  if (!dateStr) return false;
                  const postDate = new Date(dateStr);
                  if (isNaN(postDate.getTime())) return false;

                  const yearMatch =
                    yearFilter === "all" ||
                    postDate.getFullYear() === parseInt(yearFilter as string) ||
                    postDate.getUTCFullYear() === parseInt(yearFilter as string);
                  const monthMatch =
                    monthFilter === "all" ||
                    postDate.getMonth() + 1 === parseInt(monthFilter as string) ||
                    postDate.getUTCMonth() + 1 === parseInt(monthFilter as string);
                  return yearMatch && monthMatch;
                }) || [];
                const isFiltered = yearFilter !== "all" || monthFilter !== "all";
                const timingPosts = isFiltered ? monthPosts : (project.posts || []);

                return (
                  <TableRow key={project.id}>
                    <TableCell className="text-center font-medium text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {project.image ? (
                          <img
                            src={getMediaUrl(project.image)}
                            alt={project.name || "Project"}
                            className="size-9 shrink-0 cursor-pointer rounded-md border border-border object-cover transition-opacity hover:opacity-80"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLogo({
                                url: getMediaUrl(project.image!),
                                filename: project.image!.split("/").pop() || `${project.name || "Project"}.jpg`,
                                type: "image",
                              });
                            }}
                            title="Click to view logo"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center border border-border text-xs font-semibold text-muted-foreground uppercase flex-shrink-0">
                            {project.name ? project.name.substring(0, 2) : "PR"}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0 items-start justify-center gap-0.5">
                          <Link
                            href={`/dashboard/projects/posts?projectId=${project.id}`}
                          className="block max-w-[220px] truncate text-sm font-medium leading-snug text-foreground hover:text-primary hover:underline"
                            onClick={() => console.log("Navigating to PostsPage with projectId:", project.id)}
                            title={project.name || "Unnamed Project"}
                          >
                            {project.name || "Unnamed Project"}
                          </Link>
                          <ProjectTimingBadge posts={timingPosts as any} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell title={projectCompanyName(project) || "Unknown Company"}>
                      {truncateWords(projectCompanyName(project), 3)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" title="Target Posts">
                        {calculateTotalPosts(project.postTypes)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-semibold" title="Posts Created">
                        {metrics.created}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-info/20 bg-info/10 font-medium text-info" title="Design Uploaded">
                        {metrics.designUploaded}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-primary/20 bg-primary/10 font-medium text-primary" title="Client Approve (CA)">
                        {metrics.clientApproved}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-warning/20 bg-warning/10 font-medium text-warning" title="Scheduled">
                        {metrics.scheduled}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-success/20 bg-success/10 font-medium text-success" title="Posted">
                        {metrics.posted}
                      </Badge>
                    </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/projects/${project.id}`} aria-label="View project">
                        <Button variant="ghost" size="icon" className="size-8" aria-label="View project" disabled={isToggling === project.id}>
                          <Eye className="size-4" />
                        </Button>
                      </Link>
                      {(() => {
                        // Was a list of lowercased role names, so a role created in
                        // the matrix could never edit a project however it was granted.
                        const canEditDelete = can("projects", "update");
                        return canEditDelete;
                      })() && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="size-8"
                            aria-label="Edit project"
                            disabled={isToggling === project.id || isDeleting === project.id || isNavigatingToEdit === project.id}
                            onClick={() => handleEditNavigation(project.id)}
                          >
                            {isNavigatingToEdit === project.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Edit className="size-4" />
                            )}
                          </Button>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              toggleProjectStatus(project.id, project.isActive);
                            }}
                          >
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className={`${
                                project.isActive ? "text-success hover:bg-success/10" : "text-destructive hover:bg-destructive/10"
                              } size-8 transition-colors`}
                              title={project.isActive ? "Deactivate" : "Activate"}
                              aria-label={project.isActive ? "Deactivate project" : "Activate project"}
                              disabled={isToggling === project.id || isDeleting === project.id || isNavigatingToEdit === project.id}
                            >
                              {isToggling === project.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : project.isActive ? (
                                <ToggleLeft className="size-4" />
                              ) : (
                                <ToggleRight className="size-4" />
                              )}
                            </Button>
                          </form>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Delete project"
                            onClick={() => setProjectToDelete({ id: project.id, name: project.name })}
                            title="Delete"
                            disabled={isToggling === project.id || isDeleting === project.id || isNavigatingToEdit === project.id}
                          >
                            {isDeleting === project.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </div>
      ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-center sm:p-12">
          <div className="flex flex-col items-center">
            <Plus className="mb-3 size-9 text-muted-foreground/60" />
            <h3 className="mb-2 text-base font-semibold tracking-tight text-foreground">
              {roleName === "ADMIN" ? "No projects match your filters" : "No assigned projects match your filters"}
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {roleName === "ADMIN"
                ? "No projects match the current filters."
                : "No assigned projects match the current filters."}
            </p>
            {can("projects", "create") && (
              <Link href="/dashboard/projects/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      <MediaPopup
        isOpen={!!selectedLogo}
        onClose={() => setSelectedLogo(null)}
        asset={selectedLogo}
      />

      <DeleteConfirmationDialog
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={async () => {
          if (!projectToDelete) return;
          await handleDeleteProject(projectToDelete.id);
          setProjectToDelete(null);
        }}
        itemName={projectToDelete?.name || "Project"}
        entityType="project"
        isLoading={isDeleting === projectToDelete?.id}
      />
    </div>
  );
}
