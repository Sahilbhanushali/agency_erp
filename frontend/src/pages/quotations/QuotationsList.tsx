import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Pagination from "@/components/shared/Pagination";
import QuotationsListTable from "@/components/tables/QuotationsListTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { Company } from "@/types/company";
import type { Quotation, QuotationStatus } from "@/types/quotation";
import { Loader2, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const STATUS_OPTIONS: (QuotationStatus | "ALL")[] = ["ALL", "DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"];

const QuotationsList = () => {
    const navigate = useNavigate();
    const { user: actor } = useAuth();
    const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [companyId, setCompanyId] = useState<string | undefined>(actor?.companyId ?? undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<QuotationStatus | "ALL">("ALL");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchQuotations = () => {
        setIsLoading(true);
        const query = companyId ? `?companyId=${companyId}` : "";
        api
            .get<Quotation[]>(`/quotations${query}`)
            .then(setQuotations)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load quotations."))
            .finally(() => setIsLoading(false));
    };

    useEffect(fetchQuotations, [companyId]);

    useEffect(() => {
        if (isSuperAdmin) {
            api.get<Company[]>("/companies").then(setCompanies).catch(() => toast.error("Failed to load companies."));
        }
    }, [isSuperAdmin]);

    const filteredQuotations = useMemo(() => {
        const query = search.trim().toLowerCase();
        return quotations.filter((quotation) => {
            const matchesStatus = status === "ALL" || quotation.status === status;
            const matchesSearch =
                !query ||
                quotation.title.toLowerCase().includes(query) ||
                quotation.quotationNumber.toLowerCase().includes(query) ||
                quotation.client.name.toLowerCase().includes(query);
            return matchesStatus && matchesSearch;
        });
    }, [quotations, search, status]);

    useEffect(() => setPage(1), [search, status, pageSize]);

    const paginatedQuotations = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredQuotations.slice(start, start + pageSize);
    }, [filteredQuotations, page, pageSize]);

    const handleDelete = async () => {
        if (!quotationToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/quotations/${quotationToDelete.id}`);
            toast.success("Quotation deleted.");
            setQuotations((current) => current.filter((quotation) => quotation.id !== quotationToDelete.id));
            setQuotationToDelete(null);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete quotation.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Quotations" text="Quotations List" />

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

                        <Select value={status} onValueChange={(value) => setStatus(value as QuotationStatus | "ALL")}>
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
                        <Link to="/quotations-list/create">
                            <Plus className="w-5 h-5" />
                            New Quotation
                        </Link>
                    </Button>
                </CardHeader>

                <CardContent className="card-body p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                        </div>
                    ) : filteredQuotations.length === 0 ? (
                        <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">No quotations found.</p>
                    ) : (
                        <>
                            <QuotationsListTable
                                quotations={paginatedQuotations}
                                onEdit={(quotation) => navigate(`/quotations-list/${quotation.id}`)}
                                onDelete={setQuotationToDelete}
                            />

                            <Pagination
                                page={page}
                                pageSize={pageSize}
                                total={filteredQuotations.length}
                                onPageChange={setPage}
                                onPageSizeChange={setPageSize}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={!!quotationToDelete}
                onOpenChange={(open) => !open && setQuotationToDelete(null)}
                title="Delete quotation"
                description={`Are you sure you want to delete ${quotationToDelete?.quotationNumber}? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDelete}
            />
        </>
    );
};

export default QuotationsList;
