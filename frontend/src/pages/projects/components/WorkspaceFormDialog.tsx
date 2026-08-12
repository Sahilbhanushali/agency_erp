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
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { CreateWorkspacePayload, Workspace } from "@/types/workspace";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const schema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    colorHex: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface WorkspaceFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    onCreated: (workspace: Workspace) => void;
}

const WorkspaceFormDialog = ({ open, onOpenChange, projectId, onCreated }: WorkspaceFormDialogProps) => {
    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: "", description: "", colorHex: "#4F46E5" },
    });

    useEffect(() => {
        if (open) form.reset({ name: "", description: "", colorHex: "#4F46E5" });
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (values: FormValues) => {
        try {
            const payload: CreateWorkspacePayload = { projectId, ...values };
            const created = await api.post<Workspace>("/workspaces", payload);
            toast.success("Workspace created.");
            onCreated(created);
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to create workspace.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Workspace</DialogTitle>
                    <DialogDescription>Add a workspace under this project.</DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                    <Field data-invalid={!!form.formState.errors.name}>
                        <FieldLabel htmlFor="ws-name">Name *</FieldLabel>
                        <Input id="ws-name" className="h-11 rounded-lg" autoFocus {...form.register("name")} />
                        {form.formState.errors.name && <FieldError errors={[form.formState.errors.name]} />}
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="ws-description">Description</FieldLabel>
                        <Textarea id="ws-description" rows={2} {...form.register("description")} />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="ws-color">Color</FieldLabel>
                        <Input id="ws-color" type="color" className="h-11 rounded-lg p-1 w-24" {...form.register("colorHex")} />
                    </Field>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                            Create Workspace
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default WorkspaceFormDialog;
