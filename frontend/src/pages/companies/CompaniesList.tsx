import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import CompaniesListTable from "@/components/tables/CompaniesListTable";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { Company } from "@/types/company";
import { Building2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function CompaniesList() {
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
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to load companies.")
      )
      .finally(() => setIsLoading(false));
  };

  useEffect(fetchCompanies, []);

  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return companies;
    return companies.filter((company) =>
      company.name.toLowerCase().includes(query) ||
      (company.email && company.email.toLowerCase().includes(query))
    );
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
      toast.success("Company deleted successfully.");
      setCompanies((current) =>
        current.filter((company) => company.id !== companyToDelete.id)
      );
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
        isEmpty={filteredCompanies.length === 0}
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
          total: filteredCompanies.length,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      >
        <CompaniesListTable
          companies={paginatedCompanies}
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
