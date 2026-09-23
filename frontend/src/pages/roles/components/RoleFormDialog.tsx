import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { CreateRolePayload, Permission, Role, UpdateRolePayload } from "@/types/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Shield } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const schema = z.object({
    name: z
        .string()
        .min(1, "Role key is required")
        .regex(/^[A-Z][A-Z0-9_]*$/, "Use uppercase letters, numbers and underscores only (e.g. CONTENT_MANAGER)"),
    displayName: z.string().min(1, "Display name is required"),
    description: z.string().optional(),
    permissionIds: z.array(z.string()).min(1, "Select at least one permission"),
});

type FormValues = z.infer<typeof schema>;

interface RoleFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    role: Role | null;
    permissions: Permission[];
    companyId?: string;
    onSaved: () => void;
}

const RoleFormDialog = ({ open, onOpenChange, role, permissions, companyId, onSaved }: RoleFormDialogProps) => {
    const isEdit = !!role;

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: role?.name ?? "",
            displayName: role?.displayName ?? "",
            description: role?.description ?? "",
            permissionIds: role?.permissions?.map((p) => p.permission.id) ?? [],
        },
    });

    useEffect(() => {
        form.reset({
            name: role?.name ?? "",
            displayName: role?.displayName ?? "",
            description: role?.description ?? "",
            permissionIds: role?.permissions?.map((p) => p.permission.id) ?? [],
        });
    }, [role, open]); // eslint-disable-line react-hooks/exhaustive-deps

    const groupedPermissions = useMemo(() => {
        const groups = new Map<string, Permission[]>();
        for (const permission of permissions) {
            const list = groups.get(permission.module) ?? [];
            list.push(permission);
            groups.set(permission.module, list);
        }
        return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [permissions]);

    const selectedIds = form.watch("permissionIds");

    const toggleModule = (modulePermissions: Permission[], checked: boolean) => {
        const moduleIds = modulePermissions.map((p) => p.id);
        const current = form.getValues("permissionIds");
        form.setValue(
            "permissionIds",
            checked
                ? Array.from(new Set([...current, ...moduleIds]))
                : current.filter((id) => !moduleIds.includes(id)),
            { shouldValidate: true },
        );
    };

    const handleSubmit = async (values: FormValues) => {
        try {
            if (isEdit && role) {
                const payload: UpdateRolePayload = {
                    displayName: values.displayName,
                    description: values.description || undefined,
                    permissionIds: values.permissionIds,
                };
                await api.patch(`/roles/${role.id}`, payload);
                toast.success("Role updated.");
            } else {
                const payload: CreateRolePayload = {
                    companyId,
                    name: values.name,
                    displayName: values.displayName,
                    description: values.description || undefined,
                    permissionIds: values.permissionIds,
                };
                await api.post("/roles", payload);
                toast.success("Role created.");
            }
            onOpenChange(false);
            onSaved();
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to save role.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle>{isEdit ? "Edit Role" : "Create New Role"}</DialogTitle>
                            <DialogDescription className="mt-0.5 text-xs">
                                {isEdit
                                    ? "Update role attributes and associated permission privileges."
                                    : "Define a new access role and select granular capabilities."}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field data-invalid={!!form.formState.errors.name}>
                            <FieldLabel htmlFor="name" className="text-xs font-medium">Role Key *</FieldLabel>
                            <Input
                                id="name"
                                className="h-9 font-mono text-xs"
                                placeholder="e.g. PROJECT_MANAGER"
                                disabled={isEdit}
                                {...form.register("name")}
                            />
                            {form.formState.errors.name && <FieldError errors={[form.formState.errors.name]} />}
                        </Field>

                        <Field data-invalid={!!form.formState.errors.displayName}>
                            <FieldLabel htmlFor="displayName" className="text-xs font-medium">Display Name *</FieldLabel>
                            <Input
                                id="displayName"
                                className="h-9 text-xs"
                                placeholder="e.g. Project Manager"
                                {...form.register("displayName")}
                            />
                            {form.formState.errors.displayName && <FieldError errors={[form.formState.errors.displayName]} />}
                        </Field>

                        <Field className="col-span-full">
                            <FieldLabel htmlFor="description" className="text-xs font-medium">Description</FieldLabel>
                            <Textarea
                                id="description"
                                rows={2}
                                className="text-xs resize-none"
                                placeholder="Brief overview of responsibilities and scope for this role..."
                                {...form.register("description")}
                            />
                        </Field>
                    </div>

                    <Controller
                        name="permissionIds"
                        control={form.control}
                        render={() => (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between border-b border-border pb-2">
                                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                                        Module Permissions
                                    </span>
                                    <span className="text-xs font-mono text-muted-foreground">
                                        {selectedIds.length} selected
                                    </span>
                                </div>
                                {form.formState.errors.permissionIds && (
                                    <FieldError errors={[form.formState.errors.permissionIds]} />
                                )}
                                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                                    {groupedPermissions.map(([module, modulePermissions]) => {
                                        const moduleIds = modulePermissions.map((p) => p.id);
                                        const allChecked = moduleIds.every((id) => selectedIds.includes(id));
                                        const someChecked = moduleIds.some((id) => selectedIds.includes(id)) && !allChecked;

                                        return (
                                            <div
                                                key={module}
                                                className="rounded-lg border border-border/80 bg-card/60 p-3.5 space-y-2.5"
                                            >
                                                <div className="flex items-center justify-between pb-1 border-b border-border/40">
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            id={`module-${module}`}
                                                            checked={allChecked ? true : someChecked ? "indeterminate" : false}
                                                            onCheckedChange={(checked) => toggleModule(modulePermissions, !!checked)}
                                                        />
                                                        <label
                                                            htmlFor={`module-${module}`}
                                                            className="text-xs font-semibold uppercase tracking-wide text-foreground cursor-pointer"
                                                        >
                                                            {module}
                                                        </label>
                                                    </div>
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {modulePermissions.filter((p) => selectedIds.includes(p.id)).length} of {modulePermissions.length}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                                    {modulePermissions.map((permission) => {
                                                        const isChecked = selectedIds.includes(permission.id);
                                                        return (
                                                            <label
                                                                key={permission.id}
                                                                htmlFor={permission.id}
                                                                className={`flex items-center gap-2 text-xs p-1.5 rounded-md cursor-pointer transition-colors ${
                                                                    isChecked ? "bg-primary/5 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                                                                }`}
                                                            >
                                                                <Checkbox
                                                                    id={permission.id}
                                                                    checked={isChecked}
                                                                    onCheckedChange={(checked) => {
                                                                        const current = form.getValues("permissionIds");
                                                                        form.setValue(
                                                                            "permissionIds",
                                                                            checked
                                                                                ? [...current, permission.id]
                                                                                : current.filter((id) => id !== permission.id),
                                                                            { shouldValidate: true },
                                                                        );
                                                                    }}
                                                                />
                                                                <span className="capitalize">{permission.action}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    />

                    <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 bg-background/95 backdrop-blur-sm px-6 py-4 border-t border-border flex items-center justify-end gap-2">
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
                            {isEdit ? "Save Changes" : "Create Role"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default RoleFormDialog;
