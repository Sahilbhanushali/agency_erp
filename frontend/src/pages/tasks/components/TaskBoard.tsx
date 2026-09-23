import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { Task, TaskStatus } from "@/types/task";
import {
  CalendarDays,
  CheckSquare,
  GripVertical,
  MessageSquare,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  BOARD_COLUMNS,
  PRIORITY_STYLES,
  toColumnStatus,
} from "../task-styles";

interface DropTarget {
  status: TaskStatus;
  index: number;
}

interface TaskBoardProps {
  tasks: Task[];
  isLoading: boolean;
  showProject?: boolean;
  canDelete?: boolean;
  emptyText?: string;
  canMove: (task: Task) => boolean;
  onSelect: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus, orderedTaskIds?: string[]) => void;
  onDelete?: (task: Task) => void;
}

const isOverdue = (task: Task) =>
  !!task.dueDate &&
  task.status !== "DONE" &&
  task.status !== "CANCELLED" &&
  task.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);

const initials = (firstName: string, lastName: string) =>
  `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

const sameTarget = (
  current: DropTarget | null,
  status: TaskStatus,
  index: number
) => current?.status === status && current.index === index;

export default function TaskBoard({
  tasks,
  isLoading,
  showProject,
  canDelete,
  emptyText = "No tasks yet.",
  canMove,
  onSelect,
  onMove,
  onDelete,
}: TaskBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const columns = useMemo(() => {
    const byStatus = new Map<TaskStatus, Task[]>(
      BOARD_COLUMNS.map((column) => [column.status, []])
    );
    for (const task of tasks)
      byStatus.get(toColumnStatus(task.status))?.push(task);

    for (const list of byStatus.values()) {
      list.sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        if (a.dueDate !== b.dueDate) {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate < b.dueDate ? -1 : 1;
        }
        return a.createdAt < b.createdAt ? 1 : -1;
      });
    }
    return byStatus;
  }, [tasks]);

  const endDrag = () => {
    setDraggedId(null);
    setDropTarget(null);
  };

  const handleDrop = () => {
    const task = tasks.find((item) => item.id === draggedId);
    const target = dropTarget;
    endDrag();
    if (!task || !target) return;

    const destination = (columns.get(target.status) ?? []).filter(
      (item) => item.id !== task.id
    );
    const sourceIndex = (
      columns.get(toColumnStatus(task.status)) ?? []
    ).findIndex((item) => item.id === task.id);

    const movedWithinColumn =
      target.status === toColumnStatus(task.status) && sourceIndex < target.index;
    const index = Math.min(
      movedWithinColumn ? target.index - 1 : target.index,
      destination.length
    );

    destination.splice(index, 0, task);
    onMove(
      task,
      target.status,
      destination.map((item) => item.id)
    );
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {BOARD_COLUMNS.map((col) => (
          <div key={col.status} className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-6 rounded-full" />
            </div>
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-16 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-card/40">
        {emptyText}
      </div>
    );
  }

  const dropIndicator = (status: TaskStatus, index: number) =>
    sameTarget(dropTarget, status, index) ? (
      <div
        className="h-1 rounded-full bg-primary my-1 transition-all"
        aria-hidden="true"
      />
    ) : null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-start">
      {BOARD_COLUMNS.map((column) => {
        const columnTasks = columns.get(column.status) ?? [];
        return (
          <section
            key={column.status}
            className="min-w-0 flex flex-col"
            aria-label={column.label}
            onDragOver={(event) => {
              if (!draggedId) return;
              event.preventDefault();
              setDropTarget((current) =>
                sameTarget(current, column.status, columnTasks.length)
                  ? current
                  : { status: column.status, index: columnTasks.length }
              );
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop();
            }}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between gap-2 mb-2.5 px-2 py-1 select-none">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${column.dotColor}`} />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {column.label}
                </h3>
              </div>
              <span className="text-[11px] font-mono font-medium text-muted-foreground px-1.5 py-0.2 rounded bg-muted/60 border border-border/50">
                {columnTasks.length}
              </span>
            </div>

            {/* Column Droppable Container */}
            <div
              className={`space-y-2.5 min-h-[120px] p-1.5 rounded-xl transition-colors ${
                dropTarget?.status === column.status
                  ? "bg-primary/5 ring-1 ring-primary/20"
                  : "bg-muted/20"
              }`}
            >
              {columnTasks.length === 0 && !dropTarget && (
                <div className="rounded-lg border border-dashed border-border/80 py-8 text-center text-xs text-muted-foreground/60 select-none">
                  Empty
                </div>
              )}

              {columnTasks.map((task, index) => {
                const doneSubTasks = task.subTasks.filter(
                  (subTask) => subTask.status === "DONE"
                ).length;
                const draggable = canMove(task);

                return (
                  <div key={task.id}>
                    {dropIndicator(column.status, index)}
                    <article
                      draggable={draggable}
                      onDragStart={(event) => {
                        setDraggedId(task.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", task.id);
                      }}
                      onDragEnd={endDrag}
                      onDragOver={(event) => {
                        if (!draggedId) return;
                        event.preventDefault();
                        event.stopPropagation();
                        const rect = event.currentTarget.getBoundingClientRect();
                        const nextIndex =
                          index +
                          (event.clientY > rect.top + rect.height / 2 ? 1 : 0);
                        setDropTarget((current) =>
                          sameTarget(current, column.status, nextIndex)
                            ? current
                            : { status: column.status, index: nextIndex }
                        );
                      }}
                      className={`group rounded-xl border border-border bg-card p-3 shadow-2xs hover:shadow-xs transition-all duration-150 hover:border-primary/40 ${
                        draggable ? "cursor-grab active:cursor-grabbing" : ""
                      } ${draggedId === task.id ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-start gap-1.5 min-w-0">
                          {draggable && (
                            <GripVertical
                              className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors"
                              aria-hidden="true"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => onSelect(task)}
                            className="text-start text-xs font-semibold text-foreground hover:text-primary transition-colors line-clamp-3 leading-snug cursor-pointer"
                          >
                            {task.title}
                          </button>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={`Actions for ${task.title}`}
                            className="shrink-0 rounded-md p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 text-xs">
                            {draggable &&
                              BOARD_COLUMNS.filter(
                                (option) => option.status !== task.status
                              ).map((option) => (
                                <DropdownMenuItem
                                  key={option.status}
                                  onClick={() => onMove(task, option.status)}
                                  className="text-xs"
                                >
                                  Move to {option.label}
                                </DropdownMenuItem>
                              ))}
                            {canDelete && onDelete && (
                              <>
                                {draggable && <DropdownMenuSeparator />}
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => onDelete(task)}
                                  className="text-xs"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {showProject && (
                        <p className="mt-1.5 text-[11px] text-muted-foreground truncate">
                          {task.project.title}
                          {task.workspace ? ` · ${task.workspace.name}` : ""}
                        </p>
                      )}

                      <div className="mt-2.5 pt-2 border-t border-border/50 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium uppercase border ${
                            PRIORITY_STYLES[task.priority]
                          }`}
                        >
                          {task.priority}
                        </span>

                        {task.dueDate && (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-mono ${
                              isOverdue(task)
                                ? "text-rose-600 dark:text-rose-400 font-semibold"
                                : "text-muted-foreground"
                            }`}
                          >
                            <CalendarDays className="w-3 h-3" />
                            {task.dueDate.slice(5, 10)}
                          </span>
                        )}

                        {task.subTasks.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono">
                            <CheckSquare className="w-3 h-3" />
                            {doneSubTasks}/{task.subTasks.length}
                          </span>
                        )}

                        {task._count.comments > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono">
                            <MessageSquare className="w-3 h-3" />
                            {task._count.comments}
                          </span>
                        )}

                        {task.assignee && (
                          <span
                            title={`${task.assignee.firstName} ${task.assignee.lastName}`}
                            className="ms-auto flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold border border-primary/20 shrink-0"
                          >
                            {initials(
                              task.assignee.firstName,
                              task.assignee.lastName
                            )}
                          </span>
                        )}
                      </div>
                    </article>
                  </div>
                );
              })}

              {dropIndicator(column.status, columnTasks.length)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
