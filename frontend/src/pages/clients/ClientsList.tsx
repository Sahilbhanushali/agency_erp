import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Pagination from "@/components/shared/Pagination";
import ClientsListTable from "@/components/tables/ClientsListTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { Client } from "@/types/client";
import type { Company } from "@/types/company";
import { Loader2, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const ClientsList = () => {
    const navigate = useNavigate();
    const { user: actor } = useAuth();
    const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";
    const [clients, setClients] = useState<Client[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [companyId, setCompanyId] = useState<string | undefined>(actor?.companyId ?? undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchClients = () => {
        setIsLoading(true);
        const query = companyId ? `?companyId=${companyId}` : "";
        api
            .get<Client[]>(`/clients${query}`)
            .then(setClients)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load clients."))
            .finally(() => setIsLoading(false));
    };

    useEffect(fetchClients, [companyId]);

    useEffect(() => {
        if (isSuperAdmin) {
            api.get<Company[]>("/companies").then(setCompanies).catch(() => toast.error("Failed to load companies."));
        }
    }, [isSuperAdmin]);

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

    const handleDelete = async () => {
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

    return (
        <>
            <Breadcrumb title="Clients" text="Clients List" />

            <Card className="card h-full !p-0 !block border-0 overflow-hidden mb-6">
                <CardHeader className="border-b border-neutral-200 dark:border-slate-600 !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                    <div className="flex items-center flex-wrap gap-3">
                        <div className="relative">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <Input
                                placeholder="Search name or email..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="ps-9 h-11 w-[220px] border border-neutral-300 dark:border-slate-500"
                            />
                        </div>

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
                        <Link to="/clients-list/create">
                            <Plus className="w-5 h-5" />
                            Add New Client
                        </Link>
                    </Button>
                </CardHeader>

                <CardContent className="card-body p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                        </div>
                    ) : filteredClients.length === 0 ? (
                        <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">No clients found.</p>
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
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={!!clientToDelete}
                onOpenChange={(open) => !open && setClientToDelete(null)}
                title="Delete client"
                description={`Are you sure you want to delete ${clientToDelete?.name}? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDelete}
            />
        </>
    );
};

export default ClientsList;
