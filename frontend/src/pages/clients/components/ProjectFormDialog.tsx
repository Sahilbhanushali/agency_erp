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
import { api, ApiError } from "@/lib/api";
import type { CreateProjectPayload, Project } from "@/types/project";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

interface MinimalUser {
    id: string;
    firstName: string;
    lastName: string;
}

const schema = z.object({
    title: z.string().min(1, "Title is required"),
    managerId: z.string().min(1, "Manager is required"),
    deadline: z.string().optional(),
    colorHex: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ProjectFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientId: string;
    companyId: string;
    onCreated: (project: Project) => void;
}

const ProjectFormDialog = ({ open, onOpenChange, clientId, companyId, onCreated }: ProjectFormDialogProps) => {
    const [managers, setManagers] = useState<MinimalUser[]>([]);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { title: "", managerId: "", deadline: "", colorHex: "#4F46E5" },
    });

    useEffect(() => {
        if (!open) return;
        form.reset({ title: "", managerId: "", deadline: "", colorHex: "#4F46E5" });
        api.get<MinimalUser[]>(`/users?companyId=${companyId}`).then(setManagers).catch(() => toast.error("Failed to load users."));
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (values: FormValues) => {
        try {
            const payload: CreateProjectPayload = {
                title: values.title,
                managerId: values.managerId,
                clientId,
                companyId,
                deadline: values.deadline || undefined,
                colorHex: values.colorHex || undefined,
            };
            const created = await api.post<Project>("/projects", payload);
            toast.success("Project created.");
            onCreated(created);
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to create project.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Project</DialogTitle>
                    <DialogDescription>Add a project for this client.</DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                    <Field data-invalid={!!form.formState.errors.title}>
                        <FieldLabel htmlFor="proj-title">Title *</FieldLabel>
                        <Input id="proj-title" className="h-11 rounded-lg" autoFocus {...form.register("title")} />
                        {form.formState.errors.title && <FieldError errors={[form.formState.errors.title]} />}
                    </Field>

                    <Field data-invalid={!!form.formState.errors.managerId}>
                        <FieldLabel htmlFor="proj-manager">Manager *</FieldLabel>
                        <Controller
                            name="managerId"
                            control={form.control}
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger id="proj-manager" className="h-11 rounded-lg !w-full">
                                        <SelectValue placeholder="Select manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {managers.map((manager) => (
                                            <SelectItem key={manager.id} value={manager.id}>
                                                {manager.firstName} {manager.lastName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {form.formState.errors.managerId && <FieldError errors={[form.formState.errors.managerId]} />}
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="proj-deadline">Deadline</FieldLabel>
                        <Input id="proj-deadline" type="date" className="h-11 rounded-lg" {...form.register("deadline")} />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="proj-color">Color</FieldLabel>
                        <Input id="proj-color" type="color" className="h-11 rounded-lg p-1 w-24" {...form.register("colorHex")} />
                    </Field>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                            Create Project
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectFormDialog;
