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
import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as z from "zod";

const schema = z.object({
    name: z
        .string()
        .min(1, "Role name is required")
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
                    <DialogTitle>{isEdit ? "Edit Role" : "Create Role"}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? "Update the role details and permissions." : "Define a role and choose the permissions it grants."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
                        <Field data-invalid={!!form.formState.errors.name}>
                            <FieldLabel htmlFor="name">Role Key</FieldLabel>
                            <Input id="name" className="h-11 rounded-lg" disabled={isEdit} {...form.register("name")} />
                            {form.formState.errors.name && <FieldError errors={[form.formState.errors.name]} />}
                        </Field>

                        <Field data-invalid={!!form.formState.errors.displayName}>
                            <FieldLabel htmlFor="displayName">Display Name</FieldLabel>
                            <Input id="displayName" className="h-11 rounded-lg" {...form.register("displayName")} />
                            {form.formState.errors.displayName && <FieldError errors={[form.formState.errors.displayName]} />}
                        </Field>

                        <Field className="col-span-full">
                            <FieldLabel htmlFor="description">Description</FieldLabel>
                            <Textarea id="description" rows={2} {...form.register("description")} />
                        </Field>
                    </div>

                    <Controller
                        name="permissionIds"
                        control={form.control}
                        render={() => (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <FieldLabel className="mb-0">Permissions</FieldLabel>
                                    {form.formState.errors.permissionIds && (
                                        <FieldError errors={[form.formState.errors.permissionIds]} />
                                    )}
                                </div>
                                <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                                    {groupedPermissions.map(([module, modulePermissions]) => {
                                        const moduleIds = modulePermissions.map((p) => p.id);
                                        const allChecked = moduleIds.every((id) => selectedIds.includes(id));
                                        return (
                                            <div key={module} className="rounded-lg border border-neutral-200 dark:border-slate-600 p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Checkbox
                                                        id={`module-${module}`}
                                                        checked={allChecked}
                                                        onCheckedChange={(checked) => toggleModule(modulePermissions, !!checked)}
                                                    />
                                                    <FieldLabel htmlFor={`module-${module}`} className="mb-0 capitalize font-semibold">
                                                        {module}
                                                    </FieldLabel>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {modulePermissions.map((permission) => (
                                                        <div key={permission.id} className="flex items-center gap-2">
                                                            <Checkbox
                                                                id={permission.id}
                                                                checked={selectedIds.includes(permission.id)}
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
                                                            <FieldLabel htmlFor={permission.id} className="mb-0 capitalize font-normal">
                                                                {permission.action}
                                                            </FieldLabel>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    />

                    <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 bg-background/95 backdrop-blur-sm px-6 py-4 border-t border-neutral-100 dark:border-slate-700">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                            {isEdit ? "Save Changes" : "Create Role"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default RoleFormDialog;
