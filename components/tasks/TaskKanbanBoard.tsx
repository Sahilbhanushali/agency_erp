"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Clock,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Upload,
  Eye,
  MessageSquare,
  Image,
  Video,
  FileText,
  MoreHorizontal,
  Edit,
  ArrowRight,
  Filter,
  Search,
  Check,
  ChevronDown,
  Layers,
  Play,
  Camera,
  Sparkles,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMediaUrl } from "@/lib/utils";
import RejectDialog from "@/components/posts/rejectDialog";
import { projectCompanyName, projectLogo } from "@/lib/client-company";

export enum PostStatus {
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

export interface KanbanTask {
  id: string;
  title: string;
  caption?: string;
  type: string;
  status: PostStatus;
  scheduledAt?: string;
  designDueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  project?: {
    id?: string;
    name?: string;
    client?: {
      name: string;
      company?: string;
      avatar?: string;
    };
  };
  assets: Array<{
    id: string;
    filename: string;
    url: string;
    type?: string;
    createdAt?: string;
    isReference?: boolean;
  }>;
  assignedToId?: number;
  assignedTo?: {
    name: string;
    email: string;
  };
  assignedUsers?: Array<{
    id: number | string;
    name: string;
    email?: string;
    role?: { name: string };
  }>;
  feedback?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  contentStatus?: string;
}

interface ColumnDef {
  id: string;
  title: string;
  statuses: PostStatus[];
  color: string;
  bgSubtle: string;
  badgeVariant: "neutral" | "info" | "warning" | "success" | "purple";
  targetStatus: PostStatus;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "draft",
    title: "Draft / Backlog",
    statuses: [PostStatus.DRAFT],
    color: "text-zinc-600 dark:text-zinc-400",
    bgSubtle: "bg-zinc-100/80 dark:bg-zinc-800/60",
    badgeVariant: "neutral",
    targetStatus: PostStatus.DRAFT,
  },
  {
    id: "in_review",
    title: "In Review / Submitted",
    statuses: [PostStatus.SUBMITTED, PostStatus.RESUBMITTED],
    color: "text-blue-600 dark:text-blue-400",
    bgSubtle: "bg-blue-50/70 dark:bg-blue-950/40",
    badgeVariant: "info",
    targetStatus: PostStatus.SUBMITTED,
  },
  {
    id: "changes",
    title: "Changes Required",
    statuses: [PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE],
    color: "text-rose-600 dark:text-rose-400",
    bgSubtle: "bg-rose-50/70 dark:bg-rose-950/40",
    badgeVariant: "warning",
    targetStatus: PostStatus.REJECTED,
  },
  {
    id: "approved",
    title: "Approved",
    statuses: [PostStatus.APPROVED, PostStatus.C_APPROVED],
    color: "text-emerald-600 dark:text-emerald-400",
    bgSubtle: "bg-emerald-50/70 dark:bg-emerald-950/40",
    badgeVariant: "success",
    targetStatus: PostStatus.APPROVED,
  },
  {
    id: "completed",
    title: "Scheduled & Live",
    statuses: [PostStatus.SCHEDULED, PostStatus.POSTED],
    color: "text-violet-600 dark:text-violet-400",
    bgSubtle: "bg-violet-50/70 dark:bg-violet-950/40",
    badgeVariant: "purple",
    targetStatus: PostStatus.POSTED,
  },
];

interface TaskKanbanBoardProps {
  tasks: KanbanTask[];
  mutate?: () => void;
  isAdmin?: boolean;
}

