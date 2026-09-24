import Combobox from "@/components/shared/Combobox";
import DatePicker from "@/components/shared/DatePicker";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { Project } from "@/types/project";
import type { CreateTaskPayload, Task, TaskPriority, UpdateTaskPayload } from "@/types/task";
import type { Workspace } from "@/types/workspace";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckSquare, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";
import { PRIORITY_OPTIONS } from "../task-styles";

interface MinimalUser {
    id: string;
    firstName: string;
    lastName: string;
    role?: { id: string; displayName: string } | null;
}

const schema = z.object({
    projectId: z.string().min(1, "Project is required"),
    workspaceId: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    dueDate: z.string().optional(),
    assigneeId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface TaskFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Fixes the project — the picker is hidden when the board already belongs to one. */
    projectId?: string;
    /** Fixes the workspace board. */
    workspaceId?: string;
    /** Present for edit, absent for create. */
    task?: Task | null;
    onSaved: (task: Task) => void;
}

const emptyValues = (projectId?: string, workspaceId?: string): FormValues => ({
    projectId: projectId ?? "",
    workspaceId: workspaceId ?? "",
    title: "",
    description: "",
    priority: "MEDIUM",
    dueDate: "",
    assigneeId: "",
});

const TaskFormDialog = ({ open, onOpenChange, projectId, workspaceId, task, onSaved }: TaskFormDialogProps) => {
    const { user: actor } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [users, setUsers] = useState<MinimalUser[]>([]);
    const [fixedProject, setFixedProject] = useState<Project | null>(null);
    const [usersUnavailable, setUsersUnavailable] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: emptyValues(projectId, workspaceId),
    });

    const selectedProjectId = form.watch("projectId");

    useEffect(() => {
        if (!open) return;
        form.reset(
            task
                ? {
                      projectId: task.projectId,
                      workspaceId: task.workspaceId ?? "",
                      title: task.title,
                      description: task.description ?? "",
                      priority: task.priority,
                      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
                      assigneeId: task.assignee?.id ?? "",
                  }
                : emptyValues(projectId, workspaceId),
        );
        if (!projectId) {
            api.list<Project>("/projects").then(setProjects).catch(() => toast.error("Failed to load projects."));
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!open || !selectedProjectId || workspaceId) return;
        api
            .list<Workspace>(`/workspaces?projectId=${selectedProjectId}`)
            .then(setWorkspaces)
            .catch(() => setWorkspaces([]));
    }, [open, selectedProjectId, workspaceId]);

    // Opened from a project or board, the project list is never fetched, so ask that project
    // directly — a SUPER_ADMIN has no companyId of their own to fall back on.
    useEffect(() => {
        if (!open || !projectId) return;
        api
            .get<Project>(`/projects/${projectId}`)
            .then(setFixedProject)
            .catch(() => setFixedProject(null));
    }, [open, projectId]);

    const companyId =
        projects.find((project) => project.id === selectedProjectId)?.companyId ??
        fixedProject?.companyId ??
        actor?.companyId ??
        undefined;

    useEffect(() => {
        if (!open || !companyId) return;
        api
            .list<MinimalUser>(`/users?companyId=${companyId}`)
            .then((list) => {
                setUsers(list);
                setUsersUnavailable(false);
            })
            .catch(() => {
                setUsers([]);
                setUsersUnavailable(true);
            });
    }, [open, companyId]);

    const assigneePlaceholder = () => {
        if (usersUnavailable) return "You cannot list people (needs users:read)";
        if (!companyId) return "Select a project first";
        if (users.length === 0) return "No people in this company";
        return "Unassigned";
    };

    const handleSubmit = async (values: FormValues) => {
        const shared = {
            workspaceId: values.workspaceId || null,
            title: values.title,
            description: values.description || undefined,
            priority: values.priority as TaskPriority,
            dueDate: values.dueDate || null,
            assigneeId: values.assigneeId || null,
        };

        try {
            const saved = task
                ? await api.patch<Task>(`/tasks/${task.id}`, shared satisfies UpdateTaskPayload)
                : await api.post<Task>("/tasks", { projectId: values.projectId, ...shared } satisfies CreateTaskPayload);
            toast.success(task ? "Task updated." : "Task created.");
            onSaved(saved);
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to save task.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <CheckSquare className="w-4 h-4" />
                        </div>
                        <div>
                            <DialogTitle className="text-base">{task ? "Edit Task" : "Create New Task"}</DialogTitle>
                            <DialogDescription className="text-xs mt-0.5">
                                {task ? "Update the task details and status." : "Tasks organize project deliverables into actionable items."}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
                    {!projectId && (
                        <Field data-invalid={!!form.formState.errors.projectId}>
                            <FieldLabel htmlFor="task-project" className="text-xs font-medium">Project *</FieldLabel>
                            <Controller
                                control={form.control}
                                name="projectId"
                                render={({ field }) => (
                                    <Combobox
                                        id="task-project"
                                        value={field.value}
                                        onChange={(value) => {
                                            field.onChange(value);
                                            form.setValue("workspaceId", "");
                                        }}
                                        disabled={!!task}
                                        options={projects.map((project) => ({ value: project.id, label: project.title }))}
                                        placeholder="Select project"
                                        searchPlaceholder="Search projects..."
                                        emptyText="No projects found."
                                    />
                                )}
                            />
                            {form.formState.errors.projectId && (
                                <FieldError errors={[form.formState.errors.projectId]} />
                            )}
                        </Field>
                    )}

                    <Field data-invalid={!!form.formState.errors.title}>
                        <FieldLabel htmlFor="task-title" className="text-xs font-medium">Title *</FieldLabel>
                        <Input
                            id="task-title"
                            className="h-9 text-xs"
                            placeholder="e.g. Design homepage hero component"
                            autoFocus
                            {...form.register("title")}
                        />
                        {form.formState.errors.title && <FieldError errors={[form.formState.errors.title]} />}
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="task-description" className="text-xs font-medium">Description</FieldLabel>
                        <Textarea
                            id="task-description"
                            rows={3}
                            className="text-xs resize-none"
                            placeholder="Detailed requirements, acceptance criteria, or links..."
                            {...form.register("description")}
                        />
                    </Field>

                    {!workspaceId && (
                        <Field>
                            <FieldLabel htmlFor="task-workspace" className="text-xs font-medium">Workspace</FieldLabel>
                            <Controller
                                control={form.control}
                                name="workspaceId"
                                render={({ field }) => (
                                    <Combobox
                                        id="task-workspace"
                                        value={field.value}
                                        onChange={field.onChange}
                                        disabled={!selectedProjectId}
                                        options={workspaces.map((workspace) => ({
                                            value: workspace.id,
                                            label: workspace.name,
                                        }))}
                                        placeholder={selectedProjectId ? "Project backlog" : "Select a project first"}
                                        searchPlaceholder="Search workspaces..."
                                        emptyText="No workspaces found."
                                    />
                                )}
                            />
                        </Field>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Field>
                            <FieldLabel htmlFor="task-priority" className="text-xs font-medium">Priority</FieldLabel>
                            <Controller
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger id="task-priority" className="h-9 text-xs !w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PRIORITY_OPTIONS.map((option) => (
                                                <SelectItem key={option} value={option} className="text-xs">
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="task-due" className="text-xs font-medium">Due Date</FieldLabel>
                            <Controller
                                control={form.control}
                                name="dueDate"
                                render={({ field }) => (
                                    <DatePicker
                                        id="task-due"
                                        value={field.value || undefined}
                                        onChange={(value) => field.onChange(value ?? "")}
                                        placeholder="No due date"
                                    />
                                )}
                            />
                        </Field>
                    </div>

                    <Field>
                        <FieldLabel htmlFor="task-assignee" className="text-xs font-medium">Assignee</FieldLabel>
                        <Controller
                            control={form.control}
                            name="assigneeId"
                            render={({ field }) => (
                                <Combobox
                                    id="task-assignee"
                                    value={field.value}
                                    onChange={field.onChange}
                                    disabled={!companyId || usersUnavailable}
                                    options={users.map((user) => ({
                                        value: user.id,
                                        label: user.role
                                            ? `${user.firstName} ${user.lastName} · ${user.role.displayName}`
                                            : `${user.firstName} ${user.lastName}`,
                                    }))}
                                    placeholder={assigneePlaceholder()}
                                    searchPlaceholder="Search by name or role..."
                                    emptyText="No people found."
                                />
                            )}
                        />
                    </Field>

                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            disabled={form.formState.isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" />}
                            {task ? "Save Changes" : "Create Task"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default TaskFormDialog;
