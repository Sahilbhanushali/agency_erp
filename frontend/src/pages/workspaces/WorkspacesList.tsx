import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Pagination from "@/components/shared/Pagination";
import WorkspacesListTable from "@/components/tables/WorkspacesListTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { Company } from "@/types/company";
import type { Project } from "@/types/project";
import type { Workspace } from "@/types/workspace";
import { Loader2, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const WorkspacesList = () => {
    const navigate = useNavigate();
    const { user: actor } = useAuth();
    const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [companyId, setCompanyId] = useState<string | undefined>(actor?.companyId ?? undefined);
    const [projectId, setProjectId] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchWorkspaces = () => {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (companyId) params.set("companyId", companyId);
        if (projectId) params.set("projectId", projectId);
        const query = params.toString() ? `?${params.toString()}` : "";
        api
            .get<Workspace[]>(`/workspaces${query}`)
            .then(setWorkspaces)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load workspaces."))
            .finally(() => setIsLoading(false));
    };

    useEffect(fetchWorkspaces, [companyId, projectId]);

    useEffect(() => {
        if (isSuperAdmin) {
            api.get<Company[]>("/companies").then(setCompanies).catch(() => toast.error("Failed to load companies."));
        }
    }, [isSuperAdmin]);

    useEffect(() => {
        setProjectId(undefined);
        if (!companyId) {
            setProjects([]);
            return;
        }
        api.get<Project[]>(`/projects?companyId=${companyId}`).then(setProjects).catch(() => toast.error("Failed to load projects."));
    }, [companyId]);

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

    const handleDelete = async () => {
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

    return (
        <>
            <Breadcrumb title="Workspaces" text="Workspaces List" />

            <Card className="card h-full !p-0 !block border-0 overflow-hidden mb-6">
                <CardHeader className="border-b border-border !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                    <div className="flex items-center flex-wrap gap-3">
                        <div className="relative">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <Input
                                placeholder="Search name..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="ps-9 h-11 w-[220px]"
                            />
                        </div>

                        {isSuperAdmin && (
                            <Select value={companyId ?? "ALL"} onValueChange={(value) => setCompanyId(value === "ALL" ? undefined : value)}>
                                <SelectTrigger className="min-w-[180px] h-11">
                                    <SelectValue placeholder="All companies" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Companies</SelectItem>
                                    {companies.map((company) => (
                                        <SelectItem key={company.id} value={company.id}>
                                            {company.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <Select value={projectId ?? "ALL"} onValueChange={(value) => setProjectId(value === "ALL" ? undefined : value)} disabled={!projects.length}>
                            <SelectTrigger className="min-w-[180px] h-11">
                                <SelectValue placeholder="All projects" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Projects</SelectItem>
                                {projects.map((project) => (
                                    <SelectItem key={project.id} value={project.id}>
                                        {project.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button className="w-auto h-11" asChild>
                        <Link to="/workspaces-list/create">
                            <Plus className="w-5 h-5" />
                            Add New Workspace
                        </Link>
                    </Button>
                </CardHeader>

                <CardContent className="card-body p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                        </div>
                    ) : filteredWorkspaces.length === 0 ? (
                        <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">No workspaces found.</p>
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
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={!!workspaceToDelete}
                onOpenChange={(open) => !open && setWorkspaceToDelete(null)}
                title="Delete workspace"
                description={`Are you sure you want to delete ${workspaceToDelete?.name}? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDelete}
            />
        </>
    );
};

export default WorkspacesList;
