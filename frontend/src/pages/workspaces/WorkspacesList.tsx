import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import WorkspacesListTable from "@/components/tables/WorkspacesListTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useDebounced } from "@/hooks/use-debounced";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { api, ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";
import type { Company } from "@/types/company";
import type { Project } from "@/types/project";
import type { Workspace } from "@/types/workspace";
import { LayoutGrid, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function WorkspacesList() {
  const navigate = useNavigate();
  const { user: actor } = useAuth();
  const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";

  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [companyId, setCompanyId] = useState<string | undefined>(
    actor?.companyId ?? undefined
  );
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const debouncedSearch = useDebounced(search);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (companyId) params.set("companyId", companyId);
    if (projectId) params.set("projectId", projectId);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    return params.toString();
  }, [page, pageSize, companyId, projectId, debouncedSearch]);

  const {
    data: workspaces,
    total,
    isLoading,
    refetch,
  } = usePaginatedList<Workspace>("/workspaces", query, "Failed to load workspaces.");

  useEffect(() => {
    if (isSuperAdmin) {
      api
        .list<Company>("/companies")
        .then(setCompanies)
        .catch(() => toast.error("Failed to load companies."));
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    setProjectId(undefined);
    if (!companyId) {
      setProjects([]);
      return;
    }
    api
      .list<Project>(`/projects?companyId=${companyId}`)
      .then(setProjects)
      .catch(() => toast.error("Failed to load projects."));
  }, [companyId]);

  useEffect(() => setPage(1), [debouncedSearch, pageSize, companyId, projectId]);


  const handleDelete = async () => {
    if (!workspaceToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/workspaces/${workspaceToDelete.id}`);
      toast.success("Workspace deleted successfully.");
      refetch();
      setWorkspaceToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to delete workspace."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspaces"
        description="Collaboration spaces, deliverable boards, and cross-functional team channels."
        breadcrumbs={[{ label: "Workspaces" }]}
        badge={
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            {workspaces.length} workspaces
          </span>
        }
        actions={
          (isSuperAdmin || can(actor, "workspaces:create")) && (
            <Button asChild size="sm" className="gap-1.5 h-9 rounded-lg shadow-xs">
              <Link to="/workspaces-list/create">
                <Plus className="w-4 h-4" />
                <span>New Workspace</span>
              </Link>
            </Button>
          )
        }
      />

      <DataTableShell
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search workspaces by name...",
        }}
        filters={
          <div className="flex items-center gap-2 flex-wrap">
            {isSuperAdmin && (
              <Select
                value={companyId ?? "ALL"}
                onValueChange={(value) =>
                  setCompanyId(value === "ALL" ? undefined : value)
                }
              >
                <SelectTrigger className="w-44 h-9 text-xs bg-background">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">
                    All Companies
                  </SelectItem>
                  {companies.map((company) => (
                    <SelectItem
                      key={company.id}
                      value={company.id}
                      className="text-xs"
                    >
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {projects.length > 0 && (
              <Select
                value={projectId ?? "ALL"}
                onValueChange={(value) =>
                  setProjectId(value === "ALL" ? undefined : value)
                }
              >
                <SelectTrigger className="w-48 h-9 text-xs bg-background">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">
                    All Projects
                  </SelectItem>
                  {projects.map((project) => (
                    <SelectItem
                      key={project.id}
                      value={project.id}
                      className="text-xs"
                    >
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        }
        isLoading={isLoading}
        isEmpty={workspaces.length === 0}
        emptyState={{
          icon: LayoutGrid,
          title: search ? "No matching workspaces" : "No workspaces created yet",
          description: search
            ? "Try resetting your search query or filters."
            : "Workspaces help your agency compartmentalize tasks, deliverables, and team members.",
          action:
            !search && (isSuperAdmin || can(actor, "workspaces:create"))
              ? {
                  label: "Create Workspace",
                  href: "/workspaces-list/create",
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
        <WorkspacesListTable
          workspaces={workspaces}
          onView={(workspace) => navigate(`/workspaces-list/${workspace.id}`)}
          onEdit={(workspace) => navigate(`/workspaces-list/${workspace.id}/edit`)}
          onDelete={setWorkspaceToDelete}
        />
      </DataTableShell>

      <ConfirmDialog
        open={!!workspaceToDelete}
        onOpenChange={(open) => !open && setWorkspaceToDelete(null)}
        title="Delete Workspace"
        description={`Are you sure you want to delete ${workspaceToDelete?.name}? Its task boards and member roles will be deleted.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
