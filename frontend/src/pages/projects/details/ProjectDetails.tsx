import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import WorkspacesListTable from "@/components/tables/WorkspacesListTable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import TasksPanel from "@/pages/tasks/components/TasksPanel";
import type { Project } from "@/types/project";
import type { Workspace } from "@/types/workspace";
import {
  Briefcase,
  Calendar,
  CreditCard,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import WorkspaceFormDialog from "../components/WorkspaceFormDialog";

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [formOpen, setFormOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get<Project>(`/projects/${id}`)
      .then(setProject)
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to load project.")
      )
      .finally(() => setIsLoading(false));
  }, [id]);

  const fetchWorkspaces = () => {
    if (!id) return;
    setIsLoadingWorkspaces(true);
    api
      .get<Workspace[]>(`/workspaces?projectId=${id}`)
      .then(setWorkspaces)
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to load workspaces.")
      )
      .finally(() => setIsLoadingWorkspaces(false));
  };

  useEffect(fetchWorkspaces, [id]);

  const filteredWorkspaces = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return workspaces;
    return workspaces.filter((workspace) =>
      workspace.name.toLowerCase().includes(query)
    );
  }, [workspaces, search]);

  useEffect(() => setPage(1), [search, pageSize]);

  const paginatedWorkspaces = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredWorkspaces.slice(start, start + pageSize);
  }, [filteredWorkspaces, page, pageSize]);

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/workspaces/${workspaceToDelete.id}`);
      toast.success("Workspace deleted successfully.");
      setWorkspaces((current) =>
        current.filter((workspace) => workspace.id !== workspaceToDelete.id)
      );
      setWorkspaceToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to delete workspace."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground">
        Project not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.title}
        description={`Client: ${project.client?.name ?? "—"}`}
        breadcrumbs={[
          { label: "Projects", href: "/projects-list" },
          { label: project.title },
        ]}
        badge={<StatusBadge status={project.status} />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 rounded-lg"
            >
              <Link to={`/projects-list/${project.id}/edit`}>
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Project</span>
              </Link>
            </Button>
            <Button
              size="sm"
              className="gap-1.5 h-9 rounded-lg shadow-xs"
              onClick={() => setFormOpen(true)}
            >
              <Plus className="w-4 h-4" />
              <span>New Workspace</span>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Project Metadata */}
        <Card className="lg:col-span-1 p-5 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-border/70">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs"
              style={{ backgroundColor: project.colorHex ?? "var(--primary)" }}
            >
              {project.title[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {project.title}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {project.client?.name}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2.5 text-foreground/85">
              <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
              <Link
                to={`/clients-list/${project.clientId}`}
                className="text-primary hover:underline font-medium"
              >
                {project.client?.name}
              </Link>
            </div>

            <div className="flex items-center gap-2.5 text-foreground/85">
              <UserIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>
                Manager:{" "}
                <span className="font-medium text-foreground">
                  {project.manager?.firstName} {project.manager?.lastName}
                </span>
              </span>
            </div>

            {project.deadline && (
              <div className="flex items-center gap-2.5 text-foreground/85">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>
                  Target Deadline:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {project.deadline.slice(0, 10)}
                  </span>
                </span>
              </div>
            )}

            {project.budget && (
              <div className="flex items-center gap-2.5 text-foreground/85">
                <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>
                  Budget:{" "}
                  <span className="font-mono font-bold text-foreground">
                    {project.currency} {Number(project.budget).toLocaleString()}
                  </span>
                </span>
              </div>
            )}
          </div>

          {project.description && (
            <div className="pt-3 border-t border-border/70">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Description
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {project.description}
              </p>
            </div>
          )}
        </Card>

        {/* Right: Workspaces inside this project */}
        <div className="lg:col-span-2">
          <DataTableShell
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search workspaces...",
            }}
            actions={
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setFormOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Workspace</span>
              </Button>
            }
            isLoading={isLoadingWorkspaces}
            isEmpty={filteredWorkspaces.length === 0}
            emptyState={{
              icon: LayoutGrid,
              title: search ? "No matching workspaces" : "No workspaces added",
              description: search
                ? "Try searching with a different term."
                : "Workspaces let you break this project into distinct departments, channels, or deliverables.",
              action: {
                label: "Add Workspace",
                onClick: () => setFormOpen(true),
                icon: Plus,
              },
            }}
            pagination={{
              page,
              pageSize,
              total: filteredWorkspaces.length,
              onPageChange: setPage,
              onPageSizeChange: setPageSize,
              pageSizeOptions: [5, 10, 25],
            }}
          >
            <WorkspacesListTable
              workspaces={paginatedWorkspaces}
              onView={(workspace) => navigate(`/workspaces-list/${workspace.id}`)}
              onEdit={(workspace) => navigate(`/workspaces-list/${workspace.id}/edit`)}
              onDelete={setWorkspaceToDelete}
            />
          </DataTableShell>
        </div>
      </div>

      {/* Embedded Tasks Board/List */}
      {id && (
        <div className="pt-2">
          <TasksPanel
            projectId={id}
            title={`${project.title} Tasks`}
            emptyText="No tasks created in this project yet."
          />
        </div>
      )}

      <ConfirmDialog
        open={!!workspaceToDelete}
        onOpenChange={(open) => !open && setWorkspaceToDelete(null)}
        title="Delete Workspace"
        description={`Are you sure you want to delete ${workspaceToDelete?.name}? This action cannot be undone.`}
        isLoading={isDeleting}
        onConfirm={handleDeleteWorkspace}
      />

      {id && (
        <WorkspaceFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          projectId={id}
          onCreated={(workspace) =>
            setWorkspaces((current) => [...current, workspace])
          }
        />
      )}
    </div>
  );
}
