import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import ProjectsListTable from "@/components/tables/ProjectsListTable";
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
import type { Project, ProjectStatus } from "@/types/project";
import { FolderKanban, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const STATUS_OPTIONS: (ProjectStatus | "ALL")[] = [
  "ALL",
  "DRAFT",
  "ACTIVE",
  "ON_HOLD",
  "IN_REVIEW",
  "COMPLETED",
  "ARCHIVED",
  "CANCELLED",
];

export default function ProjectsList() {
  const navigate = useNavigate();
  const { user: actor } = useAuth();
  const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string | undefined>(
    actor?.companyId ?? undefined
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debouncedSearch = useDebounced(search);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (companyId) params.set("companyId", companyId);
    if (status !== "ALL") params.set("status", status);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    return params.toString();
  }, [page, pageSize, companyId, status, debouncedSearch]);

  const {
    data: projects,
    total,
    isLoading,
    refetch,
  } = usePaginatedList<Project>("/projects", query, "Failed to load projects.");

  useEffect(() => {
    if (isSuperAdmin) {
      api
        .list<Company>("/companies")
        .then(setCompanies)
        .catch(() => toast.error("Failed to load companies."));
    }
  }, [isSuperAdmin]);

  useEffect(() => setPage(1), [debouncedSearch, pageSize, companyId, status]);


  const handleDelete = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/projects/${projectToDelete.id}`);
      toast.success("Project deleted successfully.");
      refetch();
      setProjectToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to delete project."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Active client engagements, deliverables, workspaces, and team boards."
        breadcrumbs={[{ label: "Projects" }]}
        badge={
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            {total} total
          </span>
        }
        actions={
          (isSuperAdmin || can(actor, "projects:create")) && (
            <Button asChild size="sm" className="gap-1.5 h-9 rounded-lg shadow-xs">
              <Link to="/projects-list/create">
                <Plus className="w-4 h-4" />
                <span>New Project</span>
              </Link>
            </Button>
          )
        }
      />

      <DataTableShell
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search projects by title or client...",
        }}
        filters={
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as ProjectStatus | "ALL")}
            >
              <SelectTrigger className="w-36 h-9 text-xs bg-background">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-xs">
                    {opt === "ALL" ? "All Statuses" : opt.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
          </div>
        }
        isLoading={isLoading}
        isEmpty={projects.length === 0}
        emptyState={{
          icon: FolderKanban,
          title: search || status !== "ALL" ? "No matching projects" : "No projects created yet",
          description: search || status !== "ALL"
            ? "Try resetting your search query or status filter."
            : "Start by creating a new project for one of your clients.",
          action:
            !search && status === "ALL" && (isSuperAdmin || can(actor, "projects:create"))
              ? {
                  label: "Create Project",
                  href: "/projects-list/create",
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
        <ProjectsListTable
          projects={projects}
          onView={(project) => navigate(`/projects-list/${project.id}`)}
          onEdit={(project) => navigate(`/projects-list/${project.id}/edit`)}
          onDelete={setProjectToDelete}
        />
      </DataTableShell>

      <ConfirmDialog
        open={!!projectToDelete}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
        title="Delete Project"
        description={`Are you sure you want to delete ${projectToDelete?.title}? Associated workspaces, task boards, and member assignments will be removed.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
