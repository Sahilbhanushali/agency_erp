import ClientFormDialog from "@/components/shared/ClientFormDialog";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import Pagination from "@/components/shared/Pagination";
import StatusBadge from "@/components/shared/StatusBadge";
import TableSkeleton from "@/components/shared/TableSkeleton";
import ClientsListTable from "@/components/tables/ClientsListTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { Client } from "@/types/client";
import type { Company } from "@/types/company";
import {
    ArrowLeft,
    Building2,
    Globe,
    Loader2,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Plus,
    Search,
    Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

const CompanyDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [company, setCompany] = useState<Company | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [clients, setClients] = useState<Client[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [formOpen, setFormOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!id) return;
        api
            .get<Company>(`/companies/${id}`)
            .then(setCompany)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load company."))
            .finally(() => setIsLoading(false));
    }, [id]);

    const fetchClients = () => {
        if (!id) return;
        setIsLoadingClients(true);
        api
            .list<Client>(`/clients?companyId=${id}`)
            .then(setClients)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load clients."))
            .finally(() => setIsLoadingClients(false));
    };

    useEffect(fetchClients, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    const filteredClients = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return clients;
        return clients.filter(
            (client) => client.name.toLowerCase().includes(query) || client.email.toLowerCase().includes(query)
        );
    }, [clients, search]);

    useEffect(() => setPage(1), [search, pageSize]);

    const paginatedClients = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredClients.slice(start, start + pageSize);
    }, [filteredClients, page, pageSize]);

    const handleDeleteClient = async () => {
        if (!clientToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/clients/${clientToDelete.id}`);
            toast.success("Client deleted.");
            setClients((current) => current.filter((client) => client.id !== clientToDelete.id));
            setClientToDelete(null);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete client.");
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Loading company profile...</p>
            </div>
        );
    }

    if (!company) {
        return (
            <EmptyState
                icon={Building2}
                title="Company not found"
                description="The company you are looking for does not exist or has been removed."
                action={{
                    label: "Back to Companies",
                    onClick: () => navigate("/companies-list"),
                }}
            />
        );
    }

    const address = company.registeredAddress;

    return (
        <div className="space-y-6">
            <PageHeader
                title={company.name}
                description={company.legalName || "Organization profile, contact information, and associated clients."}
                breadcrumbs={[
                    { label: "Companies", href: "/companies-list" },
                    { label: company.name },
                ]}
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link to="/companies-list">
                                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                                Back
                            </Link>
                        </Button>
                        <Button size="sm" asChild>
                            <Link to={`/companies-list/${company.id}/edit`}>
                                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                Edit Company
                            </Link>
                        </Button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left Overview Card */}
                <Card className="lg:col-span-1 rounded-xl border border-border shadow-xs">
                    <CardHeader className="pb-3 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold text-sm shrink-0">
                                    {company.name[0]?.toUpperCase() ?? "C"}
                                </span>
                                <div>
                                    <h4 className="font-semibold text-sm text-foreground">{company.name}</h4>
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                        {company.currency} • {company.timezone}
                                    </span>
                                </div>
                            </div>
                            <StatusBadge status={company.isActive ? "ACTIVE" : "INACTIVE"} />
                        </div>
                    </CardHeader>

                    <CardContent className="pt-4 space-y-3.5 text-xs">
                        {company.email && (
                            <div className="flex items-center gap-2.5 text-muted-foreground">
                                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="text-foreground">{company.email}</span>
                            </div>
                        )}
                        {company.phone && (
                            <div className="flex items-center gap-2.5 text-muted-foreground">
                                <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="text-foreground">{company.phone}</span>
                            </div>
                        )}
                        {company.website && (
                            <div className="flex items-center gap-2.5 text-muted-foreground">
                                <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <a
                                    href={company.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary hover:underline truncate"
                                >
                                    {company.website}
                                </a>
                            </div>
                        )}
                        {address && (
                            <div className="flex items-start gap-2.5 text-muted-foreground pt-1 border-t border-border">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                <span className="text-foreground leading-relaxed">
                                    {[address.line1, address.city, address.state, address.country]
                                        .filter(Boolean)
                                        .join(", ")}
                                </span>
                            </div>
                        )}
                        <div className="pt-2 border-t border-border flex items-center justify-between text-muted-foreground">
                            <span>Associated Clients</span>
                            <span className="font-mono font-medium text-foreground">{clients.length}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Right Clients Section */}
                <Card className="lg:col-span-2 rounded-xl border border-border shadow-xs overflow-hidden">
                    <CardHeader className="border-b border-border py-3 px-5 flex flex-row items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-semibold text-foreground">Clients</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                                    {clients.length}
                                </span>
                            </div>

                            <div className="relative">
                                <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Filter clients..."
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="ps-8 h-8 text-xs w-[170px] sm:w-[200px]"
                                />
                            </div>
                        </div>

                        <Button size="sm" className="h-8 text-xs" onClick={() => setFormOpen(true)}>
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add Client
                        </Button>
                    </CardHeader>

                    <CardContent className="p-0">
                        {isLoadingClients ? (
                            <TableSkeleton rows={4} columns={5} />
                        ) : filteredClients.length === 0 ? (
                            <div className="py-12">
                                <EmptyState
                                    icon={Users}
                                    title={search ? "No clients match your filter" : "No clients yet"}
                                    description={
                                        search
                                            ? `No clients matched "${search}".`
                                            : "Add clients under this company to start issuing invoices and managing projects."
                                    }
                                    action={
                                        !search
                                            ? {
                                                  label: "Add First Client",
                                                  onClick: () => setFormOpen(true),
                                              }
                                            : undefined
                                    }
                                />
                            </div>
                        ) : (
                            <div className="p-4 sm:p-5 space-y-4">
                                <ClientsListTable
                                    clients={paginatedClients}
                                    onView={(client) => navigate(`/clients-list/${client.id}`)}
                                    onEdit={(client) => navigate(`/clients-list/${client.id}/edit`)}
                                    onDelete={setClientToDelete}
                                />

                                <Pagination
                                    page={page}
                                    pageSize={pageSize}
                                    total={filteredClients.length}
                                    onPageChange={setPage}
                                    onPageSizeChange={setPageSize}
                                    pageSizeOptions={[5, 10, 25]}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <ConfirmDialog
                open={!!clientToDelete}
                onOpenChange={(open) => !open && setClientToDelete(null)}
                title="Delete client"
                description={`Are you sure you want to delete ${clientToDelete?.name}? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDeleteClient}
            />

            {id && (
                <ClientFormDialog
                    open={formOpen}
                    onOpenChange={setFormOpen}
                    companyId={id}
                    onCreated={(client) => setClients((current) => [...current, client])}
                />
            )}
        </div>
    );
};

export default CompanyDetails;
