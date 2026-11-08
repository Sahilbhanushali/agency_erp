
"use client";

import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Building, Grid, List, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import TaskStatsGrid from "./taskStats";
import TaskGrid from "./taskGrid";
import TaskTable from "./taskTable";
import { format, startOfMonth, addMonths, subMonths, isSameMonth } from "date-fns";
import toast from "react-hot-toast";


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
    type: string;
    isReference: boolean;
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
}

interface ProjectGroup {
  projectId: string;
  projectName: string;
  clientName: string;
  companyName: string;
  tasks: Task[];
  stats: {
    total: number;
    draft: number;
    pending: number;
    approved: number;
    overdue: number;
    thisWeek: number;
    nextWeek: number;
    rejected: number;
  };
}

interface ProjectTasksViewProps {
  project: ProjectGroup;
  onBack: () => void;
  mutate: () => void;
}

export default function ProjectTasksView({ project, onBack, mutate }: ProjectTasksViewProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date())); // Default to current month
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const today = new Date();

  // Generate a list of months for the filter (e.g., last 6 months, current, and next 6 months)
  const generateMonthOptions = () => {
    const months: Date[] = [];
    const currentMonth = startOfMonth(today);
    for (let i = -6; i <= 6; i++) {
      months.push(addMonths(currentMonth, i));
    }
    return months;
  };

  const monthOptions = generateMonthOptions();

  // Calculate task counts per month
  const monthTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    monthOptions.forEach((month) => {
      const monthKey = format(month, "yyyy-MM");
      counts[monthKey] = project.tasks.filter((task) => {
        const dateStr = task.scheduledAt || (task as any).designDueDate || task.createdAt;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) && isSameMonth(d, month);
      }).length;
    });
    return counts;
  }, [project.tasks, monthOptions]);

  // Helper function to filter tasks by month
  const filterTasksByMonth = (tasks: Task[]) => {
    return tasks.filter(task => {
      const dateStr = task.scheduledAt || (task as any).designDueDate || task.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && isSameMonth(d, selectedMonth);
    });
  };

  // Task filtering logic with month filter applied
  const thisWeekTasks = filterTasksByMonth(project.tasks.filter(task => {
    if (!task.scheduledAt) return false;
    const designDueDate = new Date(task.scheduledAt);
    designDueDate.setDate(designDueDate.getDate() - 7);
    const weekFromNow = new Date();
    weekFromNow.setDate(today.getDate() + 7);
    return designDueDate >= today && designDueDate <= weekFromNow;
  }));

  const nextWeekTasks = filterTasksByMonth(project.tasks.filter(task => {
    if (!task.scheduledAt) return false;
    const designDueDate = new Date(task.scheduledAt);
    designDueDate.setDate(designDueDate.getDate() - 7);
    const weekFromNow = new Date();
    weekFromNow.setDate(today.getDate() + 7);
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(today.getDate() + 14);
    return designDueDate > weekFromNow && designDueDate <= twoWeeksFromNow;
  }));

  const overdueTasks = filterTasksByMonth(project.tasks.filter(task => {
    if (!(task as any).designDueDate) return false;
    const dd = new Date((task as any).designDueDate);
    return dd < today && [PostStatus.DRAFT, PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE].includes(task.status);
  }));

  const pendingTasks = filterTasksByMonth(project.tasks.filter(task =>
    [PostStatus.REJECTED, PostStatus.RESUBMITTED, PostStatus.SUBMITTED, PostStatus.NEEDS_MINOR_CHANGE].includes(task.status)
  ));

  const approvedTasks = filterTasksByMonth(project.tasks.filter(task =>
    [PostStatus.APPROVED, PostStatus.SCHEDULED, PostStatus.POSTED].includes(task.status)
  ));

  const draftTasks = filterTasksByMonth(project.tasks.filter(task => task.status === PostStatus.DRAFT));

  const rejectedTasks = filterTasksByMonth(project.tasks.filter(task => task.status === PostStatus.REJECTED || task.status === PostStatus.NEEDS_MINOR_CHANGE));

  const allTasks = filterTasksByMonth(project.tasks);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <Button variant="ghost" onClick={onBack} className="p-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{project.projectName}</h1>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Building className="h-4 w-4" />
              <p>{project.companyName}</p>
              <span>•</span>
              <p>{project.stats.total} task{project.stats.total !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            onClick={() => setViewMode("grid")}
            className="p-2"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            onClick={() => setViewMode("table")}
            className="p-2"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <TaskStatsGrid stats={project.stats} />

      {/* Redesigned Premium Month Timeline Filter */}
      <div className="flex items-center space-x-2 bg-slate-50/60 dark:bg-slate-900/30 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/40 shadow-sm backdrop-blur-sm">
        {/* Left Side Header Description */}
        <div className="hidden sm:flex flex-col items-start pl-2 pr-4 border-r border-slate-200/80 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <Calendar className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Timeline</span>
          </div>
          <span className="text-xs text-muted-foreground font-medium mt-0.5">Filter by Month</span>
        </div>

        {/* Navigation Arrow Left */}
        <Button aria-label="Previous month"
          variant="ghost"
          size="icon"
          onClick={() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollBy({ left: -220, behavior: "smooth" });
            }
          }}
          className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 shrink-0 shadow-sm hover:scale-105 transition-transform"
        >
          <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        </Button>

        {/* Scrollable Month Cards container */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex gap-2 overflow-x-auto scroll-smooth py-0.5 px-1 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {monthOptions.map((month) => {
            const monthKey = format(month, "yyyy-MM");
            const taskCount = monthTaskCounts[monthKey] || 0;
            const isSelected = isSameMonth(month, selectedMonth);

            return (
              <button
                key={monthKey}
                onClick={() => {
                  setSelectedMonth(month);
                  toast.success(`Timeline filtered to ${format(month, "MMMM yyyy")}`);
                }}
                className={`flex-shrink-0 relative overflow-hidden rounded-xl px-4 py-2 min-w-[110px] transition-all duration-300 text-left cursor-pointer border ${
                  isSelected
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500 shadow-md shadow-blue-500/10 -translate-y-0.5"
                    : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-900/60 hover:-translate-y-0.5"
                }`}
              >
                {/* Visual indicator pattern for active month */}
                {isSelected && (
                  <div className="absolute -right-4 -bottom-4 w-12 h-12 rounded-full bg-white/10" />
                )}

                <div className="flex flex-col justify-between h-full gap-0.5">
                  <div className="flex justify-between items-center gap-1.5">
                    <span className={`text-xs uppercase font-bold tracking-wider ${
                      isSelected ? "text-blue-100/90" : "text-slate-400 dark:text-slate-500"
                    }`}>
                      {format(month, "yyyy")}
                    </span>
                    
                    {/* Task count pill badge */}
                    <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-full shrink-0 border ${
                      isSelected
                        ? "bg-white/20 text-white border-white/20"
                        : taskCount > 0
                        ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/20"
                        : "bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-900 dark:text-slate-600 dark:border-slate-800/40"
                    }`}>
                      {taskCount}
                    </span>
                  </div>
                  <span className={`text-xs font-black tracking-wide ${
                    isSelected ? "text-white" : "text-slate-800 dark:text-slate-100"
                  }`}>
                    {format(month, "MMMM")}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Navigation Arrow Right */}
        <Button aria-label="Next month"
          variant="ghost"
          size="icon"
          onClick={() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollBy({ left: 220, behavior: "smooth" });
            }
          }}
          className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 shrink-0 shadow-sm hover:scale-105 transition-transform"
        >
          <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="thisweek" className="text-xs">
            This Week ({thisWeekTasks.length})
          </TabsTrigger>
          <TabsTrigger value="nextweek" className="text-xs">
            Next Week ({nextWeekTasks.length})
          </TabsTrigger>
          <TabsTrigger value="overdue" className="text-xs text-red-600">
            Overdue ({overdueTasks.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-xs">
            Pending ({pendingTasks.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="text-xs">
            I Approve ({approvedTasks.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs text-red-600">
            Changes ({rejectedTasks.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs">
            All ({allTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="thisweek">
          {viewMode === "grid" ? (
            <TaskGrid
              tasks={thisWeekTasks}
              title={`Due This Week (${format(selectedMonth, "MMMM yyyy")})`}
              showDeadlines
              emptyMessage={`No tasks due this week in ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="You're all caught up for now!"
              mutate={mutate}
            />
          ) : (
            <TaskTable
              tasks={thisWeekTasks}
              title={`Due This Week (${format(selectedMonth, "MMMM yyyy")})`}
              showDeadlines
              emptyMessage={`No tasks due this week in ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="You're all caught up for now!"
              mutate={mutate}
            />
          )}
        </TabsContent>

        <TabsContent value="nextweek">
          {viewMode === "grid" ? (
            <TaskGrid
              tasks={nextWeekTasks}
              title={`Due Next Week (${format(selectedMonth, "MMMM yyyy")})`}
              showDeadlines
              emptyMessage={`No tasks due next week in ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="Nothing scheduled yet"
              mutate={mutate}
            />
          ) : (
            <TaskTable
              tasks={nextWeekTasks}
              title={`Due Next Week (${format(selectedMonth, "MMMM yyyy")})`}
              showDeadlines
              emptyMessage={`No tasks due next week in ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="Nothing scheduled yet"
              mutate={mutate}
            />
          )}
        </TabsContent>

        <TabsContent value="overdue">
          {viewMode === "grid" ? (
            <TaskGrid
              tasks={overdueTasks}
              title={`Overdue Tasks (${format(selectedMonth, "MMMM yyyy")})`}
              showOverdue
              emptyMessage={`No overdue tasks in ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="Great job staying on schedule!"
              mutate={mutate}
            />
          ) : (
            <TaskTable
              tasks={overdueTasks}
              title={`Overdue Tasks (${format(selectedMonth, "MMMM yyyy")})`}
              showOverdue
              emptyMessage={`No overdue tasks in ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="Great job staying on schedule!"
              mutate={mutate}
            />
          )}
        </TabsContent>

        <TabsContent value="pending">
          {viewMode === "grid" ? (
            <TaskGrid
              tasks={pendingTasks}
              title={`Under Review (${format(selectedMonth, "MMMM yyyy")})`}
              showStatus
              emptyMessage={`No tasks under review in ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="Submit your work to see it here"
              mutate={mutate}
            />
          ) : (
            <TaskTable
              tasks={pendingTasks}
              title={`Under Review (${format(selectedMonth, "MMMM yyyy")})`}
              showStatus
              emptyMessage={`No tasks under review in ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="Submit your work to see it here"
              mutate={mutate}
            />
          )}
        </TabsContent>

        <TabsContent value="approved">
          {viewMode === "grid" ? (
            <TaskGrid
              tasks={approvedTasks}
              title={`I Approve Tasks (${format(selectedMonth, "MMMM yyyy")})`}
              showStatus
              emptyMessage={`No approved tasks in ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="Complete and submit tasks to see approvals"
              mutate={mutate}
            />
          ) : (
            <TaskTable
              tasks={approvedTasks}
              title={`I Approve Tasks (${format(selectedMonth, "MMMM yyyy")})`}
              showStatus
              emptyMessage={`No approved tasks in ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="Complete and submit tasks to see approvals"
              mutate={mutate}
            />
          )}
        </TabsContent>

        <TabsContent value="rejected">
          {viewMode === "grid" ? (
            <TaskGrid
              tasks={rejectedTasks}
              title={`Changes Required Tasks (${format(selectedMonth, "MMMM yyyy")})`}
              showStatus
              emptyMessage={`No tasks require changes in ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="All tasks are on track!"
              mutate={mutate}
            />
          ) : (
            <TaskTable
              tasks={rejectedTasks}
              title={`Changes Required Tasks (${format(selectedMonth, "MMMM yyyy")})`}
              showStatus
              emptyMessage={`No tasks require changes in ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="All tasks are on track!"
              mutate={mutate}
            />
          )}
        </TabsContent>

        <TabsContent value="all">
          {viewMode === "grid" ? (
            <TaskGrid
              tasks={allTasks}
              title={`All Project Tasks (${format(selectedMonth, "MMMM yyyy")})`}
              showAll
              emptyMessage={`No tasks in this project for ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="Check back later for new assignments"
              mutate={mutate}
            />
          ) : (
            <TaskTable
              tasks={allTasks}
              title={`All Project Tasks (${format(selectedMonth, "MMMM yyyy")})`}
              showAll
              emptyMessage={`No tasks in this project for ${format(selectedMonth, "MMMM yyyy")}`}
              emptySubMessage="Check back later for new assignments"
              mutate={mutate}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}