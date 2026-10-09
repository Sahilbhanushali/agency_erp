"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation"; // Import Next.js hooks
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, ChevronDown, User, Calendar, FolderOpen,
  Search, Filter, BarChart3, Grid3X3, Table, Zap, Kanban,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Clock4,
  FileText, Eye, Layers, Users, X
} from "lucide-react";
import ProjectTasksView from "@/components/tasks/projectTask";
import TaskStatsGrid from "@/components/tasks/taskStats";
import ContentWriterTasksPage from "@/components/tasks/ContentWritersTaskPage";
import StatusTasksView, { StatusFilter } from "@/components/tasks/StatusTasksView";
import TaskKanbanBoard from "@/components/tasks/TaskKanbanBoard";

enum PostStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  C_APPROVED = "C_APPROVED",
  REJECTED = "REJECTED",
  SCHEDULED = "SCHEDULED",
  POSTED = "POSTED",
  RESUBMITTED = "RESUBMITTED",
  NEEDS_MINOR_CHANGE = "NEEDS_MINOR_CHANGE",
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
      avatar: string;
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
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  designDueDate?: string;
}

interface ProjectGroup {
  projectId: string;
  projectName: string;
  clientName: string;
  tasks: Task[];
  stats: {
    total: number;
    draft: number;
    pending: number;
    approved: number;
    overdue: number;
    thisWeek: number;
    nextWeek: number;
  };
}

type ViewMode = 'kanban' | 'cards' | 'table';
type SortBy = 'dueDate' | 'priority' | 'status' | 'name' | 'client';
type FilterBy = 'all' | 'overdue' | 'thisWeek' | 'draft' | 'pending' | 'approved';

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch tasks");
  return response.json();
};

