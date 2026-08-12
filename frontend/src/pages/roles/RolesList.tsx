import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { Permission, Role } from "@/types/user";
import { Loader2, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import RoleFormDialog from "./components/RoleFormDialog";

interface Company {
    id: string;
    name: string;
}

const RolesList = () => {
    const { user: actor } = useAuth();
    const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [companyId, setCompanyId] = useState<string | undefined>(actor?.companyId ?? undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchRoles = () => {
        setIsLoading(true);
        const query = companyId ? `?companyId=${companyId}` : "";
        api
            .get<Role[]>(`/roles${query}`)
            .then(setRoles)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load roles."))
            .finally(() => setIsLoading(false));
    };

    useEffect(fetchRoles, [companyId]);

    useEffect(() => {
        api
            .get<Permission[]>("/permissions")
            .then(setPermissions)
            .catch(() => toast.error("Failed to load permissions."));
    }, []);

    useEffect(() => {
        if (isSuperAdmin) {
            api.get<Company[]>("/companies").then(setCompanies).catch(() => toast.error("Failed to load companies."));
        }
    }, [isSuperAdmin]);

    const handleDelete = async () => {
        if (!roleToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/roles/${roleToDelete.id}`);
            toast.success("Role deleted.");
            setRoles((current) => current.filter((role) => role.id !== roleToDelete.id));
            setRoleToDelete(null);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete role.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Roles & Permissions" text="Roles" />

            <Card className="card h-full !p-0 !block border-0 overflow-hidden mb-6">
                <CardHeader className="border-b border-neutral-200 dark:border-slate-600 !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                    <div className="flex items-center flex-wrap gap-3">
                        {isSuperAdmin && (
                            <Select value={companyId} onValueChange={setCompanyId}>
                                <SelectTrigger className="min-w-[200px] h-11 dark:bg-slate-700 border border-slate-300 dark:border-slate-500">
                                    <SelectValue placeholder="All companies" />
                                </SelectTrigger>
                                <SelectContent>
                                    {companies.map((company) => (
                                        <SelectItem key={company.id} value={company.id}>
                                            {company.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <Button
                        className="w-auto h-11"
                        disabled={isSuperAdmin && !companyId}
                        onClick={() => {
                            setEditingRole(null);
                            setFormOpen(true);
                        }}
                    >
                        <Plus className="w-5 h-5" />
                        Add Role
                    </Button>
                </CardHeader>

                <CardContent className="card-body p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                        </div>
                    ) : roles.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-16 text-center">
                            <ShieldAlert className="w-8 h-8 text-neutral-400" />
                            <p className="text-neutral-500 dark:text-neutral-300">
                                {isSuperAdmin && !companyId ? "Select a company to manage its roles." : "No roles found. Create one to get started."}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Permissions</TableHead>
                                        <TableHead>Users</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {roles.map((role) => (
                                        <TableRow key={role.id}>
                                            <TableCell className="font-medium">
                                                {role.displayName}
                                                {role.isSystem && <Badge variant="outline" className="ml-2 h-6 px-2 text-xs">System</Badge>}
                                            </TableCell>
                                            <TableCell className="text-neutral-500 dark:text-neutral-400 max-w-[280px] truncate">
                                                {role.description || "—"}
                                            </TableCell>
                                            <TableCell>{role.permissions?.length ?? 0}</TableCell>
                                            <TableCell>{role._count?.users ?? 0}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Edit ${role.displayName}`}
                                                        disabled={role.isSystem}
                                                        onClick={() => {
                                                            setEditingRole(role);
                                                            setFormOpen(true);
                                                        }}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Delete ${role.displayName}`}
                                                        disabled={role.isSystem || (role._count?.users ?? 0) > 0}
                                                        onClick={() => setRoleToDelete(role)}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <RoleFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                role={editingRole}
                permissions={permissions}
                companyId={isSuperAdmin ? companyId : actor?.companyId ?? undefined}
                onSaved={fetchRoles}
            />

            <ConfirmDialog
                open={!!roleToDelete}
                onOpenChange={(open) => !open && setRoleToDelete(null)}
                title="Delete role"
                description={`Are you sure you want to delete "${roleToDelete?.displayName}"? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDelete}
            />
        </>
    );
};

export default RolesList;
