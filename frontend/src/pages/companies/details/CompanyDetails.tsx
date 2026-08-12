import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Pagination from "@/components/shared/Pagination";
import ClientsListTable from "@/components/tables/ClientsListTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { Client } from "@/types/client";
import type { Company } from "@/types/company";
import {
    Globe,
    Loader2,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Plus,
    Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ClientFormDialog from "@/components/shared/ClientFormDialog";

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
            .get<Client[]>(`/clients?companyId=${id}`)
            .then(setClients)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load clients."))
            .finally(() => setIsLoadingClients(false));
    };

    useEffect(fetchClients, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    const filteredClients = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return clients;
        return clients.filter(
            (client) => client.name.toLowerCase().includes(query) || client.email.toLowerCase().includes(query),
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
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
        );
    }

    if (!company) {
        return <p className="text-center text-neutral-500 py-24">Company not found.</p>;
    }

    const address = company.registeredAddress;

    return (
        <>
            <Breadcrumb title={company.name} text="Company Details" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <Card className="lg:col-span-1 h-fit">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-11 h-11 rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                                {company.name[0]?.toUpperCase()}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${company.isActive ? "bg-success/15 text-success border-success/30" : "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30"}`}>
                                {company.isActive ? "ACTIVE" : "INACTIVE"}
                            </span>
                        </div>
                        <Button variant="outline" size="sm" className="h-9 rounded-lg" asChild>
                            <Link to={`/companies-list/${company.id}/edit`}>
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        {company.email && (
                            <div className="flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200">
                                <Mail className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span>{company.email}</span>
                            </div>
                        )}
                        {company.phone && (
                            <div className="flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200">
                                <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span>{company.phone}</span>
                            </div>
                        )}
                        {company.website && (
                            <div className="flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200">
                                <Globe className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span>{company.website}</span>
                            </div>
                        )}
                        {address && (
                            <div className="flex items-start gap-2.5 text-neutral-700 dark:text-neutral-200">
                                <MapPin className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                                <span>{[address.line1, address.city, address.state, address.country].filter(Boolean).join(", ")}</span>
                            </div>
                        )}
                        <div className="pt-3 border-t border-border mt-3 flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                            <span>Currency</span>
                            <span className="font-medium text-neutral-800 dark:text-neutral-100">{company.currency}</span>
                        </div>
                        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                            <span>Timezone</span>
                            <span className="font-medium text-neutral-800 dark:text-neutral-100">{company.timezone}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 !p-0 !block border-0 overflow-hidden">
                    <CardHeader className="border-b border-border !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                        <div className="flex items-center flex-wrap gap-3">
                            <h6 className="text-base font-semibold text-neutral-900 dark:text-white shrink-0">Clients</h6>
                            <div className="relative">
                                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <Input
                                    placeholder="Search clients..."
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="ps-9 h-10 w-[200px]"
                                />
                            </div>
                        </div>

                        <Button className="w-auto h-10" onClick={() => setFormOpen(true)}>
                            <Plus className="w-4 h-4" />
                            Add New Client
                        </Button>
                    </CardHeader>

                    <CardContent className="p-6">
                        {isLoadingClients ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                            </div>
                        ) : filteredClients.length === 0 ? (
                            <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">
                                {clients.length === 0 ? "No clients yet. Add the first one." : "No clients match your search."}
                            </p>
                        ) : (
                            <>
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
                            </>
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
        </>
    );
};

export default CompanyDetails;