export default function TasksPage() {
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;
  const isAdmin = userRole ? ['ADMIN', 'MANAGER', 'SOCIAL MEDIA MANAGER', 'TEAM LEAD', 'TEAM_LEAD'].includes(userRole.toUpperCase()) : false;
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId"); // Get projectId from URL

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectIdFromUrl);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('dueDate');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  const { data: projectGroups = [], error, isLoading, mutate } = useSWR(
    status === "authenticated" && session?.user?.id && userRole !== "Content Writer"
      ? "/api/tasks"
      : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // refreshInterval: 30000000,
    }
  );

  // Sync selectedProjectId with URL projectId
  useEffect(() => {
    setSelectedProjectId(projectIdFromUrl);
  }, [projectIdFromUrl]);

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    router.push(`tasks?projectId=${projectId}`); // Update URL with projectId
  };

  const handleBack = () => {
    setSelectedProjectId(null);
    router.push("/dashboard/tasks"); // Clear projectId from URL
  };

  const calculateProjectStats = (tasks: Task[]) => {
    const today = new Date();
    return {
      total: tasks.length,
      draft: tasks.filter(task => task.status === PostStatus.DRAFT).length,
      pending: tasks.filter(task =>
        [PostStatus.SUBMITTED, PostStatus.RESUBMITTED].includes(task.status)
      ).length,
      approved: tasks.filter(task =>
        [PostStatus.APPROVED, PostStatus.C_APPROVED, PostStatus.SCHEDULED, PostStatus.POSTED].includes(task.status)
      ).length,
      approvedOnly: tasks.filter(task => task.status === PostStatus.APPROVED).length,
      postedOnly: tasks.filter(task =>
        [PostStatus.SCHEDULED, PostStatus.POSTED].includes(task.status)
      ).length,
      rejected: tasks.filter(task =>
        [PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE].includes(task.status)
      ).length,
      overdue: tasks.filter(task => {
        if (!(task as any).designDueDate) return false;
        const designDueDate = new Date((task as any).designDueDate);
        return designDueDate < today && [PostStatus.DRAFT, PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE].includes(task.status);
      }).length,
      thisWeek: tasks.filter(task => {
        if (!task.scheduledAt) return false;
        const designDueDate = new Date(task.scheduledAt);
        designDueDate.setDate(designDueDate.getDate() - 7);
        const weekFromNow = new Date();
        weekFromNow.setDate(today.getDate() + 7);
        return designDueDate >= today && designDueDate <= weekFromNow;
      }).length,
      nextWeek: tasks.filter(task => {
        if (!task.scheduledAt) return false;
        const designDueDate = new Date(task.scheduledAt);
        designDueDate.setDate(designDueDate.getDate() - 7);
        const weekFromNow = new Date();
        weekFromNow.setDate(today.getDate() + 7);
        const twoWeeksFromNow = new Date();
        twoWeeksFromNow.setDate(today.getDate() + 14);
        return designDueDate > weekFromNow && designDueDate <= twoWeeksFromNow;
      }).length,
    };
  };

  const isTaskInSelectedMonth = (task: Task, monthKey: string) => {
    if (monthKey === "all") return true;
    const dateStr = task.scheduledAt || (task as any).designDueDate || task.createdAt;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;

    const [targetYear, targetMonth] = monthKey.split("-").map(Number);
    const localMatch = d.getFullYear() === targetYear && d.getMonth() + 1 === targetMonth;
    const utcMatch = d.getUTCFullYear() === targetYear && d.getUTCMonth() + 1 === targetMonth;
    return localMatch || utcMatch;
  };

  const monthFilteredProjectGroups = useMemo(() => {
    if (selectedMonth === "all") return projectGroups;

    return projectGroups.map((group: ProjectGroup) => {
      const filteredTasks = group.tasks.filter((task) => isTaskInSelectedMonth(task, selectedMonth));
      return {
        ...group,
        tasks: filteredTasks,
        stats: calculateProjectStats(filteredTasks),
      };
    }).filter((group: ProjectGroup) => group.tasks.length > 0);
  }, [projectGroups, selectedMonth]);

  const getAllTasks = () => {
    return monthFilteredProjectGroups.flatMap((group: ProjectGroup) => group.tasks);
  };

  const getTotalStats = () => {
    const allTasks = getAllTasks();
    return calculateProjectStats(allTasks);
  };

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = monthFilteredProjectGroups.filter((project: ProjectGroup) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!project.projectName.toLowerCase().includes(query) &&
            !project.clientName.toLowerCase().includes(query)) {
          return false;
        }
      }

      switch (filterBy) {
        case 'overdue':
          return project.stats.overdue > 0;
        case 'thisWeek':
          return project.stats.thisWeek > 0;
        case 'draft':
          return project.stats.draft > 0;
        case 'pending':
          return project.stats.pending > 0;
        case 'approved':
          return project.stats.approved > 0;
        default:
          return true;
      }
    });

    return filtered.sort((a: ProjectGroup, b: ProjectGroup) => {
      switch (sortBy) {
        case 'dueDate':
          return b.stats.overdue - a.stats.overdue || b.stats.thisWeek - a.stats.thisWeek;
        case 'priority':
          return b.stats.overdue - a.stats.overdue;
        case 'status':
          return b.stats.pending - a.stats.pending;
        case 'name':
          return a.projectName.localeCompare(b.projectName);
        case 'client':
          return a.clientName.localeCompare(b.clientName);
        default:
          return 0;
      }
    });
  }, [monthFilteredProjectGroups, searchQuery, filterBy, sortBy]);

  if (userRole === "Content Writer") {
    return <ContentWriterTasksPage />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="relative">
          <Clock className="mx-auto mb-4 size-8 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground font-medium">Loading your tasks...</p>
          <p className="text-sm text-muted-foreground/80">Organizing by projects</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 size-8 text-destructive" />
          <p className="text-muted-foreground font-medium">Failed to load tasks</p>
          <p className="text-sm text-muted-foreground/80">Please try again later</p>
          <Button onClick={() => mutate()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (selectedStatus) {
    return (
      <StatusTasksView
        status={selectedStatus}
        projectGroups={monthFilteredProjectGroups}
        onBack={() => setSelectedStatus(null)}
        mutate={mutate}
      />
    );
  }

  if (selectedProjectId) {
    const selectedProject = monthFilteredProjectGroups.find((p: ProjectGroup) => p.projectId === selectedProjectId);
    if (selectedProject) {
      return (
        <ProjectTasksView
          project={selectedProject}
          onBack={handleBack}
          mutate={mutate}
        />
      );
    }
  }

  const totalStats = getTotalStats();

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            My Design Tasks
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track assignments, deadlines, and progress across {projectGroups.length} project{projectGroups.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe Dropdown */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <MonthPicker 
              selectedMonth={selectedMonth} 
              onChange={setSelectedMonth} 
            />
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

          <div className="flex rounded-lg border border-border bg-muted p-1">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="gap-1.5"
            >
              <Kanban className="size-4 mr-1.5" />
              Kanban
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="gap-1.5"
            >
              <Grid3X3 className="size-4 mr-1.5" />
              Cards
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="gap-1.5"
            >
              <Table className="size-4 mr-1.5" />
              Table
            </Button>
          </div>
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
        </div>
      </div>
      <TaskStatsGrid stats={totalStats} onViewStatus={(s) => setSelectedStatus(s)} />

      {viewMode === 'kanban' ? (
        <div className="pt-2">
          <TaskKanbanBoard
            tasks={getAllTasks() as any}
            mutate={mutate}
            isAdmin={isAdmin}
          />
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search projects or clients..."
                    aria-label="Search tasks by project or client"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={filterBy} onValueChange={(value) => setFilterBy(value as FilterBy)}>
                    <SelectTrigger aria-label="Filter projects" className="w-40">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="thisWeek">Due This Week</SelectItem>
                      <SelectItem value="draft">Has Drafts</SelectItem>
                      <SelectItem value="pending">Under Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                    <SelectTrigger aria-label="Sort projects" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dueDate">Due Date</SelectItem>
                      <SelectItem value="priority">Priority</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Your Projects</h2>
              <Badge variant="outline" className="text-xs font-medium text-primary">
                {filteredAndSortedProjects.length} of {projectGroups.length} Project{projectGroups.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {filteredAndSortedProjects.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-xl bg-muted">
                    <FolderOpen className="size-8 text-muted-foreground" />
                  </div>
                  <p className="mb-2 text-base font-medium text-foreground">
                    {searchQuery || filterBy !== 'all' ? 'No projects match your criteria' : 'No projects assigned to you'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || filterBy !== 'all' ? 'Try adjusting your search or filters' : 'Check back later for new assignments!'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {viewMode === 'cards' ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {filteredAndSortedProjects.map((project: ProjectGroup) => (
                      <EnhancedProjectCard
                        key={project.projectId}
                        project={project}
                        onSelect={() => handleSelectProject(project.projectId)}
                      />
                    ))}
                  </div>
                ) : (
                  <ProjectTable
                    projects={filteredAndSortedProjects}
                    onSelectProject={handleSelectProject}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EnhancedProjectCard({ project, onSelect }: { project: ProjectGroup; onSelect: () => void }) {
  const hasUrgentIssues = project.stats.overdue > 0;
  const completionRate = project.stats.total > 0 ?
    Math.round((project.stats.approved / project.stats.total) * 100) : 0;

  return (
    <Card
      className={`group relative cursor-pointer overflow-hidden border-l-2 bg-card transition-colors hover:border-primary ${
        hasUrgentIssues ? 'border-l-destructive' : 'border-l-transparent'
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-3 relative">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="mb-1 line-clamp-2 text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
              {project.projectName}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Users className="size-3.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{project.clientName}</p>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <div className="rounded border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                {completionRate}% Complete
              </div>
              {hasUrgentIssues && (
                <div className="flex items-center rounded border border-destructive/20 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                  <Zap className="mr-1 size-3" />
                  Urgent
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="rounded-full border border-border bg-muted p-2 transition-colors group-hover:bg-accent">
              <ChevronRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>
            <span className="mt-1 text-xs tabular-nums text-muted-foreground">{project.stats.total} tasks</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">Project Progress</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-md border border-border bg-muted/60 p-2 text-center">
            <p className="text-sm font-semibold tabular-nums text-foreground">{project.stats.draft}</p>
            <p className="text-xs text-muted-foreground">Draft</p>
          </div>
          <div className="rounded-md border border-warning/20 bg-warning/10 p-2 text-center">
            <p className="text-sm font-semibold tabular-nums text-warning">{project.stats.pending}</p>
            <p className="text-xs text-warning">Review</p>
          </div>
          <div className="rounded-md border border-success/20 bg-success/10 p-2 text-center">
            <p className="text-sm font-semibold tabular-nums text-success">{project.stats.approved}</p>
            <p className="text-xs text-success">Done</p>
          </div>
          <div className={`rounded-md border p-2 text-center ${
            project.stats.overdue > 0 ? 'border-destructive/20 bg-destructive/10' : 'border-border bg-muted/60'
          }`}>
            <p className={`text-sm font-semibold tabular-nums ${
              project.stats.overdue > 0 ? 'text-destructive' : 'text-foreground'
            }`}>
              {project.stats.overdue}
            </p>
            <p className={`text-xs ${project.stats.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>Late</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectTable({ projects, onSelectProject }: {
  projects: ProjectGroup[];
  onSelectProject: (projectId: string) => void;
}) {
  return (
    <Card className="border-border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Project</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">Client</th>
              <th className="p-3 text-center text-xs font-medium text-muted-foreground">Total</th>
              <th className="p-3 text-center text-xs font-medium text-muted-foreground">Draft</th>
              <th className="p-3 text-center text-xs font-medium text-muted-foreground">Review</th>
              <th className="p-3 text-center text-xs font-medium text-muted-foreground">Done</th>
              <th className="p-3 text-center text-xs font-medium text-muted-foreground">Overdue</th>
              <th className="p-3 text-center text-xs font-medium text-muted-foreground">This Week</th>
              <th className="p-3 text-center text-xs font-medium text-muted-foreground">Progress</th>
              <th className="p-3 text-center text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const completionRate = project.stats.total > 0 ?
                Math.round((project.stats.approved / project.stats.total) * 100) : 0;
              const hasUrgent = project.stats.overdue > 0;
              return (
                <tr
                  key={project.projectId}
                  className={`border-b border-border hover:bg-muted/50 transition-colors ${
                    hasUrgent ? 'bg-destructive/5' : ''
                  }`}
                >
                  <td className="p-4">
                    <div>
                      <p className="cursor-pointer font-medium text-foreground hover:text-primary"
                         onClick={() => onSelectProject(project.projectId)}>
                        {project.projectName}
                      </p>
                      {hasUrgent && (
                        <div className="flex items-center mt-1">
                          <AlertCircle className="mr-1 size-3.5 text-destructive" />
                          <span className="text-xs text-destructive">Urgent attention needed</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">{project.clientName}</td>
                  <td className="p-4 text-center">
                    <Badge variant="outline" className="border-border">{project.stats.total}</Badge>
                  </td>
                  <td className="p-4 text-center">
                    <Badge variant="secondary" className="bg-muted text-foreground">
                      {project.stats.draft}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning">
                      {project.stats.pending}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    <Badge variant="outline" className="border-success/20 bg-success/10 text-success">
                      {project.stats.approved}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    <Badge
                      variant={project.stats.overdue > 0 ? "destructive" : "secondary"}
                      className={project.stats.overdue > 0 ? "" : "bg-muted text-foreground"}
                    >
                      {project.stats.overdue}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    <Badge variant="outline" className="border-info/20 bg-info/10 text-info">
                      {project.stats.thisWeek}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-muted rounded-full h-2">
                        <div
                          className="h-1.5 rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground min-w-fit">{completionRate}%</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectProject(project.projectId)}
                      className="hover:bg-accent hover:text-primary"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
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

function MonthPicker({
  selectedMonth,
  onChange,
}: {
  selectedMonth: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Extract year from selectedMonth or use current year
  const initialYear = selectedMonth === "all" ? new Date().getFullYear() : parseInt(selectedMonth.split("-")[0]);
  const [viewYear, setViewYear] = useState(initialYear);
  
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const handleSelect = (monthIndex: number) => {
    const value = `${viewYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    onChange(value);
    setIsOpen(false);
  };

  const selectedLabel = selectedMonth === "all" 
    ? "All Time (Total)" 
    : `${months[parseInt(selectedMonth.split("-")[1]) - 1]} ${selectedMonth.split("-")[0]}`;

  return (
    <Popover open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open) {
        setViewYear(selectedMonth === "all" ? new Date().getFullYear() : parseInt(selectedMonth.split("-")[0]));
      }
    }}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[180px] justify-between font-normal bg-background">
          {selectedLabel}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="icon" className="h-7 w-7 bg-transparent p-0" onClick={() => setViewYear(viewYear - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-semibold text-sm">{viewYear}</div>
          <Button variant="outline" size="icon" className="h-7 w-7 bg-transparent p-0" onClick={() => setViewYear(viewYear + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {months.map((month, index) => {
            const isSelected = selectedMonth === `${viewYear}-${String(index + 1).padStart(2, '0')}`;
            return (
              <Button
                key={month}
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className="text-xs h-8"
                onClick={() => handleSelect(index)}
              >
                {month.slice(0, 3)}
              </Button>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t">
          <Button
            variant={selectedMonth === "all" ? "default" : "ghost"}
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              onChange("all");
              setIsOpen(false);
            }}
          >
            All Time (Total)
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
