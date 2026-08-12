import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Pagination from "@/components/shared/Pagination";
import InvoicesListTable from "@/components/tables/InvoicesListTable";
import ProjectsListTable from "@/components/tables/ProjectsListTable";
import QuotationsListTable from "@/components/tables/QuotationsListTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { Client } from "@/types/client";
import type { Invoice } from "@/types/invoice";
import type { Project } from "@/types/project";
import type { Quotation } from "@/types/quotation";
import {
    Building2,
    CreditCard,
    Globe,
    Loader2,
    Mail,
    Pencil,
    Phone,
    Plus,
    Presentation,
    Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ProjectFormDialog from "../components/ProjectFormDialog";

const ClientDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [formOpen, setFormOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [isLoadingQuotations, setIsLoadingQuotations] = useState(true);
    const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
    const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

    useEffect(() => {
        if (!id) return;
        api
            .get<Client>(`/clients/${id}`)
            .then(setClient)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load client."))
            .finally(() => setIsLoading(false));
    }, [id]);

    const fetchProjects = () => {
        if (!id) return;
        setIsLoadingProjects(true);
        api
            .get<Project[]>(`/projects?clientId=${id}`)
            .then(setProjects)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load projects."))
            .finally(() => setIsLoadingProjects(false));
    };

    useEffect(fetchProjects, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!id) return;
        setIsLoadingQuotations(true);
        api
            .get<Quotation[]>(`/quotations?clientId=${id}`)
            .then(setQuotations)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load quotations."))
            .finally(() => setIsLoadingQuotations(false));
    }, [id]);

    useEffect(() => {
        if (!id) return;
        setIsLoadingInvoices(true);
        api
            .get<Invoice[]>(`/invoices?clientId=${id}`)
            .then(setInvoices)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load invoices."))
            .finally(() => setIsLoadingInvoices(false));
    }, [id]);

    const filteredProjects = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return projects;
        return projects.filter((project) => project.title.toLowerCase().includes(query));
    }, [projects, search]);

    useEffect(() => setPage(1), [search, pageSize]);

    const paginatedProjects = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredProjects.slice(start, start + pageSize);
    }, [filteredProjects, page, pageSize]);

    const handleDeleteProject = async () => {
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

    const handleDeleteQuotation = async () => {
        if (!quotationToDelete) return;
        try {
            await api.delete(`/quotations/${quotationToDelete.id}`);
            toast.success("Quotation deleted.");
            setQuotations((current) => current.filter((quotation) => quotation.id !== quotationToDelete.id));
            setQuotationToDelete(null);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete quotation.");
        }
    };

    const handleDeleteInvoice = async () => {
        if (!invoiceToDelete) return;
        try {
            await api.delete(`/invoices/${invoiceToDelete.id}`);
            toast.success("Invoice deleted.");
            setInvoices((current) => current.filter((invoice) => invoice.id !== invoiceToDelete.id));
            setInvoiceToDelete(null);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete invoice.");
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
        );
    }

    if (!client) {
        return <p className="text-center text-neutral-500 py-24">Client not found.</p>;
    }

    return (
        <>
            <Breadcrumb title={client.name} text="Client Details" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <Card className="lg:col-span-1 h-fit">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-11 h-11 rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                                {client.name[0]?.toUpperCase()}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${client.isActive ? "bg-success/15 text-success border-success/30" : "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30"}`}>
                                {client.isActive ? "ACTIVE" : "INACTIVE"}
                            </span>
                        </div>
                        <Button variant="outline" size="sm" className="h-9 rounded-lg" asChild>
                            <Link to={`/clients-list/${client.id}/edit`}>
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200">
                            <Mail className="w-4 h-4 text-neutral-400 shrink-0" />
                            <span>{client.email}</span>
                        </div>
                        {client.phone && (
                            <div className="flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200">
                                <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span>{client.phone}</span>
                            </div>
                        )}
                        {client.industry && (
                            <div className="flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200">
                                <Building2 className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span>{client.industry}</span>
                            </div>
                        )}
                        {client.website && (
                            <div className="flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200">
                                <Globe className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span>{client.website}</span>
                            </div>
                        )}
                        {(client.gstNumber || client.panNumber) && (
                            <div className="flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200">
                                <CreditCard className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span>{[client.gstNumber, client.panNumber].filter(Boolean).join(" · ")}</span>
                            </div>
                        )}
                        {client.note && (
                            <p className="text-neutral-500 dark:text-neutral-400 pt-1 border-t border-border mt-3">
                                {client.note}
                            </p>
                        )}
                    </CardContent>
                </Card>

                <div className="lg:col-span-2">
                    <Tabs defaultValue="projects">
                        <TabsList className="h-11 p-1">
                            <TabsTrigger value="projects" className="h-full px-4">Projects</TabsTrigger>
                            <TabsTrigger value="quotations" className="h-full px-4">Quotations</TabsTrigger>
                            <TabsTrigger value="billing" className="h-full px-4">Billing</TabsTrigger>
                            <TabsTrigger value="pitch" className="h-full px-4">Pitch</TabsTrigger>
                        </TabsList>

                        <TabsContent value="projects" className="mt-4">
                            <Card className="!p-0 !block border-0 overflow-hidden">
                                <CardHeader className="border-b border-border !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                                    <div className="flex items-center flex-wrap gap-3">
                                        <h6 className="text-base font-semibold text-neutral-900 dark:text-white shrink-0">Projects</h6>
                                        <div className="relative">
                                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                            <Input
                                                placeholder="Search projects..."
                                                value={search}
                                                onChange={(event) => setSearch(event.target.value)}
                                                className="ps-9 h-10 w-[200px]"
                                            />
                                        </div>
                                    </div>

                                    <Button className="w-auto h-10" onClick={() => setFormOpen(true)}>
                                        <Plus className="w-4 h-4" />
                                        Add New Project
                                    </Button>
                                </CardHeader>

                                <CardContent className="p-6">
                                    {isLoadingProjects ? (
                                        <div className="flex items-center justify-center py-16">
                                            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                                        </div>
                                    ) : filteredProjects.length === 0 ? (
                                        <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">
                                            {projects.length === 0 ? "No projects yet. Add the first one." : "No projects match your search."}
                                        </p>
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
                                                pageSizeOptions={[5, 10, 25]}
                                            />
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="quotations" className="mt-4">
                            <Card className="!p-0 !block border-0 overflow-hidden">
                                <CardHeader className="border-b border-border !py-4 px-6 flex items-center justify-between">
                                    <h6 className="text-base font-semibold text-neutral-900 dark:text-white">Quotations</h6>
                                    <Button className="w-auto h-10" asChild>
                                        <Link to={`/quotations-list/create?clientId=${id}`}>
                                            <Plus className="w-4 h-4" />
                                            New Quotation
                                        </Link>
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-6">
                                    {isLoadingQuotations ? (
                                        <div className="flex items-center justify-center py-16">
                                            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                                        </div>
                                    ) : quotations.length === 0 ? (
                                        <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">No quotations yet.</p>
                                    ) : (
                                        <QuotationsListTable
                                            quotations={quotations}
                                            onEdit={(quotation) => navigate(`/quotations-list/${quotation.id}`)}
                                            onDelete={setQuotationToDelete}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="billing" className="mt-4">
                            <Card className="!p-0 !block border-0 overflow-hidden">
                                <CardHeader className="border-b border-border !py-4 px-6 flex items-center justify-between">
                                    <h6 className="text-base font-semibold text-neutral-900 dark:text-white">Billing</h6>
                                    <Button className="w-auto h-10" asChild>
                                        <Link to={`/invoices-list/create?clientId=${id}`}>
                                            <Plus className="w-4 h-4" />
                                            New Invoice
                                        </Link>
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-6">
                                    {isLoadingInvoices ? (
                                        <div className="flex items-center justify-center py-16">
                                            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                                        </div>
                                    ) : invoices.length === 0 ? (
                                        <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">No invoices yet.</p>
                                    ) : (
                                        <InvoicesListTable
                                            invoices={invoices}
                                            onEdit={(invoice) => navigate(`/invoices-list/${invoice.id}`)}
                                            onDelete={setInvoiceToDelete}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="pitch" className="mt-4">
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                                    <Presentation className="w-8 h-8 text-neutral-400" />
                                    <p className="font-medium text-neutral-700 dark:text-neutral-200">Pitch decks are coming soon</p>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
                                        This tab will let you build and manage pitch presentations for {client.name} once the module ships.
                                    </p>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <ConfirmDialog
                open={!!projectToDelete}
                onOpenChange={(open) => !open && setProjectToDelete(null)}
                title="Delete project"
                description={`Are you sure you want to delete ${projectToDelete?.title}? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDeleteProject}
            />

            <ConfirmDialog
                open={!!quotationToDelete}
                onOpenChange={(open) => !open && setQuotationToDelete(null)}
                title="Delete quotation"
                description={`Are you sure you want to delete ${quotationToDelete?.quotationNumber}? This action cannot be undone.`}
                onConfirm={handleDeleteQuotation}
            />

            <ConfirmDialog
                open={!!invoiceToDelete}
                onOpenChange={(open) => !open && setInvoiceToDelete(null)}
                title="Delete invoice"
                description={`Are you sure you want to delete ${invoiceToDelete?.invoiceNumber}? This action cannot be undone.`}
                onConfirm={handleDeleteInvoice}
            />

            {id && (
                <ProjectFormDialog
                    open={formOpen}
                    onOpenChange={setFormOpen}
                    clientId={id}
                    companyId={client.companyId}
                    onCreated={(project) => setProjects((current) => [...current, project])}
                />
            )}
        </>
    );
};

export default ClientDetails;
