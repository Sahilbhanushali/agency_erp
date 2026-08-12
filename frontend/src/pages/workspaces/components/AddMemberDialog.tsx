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
import type { AddMemberPayload, WorkspaceMember } from "@/types/workspace";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

interface MinimalUser {
    id: string;
    firstName: string;
    lastName: string;
}

const schema = z.object({
    userId: z.string().min(1, "Select a user"),
    memberRole: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddMemberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspaceId: string;
    companyId: string;
    existingMemberIds: string[];
    onAdded: (member: WorkspaceMember) => void;
}

const AddMemberDialog = ({ open, onOpenChange, workspaceId, companyId, existingMemberIds, onAdded }: AddMemberDialogProps) => {
    const [companyUsers, setCompanyUsers] = useState<MinimalUser[]>([]);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { userId: "", memberRole: "" },
    });

    useEffect(() => {
        if (!open) return;
        form.reset({ userId: "", memberRole: "" });
        api.get<MinimalUser[]>(`/users?companyId=${companyId}`).then(setCompanyUsers).catch(() => toast.error("Failed to load users."));
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const availableUsers = useMemo(
        () => companyUsers.filter((user) => !existingMemberIds.includes(user.id)),
        [companyUsers, existingMemberIds],
    );

    const handleSubmit = async (values: FormValues) => {
        try {
            const payload: AddMemberPayload = { userId: values.userId, memberRole: values.memberRole || undefined };
            const member = await api.post<WorkspaceMember>(`/workspaces/${workspaceId}/members`, payload);
            toast.success("Member added.");
            onAdded(member);
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to add member.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Member</DialogTitle>
                    <DialogDescription>Add an employee to this workspace.</DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                    <Field data-invalid={!!form.formState.errors.userId}>
                        <FieldLabel htmlFor="member-user">User *</FieldLabel>
                        <Controller
                            name="userId"
                            control={form.control}
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange} disabled={!availableUsers.length}>
                                    <SelectTrigger id="member-user" className="h-11 rounded-lg !w-full">
                                        <SelectValue placeholder={availableUsers.length ? "Select a user" : "No users available"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableUsers.map((user) => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {user.firstName} {user.lastName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {form.formState.errors.userId && <FieldError errors={[form.formState.errors.userId]} />}
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="member-role">Role label</FieldLabel>
                        <Input id="member-role" placeholder="e.g. Designer" className="h-11 rounded-lg" {...form.register("memberRole")} />
                    </Field>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={form.formState.isSubmitting || !availableUsers.length}>
                            {form.formState.isSubmitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                            Add Member
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AddMemberDialog;
