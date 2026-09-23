import StatusBadge from "@/components/shared/StatusBadge";
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
import {
    CalendarDays,
    CheckSquare,
    FolderKanban,
    Loader2,
    MessageSquare,
    Pencil,
    Plus,
    Trash2,
    User as UserIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { BOARD_COLUMNS } from "../task-styles";

interface TaskDetailSheetProps {
    taskId: string | null;
    onOpenChange: (open: boolean) => void;
    /** Bubbles every change up so the board card stays in sync. */
    onChanged: (task: Task) => void;
    onEdit: (task: Task) => void;
    onDelete?: (task: Task) => void;
}

const MetaRow = ({ icon: Icon, label, value }: { icon: typeof UserIcon; label: string; value: string }) => (
    <div className="flex items-center justify-between py-1.5 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{label}</span>
        </div>
        <span className="font-medium text-foreground truncate max-w-[200px] text-right">{value}</span>
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
            toast.error(error instanceof ApiError ? error.message : "Failed to update status.");
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
            toast.error(error instanceof ApiError ? error.message : "Failed to add sub-task.");
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
            toast.error(error instanceof ApiError ? error.message : "Failed to update sub-task.");
        }
    };

    const handleDeleteSubTask = async (subTask: SubTask) => {
        if (!task) return;
        try {
            await api.delete(`/tasks/${subTask.id}`);
            applyTask({ ...task, subTasks: task.subTasks.filter((item) => item.id !== subTask.id) });
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete sub-task.");
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
            toast.error(error instanceof ApiError ? error.message : "Failed to post comment.");
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
            toast.error(error instanceof ApiError ? error.message : "Failed to delete comment.");
        }
    };

    const completedSubTasks = task?.subTasks.filter((item) => item.status === "DONE").length ?? 0;
    const totalSubTasks = task?.subTasks.length ?? 0;

    return (
        <Sheet open={!!taskId} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 flex flex-col gap-0 border-l border-border bg-card">
                {isLoading || !task ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-3 m-auto">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Loading task details...</p>
                    </div>
                ) : (
                    <>
                        {/* Sheet Header */}
                        <SheetHeader className="p-5 pb-4 border-b border-border/80 sticky top-0 bg-card/95 backdrop-blur-md z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <StatusBadge status={task.status} />
                                <StatusBadge status={task.priority} />
                            </div>
                            <SheetTitle className="text-base font-semibold text-foreground pe-6 leading-snug">
                                {task.title}
                            </SheetTitle>
                            <SheetDescription className="sr-only">Task details, sub-tasks and comments.</SheetDescription>
                        </SheetHeader>

                        {/* Sheet Body */}
                        <div className="p-5 space-y-6 flex-1">
                            {/* Controls Bar */}
                            <div className="flex items-center gap-2">
                                <Select value={task.status} onValueChange={(value) => handleStatusChange(value as TaskStatus)}>
                                    <SelectTrigger aria-label="Task status" className="h-8 text-xs rounded-lg flex-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BOARD_COLUMNS.map((column) => (
                                            <SelectItem key={column.status} value={column.status} className="text-xs">
                                                {column.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {canManage && (
                                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onEdit(task)}>
                                        <Pencil className="w-3.5 h-3.5 mr-1" />
                                        Edit
                                    </Button>
                                )}
                                {canDelete && onDelete && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        aria-label="Delete task"
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => onDelete(task)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                            </div>

                            {/* Metadata Properties */}
                            <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-0.5 divide-y divide-border/40">
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
                                    label="Due Date"
                                    value={task.dueDate ? task.dueDate.slice(0, 10) : "No due date"}
                                />
                            </div>

                            {/* Description */}
                            {task.description && (
                                <div className="space-y-1.5">
                                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        Description
                                    </span>
                                    <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed rounded-lg p-3 bg-muted/30 border border-border/50">
                                        {task.description}
                                    </p>
                                </div>
                            )}

                            {/* Sub-tasks Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <CheckSquare className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                                            Sub-tasks
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                        {completedSubTasks} / {totalSubTasks}
                                    </span>
                                </div>

                                {task.subTasks.length > 0 && (
                                    <div className="space-y-1.5 rounded-lg border border-border/70 p-2 bg-muted/10">
                                        {task.subTasks.map((subTask) => (
                                            <div
                                                key={subTask.id}
                                                className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-muted/50 group transition-colors"
                                            >
                                                <Checkbox
                                                    id={`sub-${subTask.id}`}
                                                    checked={subTask.status === "DONE"}
                                                    disabled={!canManage && subTask.assignee?.id !== actor?.id}
                                                    onCheckedChange={(checked) => handleToggleSubTask(subTask, checked === true)}
                                                />
                                                <label
                                                    htmlFor={`sub-${subTask.id}`}
                                                    className={`text-xs flex-1 min-w-0 truncate cursor-pointer ${
                                                        subTask.status === "DONE"
                                                            ? "line-through text-muted-foreground"
                                                            : "text-foreground"
                                                    }`}
                                                >
                                                    {subTask.title}
                                                </label>
                                                {canDelete && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        aria-label={`Delete sub-task ${subTask.title}`}
                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => handleDeleteSubTask(subTask)}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {can(actor, "tasks:create") && (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            aria-label="New sub-task"
                                            placeholder="Add sub-task..."
                                            className="h-8 text-xs"
                                            value={subTaskTitle}
                                            onChange={(event) => setSubTaskTitle(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key !== "Enter") return;
                                                event.preventDefault();
                                                void handleAddSubTask();
                                            }}
                                        />
                                        <Button
                                            size="sm"
                                            aria-label="Add sub-task"
                                            className="h-8 px-2.5 shrink-0 text-xs"
                                            disabled={isBusy || !subTaskTitle.trim()}
                                            onClick={handleAddSubTask}
                                        >
                                            <Plus className="w-3.5 h-3.5 mr-1" />
                                            Add
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Comments Section */}
                            <div className="space-y-3 pt-2 border-t border-border">
                                <div className="flex items-center gap-1.5">
                                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                                        Comments ({task.comments?.length ?? 0})
                                    </span>
                                </div>

                                <div className="space-y-2.5">
                                    {(task.comments ?? []).map((item) => (
                                        <div key={item.id} className="rounded-lg bg-muted/40 border border-border/60 p-3 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                                                        {item.user.firstName[0]?.toUpperCase()}
                                                    </span>
                                                    <span className="text-xs font-medium text-foreground">
                                                        {item.user.firstName} {item.user.lastName}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        {item.createdAt.slice(0, 10)}
                                                    </span>
                                                </div>
                                                {(item.user.id === actor?.id || canManage) && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        aria-label="Delete comment"
                                                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleDeleteComment(item.id)}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>
                                            <p className="text-xs text-foreground/90 whitespace-pre-wrap pl-7">
                                                {item.content}
                                            </p>
                                        </div>
                                    ))}

                                    {(task.comments?.length ?? 0) === 0 && (
                                        <p className="text-xs text-muted-foreground py-2 text-center">
                                            No comments on this task yet.
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2 pt-1">
                                    <Textarea
                                        aria-label="New comment"
                                        rows={2}
                                        placeholder="Add a remark or update..."
                                        className="text-xs resize-none"
                                        value={comment}
                                        onChange={(event) => setComment(event.target.value)}
                                    />
                                    <div className="flex justify-end">
                                        <Button
                                            size="sm"
                                            className="h-8 text-xs font-medium"
                                            disabled={isBusy || !comment.trim()}
                                            onClick={handleAddComment}
                                        >
                                            {isBusy && <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" />}
                                            Post Comment
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
};

export default TaskDetailSheet;
