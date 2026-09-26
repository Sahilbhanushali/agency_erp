import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EmptyState from "@/components/shared/EmptyState";
import TableSkeleton from "@/components/shared/TableSkeleton";
import UsersListTable from "@/components/tables/UsersListTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/types/user";
import { Plus, Search, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

interface CompanyTeamPanelProps {
  companyId: string;
  companyName: string;
}

/** The people belonging to this company, managed without leaving it. */
export default function CompanyTeamPanel({
  companyId,
  companyName,
}: CompanyTeamPanelProps) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    api
      .list<User>(`/users?companyId=${companyId}`)
      .then(setUsers)
      .catch((error) =>
        toast.error(
          error instanceof ApiError ? error.message : "Failed to load team."
        )
      )
      .finally(() => setIsLoading(false));
  }, [companyId]);

  useEffect(load, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      `${user.firstName} ${user.lastName} ${user.email} ${user.role?.displayName ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [users, search]);

  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/users/${userToDelete.id}`);
      toast.success("User removed.");
      setUserToDelete(null);
      load();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not remove that user."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative max-w-xs w-full">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this company's team..."
            className="h-9 ps-8 text-xs"
          />
        </div>
        <Button
          size="sm"
          className="gap-1.5 h-9"
          // Carries the company through, so it is not re-picked on the next screen.
          onClick={() =>
            navigate(`/users-list/create?companyId=${companyId}`)
          }
        >
          <Plus className="w-4 h-4" />
          <span>Invite User</span>
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={search ? "No one matches that search" : "No team members yet"}
          description={
            search
              ? "Try a different name, email or role."
              : `Invite the first person into ${companyName}. They get a role at the same time, which is what decides what they can see.`
          }
          action={
            search
              ? undefined
              : {
                  label: "Invite User",
                  onClick: () =>
                    navigate(`/users-list/create?companyId=${companyId}`),
                }
          }
        />
      ) : (
        <UsersListTable
          users={filtered}
          onView={(user) => navigate(`/users-list/${user.id}`)}
          onEdit={(user) => navigate(`/users-list/${user.id}/edit`)}
          onDelete={setUserToDelete}
        />
      )}

      <ConfirmDialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
        title="Remove user"
        description={`Remove ${userToDelete?.firstName} ${userToDelete?.lastName} from ${companyName}? They lose access immediately.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
