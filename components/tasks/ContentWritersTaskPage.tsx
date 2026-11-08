"use client";

import { useLiveRefresh } from "@/hooks/use-live-refresh"

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Clock, AlertCircle, ChevronRight, User, Calendar, FolderOpen,
  Search, Filter, BarChart3, Target, Zap, Grid3X3, Table,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Layers, Users, FileText, Plus, Eye
} from "lucide-react";
import ProjectTasksView from "@/components/tasks/contentWriterPostView";

enum PostStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SCHEDULED = "SCHEDULED",
  POSTED = "POSTED",
  RESUBMITTED = "RESUBMITTED",
  NEEDS_MINOR_CHANGE = "NEEDS_MINOR_CHANGE",
}

// Add Comment interface to Task
interface Comment {
    id: string;
    type: "CONTENT" | "DESIGN";
    content: string;
    createdAt: string;
    postId: string;
    userId: number;
  }

interface Task {
  id: string;
  title: string;
  caption?: string;
  type: string;
  status: PostStatus;
  scheduledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  project?: {
    id?: string;
    name?: string;
    client?: {
      name: string;
    };
  };
  assets: Array<{
    id: string;
    filename: string;
    url: string;
    createdAt?: string;
  }>;
  platforms?: Array<{
    id: string;
    platform: string;
  }>;
  assignedToId?: number;
  assignedTo?: {
    name: string;
    email: string;
  };
  feedback?: string;
  Comments: Comment[];
}

interface ProjectStrategy {
  id: number;
  month: number;
  year: number;
  postTypes: Record<string, number>;
  total: number;
}

type PeriodStats = {
  required: number;
  created: number;
  left: number;
  requiredByType: Record<string, number>;
  createdByType: Record<string, number>;
  leftByType: Record<string, number>;
};

interface ProjectGroup {
  projectId: string;
  projectName: string;
  clientName: string;
  tasks: Task[];
  strategies: ProjectStrategy[];
  stats: {
    total: number;
    draft: number;
    pending: number;
    approved: number;
    overdue: number;
    thisWeek: number;
    current: PeriodStats;
    next: PeriodStats;
    future: PeriodStats;
    unscheduled: number;
  };
}

type ViewMode = 'cards' | 'table';
type SortBy = 'dueDate' | 'status' | 'name' | 'client' | 'left';
type FilterBy = 'all' | 'overdue' | 'thisWeek' | 'draft' | 'pending' | 'approved' | 'pendingCreation';

