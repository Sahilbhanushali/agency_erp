import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EmptyState from "@/components/shared/EmptyState";
import TableSkeleton from "@/components/shared/TableSkeleton";
import RowActions from "@/components/tables/RowActions";
import { cellClass, headClass, rowClass } from "@/components/tables/table-styles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import type { Permission, Role } from "@/types/user";
import { Plus, Shield, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import RoleFormDialog from "@/pages/roles/components/RoleFormDialog";

interface CompanyRolesPanelProps {
  companyId: string;
  companyName: string;
}

/**
 * Roles belong to a company, so this is the least ambiguous place to manage them:
 * the company is already chosen, which is what the standalone Roles page has to ask for.
 */
export default function CompanyRolesPanel({
  companyId,
  companyName,
}: CompanyRolesPanelProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    api
      .list<Role>(`/roles?companyId=${companyId}`)
      .then(setRoles)
      .catch((error) =>
        toast.error(
          error instanceof ApiError ? error.message : "Failed to load roles."
        )
      )
      .finally(() => setIsLoading(false));
  }, [companyId]);

  useEffect(load, [load]);

  useEffect(() => {
    api
      .get<Permission[]>("/permissions")
      .then(setPermissions)
      .catch(() => undefined);
  }, []);

  const openCreate = () => {
    setEditingRole(null);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!roleToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/roles/${roleToDelete.id}`);
      toast.success("Role deleted.");
      setRoleToDelete(null);
      load();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not delete that role."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          What each person in {companyName} is allowed to see and do.
        </p>
        <Button size="sm" className="gap-1.5 h-9" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          <span>Add Role</span>
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} columns={4} />
      ) : roles.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No roles yet"
          description={`Create a role for ${companyName}, tick the permissions it should carry, then assign it when you invite someone.`}
          action={{ label: "Add Role", onClick: openCreate }}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={headClass}>Role</TableHead>
              <TableHead className={headClass}>Permissions</TableHead>
              <TableHead className={headClass}>People</TableHead>
              <TableHead className={`${headClass} text-end pe-6`}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
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
                            className="text-[10px] px-1.5 py-0 h-4.5 font-normal uppercase tracking-wide bg-muted text-muted-foreground border-border"
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
                <TableCell className={`${cellClass} text-xs`}>
                  {role.permissions?.length ?? 0} of {permissions.length}
                </TableCell>
                <TableCell className={`${cellClass} text-xs`}>
                  {role._count?.users ?? 0}
                </TableCell>
                <TableCell className={`${cellClass} text-end pe-6`}>
                  <RowActions
                    label={role.displayName}
                    onEdit={() => {
                      setEditingRole(role);
                      setFormOpen(true);
                    }}
                    onDelete={
                      role.isSystem ? undefined : () => setRoleToDelete(role)
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <RoleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        role={editingRole}
        permissions={permissions}
        companyId={companyId}
        onSaved={load}
      />

      <ConfirmDialog
        open={!!roleToDelete}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
        title="Delete role"
        description={`Delete "${roleToDelete?.displayName}"? Anyone holding it loses those permissions.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
