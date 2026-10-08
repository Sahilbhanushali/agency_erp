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
  Search, Filter, BarChart3, Grid3X3, Table, Zap,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Clock4,
  FileText, Eye, Layers, Users, X
} from "lucide-react";
import ProjectTasksView from "@/components/tasks/projectTask";
import TaskStatsGrid from "@/components/tasks/taskStats";
import ContentWriterTasksPage from "@/components/tasks/ContentWritersTaskPage";
import StatusTasksView, { StatusFilter } from "@/components/tasks/StatusTasksView";

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

type ViewMode = 'cards' | 'table';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId"); // Get projectId from URL

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectIdFromUrl);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
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
            <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
            <div className="absolute inset-0 bg-blue-550/20 rounded-full opacity-20 animate-ping" />
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
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
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
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            My Design Tasks
          </h1>
          <p className="text-muted-foreground mt-1">
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

          <div className="flex bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className={viewMode === 'cards' ? 'shadow-sm' : ''}
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              Cards
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className={viewMode === 'table' ? 'shadow-sm' : ''}
            >
              <Table className="h-4 w-4 mr-2" />
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


      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects or clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterBy} onValueChange={(value) => setFilterBy(value as FilterBy)}>
                <SelectTrigger className="w-40">
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
                <SelectTrigger className="w-32">
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
          <Badge variant="outline" className="text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60">
            {filteredAndSortedProjects.length} of {projectGroups.length} Project{projectGroups.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        {filteredAndSortedProjects.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="bg-muted rounded-full p-6 w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium text-lg mb-2">
                {searchQuery || filterBy !== 'all' ? 'No projects match your criteria' : 'No projects assigned to you'}
              </p>
              <p className="text-sm text-muted-foreground/80">
                {searchQuery || filterBy !== 'all' ? 'Try adjusting your search or filters' : 'Check back later for new assignments!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {viewMode === 'cards' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredAndSortedProjects.map((project: ProjectGroup) => (
                  <EnhancedProjectCard
                    key={project.projectId}
                    project={project}
                    onSelect={() => handleSelectProject(project.projectId)} // Updated to handle URL
                  />
                ))}
              </div>
            ) : (
              <ProjectTable
                projects={filteredAndSortedProjects}
                onSelectProject={handleSelectProject} // Updated to handle URL
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EnhancedProjectCard({ project, onSelect }: { project: ProjectGroup; onSelect: () => void }) {
  const hasUrgentIssues = project.stats.overdue > 0;
  const completionRate = project.stats.total > 0 ?
    Math.round((project.stats.approved / project.stats.total) * 100) : 0;

  return (
    <Card
      className={`group relative overflow-hidden transition-all duration-300 cursor-pointer bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 ${
        hasUrgentIssues
          ? 'border-red-200 border-l-4 border-l-red-500'
          : 'border-slate-200 hover:border-blue-200'
      }`}
      onClick={onSelect}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full -translate-y-12 translate-x-12 opacity-50 group-hover:opacity-100 transition-opacity" />
      <CardHeader className="pb-3 relative">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg font-bold line-clamp-2 text-slate-800 group-hover:text-blue-600 transition-colors mb-1">
              {project.projectName}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Users className="h-3 w-3 text-slate-400" />
              <p className="text-sm text-slate-500">{project.clientName}</p>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <div className="bg-blue-50 px-2 py-1 rounded text-xs font-medium text-blue-700 border border-blue-100">
                {completionRate}% Complete
              </div>
              {hasUrgentIssues && (
                <div className="bg-red-50 px-2 py-1 rounded text-xs font-medium text-red-600 flex items-center border border-red-100">
                  <Zap className="h-3 w-3 mr-1" />
                  Urgent
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="bg-slate-50 rounded-full p-2 shadow-sm group-hover:shadow-md transition-shadow border border-slate-100">
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
            </div>
            <span className="text-xs text-slate-400 mt-1">{project.stats.total} tasks</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">Project Progress</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-sm font-semibold text-slate-700">{project.stats.draft}</p>
            <p className="text-xs text-slate-500">Draft</p>
          </div>
          <div className="text-center p-2 bg-yellow-50 rounded-lg border border-yellow-100">
            <p className="text-sm font-semibold text-yellow-700">{project.stats.pending}</p>
            <p className="text-xs text-yellow-600">Review</p>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg border border-green-100">
            <p className="text-sm font-semibold text-green-700">{project.stats.approved}</p>
            <p className="text-xs text-green-600">Done</p>
          </div>
          <div className={`text-center p-2 rounded-lg border ${
            project.stats.overdue > 0
              ? 'bg-red-50 border-red-100'
              : 'bg-slate-50 border-slate-100'
          }`}>
            <p className={`text-sm font-semibold ${
              project.stats.overdue > 0 ? 'text-red-700' : 'text-slate-700'
            }`}>
              {project.stats.overdue}
            </p>
            <p className={`text-xs ${project.stats.overdue > 0 ? 'text-red-600' : 'text-slate-500'}`}>Late</p>
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
              <th className="text-left p-4 font-semibold text-foreground">Project</th>
              <th className="text-left p-4 font-semibold text-foreground">Client</th>
              <th className="text-center p-4 font-semibold text-foreground">Total</th>
              <th className="text-center p-4 font-semibold text-foreground">Draft</th>
              <th className="text-center p-4 font-semibold text-foreground">Review</th>
              <th className="text-center p-4 font-semibold text-foreground">Done</th>
              <th className="text-center p-4 font-semibold text-foreground">Overdue</th>
              <th className="text-center p-4 font-semibold text-foreground">This Week</th>
              <th className="text-center p-4 font-semibold text-foreground">Progress</th>
              <th className="text-center p-4 font-semibold text-foreground">Actions</th>
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
                    hasUrgent ? 'bg-red-950/10' : ''
                  }`}
                >
                  <td className="p-4">
                    <div>
                      <p className="font-semibold text-foreground hover:text-blue-400 cursor-pointer"
                         onClick={() => onSelectProject(project.projectId)}>
                        {project.projectName}
                      </p>
                      {hasUrgent && (
                        <div className="flex items-center mt-1">
                          <AlertCircle className="h-3 w-3 text-red-500 mr-1" />
                          <span className="text-xs text-red-400">Urgent attention needed</span>
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
                    <Badge variant="secondary" className="bg-yellow-95/30 text-yellow-400 border border-yellow-900/60">
                      {project.stats.pending}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    <Badge variant="secondary" className="bg-green-95/30 text-green-400 border border-green-900/60">
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
                    <Badge variant="outline" className="bg-blue-95/30 text-blue-400 border border-blue-900/60">
                      {project.stats.thisWeek}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-muted rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
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
                      className="hover:bg-blue-95/30 hover:text-blue-400"
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