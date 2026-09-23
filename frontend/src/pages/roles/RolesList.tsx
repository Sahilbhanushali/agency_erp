import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import RowActions from "@/components/tables/RowActions";
import { cellClass, headClass, rowClass } from "@/components/tables/table-styles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { Permission, Role } from "@/types/user";
import { Lock, Plus, Shield, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
    const [search, setSearch] = useState("");
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

    const filteredRoles = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return roles;
        return roles.filter(
            (role) =>
                role.displayName.toLowerCase().includes(query) ||
                role.name.toLowerCase().includes(query) ||
                (role.description && role.description.toLowerCase().includes(query))
        );
    }, [roles, search]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Roles & Permissions"
                description="Manage user roles, access control levels, and granular feature permissions across modules."
                badge={roles.length ? `${roles.length} roles` : undefined}
                breadcrumbs={[
                    { label: "Settings", href: "/setting/company" },
                    { label: "Roles & Permissions" },
                ]}
                actions={
                    <Button
                        size="sm"
                        disabled={isSuperAdmin && !companyId}
                        onClick={() => {
                            setEditingRole(null);
                            setFormOpen(true);
                        }}
                    >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Add Role
                    </Button>
                }
            />

            <DataTableShell
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: "Search roles by name or key...",
                }}
                filters={
                    isSuperAdmin ? (
                        <Select value={companyId} onValueChange={setCompanyId}>
                            <SelectTrigger className="h-9 w-[200px] text-xs">
                                <SelectValue placeholder="All companies" />
                            </SelectTrigger>
                            <SelectContent>
                                {companies.map((company) => (
                                    <SelectItem key={company.id} value={company.id} className="text-xs">
                                        {company.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : null
                }
                isLoading={isLoading}
                isEmpty={filteredRoles.length === 0}
                emptyState={{
                    icon: Shield,
                    title: search ? "No roles match your search" : "No roles found",
                    description: search
                        ? `No roles matched "${search}". Try clearing your search keyword.`
                        : isSuperAdmin && !companyId
                        ? "Select a company to view and configure its roles."
                        : "Create custom roles to assign specific capabilities to your team.",
                    action:
                        !search && (!isSuperAdmin || companyId)
                            ? {
                                  label: "Create First Role",
                                  onClick: () => {
                                      setEditingRole(null);
                                      setFormOpen(true);
                                  },
                              }
                            : undefined,
                }}
            >
                <div className="overflow-x-auto">
                    <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className={`${headClass} min-w-[220px]`}>Role</TableHead>
                                    <TableHead className={`${headClass} min-w-[280px]`}>Description</TableHead>
                                    <TableHead className={`${headClass} text-center w-[130px]`}>Permissions</TableHead>
                                    <TableHead className={`${headClass} text-center w-[110px]`}>Assigned Users</TableHead>
                                    <TableHead className={`${headClass} text-right w-[100px]`}>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRoles.map((role) => {
                                    const permissionCount = role.permissions?.length ?? 0;
                                    const userCount = role._count?.users ?? 0;

                                    return (
                                        <TableRow key={role.id} className={rowClass}>
                                            <TableCell className={cellClass}>
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                        {role.isSystem ? (
                                                            <ShieldCheck className="w-4 h-4" />
                                                        ) : (
                                                            <Shield className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-foreground text-sm">
                                                                {role.displayName}
                                                            </span>
                                                            {role.isSystem && (
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="text-[10px] px-1.5 py-0 h-4.5 font-normal tracking-wide uppercase bg-muted text-muted-foreground border-border"
                                                                >
                                                                    System
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <span className="font-mono text-[11px] text-muted-foreground">
                                                            {role.name}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className={`${cellClass} text-muted-foreground text-sm`}>
                                                {role.description || "—"}
                                            </TableCell>
                                            <TableCell className={`${cellClass} text-center`}>
                                                <Badge
                                                    variant="outline"
                                                    className="font-mono text-xs px-2 py-0.5 rounded-md border-border bg-muted/40 font-medium"
                                                >
                                                    {permissionCount} allowed
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={`${cellClass} text-center`}>
                                                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                                    <Users className="w-3.5 h-3.5" />
                                                    {userCount}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`${cellClass} text-right`}>
                                                {role.isSystem ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 font-normal">
                                                        <Lock className="w-3 h-3" />
                                                        Locked
                                                    </span>
                                                ) : (
                                                    <RowActions
                                                        label={role.displayName}
                                                        onEdit={() => {
                                                            setEditingRole(role);
                                                            setFormOpen(true);
                                                        }}
                                                        onDelete={
                                                            userCount === 0
                                                                ? () => setRoleToDelete(role)
                                                                : undefined
                                                        }
                                                    />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
            </DataTableShell>

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
        </div>
    );
};

export default RolesList;
