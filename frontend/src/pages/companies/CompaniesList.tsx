import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import CompaniesListTable from "@/components/tables/CompaniesListTable";
import { Button } from "@/components/ui/button";
import { useDebounced } from "@/hooks/use-debounced";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { api, ApiError } from "@/lib/api";
import type { Company } from "@/types/company";
import { Building2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function CompaniesList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debouncedSearch = useDebounced(search);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    return params.toString();
  }, [page, pageSize, debouncedSearch]);

  const {
    data: companies,
    total,
    isLoading,
    refetch,
  } = usePaginatedList<Company>("/companies", query, "Failed to load companies.");

  useEffect(() => setPage(1), [debouncedSearch, pageSize]);


  const handleDelete = async () => {
    if (!companyToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/companies/${companyToDelete.id}`);
      toast.success("Company deleted successfully.");
      refetch();
      setCompanyToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to delete company."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Multi-tenant organizational entities, business branches, and legal company accounts."
        breadcrumbs={[{ label: "Companies" }]}
        badge={
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            {companies.length} tenants
          </span>
        }
        actions={
          <Button asChild size="sm" className="gap-1.5 h-9 rounded-lg shadow-xs">
            <Link to="/companies-list/create">
              <Plus className="w-4 h-4" />
              <span>Add Company</span>
            </Link>
          </Button>
        }
      />

      <DataTableShell
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search companies by name or email...",
        }}
        isLoading={isLoading}
        isEmpty={companies.length === 0}
        emptyState={{
          icon: Building2,
          title: search ? "No matching companies found" : "No companies registered",
          description: search
            ? "Try checking the spelling or resetting the search filter."
            : "Create your first agency company entity to manage multi-tenant access.",
          action: !search
            ? {
                label: "Create Company",
                href: "/companies-list/create",
                icon: Plus,
              }
            : undefined,
        }}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      >
        <CompaniesListTable
          companies={companies}
          onView={(company) => navigate(`/companies-list/${company.id}`)}
          onEdit={(company) => navigate(`/companies-list/${company.id}/edit`)}
          onDelete={setCompanyToDelete}
        />
      </DataTableShell>

      <ConfirmDialog
        open={!!companyToDelete}
        onOpenChange={(open) => !open && setCompanyToDelete(null)}
        title="Delete Company"
        description={`Are you sure you want to delete ${companyToDelete?.name}? All associated workspaces, clients, and user memberships under this tenant will be affected.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