export default function TaskKanbanBoard({
  tasks,
  mutate,
  isAdmin = true,
}: TaskKanbanBoardProps) {
  const [search, setSearch] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("ALL");
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [statusRejectDialog, setStatusRejectDialog] = useState<{
    postId: string;
    statusType?: "content" | "design";
    targetStatus?: string;
  } | null>(null);

  // Extract unique assignees for the Admin assignee dropdown
  const allAssignees = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    tasks.forEach((task) => {
      if (task.assignedTo?.name) {
        map.set(task.assignedTo.name, {
          id: String(task.assignedToId || task.assignedTo.name),
          name: task.assignedTo.name,
        });
      }
      task.assignedUsers?.forEach((u) => {
        if (u.name) {
          map.set(u.name, { id: String(u.id), name: u.name });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  // Extract unique projects
  const allProjects = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((task) => {
      if (task.project?.name) {
        map.set(task.project.id || task.project.name, task.project.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = task.title?.toLowerCase().includes(q);
        const matchesClient = task.project?.client?.name?.toLowerCase().includes(q) ||
          projectCompanyName(task.project)?.toLowerCase().includes(q);
        const matchesProject = task.project?.name?.toLowerCase().includes(q);
        const matchesAssignee = task.assignedTo?.name?.toLowerCase().includes(q) ||
          task.assignedUsers?.some((u) => u.name.toLowerCase().includes(q));
        if (!matchesTitle && !matchesClient && !matchesProject && !matchesAssignee) {
          return false;
        }
      }

      // Assignee filter
      if (selectedAssignee !== "ALL") {
        const isAssigned =
          task.assignedTo?.name === selectedAssignee ||
          task.assignedUsers?.some((u) => u.name === selectedAssignee);
        if (!isAssigned) return false;
      }

      // Project filter
      if (selectedProject !== "ALL") {
        if (task.project?.id !== selectedProject && task.project?.name !== selectedProject) {
          return false;
        }
      }

      // Type filter
      if (selectedType !== "ALL") {
        if (task.type !== selectedType) return false;
      }

      return true;
    });
  }, [tasks, search, selectedAssignee, selectedProject, selectedType]);

  // Handle status update
  const handleUpdateStatus = async (taskId: string, newStatus: PostStatus) => {
    setMovingTaskId(taskId);
    try {
      const response = await fetch(`/api/posts/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || "Failed to update task status");
        return;
      }

      toast.success(`Task moved to ${newStatus.toLowerCase().replace(/_/g, " ")}`);
      mutate?.();
    } catch {
      toast.error("Network error while updating status");
    } finally {
      setMovingTaskId(null);
      setDraggedTaskId(null);
    }
  };

  // Initiate status change (intercepts Changes Required to prompt for comment)
  const handleInitiateStatusChange = (taskId: string, targetStatus: PostStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Check if task is already in the column representing targetStatus
    const targetColumn = COLUMNS.find((col) => col.targetStatus === targetStatus);
    if (targetColumn && targetColumn.statuses.includes(task.status)) {
      return;
    }

    if (targetStatus === PostStatus.REJECTED || targetStatus === PostStatus.NEEDS_MINOR_CHANGE) {
      if (task.status === PostStatus.DRAFT) {
        toast.error("Cannot reject or request minor changes for a design that is in Draft status.");
        return;
      }
      setStatusRejectDialog({
        postId: taskId,
        statusType: "design",
        targetStatus: "REJECTED",
      });
      return;
    }

    handleUpdateStatus(taskId, targetStatus);
  };

  // Handle submit for Changes Required (REJECTED) with mandatory feedback comment
  const handleRejectSubmit = async (textFeedback: string, audioBlob: Blob | null) => {
    if (!statusRejectDialog) return;
    const taskId = statusRejectDialog.postId;
    const targetStatus = (statusRejectDialog.targetStatus as PostStatus) || PostStatus.REJECTED;

    setMovingTaskId(taskId);
    try {
      let finalFeedback = textFeedback.trim();

      if (audioBlob) {
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "rejection-audio.webm");
          formData.append("postId", taskId);
          formData.append("flowType", "DESIGN");

          const uploadRes = await fetch("/api/approval-attachments", {
            method: "POST",
            body: formData,
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (finalFeedback === "🎙️ Audio feedback recorded" || !finalFeedback) {
              finalFeedback = `🎙️ Audio feedback: ${uploadData.filename}`;
            } else {
              finalFeedback = finalFeedback.replace(
                "🎙️ Audio feedback recorded",
                `🎙️ Audio feedback: ${uploadData.filename}`
              );
            }
          }
        } catch (audioErr) {
          console.error("Failed to upload audio attachment:", audioErr);
        }
      }

      if (!finalFeedback) {
        toast.error("Comment is required for design status rejection or minor change request");
        throw new Error("Comment is required for design status rejection or minor change request");
      }

      const response = await fetch(`/api/posts/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          feedback: finalFeedback,
          rejectedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err.error || "Failed to update task status";
        toast.error(msg);
        throw new Error(msg);
      }

      toast.success("Task moved to changes required");
      mutate?.();
    } catch (err: any) {
      console.error("Error moving task to changes required:", err);
      throw err;
    } finally {
      setMovingTaskId(null);
      setDraggedTaskId(null);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: PostStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    if (taskId) {
      handleInitiateStatusChange(taskId, targetStatus);
    }
    setDraggedTaskId(null);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "REEL":
        return Play;
      case "STORY":
        return Image;
      case "PHOTO":
        return Camera;
      case "CAROUSEL":
        return Layers;
      default:
        return FileText;
    }
  };

  const isOverdue = (task: KanbanTask) => {
    let designDue = task.designDueDate ? new Date(task.designDueDate) : null;
    if (!designDue && task.scheduledAt) {
      designDue = new Date(task.scheduledAt);
      designDue.setDate(designDue.getDate() - 7);
    }
    if (!designDue) return false;
    return designDue < new Date() && [PostStatus.DRAFT, PostStatus.REJECTED].includes(task.status);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar for Admin / Manager */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Real-time search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search tasks, client, assignee"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, client, assignee..."
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>

          {/* Assignee Filter - Critical for Admin */}
          <div className="w-[180px]">
            <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
              <SelectTrigger aria-label="Assignee" className="h-8 text-xs bg-background">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs font-medium">
                  All Assignees ({allAssignees.length})
                </SelectItem>
                {allAssignees.map((assignee) => (
                  <SelectItem key={assignee.name} value={assignee.name} className="text-xs">
                    {assignee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project Filter */}
          <div className="w-[160px]">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger aria-label="Project" className="h-8 text-xs bg-background">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs font-medium">
                  All Projects ({allProjects.length})
                </SelectItem>
                {allProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs truncate">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Post Type Filter */}
          <div className="w-[130px]">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger aria-label="Post Type" className="h-8 text-xs bg-background">
                <SelectValue placeholder="Post Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Types</SelectItem>
                <SelectItem value="PHOTO" className="text-xs">Photo</SelectItem>
                <SelectItem value="REEL" className="text-xs">Reel</SelectItem>
                <SelectItem value="STORY" className="text-xs">Story</SelectItem>
                <SelectItem value="CAROUSEL" className="text-xs">Carousel</SelectItem>
                <SelectItem value="BLOG" className="text-xs">Blog</SelectItem>
                <SelectItem value="PPT" className="text-xs">Presentation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(search || selectedAssignee !== "ALL" || selectedProject !== "ALL" || selectedType !== "ALL") && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setSearch("");
                setSelectedAssignee("ALL");
                setSelectedProject("ALL");
                setSelectedType("ALL");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </Button>
          )}
        </div>

        {/* Counter Pill */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs tabular-nums font-mono">
            {filteredTasks.length} tasks visible
          </Badge>
          {isAdmin && (
            <Badge variant="neutral" className="text-xs hidden sm:inline-flex">
              Admin Board View
            </Badge>
          )}
        </div>
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 items-start overflow-x-auto pb-4">
        {COLUMNS.map((column) => {
          const colTasks = filteredTasks.filter((t) => column.statuses.includes(t.status));

          return (
            <div
              key={column.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.targetStatus)}
              className={`flex flex-col rounded-xl border border-border/70 ${column.bgSubtle} p-3 min-h-[560px] max-h-[calc(100vh-220px)] transition-colors`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${
                    column.id === "approved" ? "bg-emerald-500" :
                    column.id === "in_review" ? "bg-blue-500" :
                    column.id === "changes" ? "bg-rose-500" :
                    column.id === "completed" ? "bg-violet-500" : "bg-zinc-400"
                  }`} />
                  <h3 className="text-xs font-bold text-foreground tracking-tight">{column.title}</h3>
                </div>
                <Badge variant={column.badgeVariant} className="text-xs font-mono tabular-nums px-1.5 py-0">
                  {colTasks.length}
                </Badge>
              </div>

              {/* Tasks List */}
              <div className="flex-1 space-y-2.5 overflow-y-auto pr-0.5">
                {colTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed border-border/60 bg-background/50 text-xs text-muted-foreground min-h-[140px]">
                    <p className="font-medium text-xs">No tasks</p>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">Drop tasks here</p>
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const TypeIcon = getTypeIcon(task.type);
                    const overdue = isOverdue(task);
                    const firstImage = task.assets.find(
                      (a) => !a.isReference && /\.(jpg|jpeg|png|webp|gif)$/i.test(a.filename)
                    );
                    const assigneeName = task.assignedTo?.name || task.assignedUsers?.[0]?.name || "Unassigned";
                    const initial = assigneeName.charAt(0).toUpperCase();

                    return (
                      <Card
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        className={`group relative cursor-grab active:cursor-grabbing border border-border/80 bg-card p-3 shadow-2xs hover:border-primary/50 hover:shadow-xs transition-all ${
                          overdue ? "border-l-2 border-l-rose-500" : ""
                        } ${movingTaskId === task.id ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        {/* Client info & Dropdown action */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {projectLogo(task.project) ? (
                              <img
                                src={projectLogo(task.project) ?? undefined}
                                alt="Client avatar"
                                className="size-4 rounded-full object-cover shrink-0"
                              />
                            ) : null}
                            <span className="text-xs font-semibold text-muted-foreground truncate">
                              {projectCompanyName(task.project) || task.project?.client?.name || "Client"}
                            </span>
                          </div>

                          {/* Quick move dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button aria-label="More actions for this post"
                                variant="ghost"
                                size="icon-xs"
                                className="size-5 p-0 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100"
                              >
                                <MoreHorizontal className="size-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 text-xs">
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link href={`/dashboard/projects/posts/${task.id}`}>
                                  <Eye className="size-3.5 mr-2" /> View Post
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link href={`/dashboard/projects/posts/${task.id}/edit`}>
                                  <Edit className="size-3.5 mr-2" /> Edit Task
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                                Move to Status
                              </div>
                              {COLUMNS.map((col) => (
                                <DropdownMenuItem
                                  key={col.id}
                                  onClick={() => handleInitiateStatusChange(task.id, col.targetStatus)}
                                  className="cursor-pointer text-xs"
                                >
                                  <ArrowRight className="size-3 mr-2" />
                                  {col.title}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Title */}
                        <Link
                          href={`/dashboard/projects/posts/${task.id}`}
                          className="font-semibold text-xs text-foreground hover:text-primary transition-colors line-clamp-2 block mb-1.5"
                        >
                          {task.title}
                        </Link>

                        {/* Project name */}
                        {task.project?.name && (
                          <p className="text-xs text-muted-foreground truncate mb-2">
                            {task.project.name}
                          </p>
                        )}

                        {/* Asset preview thumbnail if available */}
                        {firstImage?.url && (
                          <div className="mb-2 rounded-md overflow-hidden border border-border/60 bg-muted/30 aspect-video relative">
                            <img
                              src={getMediaUrl(firstImage.url)}
                              alt={task.title}
                              className="size-full object-cover"
                            />
                            {task.assets.length > 1 && (
                              <Badge variant="neutral" className="absolute bottom-1 right-1 text-xs px-1 py-0 bg-black/60 text-white border-0">
                                +{task.assets.length - 1} more
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Metadata row: Type, Due Date, Asset Count */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                          <Badge variant="outline" className="text-xs px-1.5 py-0 gap-1 font-mono">
                            <TypeIcon className="size-2.5" />
                            {task.type}
                          </Badge>

                          {task.assets.length > 0 && !firstImage && (
                            <Badge variant="neutral" className="text-xs px-1.5 py-0 gap-1 font-mono">
                              <FileText className="size-2.5" />
                              {task.assets.length} file{task.assets.length !== 1 ? "s" : ""}
                            </Badge>
                          )}

                          {task.scheduledAt && (
                            <div className={`flex items-center gap-1 text-xs tabular-nums ${
                              overdue ? "text-rose-600 font-semibold dark:text-rose-400" : "text-muted-foreground"
                            }`}>
                              <Clock className="size-2.5" />
                              <span>{formatDate(task.scheduledAt)}</span>
                              {overdue && <span className="text-xs">(Late)</span>}
                            </div>
                          )}
                        </div>

                        {/* Assignee Footer (Critical for Admin View) */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0" title={`Assigned to: ${assigneeName}`}>
                            <Avatar className="size-5 shrink-0 border border-border/80">
                              <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                                {initial}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium text-foreground truncate max-w-[110px]">
                              {assigneeName}
                            </span>
                          </div>

                          {task.priority && (
                            <Badge
                              variant={
                                task.priority === "URGENT" || task.priority === "HIGH"
                                  ? "destructive"
                                  : task.priority === "MEDIUM"
                                  ? "warning"
                                  : "neutral"
                              }
                              className="text-xs px-1 py-0 font-mono"
                            >
                              {task.priority}
                            </Badge>
                          )}
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reject / Changes Required Dialog */}
      <RejectDialog
        statusRejectDialog={statusRejectDialog}
        setStatusRejectDialog={setStatusRejectDialog}
        posts={tasks}
        customTitle={
          statusRejectDialog
            ? `Request Changes: ${tasks.find((p) => p.id === statusRejectDialog.postId)?.title || "Task"}`
            : undefined
        }
        customButtonText="Submit Changes Required"
        customFeedbackPlaceholder="Enter the changes required (comment is required)..."
        onSubmitCustom={handleRejectSubmit}
      />
    </div>
  );
}
