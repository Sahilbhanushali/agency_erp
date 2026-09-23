import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import QuotationsListTable from "@/components/tables/QuotationsListTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";
import type { Company } from "@/types/company";
import type { Quotation, QuotationStatus } from "@/types/quotation";
import { Plus, Receipt } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const STATUS_OPTIONS: (QuotationStatus | "ALL")[] = [
  "ALL",
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CONVERTED",
];

export default function QuotationsList() {
  const navigate = useNavigate();
  const { user: actor } = useAuth();
  const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string | undefined>(
    actor?.companyId ?? undefined
  );
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuotationStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchQuotations = () => {
    setIsLoading(true);
    const query = companyId ? `?companyId=${companyId}` : "";
    api
      .get<Quotation[]>(`/quotations${query}`)
      .then(setQuotations)
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to load quotations.")
      )
      .finally(() => setIsLoading(false));
  };

  useEffect(fetchQuotations, [companyId]);

  useEffect(() => {
    if (isSuperAdmin) {
      api
        .get<Company[]>("/companies")
        .then(setCompanies)
        .catch(() => toast.error("Failed to load companies."));
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
        quotation.client?.name.toLowerCase().includes(query);
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
      toast.success("Quotation deleted successfully.");
      setQuotations((current) =>
        current.filter((item) => item.id !== quotationToDelete.id)
      );
      setQuotationToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to delete quotation."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        description="Formal project estimates, scope proposals, and fee schedules."
        breadcrumbs={[{ label: "Quotations" }]}
        badge={
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            {quotations.length} proposals
          </span>
        }
        actions={
          (isSuperAdmin || can(actor, "quotations:create")) && (
            <Button asChild size="sm" className="gap-1.5 h-9 rounded-lg shadow-xs">
              <Link to="/quotations-list/create">
                <Plus className="w-4 h-4" />
                <span>New Quotation</span>
              </Link>
            </Button>
          )
        }
      />

      <DataTableShell
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search by quote #, title, or client...",
        }}
        filters={
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as QuotationStatus | "ALL")}
            >
              <SelectTrigger className="w-36 h-9 text-xs bg-background">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-xs">
                    {opt === "ALL" ? "All Statuses" : opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isSuperAdmin && (
              <Select
                value={companyId ?? "ALL"}
                onValueChange={(value) =>
                  setCompanyId(value === "ALL" ? undefined : value)
                }
              >
                <SelectTrigger className="w-44 h-9 text-xs bg-background">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">
                    All Companies
                  </SelectItem>
                  {companies.map((company) => (
                    <SelectItem
                      key={company.id}
                      value={company.id}
                      className="text-xs"
                    >
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        }
        isLoading={isLoading}
        isEmpty={filteredQuotations.length === 0}
        emptyState={{
          icon: Receipt,
          title: search || status !== "ALL" ? "No matching quotations" : "No quotations created yet",
          description: search || status !== "ALL"
            ? "Try adjusting your search criteria or status filter."
            : "Draft and send formal estimates to prospective or current clients.",
          action:
            !search && status === "ALL" && (isSuperAdmin || can(actor, "quotations:create"))
              ? {
                  label: "Create Quotation",
                  href: "/quotations-list/create",
                  icon: Plus,
                }
              : undefined,
        }}
        pagination={{
          page,
          pageSize,
          total: filteredQuotations.length,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      >
        <QuotationsListTable
          quotations={paginatedQuotations}
          onEdit={(q) => navigate(`/quotations-list/${q.id}`)}
          onDelete={setQuotationToDelete}
        />
      </DataTableShell>

      <ConfirmDialog
        open={!!quotationToDelete}
        onOpenChange={(open) => !open && setQuotationToDelete(null)}
        title="Delete Quotation"
        description={`Are you sure you want to delete quotation ${quotationToDelete?.quotationNumber}? This action cannot be undone.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
