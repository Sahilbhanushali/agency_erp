"use client";

import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, Calendar, MessageSquare, User, Eye, Edit, 
  Clock, CheckCircle2, XCircle, AlertCircle, FileText,
  Image, Video, Layers, Grid3X3, Search, Filter,
  Instagram, Facebook, Twitter, Linkedin, Plus, Globe,
  Target, CalendarDays, ChevronLeft, ChevronRight, BarChart3,
} from "lucide-react";

// Utility functions for date handling
const formatDate = (date: Date, formatStr: string = 'MMM dd, yyyy') => {
  const options: Intl.DateTimeFormatOptions = {};
  
  if (formatStr.includes('MMM')) {
    options.month = 'short';
  }
  if (formatStr.includes('dd')) {
    options.day = '2-digit';
  }
  if (formatStr.includes('yyyy')) {
    options.year = 'numeric';
  }
  if (formatStr.includes('HH:mm')) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  }
  
  return date.toLocaleDateString('en-GB', options);
};

const getMonthYear = (date: Date) => {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

const startOfMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const endOfMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

const isWithinInterval = (date: Date, interval: { start: Date; end: Date }) => {
  return date >= interval.start && date <= interval.end;
};

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

enum ContentStatus {
  PENDING_REVIEW = "PENDING_REVIEW",
  NEEDS_REVISION = "NEEDS_REVISION",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  NEEDS_MINOR_CHANGE = "NEEDS_MINOR_CHANGE",
  RESUBMITTED = "RESUBMITTED",
}

interface Comment {
  id: string;
  type: "CONTENT" | "DESIGN" | null;
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
  contentStatus?: ContentStatus;
  scheduledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  Comments: Comment[];
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
}

interface Strategy {
  id: number;
  month: number;
  year: number;
  postTypes: {
    [key: string]: number;
  };
  total: number;
}

interface ProjectStats {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  overdue: number;
  thisWeek: number;
  current: {
    required: number;
    created: number;
    left: number;
    requiredByType: { [key: string]: number };
    createdByType: { [key: string]: number };
    leftByType: { [key: string]: number };
  };
  next: any;
  future: any;
  unscheduled: number;
}

interface ProjectGroup {
  projectId: string;
  projectName: string;
  clientName: string;
  tasks: Task[];
  strategies: Strategy[];
  stats: ProjectStats;
}

interface ProjectTasksViewProps {
  project: ProjectGroup;
  onBack: () => void;
}

interface TaskDetailViewProps {
  task: Task;
  onBack: () => void;
  getStatusColor: (status: ContentStatus) => string;
}

type FilterBy = 'all' | 'pending_review' | 'needs_revision' | 'approved' | 'rejected';
type SortBy = 'newest' | 'oldest' | 'status' | 'scheduledAt';

// Task Detail View Component
function TaskDetailView({ task, onBack, getStatusColor }: TaskDetailViewProps) {
  const displayStatus = task.contentStatus || ContentStatus.PENDING_REVIEW;
  const canEdit = displayStatus === ContentStatus.NEEDS_REVISION || displayStatus === ContentStatus.REJECTED || displayStatus === ContentStatus.NEEDS_MINOR_CHANGE;
  const canSubmit = displayStatus === ContentStatus.REJECTED || displayStatus === ContentStatus.NEEDS_MINOR_CHANGE;

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Button>
        <div className="flex items-center gap-3">
          <Badge className={getStatusColor(displayStatus)}>
            {displayStatus.replace('_', ' ')}
          </Badge>
          {canEdit && (
            <Button asChild>
              <a href={`/dashboard/projects/posts/${task.id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Post
              </a>
            </Button>
          )}
          {canSubmit && (
            <Button asChild variant="default">
              <a href={`/dashboard/projects/posts/${task.id}/edit`}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Submit
              </a>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{task.title}</CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {task.assignedTo?.name || 'Unassigned'}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {task.scheduledAt ? formatDate(new Date(task.scheduledAt), 'MMM dd, yyyy HH:mm') : 'Not scheduled'}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {task.caption && (
            <div>
              <h3 className="font-medium text-foreground mb-2">Caption</h3>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="whitespace-pre-wrap text-foreground/90">{task.caption}</p>
              </div>
            </div>
          )}

          {task.platforms && task.platforms.length > 0 && (
            <div>
              <h3 className="font-medium text-foreground mb-2">Platforms</h3>
              <div className="flex gap-2">
                {task.platforms.map((platform) => (
                  <Badge key={platform.id} variant="outline">
                    {platform.platform}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {task.assets && task.assets.length > 0 && (
            <div>
              <h3 className="font-medium text-foreground mb-2">Assets ({task.assets.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {task.assets.map((asset) => (
                  <div key={asset.id} className="bg-muted p-3 rounded-lg">
                    <div className="text-sm font-medium truncate">{asset.filename}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {asset.createdAt && formatDate(new Date(asset.createdAt), 'MMM dd, yyyy')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {task.Comments && task.Comments.length > 0 && (
            <div>
              <h3 className="font-medium text-foreground mb-3">Comments ({task.Comments.length})</h3>
              <div className="space-y-3">
                {task.Comments.map((comment) => (
                  <div key={comment.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      {comment.type && (
                        <Badge variant="outline" className="text-xs">
                          {comment.type}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(new Date(comment.createdAt), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                    <p className="text-foreground/90">{comment.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Month Tab Component
function MonthTabs({ 
  availableMonths, 
  selectedMonth, 
  onMonthSelect, 
  taskCounts 
}: {
  availableMonths: string[];
  selectedMonth: string;
  onMonthSelect: (month: string) => void;
  taskCounts: { [key: string]: number };
}) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);

  const scroll = (direction: 'left' | 'right') => {
    const container = tabsContainerRef.current;
    if (!container) return;
    
    const scrollAmount = 200;
    const newPosition = direction === 'left' 
      ? Math.max(0, scrollPosition - scrollAmount)
      : Math.min(container.scrollWidth - container.clientWidth, scrollPosition + scrollAmount);
    
    container.scrollTo({ left: newPosition, behavior: 'smooth' });
    setScrollPosition(newPosition);
  };

  const allTasks = Object.values(taskCounts).reduce((sum, count) => sum + count, 0);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            Filter by Month
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => scroll('left')}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => scroll('right')}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <div 
            ref={tabsContainerRef}
            className="flex gap-2 overflow-x-auto scrollbar-hide pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* All Posts Tab */}
            <button
              onClick={() => onMonthSelect('all')}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                selectedMonth === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <div className="flex flex-col items-center">
                <span>All Posts</span>
                <span className="text-xs opacity-75 mt-1">{allTasks}</span>
              </div>
            </button>

            {/* Month Tabs */}
            {availableMonths.map(month => {
              const [year, monthNum] = month.split('-');
              const monthName = formatDate(new Date(parseInt(year), parseInt(monthNum) - 1), 'MMM');
              const fullMonthName = formatDate(new Date(parseInt(year), parseInt(monthNum) - 1), 'MMMM yyyy');
              const count = taskCounts[month] || 0;
              
              return (
                <button
                  key={month}
                  onClick={() => onMonthSelect(month)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    selectedMonth === month
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  title={fullMonthName}
                >
                  <div className="flex flex-col items-center">
                    <span>{monthName} {year}</span>
                    <span className="text-xs opacity-75 mt-1">{count}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectTasksView({ project, onBack }: ProjectTasksViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const getStatusColor = (status: ContentStatus) => {
    switch (status) {
      case ContentStatus.PENDING_REVIEW: return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700";
      case ContentStatus.APPROVED: return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700";
      case ContentStatus.REJECTED: return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700";
      case ContentStatus.NEEDS_REVISION: return "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700";
      case ContentStatus.NEEDS_MINOR_CHANGE: return "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700";
      case ContentStatus.RESUBMITTED: return "bg-blue-200 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-800";
      default: return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600";
    }
  };

  const getStatusIcon = (status: ContentStatus) => {
    switch (status) {
      case ContentStatus.PENDING_REVIEW: return <Eye className="h-3 w-3" />;
      case ContentStatus.APPROVED: return <CheckCircle2 className="h-3 w-3" />;
      case ContentStatus.REJECTED: return <XCircle className="h-3 w-3" />;
      case ContentStatus.NEEDS_REVISION: return <AlertCircle className="h-3 w-3" />;
      case ContentStatus.NEEDS_MINOR_CHANGE: return <AlertCircle className="h-3 w-3 text-amber-600" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'photo': return <Image className="h-4 w-4 text-blue-600" />;
      case 'video': case 'reel': return <Video className="h-4 w-4 text-red-600" />;
      case 'carousel': return <Layers className="h-4 w-4 text-purple-600" />;
      case 'story': return <Grid3X3 className="h-4 w-4 text-orange-600" />;
      default: return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram': return <Instagram className="h-4 w-4 text-pink-600" />;
      case 'facebook': return <Facebook className="h-4 w-4 text-blue-600" />;
      case 'twitter': return <Twitter className="h-4 w-4 text-sky-600" />;
      case 'linkedin': return <Linkedin className="h-4 w-4 text-blue-700" />;
      default: return <Globe className="h-4 w-4 text-gray-600" />;
    }
  };

  // Get available months from tasks with counts
  const { availableMonths, taskCountsByMonth } = useMemo(() => {
    const monthsMap = new Map<string, number>();
    
    project.tasks.forEach(task => {
      if (task.scheduledAt || task.createdAt) {
        const date = new Date(task.scheduledAt || task.createdAt!);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthsMap.set(monthKey, (monthsMap.get(monthKey) || 0) + 1);
      }
    });
    
    const months = Array.from(monthsMap.keys()).sort().reverse();
    const counts = Object.fromEntries(monthsMap);
    
    return {
      availableMonths: months,
      taskCountsByMonth: counts
    };
  }, [project.tasks]);

  // Calculate stats for the selected month using contentStatus
  const monthStats = useMemo(() => {
    let stats: ProjectStats['current'] = {
      required: 0,
      created: 0,
      left: 0,
      requiredByType: {},
      createdByType: {},
      leftByType: {},
    };
    let displayMonth = 'All Time';

    if (selectedMonth === 'all') {
      // Aggregate stats across all strategies
      const totalRequired = project.strategies.reduce((sum, strategy) => sum + strategy.total, 0);
      const createdTasks = project.tasks.length;
      
      // Aggregate required and created by type
      const requiredByType: { [key: string]: number } = {};
      const createdByType: { [key: string]: number } = {};
      
      project.strategies.forEach(strategy => {
        Object.entries(strategy.postTypes).forEach(([type, count]) => {
          requiredByType[type] = (requiredByType[type] || 0) + count;
        });
      });
      
      project.tasks.forEach(task => {
        createdByType[task.type] = (createdByType[task.type] || 0) + 1;
      });
      
      const leftByType: { [key: string]: number } = {};
      Object.keys(requiredByType).forEach(type => {
        leftByType[type] = requiredByType[type] - (createdByType[type] || 0);
      });
      
      stats = {
        required: totalRequired,
        created: createdTasks,
        left: totalRequired - createdTasks,
        requiredByType,
        createdByType,
        leftByType,
      };
    } else {
      // Filter strategies for the selected month
      const [year, month] = selectedMonth.split('-').map(Number);
      const strategy = project.strategies.find(
        s => s.year === year && s.month === month
      );
      
      if (strategy) {
        // Count tasks for the selected month
        const monthStart = startOfMonth(new Date(year, month - 1));
        const monthEnd = endOfMonth(new Date(year, month - 1));
        const createdTasks = project.tasks.filter(task => {
          const taskDate = new Date(task.scheduledAt || task.createdAt!);
          return isWithinInterval(taskDate, { start: monthStart, end: monthEnd });
        }).length;
        
        const createdByType: { [key: string]: number } = {};
        project.tasks
          .filter(task => {
            const taskDate = new Date(task.scheduledAt || task.createdAt!);
            return isWithinInterval(taskDate, { start: monthStart, end: monthEnd });
          })
          .forEach(task => {
            createdByType[task.type] = (createdByType[task.type] || 0) + 1;
          });
        
        const leftByType: { [key: string]: number } = {};
        Object.keys(strategy.postTypes).forEach(type => {
          leftByType[type] = strategy.postTypes[type] - (createdByType[type] || 0);
        });
        
        stats = {
          required: strategy.total,
          created: createdTasks,
          left: strategy.total - createdTasks,
          requiredByType: strategy.postTypes,
          createdByType,
          leftByType,
        };
        displayMonth = formatDate(new Date(year, month - 1), 'MMMM yyyy');
      }
    }

    return { stats, displayMonth };
  }, [project.strategies, project.tasks, selectedMonth]);

  const filteredAndSortedTasks = useMemo(() => {
    return project.tasks
      .filter(task => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return task.title.toLowerCase().includes(query) || 
                 task.caption?.toLowerCase().includes(query) ||
                 task.assignedTo?.name.toLowerCase().includes(query);
        }
        return true;
      })
      .filter(task => {
        // Status filter based on contentStatus
        if (filterBy !== 'all') {
          const contentStatus = task.contentStatus || ContentStatus.PENDING_REVIEW;
          return contentStatus.toLowerCase() === filterBy;
        }
        return true;
      })
      .filter(task => {
        // Month filter
        if (selectedMonth !== 'all') {
          const taskDate = new Date(task.scheduledAt || task.createdAt!);
          const [year, month] = selectedMonth.split('-').map(Number);
          const monthStart = startOfMonth(new Date(year, month - 1));
          const monthEnd = endOfMonth(new Date(year, month - 1));
          return isWithinInterval(taskDate, { start: monthStart, end: monthEnd });
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'newest':
            return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
          case 'oldest':
            return new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime();
          case 'status':
            const aStatus = a.contentStatus || ContentStatus.PENDING_REVIEW;
            const bStatus = b.contentStatus || ContentStatus.PENDING_REVIEW;
            return aStatus.localeCompare(bStatus);
          case 'scheduledAt':
            if (!a.scheduledAt && !b.scheduledAt) return 0;
            if (!a.scheduledAt) return 1;
            if (!b.scheduledAt) return -1;
            return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
          default:
            return 0;
        }
      });
  }, [project.tasks, searchQuery, filterBy, sortBy, selectedMonth]);

  if (selectedTask) {
    return <TaskDetailView task={selectedTask} onBack={() => setSelectedTask(null)} getStatusColor={getStatusColor} />;
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-50/10 to-indigo-50/10 rounded-xl p-6 border border-blue-100/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={onBack} className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{project.projectName}</h1>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="font-medium">{project.clientName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>{project.tasks.length} total posts</span>
                </div>
              </div>
            </div>
          </div>
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            Create New Post
          </Button>
        </div>

        {/* Strategy Progress */}
        {monthStats.stats.required > 0 && (
          <div className="bg-card/85 border border-border rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Monthly Strategy Progress
              </h3>
              <Badge variant="outline" className="bg-card">
                {monthStats.displayMonth}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{monthStats.stats.created}</div>
                <div className="text-sm text-muted-foreground">Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{monthStats.stats.required}</div>
                <div className="text-sm text-muted-foreground">Required</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{monthStats.stats.left}</div>
                <div className="text-sm text-muted-foreground">Remaining</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {monthStats.stats.required > 0 
                    ? Math.round((monthStats.stats.created / monthStats.stats.required) * 100)
                    : 0}%
                </div>
                <div className="text-sm text-muted-foreground">Complete</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Status Overview based on contentStatus */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.values(ContentStatus).map(status => {
          const count = project.tasks.filter(task => (task.contentStatus || ContentStatus.PENDING_REVIEW) === status).length;
          const isActive = filterBy === status.toLowerCase();
          return (
            <Card 
              key={status} 
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${
                isActive ? 'ring-2 ring-blue-500 bg-blue-50/20' : 'hover:shadow-md'
              }`}
              onClick={() => setFilterBy(status.toLowerCase() as FilterBy)}
            >
              <CardContent className="p-4 text-center">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-3 ${getStatusColor(status)}`}>
                  {getStatusIcon(status)}
                </div>
                <div className="text-2xl font-bold text-foreground mb-1">{count}</div>
                <div className="text-xs text-muted-foreground capitalize">{status.replace('_', ' ')}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Month Tabs */}
      <MonthTabs
        availableMonths={availableMonths}
        selectedMonth={selectedMonth}
        onMonthSelect={setSelectedMonth}
        taskCounts={taskCountsByMonth}
      />

      {/* Enhanced Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, caption, or assignee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={filterBy} onValueChange={(value) => setFilterBy(value as FilterBy)}>
                <SelectTrigger className="w-[150px] h-11">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="needs_revision">Needs Revision</SelectItem>
                  <SelectItem value="approved">I Approve</SelectItem>
                  <SelectItem value="c_approved">C Approve</SelectItem>
                  <SelectItem value="rejected">Changes</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                <SelectTrigger className="w-[150px] h-11">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="status">By Status</SelectItem>
                  <SelectItem value="scheduledAt">By Posting Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          {filteredAndSortedTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tasks found matching your criteria.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedTasks.map(task => (
                <Card
                  key={task.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedTask(task)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 flex justify-center">
                          {getTypeIcon(task.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground truncate">
                              {task.title}
                            </h3>
                            <Badge className={getStatusColor(task.contentStatus || ContentStatus.PENDING_REVIEW)}>
                              {(task.contentStatus || ContentStatus.PENDING_REVIEW).replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            {task.caption || 'No caption provided'}
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {task.assignedTo?.name || 'Unassigned'}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {task.scheduledAt
                                ? formatDate(new Date(task.scheduledAt), 'MMM dd, yyyy')
                                : 'Not scheduled'}
                            </div>
                            {task.Comments && task.Comments.length > 0 && (
                              <div className="flex items-center gap-1">
                                <MessageSquare className="h-4 w-4" />
                                {task.Comments.length}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.platforms?.map(platform => (
                          <div key={platform.id} className="text-muted-foreground">
                            {getPlatformIcon(platform.platform)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}