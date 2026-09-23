import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Pagination from "@/components/shared/Pagination";
import WorkspacesListTable from "@/components/tables/WorkspacesListTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { Project, ProjectStatus } from "@/types/project";
import type { Workspace } from "@/types/workspace";
import {
    Briefcase,
    Calendar,
    DollarSign,
    Loader2,
    Pencil,
    Plus,
    Search,
    User as UserIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import TasksPanel from "@/pages/tasks/components/TasksPanel";
import WorkspaceFormDialog from "../components/WorkspaceFormDialog";

const STATUS_STYLES: Record<ProjectStatus, string> = {
    DRAFT: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30",
    ACTIVE: "bg-success/15 text-success border-success/30",
    ON_HOLD: "bg-warning/20 text-warning-foreground dark:text-warning border-warning/40",
    IN_REVIEW: "bg-info/15 text-info border-info/30",
    COMPLETED: "bg-success/15 text-success border-success/30",
    ARCHIVED: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30",
    CANCELLED: "bg-destructive/15 text-destructive border-destructive/30",
};

const ProjectDetails = () => {
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
    const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!id) return;
        api
            .get<Project>(`/projects/${id}`)
            .then(setProject)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load project."))
            .finally(() => setIsLoading(false));
    }, [id]);

    const fetchWorkspaces = () => {
        if (!id) return;
        setIsLoadingWorkspaces(true);
        api
            .get<Workspace[]>(`/workspaces?projectId=${id}`)
            .then(setWorkspaces)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load workspaces."))
            .finally(() => setIsLoadingWorkspaces(false));
    };

    useEffect(fetchWorkspaces, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    const filteredWorkspaces = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return workspaces;
        return workspaces.filter((workspace) => workspace.name.toLowerCase().includes(query));
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
            toast.success("Workspace deleted.");
            setWorkspaces((current) => current.filter((workspace) => workspace.id !== workspaceToDelete.id));
            setWorkspaceToDelete(null);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete workspace.");
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
        );
    }

    if (!project) {
        return <p className="text-center text-neutral-500 py-24">Project not found.</p>;
    }

    return (
        <>
            <Breadcrumb title={project.title} text="Project Details" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <Card className="lg:col-span-1 h-fit">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.colorHex ?? "#94a3b8" }} />
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[project.status]}`}>
                                {project.status.replace("_", " ")}
                            </span>
                        </div>
                        <Button variant="outline" size="sm" className="h-9 rounded-lg" asChild>
                            <Link to={`/projects-list/${project.id}/edit`}>
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200">
                            <Briefcase className="w-4 h-4 text-neutral-400 shrink-0" />
                            <span>{project.client.name}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200">
                            <UserIcon className="w-4 h-4 text-neutral-400 shrink-0" />
                            <span>{project.manager.firstName} {project.manager.lastName}</span>
                        </div>
                        {project.deadline && (
                            <div className="flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200">
                                <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span>Due {project.deadline.slice(0, 10)}</span>
                            </div>
                        )}
                        {project.budget && (
                            <div className="flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200">
                                <DollarSign className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span>{project.currency} {project.budget}</span>
                            </div>
                        )}
                        {project.description && (
                            <p className="text-neutral-500 dark:text-neutral-400 pt-1 border-t border-border mt-3">
                                {project.description}
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 !p-0 !block border-0 overflow-hidden">
                    <CardHeader className="border-b border-border !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                        <div className="flex items-center flex-wrap gap-3">
                            <h6 className="text-base font-semibold text-neutral-900 dark:text-white shrink-0">Workspaces</h6>
                            <div className="relative">
                                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <Input
                                    placeholder="Search workspaces..."
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="ps-9 h-10 w-[200px]"
                                />
                            </div>
                        </div>

                        <Button className="w-auto h-10" onClick={() => setFormOpen(true)}>
                            <Plus className="w-4 h-4" />
                            Add New Workspace
                        </Button>
                    </CardHeader>

                    <CardContent className="p-6">
                        {isLoadingWorkspaces ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                            </div>
                        ) : filteredWorkspaces.length === 0 ? (
                            <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">
                                {workspaces.length === 0 ? "No workspaces yet. Add the first one." : "No workspaces match your search."}
                            </p>
                        ) : (
                            <>
                                <WorkspacesListTable
                                    workspaces={paginatedWorkspaces}
                                    onView={(workspace) => navigate(`/workspaces-list/${workspace.id}`)}
                                    onEdit={(workspace) => navigate(`/workspaces-list/${workspace.id}/edit`)}
                                    onDelete={setWorkspaceToDelete}
                                />

                                <Pagination
                                    page={page}
                                    pageSize={pageSize}
                                    total={filteredWorkspaces.length}
                                    onPageChange={setPage}
                                    onPageSizeChange={setPageSize}
                                    pageSizeOptions={[5, 10, 25]}
                                />
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {id && (
                <div className="mt-6">
                    <TasksPanel projectId={id} emptyText="No tasks in this project yet." />
                </div>
            )}

            <ConfirmDialog
                open={!!workspaceToDelete}
                onOpenChange={(open) => !open && setWorkspaceToDelete(null)}
                title="Delete workspace"
                description={`Are you sure you want to delete ${workspaceToDelete?.name}? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDeleteWorkspace}
            />

            {id && (
                <WorkspaceFormDialog
                    open={formOpen}
                    onOpenChange={setFormOpen}
                    projectId={id}
                    onCreated={(workspace) => setWorkspaces((current) => [...current, workspace])}
                />
            )}
        </>
    );
};

export default ProjectDetails;
