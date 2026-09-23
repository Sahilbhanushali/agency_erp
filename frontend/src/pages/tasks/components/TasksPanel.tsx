import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";
import type { Task, TaskStatus } from "@/types/task";
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import TaskBoard from "./TaskBoard";
import TaskDetailSheet from "./TaskDetailSheet";
import TaskFormDialog from "./TaskFormDialog";

interface TasksPanelProps {
    title?: string;
    /** Server-side filters; they also prefill the create form. */
    projectId?: string;
    workspaceId?: string;
    assigneeId?: string;
    showProject?: boolean;
    emptyText?: string;
    /** Extra controls rendered next to the search box, e.g. the My Tasks tabs. */
    headerExtra?: ReactNode;
}

const TasksPanel = ({
    title = "Tasks",
    projectId,
    workspaceId,
    assigneeId,
    showProject,
    emptyText,
    headerExtra,
}: TasksPanelProps) => {
    const { user: actor } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const canCreate = can(actor, "tasks:create");
    const canDelete = can(actor, "tasks:delete");
    const canManage = can(actor, "tasks:update");
    // Without tasks:update an employee may still move their own card along.
    const canMove = (task: Task) => canManage || task.assignee?.id === actor?.id;

    useEffect(() => {
        const query = new URLSearchParams();
        if (projectId) query.set("projectId", projectId);
        if (workspaceId) query.set("workspaceId", workspaceId);
        if (assigneeId) query.set("assigneeId", assigneeId);

        const queryString = query.toString();
        setIsLoading(true);
        api
            .get<Task[]>(`/tasks${queryString ? `?${queryString}` : ""}`)
            .then(setTasks)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load tasks."))
            .finally(() => setIsLoading(false));
    }, [projectId, workspaceId, assigneeId]);

    const filteredTasks = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return tasks;
        return tasks.filter(
            (task) =>
                task.title.toLowerCase().includes(query) ||
                task.project.title.toLowerCase().includes(query) ||
                `${task.assignee?.firstName ?? ""} ${task.assignee?.lastName ?? ""}`.toLowerCase().includes(query),
        );
    }, [tasks, search]);

    const upsertTask = (task: Task) =>
        setTasks((current) =>
            current.some((item) => item.id === task.id)
                ? current.map((item) => (item.id === task.id ? task : item))
                : [task, ...current],
        );

    const handleMove = async (task: Task, status: TaskStatus, orderedTaskIds?: string[]) => {
        const previous = tasks;
        setTasks((current) =>
            current.map((item) => {
                const index = orderedTaskIds?.indexOf(item.id) ?? -1;
                const position = index >= 0 ? index : item.position;
                return item.id === task.id ? { ...item, status, position } : { ...item, position };
            }),
        );

        try {
            // Persisting the column order needs tasks:update; an assignee just moves their own card.
            if (orderedTaskIds && canManage) {
                const updated = await api.patch<Task[]>("/tasks/reorder", { status, taskIds: orderedTaskIds });
                setTasks((current) => current.map((item) => updated.find((task) => task.id === item.id) ?? item));
            } else {
                upsertTask(await api.patch<Task>(`/tasks/${task.id}`, { status }));
            }
        } catch (error) {
            setTasks(previous);
            toast.error(error instanceof ApiError ? error.message : "Failed to move the task.");
        }
    };

    const handleDelete = async () => {
        if (!taskToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/tasks/${taskToDelete.id}`);
            toast.success("Task deleted.");
            setTasks((current) => current.filter((item) => item.id !== taskToDelete.id));
            if (selectedId === taskToDelete.id) setSelectedId(null);
            setTaskToDelete(null);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete the task.");
        } finally {
            setIsDeleting(false);
        }
    };

    const openCreateForm = () => {
        setTaskToEdit(null);
        setFormOpen(true);
    };

    return (
        <>
            <Card className="card h-full !p-0 !block border-0 overflow-hidden">
                <CardHeader className="border-b border-border !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                    <div className="flex items-center flex-wrap gap-3">
                        <h2 className="text-base font-semibold text-neutral-900 dark:text-white shrink-0">{title}</h2>
                        {headerExtra}
                        <div className="relative">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <Input
                                aria-label="Search tasks"
                                placeholder="Search tasks..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="ps-9 h-11 w-[220px]"
                            />
                        </div>
                    </div>

                    {canCreate && (
                        <Button className="w-auto h-11" onClick={openCreateForm}>
                            <Plus className="w-5 h-5" />
                            New Task
                        </Button>
                    )}
                </CardHeader>

                <CardContent className="p-6">
                    <TaskBoard
                        tasks={filteredTasks}
                        isLoading={isLoading}
                        showProject={showProject}
                        canDelete={canDelete}
                        emptyText={search ? "No tasks match your search." : emptyText}
                        canMove={canMove}
                        onSelect={(task) => setSelectedId(task.id)}
                        onMove={handleMove}
                        onDelete={setTaskToDelete}
                    />
                </CardContent>
            </Card>

            <TaskDetailSheet
                taskId={selectedId}
                onOpenChange={(open) => !open && setSelectedId(null)}
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
                title="Delete task"
                description={`Delete "${taskToDelete?.title}" and its sub-tasks? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDelete}
            />
        </>
    );
};

export default TasksPanel;
