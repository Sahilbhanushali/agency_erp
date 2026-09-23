import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Task, TaskStatus } from "@/types/task";
import { CalendarDays, CheckSquare, GripVertical, Loader2, MessageSquare, MoreVertical, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { BOARD_COLUMNS, PRIORITY_STYLES, toColumnStatus } from "../task-styles";

interface DropTarget {
    status: TaskStatus;
    index: number;
}

interface TaskBoardProps {
    tasks: Task[];
    isLoading: boolean;
    /** Show the project name on each card — useful when the board spans projects. */
    showProject?: boolean;
    canDelete?: boolean;
    emptyText?: string;
    /** Whether this user may move a given card, by drag or from its menu. */
    canMove: (task: Task) => boolean;
    onSelect: (task: Task) => void;
    /** orderedTaskIds carries the destination column's new order after a drop; a menu move omits it. */
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

const sameTarget = (current: DropTarget | null, status: TaskStatus, index: number) =>
    current?.status === status && current.index === index;

const TaskBoard = ({
    tasks,
    isLoading,
    showProject,
    canDelete,
    emptyText = "No tasks yet.",
    canMove,
    onSelect,
    onMove,
    onDelete,
}: TaskBoardProps) => {
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

    const columns = useMemo(() => {
        const byStatus = new Map<TaskStatus, Task[]>(BOARD_COLUMNS.map((column) => [column.status, []]));
        for (const task of tasks) byStatus.get(toColumnStatus(task.status))?.push(task);

        // Hand-placed order first, then soonest deadline, undated last, then newest.
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

        const destination = (columns.get(target.status) ?? []).filter((item) => item.id !== task.id);
        const sourceIndex = (columns.get(toColumnStatus(task.status)) ?? []).findIndex((item) => item.id === task.id);

        // Removing the card from its own column shifts every later slot up by one.
        const movedWithinColumn = target.status === toColumnStatus(task.status) && sourceIndex < target.index;
        const index = Math.min(movedWithinColumn ? target.index - 1 : target.index, destination.length);

        destination.splice(index, 0, task);
        onMove(
            task,
            target.status,
            destination.map((item) => item.id),
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
        );
    }

    if (tasks.length === 0) {
        return <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">{emptyText}</p>;
    }

    const dropIndicator = (status: TaskStatus, index: number) =>
        sameTarget(dropTarget, status, index) ? (
            <div className="h-0.5 rounded-full bg-primary" aria-hidden="true" />
        ) : null;

    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {BOARD_COLUMNS.map((column) => {
                const columnTasks = columns.get(column.status) ?? [];
                return (
                    <section
                        key={column.status}
                        className="min-w-0"
                        aria-label={column.label}
                        onDragOver={(event) => {
                            if (!draggedId) return;
                            event.preventDefault();
                            setDropTarget((current) =>
                                sameTarget(current, column.status, columnTasks.length)
                                    ? current
                                    : { status: column.status, index: columnTasks.length },
                            );
                        }}
                        onDrop={(event) => {
                            event.preventDefault();
                            handleDrop();
                        }}
                    >
                        <div className="flex items-center justify-between gap-2 mb-3 px-1">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                                {column.label}
                            </h3>
                            <span className="text-xs font-medium text-neutral-400">{columnTasks.length}</span>
                        </div>

                        <div
                            className={`space-y-3 min-h-[80px] rounded-lg transition-colors ${dropTarget?.status === column.status ? "bg-primary/[0.04]" : ""}`}
                        >
                            {columnTasks.length === 0 && !dropTarget && (
                                <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-neutral-400">
                                    Nothing here
                                </p>
                            )}

                            {columnTasks.map((task, index) => {
                                const doneSubTasks = task.subTasks.filter((subTask) => subTask.status === "DONE").length;
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
                                                const nextIndex = index + (event.clientY > rect.top + rect.height / 2 ? 1 : 0);
                                                setDropTarget((current) =>
                                                    sameTarget(current, column.status, nextIndex)
                                                        ? current
                                                        : { status: column.status, index: nextIndex },
                                                );
                                            }}
                                            className={`group rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-primary/40 ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${draggedId === task.id ? "opacity-40" : ""}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-1.5 min-w-0">
                                                    {draggable && (
                                                        <GripVertical
                                                            className="w-3.5 h-3.5 mt-0.5 shrink-0 text-neutral-300 dark:text-neutral-600"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => onSelect(task)}
                                                        className="text-start text-sm font-medium text-neutral-900 dark:text-white hover:text-primary line-clamp-3"
                                                    >
                                                        {task.title}
                                                    </button>
                                                </div>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        aria-label={`Actions for ${task.title}`}
                                                        className="shrink-0 rounded-md p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-muted cursor-pointer"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {draggable &&
                                                            BOARD_COLUMNS.filter((option) => option.status !== task.status).map(
                                                                (option) => (
                                                                    <DropdownMenuItem
                                                                        key={option.status}
                                                                        onClick={() => onMove(task, option.status)}
                                                                    >
                                                                        Move to {option.label}
                                                                    </DropdownMenuItem>
                                                                ),
                                                            )}
                                                        {canDelete && onDelete && (
                                                            <>
                                                                {draggable && <DropdownMenuSeparator />}
                                                                <DropdownMenuItem
                                                                    variant="destructive"
                                                                    onClick={() => onDelete(task)}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>

                                            {showProject && (
                                                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                                    {task.project.title}
                                                    {task.workspace ? ` · ${task.workspace.name}` : ""}
                                                </p>
                                            )}

                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${PRIORITY_STYLES[task.priority]}`}
                                                >
                                                    {task.priority}
                                                </span>

                                                {task.dueDate && (
                                                    <span
                                                        className={`inline-flex items-center gap-1 text-[11px] ${isOverdue(task) ? "text-destructive font-medium" : "text-neutral-500 dark:text-neutral-400"}`}
                                                    >
                                                        <CalendarDays className="w-3 h-3" />
                                                        {task.dueDate.slice(0, 10)}
                                                    </span>
                                                )}

                                                {task.subTasks.length > 0 && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                                                        <CheckSquare className="w-3 h-3" />
                                                        {doneSubTasks}/{task.subTasks.length}
                                                    </span>
                                                )}

                                                {task._count.comments > 0 && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                                                        <MessageSquare className="w-3 h-3" />
                                                        {task._count.comments}
                                                    </span>
                                                )}

                                                {task.assignee && (
                                                    <span
                                                        title={`${task.assignee.firstName} ${task.assignee.lastName}`}
                                                        className="ms-auto flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-semibold"
                                                    >
                                                        {initials(task.assignee.firstName, task.assignee.lastName)}
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
};

export default TaskBoard;
