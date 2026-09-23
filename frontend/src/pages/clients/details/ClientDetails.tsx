import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import InvoicesListTable from "@/components/tables/InvoicesListTable";
import ProjectsListTable from "@/components/tables/ProjectsListTable";
import QuotationsListTable from "@/components/tables/QuotationsListTable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api";
import type { Client } from "@/types/client";
import type { Invoice } from "@/types/invoice";
import type { Project } from "@/types/project";
import type { Quotation } from "@/types/quotation";
import {
  Building2,
  CreditCard,
  FolderKanban,
  Globe,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ProjectFormDialog from "../components/ProjectFormDialog";

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [formOpen, setFormOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(true);
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<Client>(`/clients/${id}`)
      .then(setClient)
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to load client.")
      )
      .finally(() => setIsLoading(false));
  }, [id]);

  const fetchProjects = () => {
    if (!id) return;
    setIsLoadingProjects(true);
    api
      .get<Project[]>(`/projects?clientId=${id}`)
      .then(setProjects)
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to load projects.")
      )
      .finally(() => setIsLoadingProjects(false));
  };

  useEffect(fetchProjects, [id]);

  useEffect(() => {
    if (!id) return;
    setIsLoadingQuotations(true);
    api
      .get<Quotation[]>(`/quotations?clientId=${id}`)
      .then(setQuotations)
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to load quotations.")
      )
      .finally(() => setIsLoadingQuotations(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setIsLoadingInvoices(true);
    api
      .get<Invoice[]>(`/invoices?clientId=${id}`)
      .then(setInvoices)
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to load invoices.")
      )
      .finally(() => setIsLoadingInvoices(false));
  }, [id]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) => project.title.toLowerCase().includes(query));
  }, [projects, search]);

  useEffect(() => setPage(1), [search, pageSize]);

  const paginatedProjects = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, page, pageSize]);

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/projects/${projectToDelete.id}`);
      toast.success("Project deleted.");
      setProjects((current) => current.filter((p) => p.id !== projectToDelete.id));
      setProjectToDelete(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to delete project.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteQuotation = async () => {
    if (!quotationToDelete) return;
    try {
      await api.delete(`/quotations/${quotationToDelete.id}`);
      toast.success("Quotation deleted.");
      setQuotations((current) => current.filter((q) => q.id !== quotationToDelete.id));
      setQuotationToDelete(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to delete quotation.");
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    try {
      await api.delete(`/invoices/${invoiceToDelete.id}`);
      toast.success("Invoice deleted.");
      setInvoices((current) => current.filter((i) => i.id !== invoiceToDelete.id));
      setInvoiceToDelete(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to delete invoice.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground">
        Client not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={client.industry ? `Client Profile • ${client.industry}` : "Client Profile"}
        breadcrumbs={[
          { label: "Clients", href: "/clients-list" },
          { label: client.name },
        ]}
        badge={<StatusBadge status={client.isActive} />}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5 h-9 rounded-lg">
              <Link to={`/clients-list/${client.id}/edit`}>
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </Link>
            </Button>
            <Button
              size="sm"
              className="gap-1.5 h-9 rounded-lg shadow-xs"
              onClick={() => setFormOpen(true)}
            >
              <Plus className="w-4 h-4" />
              <span>Add Project</span>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Client Profile Summary */}
        <Card className="lg:col-span-1 p-5 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border/70">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary font-bold text-lg flex items-center justify-center border border-primary/20 shrink-0">
              {client.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{client.email}</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2.5 text-foreground/85">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-mono">{client.email}</span>
            </div>

            {client.phone && (
              <div className="flex items-center gap-2.5 text-foreground/85">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-mono">{client.phone}</span>
              </div>
            )}

            {client.industry && (
              <div className="flex items-center gap-2.5 text-foreground/85">
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{client.industry}</span>
              </div>
            )}

            {client.website && (
              <div className="flex items-center gap-2.5 text-foreground/85">
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <a
                  href={
                    client.website.startsWith("http")
                      ? client.website
                      : `https://${client.website}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline truncate"
                >
                  {client.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}

            {(client.gstNumber || client.panNumber) && (
              <div className="flex items-center gap-2.5 text-foreground/85">
                <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-mono">
                  {[client.gstNumber, client.panNumber].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}
          </div>

          {client.note && (
            <div className="pt-4 border-t border-border/70">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Internal Notes
              </p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {client.note}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-border/70 grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                Projects
              </span>
              <span className="text-sm font-bold text-foreground font-mono">
                {projects.length}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                Quotes
              </span>
              <span className="text-sm font-bold text-foreground font-mono">
                {quotations.length}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                Invoices
              </span>
              <span className="text-sm font-bold text-foreground font-mono">
                {invoices.length}
              </span>
            </div>
          </div>
        </Card>

        {/* Right: Tabbed Details (Projects, Quotations, Invoices) */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="projects" className="w-full">
            <TabsList className="h-9 p-1 bg-muted rounded-lg border border-border/80 w-full sm:w-auto">
              <TabsTrigger value="projects" className="text-xs px-3.5 h-7">
                Projects ({projects.length})
              </TabsTrigger>
              <TabsTrigger value="quotations" className="text-xs px-3.5 h-7">
                Quotations ({quotations.length})
              </TabsTrigger>
              <TabsTrigger value="invoices" className="text-xs px-3.5 h-7">
                Billing ({invoices.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="mt-4">
              <DataTableShell
                search={{
                  value: search,
                  onChange: setSearch,
                  placeholder: "Search projects...",
                }}
                actions={
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setFormOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Project</span>
                  </Button>
                }
                isLoading={isLoadingProjects}
                isEmpty={filteredProjects.length === 0}
                emptyState={{
                  icon: FolderKanban,
                  title: search ? "No matching projects" : "No projects yet",
                  description: search
                    ? "Try adjusting your search criteria."
                    : "Create a project to start organizing workspaces and tasks for this client.",
                  action: {
                    label: "Add Project",
                    onClick: () => setFormOpen(true),
                    icon: Plus,
                  },
                }}
                pagination={{
                  page,
                  pageSize,
                  total: filteredProjects.length,
                  onPageChange: setPage,
                  onPageSizeChange: setPageSize,
                }}
              >
                <ProjectsListTable
                  projects={paginatedProjects}
                  onView={(project) => navigate(`/projects-list/${project.id}`)}
                  onEdit={(project) => navigate(`/projects-list/${project.id}/edit`)}
                  onDelete={setProjectToDelete}
                />
              </DataTableShell>
            </TabsContent>

            <TabsContent value="quotations" className="mt-4">
              <DataTableShell
                actions={
                  <Button asChild size="sm" className="h-8 text-xs gap-1.5">
                    <Link to={`/quotations-list/create?clientId=${client.id}`}>
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Quotation</span>
                    </Link>
                  </Button>
                }
                isLoading={isLoadingQuotations}
                isEmpty={quotations.length === 0}
                emptyState={{
                  icon: Receipt,
                  title: "No quotations created yet",
                  description: "Send formal price proposals and scope estimates to this client.",
                  action: {
                    label: "Create Quotation",
                    href: `/quotations-list/create?clientId=${client.id}`,
                    icon: Plus,
                  },
                }}
              >
                <QuotationsListTable
                  quotations={quotations}
                  onEdit={(q) => navigate(`/quotations-list/${q.id}`)}
                  onDelete={setQuotationToDelete}
                />
              </DataTableShell>
            </TabsContent>

            <TabsContent value="billing" className="mt-4">
              <DataTableShell
                actions={
                  <Button asChild size="sm" className="h-8 text-xs gap-1.5">
                    <Link to={`/invoices-list/create?clientId=${client.id}`}>
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Invoice</span>
                    </Link>
                  </Button>
                }
                isLoading={isLoadingInvoices}
                isEmpty={invoices.length === 0}
                emptyState={{
                  icon: Wallet,
                  title: "No invoices issued yet",
                  description: "Bill this client for milestones, deliverables, or retainer services.",
                  action: {
                    label: "Create Invoice",
                    href: `/invoices-list/create?clientId=${client.id}`,
                    icon: Plus,
                  },
                }}
              >
                <InvoicesListTable
                  invoices={invoices}
                  onEdit={(inv) => navigate(`/invoices-list/${inv.id}`)}
                  onDelete={setInvoiceToDelete}
                />
              </DataTableShell>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        clientId={client.id}
        companyId={client.companyId}
        onCreated={fetchProjects}
      />

      <ConfirmDialog
        open={!!projectToDelete}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
        title="Delete Project"
        description={`Are you sure you want to delete ${projectToDelete?.title}? Workspaces and tasks will also be removed.`}
        isLoading={isDeleting}
        onConfirm={handleDeleteProject}
      />

      <ConfirmDialog
        open={!!quotationToDelete}
        onOpenChange={(open) => !open && setQuotationToDelete(null)}
        title="Delete Quotation"
        description={`Are you sure you want to delete quotation ${quotationToDelete?.quotationNumber}?`}
        onConfirm={handleDeleteQuotation}
      />

      <ConfirmDialog
        open={!!invoiceToDelete}
        onOpenChange={(open) => !open && setInvoiceToDelete(null)}
        title="Delete Invoice"
        description={`Are you sure you want to delete invoice ${invoiceToDelete?.invoiceNumber}?`}
        onConfirm={handleDeleteInvoice}
      />
    </div>
  );
}
