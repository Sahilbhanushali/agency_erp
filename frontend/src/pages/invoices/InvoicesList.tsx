import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import InvoicesListTable from "@/components/tables/InvoicesListTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useDebounced } from "@/hooks/use-debounced";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { api, ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";
import type { Company } from "@/types/company";
import type { Invoice, InvoiceStatus } from "@/types/invoice";
import { Plus, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const STATUS_OPTIONS: (InvoiceStatus | "ALL")[] = [
  "ALL",
  "DRAFT",
  "SENT",
  "VIEWED",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
  "REFUNDED",
];

export default function InvoicesList() {
  const navigate = useNavigate();
  const { user: actor } = useAuth();
  const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string | undefined>(
    actor?.companyId ?? undefined
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debouncedSearch = useDebounced(search);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (companyId) params.set("companyId", companyId);
    if (status !== "ALL") params.set("status", status);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    return params.toString();
  }, [page, pageSize, companyId, status, debouncedSearch]);

  const {
    data: invoices,
    total,
    isLoading,
    refetch,
  } = usePaginatedList<Invoice>("/invoices", query, "Failed to load invoices.");

  useEffect(() => {
    if (isSuperAdmin) {
      api
        .list<Company>("/companies")
        .then(setCompanies)
        .catch(() => toast.error("Failed to load companies."));
    }
  }, [isSuperAdmin]);

  useEffect(() => setPage(1), [debouncedSearch, pageSize, companyId, status]);


  const handleDelete = async () => {
    if (!invoiceToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/invoices/${invoiceToDelete.id}`);
      toast.success("Invoice deleted successfully.");
      refetch();
      setInvoiceToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to delete invoice."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & Billing"
        description="Manage client billables, payment statuses, and tax invoice generation."
        breadcrumbs={[{ label: "Billing" }]}
        badge={
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            {invoices.length} invoices
          </span>
        }
        actions={
          (isSuperAdmin || can(actor, "invoices:create")) && (
            <Button asChild size="sm" className="gap-1.5 h-9 rounded-lg shadow-xs">
              <Link to="/invoices-list/create">
                <Plus className="w-4 h-4" />
                <span>New Invoice</span>
              </Link>
            </Button>
          )
        }
      />

      <DataTableShell
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search by number, title, or client...",
        }}
        filters={
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as InvoiceStatus | "ALL")}
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
        isEmpty={invoices.length === 0}
        emptyState={{
          icon: Wallet,
          title: search || status !== "ALL" ? "No matching invoices" : "No invoices issued yet",
          description: search || status !== "ALL"
            ? "Try resetting your search filters or status selection."
            : "Generate your first invoice for client billables or retainers.",
          action:
            !search && status === "ALL" && (isSuperAdmin || can(actor, "invoices:create"))
              ? {
                  label: "Create Invoice",
                  href: "/invoices-list/create",
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
        <InvoicesListTable
          invoices={invoices}
          onView={(inv) => navigate(`/invoices-list/${inv.id}`)}
          onEdit={(inv) => navigate(`/invoices-list/${inv.id}/edit`)}
          onDelete={setInvoiceToDelete}
        />
      </DataTableShell>

      <ConfirmDialog
        open={!!invoiceToDelete}
        onOpenChange={(open) => !open && setInvoiceToDelete(null)}
        title="Delete Invoice"
        description={`Are you sure you want to delete invoice ${invoiceToDelete?.invoiceNumber}? This action cannot be undone.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
