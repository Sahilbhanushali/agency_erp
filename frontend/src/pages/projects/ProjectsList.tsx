import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Pagination from "@/components/shared/Pagination";
import ProjectsListTable from "@/components/tables/ProjectsListTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { Company } from "@/types/company";
import type { Project, ProjectStatus } from "@/types/project";
import { Loader2, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const STATUS_OPTIONS: (ProjectStatus | "ALL")[] = ["ALL", "DRAFT", "ACTIVE", "ON_HOLD", "IN_REVIEW", "COMPLETED", "ARCHIVED", "CANCELLED"];

const ProjectsList = () => {
    const navigate = useNavigate();
    const { user: actor } = useAuth();
    const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";
    const [projects, setProjects] = useState<Project[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [companyId, setCompanyId] = useState<string | undefined>(actor?.companyId ?? undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchProjects = () => {
        setIsLoading(true);
        const query = companyId ? `?companyId=${companyId}` : "";
        api
            .get<Project[]>(`/projects${query}`)
            .then(setProjects)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load projects."))
            .finally(() => setIsLoading(false));
    };

    useEffect(fetchProjects, [companyId]);

    useEffect(() => {
        if (isSuperAdmin) {
            api.get<Company[]>("/companies").then(setCompanies).catch(() => toast.error("Failed to load companies."));
        }
    }, [isSuperAdmin]);

    const filteredProjects = useMemo(() => {
        const query = search.trim().toLowerCase();
        return projects.filter((project) => {
            const matchesStatus = status === "ALL" || project.status === status;
            const matchesSearch = !query || project.title.toLowerCase().includes(query) || project.client.name.toLowerCase().includes(query);
            return matchesStatus && matchesSearch;
        });
    }, [projects, search, status]);

    useEffect(() => setPage(1), [search, status, pageSize]);

    const paginatedProjects = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredProjects.slice(start, start + pageSize);
    }, [filteredProjects, page, pageSize]);

    const handleDelete = async () => {
        if (!projectToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/projects/${projectToDelete.id}`);
            toast.success("Project deleted.");
            setProjects((current) => current.filter((project) => project.id !== projectToDelete.id));
            setProjectToDelete(null);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete project.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Projects" text="Projects List" />

            <Card className="card h-full !p-0 !block border-0 overflow-hidden mb-6">
                <CardHeader className="border-b border-neutral-200 dark:border-slate-600 !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                    <div className="flex items-center flex-wrap gap-3">
                        <div className="relative">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <Input
                                placeholder="Search title or client..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="ps-9 h-11 w-[220px] border border-neutral-300 dark:border-slate-500"
                            />
                        </div>

                        <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus | "ALL")}>
                            <SelectTrigger className="min-w-[150px] h-11 dark:bg-slate-700 border border-slate-300 dark:border-slate-500">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option === "ALL" ? "All Status" : option.replace("_", " ")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {isSuperAdmin && (
                            <Select value={companyId ?? "ALL"} onValueChange={(value) => setCompanyId(value === "ALL" ? undefined : value)}>
                                <SelectTrigger className="min-w-[180px] h-11 dark:bg-slate-700 border border-slate-300 dark:border-slate-500">
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
                    </div>

                    <Button className="w-auto h-11" asChild>
                        <Link to="/projects-list/create">
                            <Plus className="w-5 h-5" />
                            Add New Project
                        </Link>
                    </Button>
                </CardHeader>

                <CardContent className="card-body p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">No projects found.</p>
                    ) : (
                        <>
                            <ProjectsListTable
                                projects={paginatedProjects}
                                onView={(project) => navigate(`/projects-list/${project.id}`)}
                                onEdit={(project) => navigate(`/projects-list/${project.id}/edit`)}
                                onDelete={setProjectToDelete}
                            />

                            <Pagination
                                page={page}
                                pageSize={pageSize}
                                total={filteredProjects.length}
                                onPageChange={setPage}
                                onPageSizeChange={setPageSize}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={!!projectToDelete}
                onOpenChange={(open) => !open && setProjectToDelete(null)}
                title="Delete project"
                description={`Are you sure you want to delete ${projectToDelete?.title}? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDelete}
            />
        </>
    );
};

export default ProjectsList;
