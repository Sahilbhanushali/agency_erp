import ConfirmDialog from "@/components/shared/ConfirmDialog";
import Pagination from "@/components/shared/Pagination";
import CompaniesListTable from "@/components/tables/CompaniesListTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Breadcrumb from "@/layouts/Breadcrumb";
import { api, ApiError } from "@/lib/api";
import type { Company } from "@/types/company";
import { Loader2, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const CompaniesList = () => {
    const navigate = useNavigate();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchCompanies = () => {
        setIsLoading(true);
        api
            .get<Company[]>("/companies")
            .then(setCompanies)
            .catch((error) => toast.error(error instanceof ApiError ? error.message : "Failed to load companies."))
            .finally(() => setIsLoading(false));
    };

    useEffect(fetchCompanies, []);

    const filteredCompanies = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return companies;
        return companies.filter((company) => company.name.toLowerCase().includes(query));
    }, [companies, search]);

    useEffect(() => setPage(1), [search, pageSize]);

    const paginatedCompanies = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredCompanies.slice(start, start + pageSize);
    }, [filteredCompanies, page, pageSize]);

    const handleDelete = async () => {
        if (!companyToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/companies/${companyToDelete.id}`);
            toast.success("Company deleted.");
            setCompanies((current) => current.filter((company) => company.id !== companyToDelete.id));
            setCompanyToDelete(null);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Failed to delete company.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Breadcrumb title="Companies" text="Companies List" />

            <Card className="card h-full !p-0 !block border-0 overflow-hidden mb-6">
                <CardHeader className="border-b border-border !py-4 px-6 flex items-center flex-wrap gap-3 justify-between">
                    <div className="relative">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <Input
                            placeholder="Search company..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="ps-9 h-11 w-[220px]"
                        />
                    </div>

                    <Button className="w-auto h-11" asChild>
                        <Link to="/companies-list/create">
                            <Plus className="w-5 h-5" />
                            Add New Company
                        </Link>
                    </Button>
                </CardHeader>

                <CardContent className="card-body p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                        </div>
                    ) : filteredCompanies.length === 0 ? (
                        <p className="text-center text-neutral-500 dark:text-neutral-300 py-16">No companies found.</p>
                    ) : (
                        <>
                            <CompaniesListTable
                                companies={paginatedCompanies}
                                onView={(company) => navigate(`/companies-list/${company.id}`)}
                                onEdit={(company) => navigate(`/companies-list/${company.id}/edit`)}
                                onDelete={setCompanyToDelete}
                            />

                            <Pagination
                                page={page}
                                pageSize={pageSize}
                                total={filteredCompanies.length}
                                onPageChange={setPage}
                                onPageSizeChange={setPageSize}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={!!companyToDelete}
                onOpenChange={(open) => !open && setCompanyToDelete(null)}
                title="Delete company"
                description={`Are you sure you want to delete ${companyToDelete?.name}? This action cannot be undone.`}
                isLoading={isDeleting}
                onConfirm={handleDelete}
            />
        </>
    );
};

export default CompaniesList;
