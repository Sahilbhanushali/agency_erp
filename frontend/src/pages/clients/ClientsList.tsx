import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import ClientsListTable from "@/components/tables/ClientsListTable";
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
import type { Client } from "@/types/client";
import type { Company } from "@/types/company";
import { Briefcase, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function ClientsList() {
  const navigate = useNavigate();
  const { user: actor } = useAuth();
  const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";

  const [clients, setClients] = useState<Client[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string | undefined>(
    actor?.companyId ?? undefined
  );
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
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to load clients.")
      )
      .finally(() => setIsLoading(false));
  };

  useEffect(fetchClients, [companyId]);

  useEffect(() => {
    if (isSuperAdmin) {
      api
        .get<Company[]>("/companies")
        .then(setCompanies)
        .catch(() => toast.error("Failed to load companies."));
    }
  }, [isSuperAdmin]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query) ||
        (client.industry && client.industry.toLowerCase().includes(query))
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
      toast.success("Client deleted successfully.");
      setClients((current) =>
        current.filter((client) => client.id !== clientToDelete.id)
      );
      setClientToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to delete client."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Directory of agency clients, company details, and billing relationships."
        breadcrumbs={[{ label: "Clients" }]}
        badge={
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            {clients.length} total
          </span>
        }
        actions={
          (isSuperAdmin || can(actor, "clients:create")) && (
            <Button asChild size="sm" className="gap-1.5 h-9 rounded-lg shadow-xs">
              <Link to="/clients-list/create">
                <Plus className="w-4 h-4" />
                <span>Add Client</span>
              </Link>
            </Button>
          )
        }
      />

      <DataTableShell
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search clients by name, email, or industry...",
        }}
        filters={
          isSuperAdmin ? (
            <Select
              value={companyId ?? "ALL"}
              onValueChange={(value) =>
                setCompanyId(value === "ALL" ? undefined : value)
              }
            >
              <SelectTrigger className="w-48 h-9 text-xs bg-background">
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
          ) : undefined
        }
        isLoading={isLoading}
        isEmpty={filteredClients.length === 0}
        emptyState={{
          icon: Briefcase,
          title: search ? "No matching clients found" : "No clients created yet",
          description: search
            ? "Try refining your search terms or clearing the filter."
            : "Get started by adding your first agency client profile.",
          action:
            !search && (isSuperAdmin || can(actor, "clients:create"))
              ? {
                  label: "Create Client",
                  href: "/clients-list/create",
                  icon: Plus,
                }
              : undefined,
        }}
        pagination={{
          page,
          pageSize,
          total: filteredClients.length,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      >
        <ClientsListTable
          clients={paginatedClients}
          onView={(client) => navigate(`/clients-list/${client.id}`)}
          onEdit={(client) => navigate(`/clients-list/${client.id}/edit`)}
          onDelete={setClientToDelete}
        />
      </DataTableShell>

      <ConfirmDialog
        open={!!clientToDelete}
        onOpenChange={(open) => !open && setClientToDelete(null)}
        title="Delete Client"
        description={`Are you sure you want to delete ${clientToDelete?.name}? Associated workspaces and billing documents may be affected. This action cannot be undone.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
