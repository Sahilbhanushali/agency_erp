import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import UsersListTable from "@/components/tables/UsersListTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounced } from "@/hooks/use-debounced";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { api, ApiError } from "@/lib/api";
import type { User, UserStatus } from "@/types/user";
import { LayoutGrid, List, Plus, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UsersGridView from "./components/UsersGridView";

const STATUS_OPTIONS: (UserStatus | "ALL")[] = [
  "ALL",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "INVITED",
];

export default function UsersList() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debouncedSearch = useDebounced(search);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (status !== "ALL") params.set("status", status);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    return params.toString();
  }, [page, pageSize, status, debouncedSearch]);

  const {
    data: users,
    total,
    isLoading,
    refetch,
  } = usePaginatedList<User>("/users", query, "Failed to load users.");

  useEffect(() => setPage(1), [debouncedSearch, pageSize, status]);


  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/users/${userToDelete.id}`);
      toast.success("User deleted successfully.");
      refetch();
      setUserToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to delete user."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Members"
        description="Directory of agency staff, employee profiles, department assignments, and system permissions."
        breadcrumbs={[{ label: "Team" }]}
        badge={
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            {users.length} members
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-md"
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-md"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>

            <Button asChild size="sm" className="gap-1.5 h-9 rounded-lg shadow-xs">
              <Link to="/users-list/create">
                <Plus className="w-4 h-4" />
                <span>Invite User</span>
              </Link>
            </Button>
          </div>
        }
      />

      <DataTableShell
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search team by name, email, department...",
        }}
        filters={
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as UserStatus | "ALL")}
          >
            <SelectTrigger className="w-36 h-9 text-xs bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-xs">
                  {opt === "ALL" ? "All Statuses" : opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        isLoading={isLoading}
        isEmpty={users.length === 0}
        emptyState={{
          icon: UsersRound,
          title: search || status !== "ALL" ? "No matching team members" : "No users created yet",
          description: search || status !== "ALL"
            ? "Try resetting your search query or status filter."
            : "Add team members and staff to collaborate across workspaces.",
          action:
            !search && status === "ALL"
              ? {
                  label: "Invite Member",
                  href: "/users-list/create",
                  icon: Plus,
                }
              : undefined,
        }}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      >
        {viewMode === "list" ? (
          <UsersListTable
            users={users}
            onView={(user) => navigate(`/users-list/${user.id}`)}
            onEdit={(user) => navigate(`/users-list/${user.id}/edit`)}
            onDelete={setUserToDelete}
          />
        ) : (
          <div className="p-4 sm:p-6">
            <UsersGridView
              users={users}
              onView={(user) => navigate(`/users-list/${user.id}`)}
              onEdit={(user) => navigate(`/users-list/${user.id}/edit`)}
              onDelete={setUserToDelete}
            />
          </div>
        )}
      </DataTableShell>

      <ConfirmDialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
        title="Delete Team Member"
        description={`Are you sure you want to remove ${userToDelete?.firstName} ${userToDelete?.lastName}? They will immediately lose access to all agency workspaces.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
