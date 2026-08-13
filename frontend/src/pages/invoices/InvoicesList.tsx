import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Pagination from "@/components/shared/Pagination";
import InvoicesListTable from "@/components/tables/InvoicesListTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { Company } from "@/types/company";
import type { Invoice, InvoiceStatus } from "@/types/invoice";
import { Loader2, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const STATUS_OPTIONS: (InvoiceStatus | "ALL")[] = ["ALL", "DRAFT", "SENT", "VIEWED", "PARTIAL", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"];

const InvoicesList = () => {
    const navigate = useNavigate();
    const { user: actor } = useAuth();
    const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [companyId, setCompanyId] = useState<string | undefined>(actor?.companyId ?? undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<InvoiceStatus | "ALL">("ALL");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchInvoices = () => {
        setIsLoading(true);
        const query = companyId ? `?companyId=${companyId}` : "";
        api
            .get<Invoice[]>(`/invoices${query}`)
            .then(setInvoices)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load invoices."))
            .finally(() => setIsLoading(false));
    };

    useEffect(fetchInvoices, [companyId]);

    useEffect(() => {
        if (isSuperAdmin) {
            api.get<Company[]>("/companies").then(setCompanies).catch(() => toast.error("Failed to load companies."));
        }
    }, [isSuperAdmin]);

    const filteredInvoices = useMemo(() => {
        const query = search.trim().toLowerCase();
        return invoices.filter((invoice) => {
            const matchesStatus = status === "ALL" || invoice.status === status;
            const matchesSearch =
                !query ||
                invoice.title.toLowerCase().includes(query) ||
                invoice.invoiceNumber.toLowerCase().includes(query) ||
                invoice.client.name.toLowerCase().includes(query);
            return matchesStatus && matchesSearch;
        });
    }, [invoices, search, status]);

    useEffect(() => setPage(1), [search, status, pageSize]);

    const paginatedInvoices = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredInvoices.slice(start, start + pageSize);
    }, [filteredInvoices, page, pageSize]);

    const handleDelete = async () => {
        if (!invoiceToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/invoices/${invoiceToDelete.id}`);
            toast.success("Invoice deleted.");
            setInvoices((current) => current.filter((invoice) => invoice.id !== invoiceToDelete.id));
            setInvoiceToDelete(null);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete invoice.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Billing" text="Invoices" />

            <Card className="h-full !p-0 !block border-0 overflow-hidden mb-6">
                <CardHeader className="border-b border-border !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                    <div className="flex items-center flex-wrap gap-3">
                        <div className="relative">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <Input
                                placeholder="Search number, title, client..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="ps-9 h-11 w-[240px]"
                            />
                        </div>

                        <Select value={status} onValueChange={(value) => setStatus(value as InvoiceStatus | "ALL")}>
                            <SelectTrigger className="min-w-[150px] h-11">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option === "ALL" ? "All Status" : option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

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
                    </div>

                    <Button className="w-auto h-11" asChild>
                        <Link to="/invoices-list/create">
                            <Plus className="w-5 h-5" />
                            New Invoice
                        </Link>
                    </Button>
                </CardHeader>

                <CardContent className="card-body p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                        </div>
                    ) : filteredInvoices.length === 0 ? (
                        <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">No invoices found.</p>
                    ) : (
                        <>
                            <InvoicesListTable
                                invoices={paginatedInvoices}
                                onView={(invoice) => navigate(`/invoices-list/${invoice.id}`)}
                                onEdit={(invoice) => navigate(`/invoices-list/${invoice.id}/edit`)}
                                onDelete={setInvoiceToDelete}
                            />

                            <Pagination
                                page={page}
                                pageSize={pageSize}
                                total={filteredInvoices.length}
                                onPageChange={setPage}
                                onPageSizeChange={setPageSize}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={!!invoiceToDelete}
                onOpenChange={(open) => !open && setInvoiceToDelete(null)}
                title="Delete invoice"
                description={`Are you sure you want to delete ${invoiceToDelete?.invoiceNumber}? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDelete}
            />
        </>
    );
};

export default InvoicesList;