export default function ContentWriterTasksPage() {
  const { data: session } = useSession();
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('dueDate');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');

  useEffect(() => {
    if (session?.user?.id) {
      fetchTasks();
    }
  }, [session]);

  const fetchTasks = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const response = await fetch("/api/content-tasks");
      if (!response.ok) throw new Error("Failed to fetch content tasks");
      const data: ProjectGroup[] = await response.json();
      const groupsWithStats = data.map(group => ({
        ...group,
        stats: calculateProjectStats(group.tasks, group.strategies)
      }));
      setProjectGroups(groupsWithStats);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };
  // Live: re-read when someone else changes what this shows.
  useLiveRefresh(() => fetchTasks({ silent: true }), ["Post", "Task"])

  const getAllTasks = () => {
    return projectGroups.flatMap(group => group.tasks);
  };

  const getTotalStats = () => {
    const allTasks = getAllTasks();
    const allStrategies = projectGroups.flatMap(group => group.strategies);
    return calculateProjectStats(allTasks, allStrategies);
  };

  const calculateProjectStats = (tasks: Task[], strategies: ProjectStrategy[]) => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const getMonthPeriod = (date: Date) => {
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      if (y < currentYear || (y === currentYear && m < currentMonth)) return 'past';
      if (y === currentYear && m === currentMonth) return 'current';
      const nextM = currentMonth + 1 > 12 ? 1 : currentMonth + 1;
      const nextY = currentMonth + 1 > 12 ? currentYear + 1 : currentYear;
      if (y === nextY && m === nextM) return 'next';
      return 'future';
    };

    const periodStrategies: Record<string, ProjectStrategy[]> = { current: [], next: [], future: [] };
    strategies.forEach(s => {
      const period = getMonthPeriod(new Date(s.year, s.month - 1, 1));
      if (period !== 'past') periodStrategies[period].push(s);
    });

    const getRequired = (strats: ProjectStrategy[]) => {
      const byType: Record<string, number> = {};
      let total = 0;
      strats.forEach(s => {
        Object.entries(s.postTypes).forEach(([type, count]) => {
          byType[type] = (byType[type] || 0) + count;
          total += count;
        });
      });
      return { byType, total };
    };

    const requiredCurrent = getRequired(periodStrategies.current);
    const requiredNext = getRequired(periodStrategies.next);
    const requiredFuture = getRequired(periodStrategies.future);

    const periodPosts: Record<string, Task[]> = { current: [], next: [], future: [], unscheduled: [] };
    tasks.forEach(t => {
      if (!t.scheduledAt) {
        periodPosts.unscheduled.push(t);
      } else {
        const d = new Date(t.scheduledAt);
        const period = getMonthPeriod(d);
        if (period !== 'past') periodPosts[period].push(t);
      }
    });

    const getCreated = (posts: Task[]) => {
      const byType: Record<string, number> = {};
      let total = 0;
      posts.forEach(t => {
        byType[t.type] = (byType[t.type] || 0) + 1;
        total++;
      });
      return { byType, total };
    };

    const createdCurrent = getCreated(periodPosts.current);
    const createdNext = getCreated(periodPosts.next);
    const createdFuture = getCreated(periodPosts.future);

    const getLeft = (required: { byType: Record<string, number>; total: number }, created: { byType: Record<string, number>; total: number }) => {
      const byType: Record<string, number> = {};
      let total = 0;
      Object.entries(required.byType).forEach(([type, req]) => {
        const cr = created.byType[type] || 0;
        byType[type] = Math.max(0, req - cr);
        total += Math.max(0, req - cr);
      });
      return { byType, total };
    };

    const leftCurrent = getLeft(requiredCurrent, createdCurrent);
    const leftNext = getLeft(requiredNext, createdNext);
    const leftFuture = getLeft(requiredFuture, createdFuture);

    const draft = tasks.filter(task => [PostStatus.DRAFT, PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE].includes(task.status)).length;
    const pending = tasks.filter(task => [PostStatus.SUBMITTED, PostStatus.RESUBMITTED].includes(task.status)).length;
    const approved = tasks.filter(task => [PostStatus.APPROVED, PostStatus.SCHEDULED, PostStatus.POSTED].includes(task.status)).length;

    const overdue = tasks.filter(task => {
      if (!task.scheduledAt) return false;
      const contentDueDate = new Date(task.scheduledAt);
      contentDueDate.setDate(contentDueDate.getDate() - 14);
      return contentDueDate < today && [PostStatus.DRAFT, PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE].includes(task.status);
    }).length;

    const weekFromNow = new Date(today);
    weekFromNow.setDate(today.getDate() + 7);
    const thisWeek = tasks.filter(task => {
      if (!task.scheduledAt) return false;
      const contentDueDate = new Date(task.scheduledAt);
      contentDueDate.setDate(contentDueDate.getDate() - 14);
      return contentDueDate >= today && contentDueDate <= weekFromNow;
    }).length;

    return {
      total: tasks.length,
      draft,
      pending,
      approved,
      overdue,
      thisWeek,
      current: {
        required: requiredCurrent.total,
        created: createdCurrent.total,
        left: leftCurrent.total,
        requiredByType: requiredCurrent.byType,
        createdByType: createdCurrent.byType,
        leftByType: leftCurrent.byType,
      },
      next: {
        required: requiredNext.total,
        created: createdNext.total,
        left: leftNext.total,
        requiredByType: requiredNext.byType,
        createdByType: createdNext.byType,
        leftByType: leftNext.byType,
      },
      future: {
        required: requiredFuture.total,
        created: createdFuture.total,
        left: leftFuture.total,
        requiredByType: requiredFuture.byType,
        createdByType: createdFuture.byType,
        leftByType: leftFuture.byType,
      },
      unscheduled: periodPosts.unscheduled.length,
    };
  };

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projectGroups.filter(project => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return project.projectName.toLowerCase().includes(query) || 
               project.clientName.toLowerCase().includes(query);
      }
      switch (filterBy) {
        case 'overdue': return project.stats.overdue > 0;
        case 'thisWeek': return project.stats.thisWeek > 0;
        case 'draft': return project.stats.draft > 0;
        case 'pending': return project.stats.pending > 0;
        case 'approved': return project.stats.approved > 0;
        case 'pendingCreation': return project.stats.current.left > 0 || project.stats.next.left > 0;
        default: return true;
      }
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'dueDate': return b.stats.overdue - a.stats.overdue || b.stats.thisWeek - a.stats.thisWeek;
        case 'status': return b.stats.pending - a.stats.pending;
        case 'name': return a.projectName.localeCompare(b.projectName);
        case 'client': return a.clientName.localeCompare(b.clientName);
        case 'left': return b.stats.current.left - a.stats.current.left;
        default: return 0;
      }
    });
  }, [projectGroups, searchQuery, filterBy, sortBy]);

  if (loading) {

    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="relative">
            <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
            <div className="absolute inset-0 bg-blue-100 rounded-full opacity-20 animate-ping" />
          </div>
          <p className="text-muted-foreground font-medium">Loading content tasks...</p>
          <p className="text-sm text-muted-foreground/70">Fetching your projects</p>
        </div>
      </div>
    );
  }

  if (selectedProjectId) {
    const selectedProject = projectGroups.find(p => p.projectId === selectedProjectId);
    if (selectedProject) {
      return (
        <ProjectTasksView
          project={selectedProject}
          onBack={() => setSelectedProjectId(null)}
        />
      );
    }
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Project not found</p>
          <Button variant="ghost" onClick={() => setSelectedProjectId(null)}>
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalStats = getTotalStats();

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">Content Writer Dashboard</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your content tasks across {projectGroups.length} project{projectGroups.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('cards')}
          >
            <Grid3X3 className="h-4 w-4 mr-1" />
            Cards
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <Table className="h-4 w-4 mr-1" />
            Table
          </Button>
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-1" />
            Analytics
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{totalStats.total}</p>
                <p className="text-sm text-muted-foreground">Total Posts</p>
              </div>
              <FileText className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{totalStats.pending}</p>
                <p className="text-sm text-muted-foreground">Under Review</p>
              </div>
              <Eye className="h-6 w-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{totalStats.overdue}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{totalStats.current.left}</p>
                <p className="text-sm text-muted-foreground">Pending Creation</p>
              </div>
              <Zap className="h-6 w-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search by project or client"
              placeholder="Search by project or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filterBy} onValueChange={(value) => setFilterBy(value as FilterBy)}>
            <SelectTrigger aria-label="Filter by" className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="thisWeek">Due This Week</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="pending">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="c_approved">Client approved</SelectItem>
              <SelectItem value="pendingCreation">Pending Creation</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
            <SelectTrigger aria-label="Sort by" className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dueDate">Due Date</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="name">Project Name</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="left">Pending Creation</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Projects Display */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Projects</h2>
          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
            {filteredAndSortedProjects.length} Project{filteredAndSortedProjects.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {filteredAndSortedProjects.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">
                {searchQuery || filterBy !== 'all' ? 'No matching projects found' : 'No projects assigned'}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {searchQuery || filterBy !== 'all' ? 'Adjust your search or filters' : 'New assignments will appear here'}
              </p>
            </CardContent>
          </Card>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedProjects.map(project => (
              <ProjectCard key={project.projectId} project={project} onSelect={() => setSelectedProjectId(project.projectId)} />
            ))}
          </div>
        ) : (
          <ProjectTable projects={filteredAndSortedProjects} onSelectProject={setSelectedProjectId} />
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project, onSelect }: { project: ProjectGroup; onSelect: () => void }) {
  const completionRate = project.stats.current.required > 0 
    ? Math.round((project.stats.current.created / project.stats.current.required) * 100) 
    : 0;
  const isUrgent = project.stats.overdue > 0 || project.stats.current.left > 0;

  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${isUrgent ? 'border-l-4 border-l-red-500' : ''}`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold">{project.projectName}</CardTitle>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <User className="h-4 w-4" /> {project.clientName}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            asChild
            onClick={e => e.stopPropagation()} // Prevent card click from triggering
          >
      <Link
  href={`/dashboard/projects/posts/new?projectId=${project.projectId}`}
  className="flex items-center"
>
  <Plus className="h-4 w-4 mr-1" />
  Create Post
</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{completionRate}% Complete</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-center">
              <p className="font-medium">{project.stats.draft}</p>
              <p className="text-muted-foreground text-xs">Drafts</p>
            </div>
            <div className="text-center">
              <p className="font-medium">{project.stats.pending}</p>
              <p className="text-muted-foreground text-xs">Review</p>
            </div>
            <div className="text-center">
              <p className="font-medium">{project.stats.approved}</p>
              <p className="text-muted-foreground text-xs">Approved</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-sm">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span>This Month: {project.stats.current.left} left</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(project.stats.current.leftByType).map(([type, count]) => (
                count > 0 && (
                  <Badge key={type} variant="secondary" className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300">
                    {type}: {count}
                  </Badge>
                )
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectTable({ projects, onSelectProject }: { projects: ProjectGroup[]; onSelectProject: (projectId: string) => void }) {
  const formatByType = (leftByType: Record<string, number>) => {
    return Object.entries(leftByType)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
  };

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-3 text-left font-semibold text-muted-foreground">Project</th>
              <th className="p-3 text-left font-semibold text-muted-foreground">Client</th>
              <th className="p-3 text-center font-semibold text-muted-foreground">Total Posts</th>
              <th className="p-3 text-center font-semibold text-muted-foreground">Drafts</th>
              <th className="p-3 text-center font-semibold text-muted-foreground">Review</th>
              <th className="p-3 text-center font-semibold text-muted-foreground">Approved</th>
              <th className="p-3 text-center font-semibold text-muted-foreground">Overdue</th>
              <th className="p-3 text-center font-semibold text-muted-foreground">Pending Creation</th>
              <th className="p-3 text-center font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(project => {
              const completionRate = project.stats.current.required > 0 
                ? Math.round((project.stats.current.created / project.stats.current.required) * 100) 
                : 0;
              return (
                <tr key={project.projectId} className="border-b border-border hover:bg-muted/50">
                  <td className="p-3">
                    <p 
                      className="font-medium text-blue-600 cursor-pointer"
                      onClick={() => onSelectProject(project.projectId)}
                    >
                      {project.projectName}
                    </p>
                  </td>
                  <td className="p-3">{project.clientName}</td>
                  <td className="p-3 text-center">{project.stats.total}</td>
                  <td className="p-3 text-center">{project.stats.draft}</td>
                  <td className="p-3 text-center">{project.stats.pending}</td>
                  <td className="p-3 text-center">{project.stats.approved}</td>
                  <td className="p-3 text-center">
                    <Badge variant={project.stats.overdue > 0 ? "destructive" : "secondary"}>
                      {project.stats.overdue}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">{formatByType(project.stats.current.leftByType)}</td>
                  <td className="p-3 text-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      asChild
                    >
      <Link
  href={`/dashboard/projects/posts/new?projectId=${project.projectId}`}
  className="flex items-center"
>
  <Plus className="h-4 w-4 mr-1" />
  Create Post
</Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}