import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";
import type { Task, TaskStatus } from "@/types/task";
import { Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import TaskBoard from "./TaskBoard";
import TaskDetailSheet from "./TaskDetailSheet";
import TaskFormDialog from "./TaskFormDialog";

interface TasksPanelProps {
  title?: string;
  projectId?: string;
  workspaceId?: string;
  assigneeId?: string;
  showProject?: boolean;
  emptyText?: string;
  headerExtra?: ReactNode;
}

export default function TasksPanel({
  title = "Tasks",
  projectId,
  workspaceId,
  assigneeId,
  showProject,
  emptyText,
  headerExtra,
}: TasksPanelProps) {
  const { user: actor } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  // A notification links to /tasks?taskId=..., so the card it names opens directly.
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get("taskId")
  );
  const [formOpen, setFormOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Only meaningful when the board is not already pinned to one workspace.
  const spansWorkspaces = !workspaceId;
  const [workspaceFilter, setWorkspaceFilter] = useState("ALL");

  const canCreate = can(actor, "tasks:create");
  const canDelete = can(actor, "tasks:delete");
  const canManage = can(actor, "tasks:update");
  const canMove = (task: Task) => canManage || task.assignee?.id === actor?.id;

  useEffect(() => {
    const query = new URLSearchParams();
    if (projectId) query.set("projectId", projectId);
    if (workspaceId) query.set("workspaceId", workspaceId);
    if (assigneeId) query.set("assigneeId", assigneeId);

    const queryString = query.toString();
    setIsLoading(true);
    api
      .list<Task>(`/tasks${queryString ? `?${queryString}` : ""}`)
      .then(setTasks)
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to load tasks.")
      )
      .finally(() => setIsLoading(false));
  }, [projectId, workspaceId, assigneeId]);

  const filteredTasks = useMemo(() => {
    const byWorkspace =
      workspaceFilter === "ALL"
        ? tasks
        : workspaceFilter === "NONE"
          ? tasks.filter((task) => !task.workspace)
          : tasks.filter((task) => task.workspace?.id === workspaceFilter);

    const query = search.trim().toLowerCase();
    if (!query) return byWorkspace;
    return byWorkspace.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.project.title.toLowerCase().includes(query) ||
        `${task.assignee?.firstName ?? ""} ${task.assignee?.lastName ?? ""}`
          .toLowerCase()
          .includes(query)
    );
  }, [tasks, search, workspaceFilter]);

  /** Workspaces actually present on this board, so the filter never offers an empty one. */
  const workspaceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      if (task.workspace) map.set(task.workspace.id, task.workspace.name);
    }
    return [...map].map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const upsertTask = (task: Task) =>
    setTasks((current) =>
      current.some((item) => item.id === task.id)
        ? current.map((item) => (item.id === task.id ? task : item))
        : [task, ...current]
    );

  const handleMove = async (
    task: Task,
    status: TaskStatus,
    orderedTaskIds?: string[]
  ) => {
    const previous = tasks;
    setTasks((current) =>
      current.map((item) => {
        const index = orderedTaskIds?.indexOf(item.id) ?? -1;
        const position = index >= 0 ? index : item.position;
        return item.id === task.id
          ? { ...item, status, position }
          : { ...item, position };
      })
    );

    try {
      if (orderedTaskIds && canManage) {
        const updated = await api.patch<Task[]>("/tasks/reorder", {
          status,
          taskIds: orderedTaskIds,
        });
        setTasks((current) =>
          current.map(
            (item) => updated.find((t) => t.id === item.id) ?? item
          )
        );
      } else {
        upsertTask(await api.patch<Task>(`/tasks/${task.id}`, { status }));
      }
    } catch (error) {
      setTasks(previous);
      toast.error(
        error instanceof ApiError ? error.message : "Failed to move the task."
      );
    }
  };

  const handleDelete = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/tasks/${taskToDelete.id}`);
      toast.success("Task deleted successfully.");
      setTasks((current) =>
        current.filter((item) => item.id !== taskToDelete.id)
      );
      if (selectedId === taskToDelete.id) setSelectedId(null);
      setTaskToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to delete the task."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const openCreateForm = () => {
    setTaskToEdit(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden flex flex-col">
        {/* Header Toolbar */}
        <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-foreground">
                {title}
              </h2>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                {tasks.length}
              </span>
            </div>

            {headerExtra}

            {spansWorkspaces && workspaceOptions.length > 1 && (
              <Select value={workspaceFilter} onValueChange={setWorkspaceFilter}>
                <SelectTrigger className="h-9 w-[190px] text-xs bg-background">
                  <SelectValue placeholder="All workspaces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">
                    All workspaces
                  </SelectItem>
                  {workspaceOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id} className="text-xs">
                      {option.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="NONE" className="text-xs">
                    Project backlog
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                aria-label="Search tasks"
                placeholder="Filter tasks..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="ps-9 pe-8 h-9 text-xs bg-background border-border rounded-lg"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {canCreate && (
            <Button
              size="sm"
              className="gap-1.5 h-9 rounded-lg shadow-xs"
              onClick={openCreateForm}
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </Button>
          )}
        </div>

        {/* Board Body */}
        <div className="p-4 sm:p-5 overflow-x-auto min-w-full">
          <TaskBoard
            tasks={filteredTasks}
            isLoading={isLoading}
            showProject={showProject}
            showWorkspace={spansWorkspaces}
            canDelete={canDelete}
            emptyText={search ? "No tasks match your search." : emptyText}
            canMove={canMove}
            onSelect={(task) => setSelectedId(task.id)}
            onMove={handleMove}
            onDelete={setTaskToDelete}
          />
        </div>
      </div>

      <TaskDetailSheet
        taskId={selectedId}
        onOpenChange={(open) => {
          if (open) return;
          setSelectedId(null);
          // Drop the deep link so a refresh does not reopen what was just closed.
          if (searchParams.has("taskId")) {
            searchParams.delete("taskId");
            setSearchParams(searchParams, { replace: true });
          }
        }}
        onChanged={upsertTask}
        onEdit={(task) => {
          setTaskToEdit(task);
          setFormOpen(true);
        }}
        onDelete={setTaskToDelete}
      />

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        projectId={projectId}
        workspaceId={workspaceId}
        task={taskToEdit}
        onSaved={upsertTask}
      />

      <ConfirmDialog
        open={!!taskToDelete}
        onOpenChange={(open) => !open && setTaskToDelete(null)}
        title="Delete Task"
        description={`Delete "${taskToDelete?.title}" and all its sub-tasks? This action cannot be undone.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
