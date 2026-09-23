import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";
import type { SubTask, Task, TaskComment, TaskStatus } from "@/types/task";
import { CalendarDays, FolderKanban, Loader2, Pencil, Plus, Trash2, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { BOARD_COLUMNS, PRIORITY_STYLES, STATUS_STYLES, statusLabel } from "../task-styles";

interface TaskDetailSheetProps {
    taskId: string | null;
    onOpenChange: (open: boolean) => void;
    /** Bubbles every change up so the board card stays in sync. */
    onChanged: (task: Task) => void;
    onEdit: (task: Task) => void;
    onDelete?: (task: Task) => void;
}

const MetaRow = ({ icon: Icon, label, value }: { icon: typeof UserIcon; label: string; value: string }) => (
    <div className="flex items-center gap-2.5 text-sm">
        <Icon className="w-4 h-4 text-neutral-400 shrink-0" />
        <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
        <span className="ms-auto font-medium text-neutral-900 dark:text-white truncate">{value}</span>
    </div>
);

const TaskDetailSheet = ({ taskId, onOpenChange, onChanged, onEdit, onDelete }: TaskDetailSheetProps) => {
    const { user: actor } = useAuth();
    const [task, setTask] = useState<Task | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [subTaskTitle, setSubTaskTitle] = useState("");
    const [comment, setComment] = useState("");
    const [isBusy, setIsBusy] = useState(false);

    const canManage = can(actor, "tasks:update");
    const canDelete = can(actor, "tasks:delete");

    useEffect(() => {
        if (!taskId) {
            setTask(null);
            return;
        }
        setIsLoading(true);
        setSubTaskTitle("");
        setComment("");
        api
            .get<Task>(`/tasks/${taskId}`)
            .then(setTask)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load task."))
            .finally(() => setIsLoading(false));
    }, [taskId]);

    const applyTask = (next: Task) => {
        setTask(next);
        onChanged(next);
    };

    const handleStatusChange = async (status: TaskStatus) => {
        if (!task) return;
        try {
            const updated = await api.patch<Task>(`/tasks/${task.id}`, { status });
            applyTask({ ...updated, comments: task.comments });
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to update the status.");
        }
    };

    const handleAddSubTask = async () => {
        if (!task || !subTaskTitle.trim()) return;
        setIsBusy(true);
        try {
            const subTask = await api.post<SubTask>(`/tasks/${task.id}/subtasks`, { title: subTaskTitle.trim() });
            applyTask({ ...task, subTasks: [...task.subTasks, subTask] });
            setSubTaskTitle("");
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to add the sub-task.");
        } finally {
            setIsBusy(false);
        }
    };

    const handleToggleSubTask = async (subTask: SubTask, done: boolean) => {
        if (!task) return;
        try {
            const updated = await api.patch<SubTask>(`/tasks/${subTask.id}`, { status: done ? "DONE" : "TODO" });
            applyTask({
                ...task,
                subTasks: task.subTasks.map((item) => (item.id === subTask.id ? { ...item, status: updated.status } : item)),
            });
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to update the sub-task.");
        }
    };

    const handleDeleteSubTask = async (subTask: SubTask) => {
        if (!task) return;
        try {
            await api.delete(`/tasks/${subTask.id}`);
            applyTask({ ...task, subTasks: task.subTasks.filter((item) => item.id !== subTask.id) });
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete the sub-task.");
        }
    };

    const handleAddComment = async () => {
        if (!task || !comment.trim()) return;
        setIsBusy(true);
        try {
            const created = await api.post<TaskComment>(`/tasks/${task.id}/comments`, { content: comment.trim() });
            applyTask({
                ...task,
                comments: [...(task.comments ?? []), created],
                _count: { comments: task._count.comments + 1 },
            });
            setComment("");
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to post the comment.");
        } finally {
            setIsBusy(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!task) return;
        try {
            await api.delete(`/tasks/${task.id}/comments/${commentId}`);
            applyTask({
                ...task,
                comments: (task.comments ?? []).filter((item) => item.id !== commentId),
                _count: { comments: Math.max(0, task._count.comments - 1) },
            });
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete the comment.");
        }
    };

    return (
        <Sheet open={!!taskId} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                {isLoading || !task ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                    </div>
                ) : (
                    <>
                        <SheetHeader>
                            <SheetTitle className="text-lg pe-6">{task.title}</SheetTitle>
                            <SheetDescription className="sr-only">Task details, sub-tasks and comments.</SheetDescription>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <span
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[task.status]}`}
                                >
                                    {statusLabel(task.status)}
                                </span>
                                <span
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${PRIORITY_STYLES[task.priority]}`}
                                >
                                    {task.priority}
                                </span>
                            </div>
                        </SheetHeader>

                        <div className="px-4 pb-6 space-y-6">
                            <div className="flex flex-wrap gap-2">
                                <Select value={task.status} onValueChange={(value) => handleStatusChange(value as TaskStatus)}>
                                    <SelectTrigger aria-label="Task status" className="h-10 rounded-lg flex-1 min-w-[160px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BOARD_COLUMNS.map((column) => (
                                            <SelectItem key={column.status} value={column.status}>
                                                {column.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {canManage && (
                                    <Button variant="outline" className="h-10 rounded-lg" onClick={() => onEdit(task)}>
                                        <Pencil className="w-3.5 h-3.5" />
                                        Edit
                                    </Button>
                                )}
                                {canDelete && onDelete && (
                                    <Button
                                        variant="outline"
                                        aria-label="Delete task"
                                        className="h-10 rounded-lg text-destructive hover:text-destructive"
                                        onClick={() => onDelete(task)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-2.5 rounded-lg border border-border p-4">
                                <MetaRow
                                    icon={FolderKanban}
                                    label="Project"
                                    value={task.workspace ? `${task.project.title} · ${task.workspace.name}` : task.project.title}
                                />
                                <MetaRow
                                    icon={UserIcon}
                                    label="Assignee"
                                    value={task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : "Unassigned"}
                                />
                                <MetaRow
                                    icon={CalendarDays}
                                    label="Due"
                                    value={task.dueDate ? task.dueDate.slice(0, 10) : "No due date"}
                                />
                            </div>

                            {task.description && (
                                <p className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap">
                                    {task.description}
                                </p>
                            )}

                            <section className="space-y-3">
                                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                                    Sub-tasks ({task.subTasks.filter((item) => item.status === "DONE").length}/
                                    {task.subTasks.length})
                                </h3>

                                {task.subTasks.map((subTask) => (
                                    <div key={subTask.id} className="flex items-center gap-2.5">
                                        <Checkbox
                                            id={`sub-${subTask.id}`}
                                            checked={subTask.status === "DONE"}
                                            disabled={!canManage && subTask.assignee?.id !== actor?.id}
                                            onCheckedChange={(checked) => handleToggleSubTask(subTask, checked === true)}
                                        />
                                        <label
                                            htmlFor={`sub-${subTask.id}`}
                                            className={`text-sm flex-1 min-w-0 truncate ${subTask.status === "DONE" ? "line-through text-neutral-400" : "text-neutral-700 dark:text-neutral-200"}`}
                                        >
                                            {subTask.title}
                                        </label>
                                        {canDelete && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                aria-label={`Delete sub-task ${subTask.title}`}
                                                className="h-7 w-7 text-neutral-400 hover:text-destructive"
                                                onClick={() => handleDeleteSubTask(subTask)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                ))}

                                {task.subTasks.length === 0 && (
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400">No sub-tasks yet.</p>
                                )}

                                {can(actor, "tasks:create") && (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            aria-label="New sub-task"
                                            placeholder="Add a sub-task..."
                                            className="h-10 rounded-lg"
                                            value={subTaskTitle}
                                            onChange={(event) => setSubTaskTitle(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key !== "Enter") return;
                                                event.preventDefault();
                                                void handleAddSubTask();
                                            }}
                                        />
                                        <Button
                                            size="icon"
                                            aria-label="Add sub-task"
                                            className="h-10 w-10 shrink-0"
                                            disabled={isBusy || !subTaskTitle.trim()}
                                            onClick={handleAddSubTask}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </section>

                            <section className="space-y-3">
                                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                                    Comments ({task.comments?.length ?? 0})
                                </h3>

                                {(task.comments ?? []).map((item) => (
                                    <div key={item.id} className="rounded-lg bg-muted/50 p-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-neutral-900 dark:text-white">
                                                {item.user.firstName} {item.user.lastName}
                                            </span>
                                            <span className="text-xs text-neutral-400">{item.createdAt.slice(0, 10)}</span>
                                            {(item.user.id === actor?.id || canManage) && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    aria-label="Delete comment"
                                                    className="ms-auto h-7 w-7 text-neutral-400 hover:text-destructive"
                                                    onClick={() => handleDeleteComment(item.id)}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                        <p className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap mt-1">
                                            {item.content}
                                        </p>
                                    </div>
                                ))}

                                {(task.comments?.length ?? 0) === 0 && (
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400">No comments yet.</p>
                                )}

                                <Textarea
                                    aria-label="New comment"
                                    rows={2}
                                    placeholder="Write a comment..."
                                    value={comment}
                                    onChange={(event) => setComment(event.target.value)}
                                />
                                <Button
                                    className="h-10 rounded-lg"
                                    disabled={isBusy || !comment.trim()}
                                    onClick={handleAddComment}
                                >
                                    {isBusy && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                                    Comment
                                </Button>
                            </section>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
};

export default TaskDetailSheet;
