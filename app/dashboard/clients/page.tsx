"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/use-permissions";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Building2, Mail, Phone, Search, Eye, Edit, Trash2, Loader2, Filter, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { getMediaUrl } from "@/lib/utils";
import MediaPopup from "@/components/mediaPopup";
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog";

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  industry?: string | null;
  status?: string;
  avatar?: string | null;
  createdAt: string;
  updatedAt: string;
  projects: { id: string; isActive: boolean }[];
}

const fetcher = async (url: string) => {
  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}t=${Date.now()}`;
  const response = await fetch(fullUrl, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid client data format");
  }
  return data;
};

export default function ClientsPage() {
  const { data: session, status } = useSession();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("NEWEST");
  const { can, role: userRole, isLoading: isCheckingPermissions } = usePermissions();
  const [selectedLogo, setSelectedLogo] = useState<{ url: string; filename: string; type: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isNavigatingToEdit, setIsNavigatingToEdit] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const router = useRouter();

  /**
   * Permissions come from `/api/me/permissions` via usePermissions().
   *
   * This page used to fetch `/api/users/role?id=...` and then
   * `/api/role-permission/role/<roleName>` to work out what the viewer may do. Both are
   * administrative endpoints — they require `users:update` and `roles:read` — so any
   * role without those got 403 and the page rendered "Forbidden" even when it held the
   * permission for this module. It then compared against legacy names like
   * "View-clients", which a role created in the permission matrix never holds.
   */

  const clientsUrl = status !== "loading" && session && !isCheckingPermissions && can("clients", "read")
    ? "/api/clients"
    : null;

  const { data: clients = [], error: clientsError, isLoading } = useSWR<Client[]>(
    clientsUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      onError: (error) => {
        console.error("Clients SWR error:", error);
        toast.error("Failed to load clients");
      },
    }
  );

  useEffect(() => {
    if (clientsUrl) {
      mutate(clientsUrl);
    }
  }, [clientsUrl]);

  useEffect(() => {
    if (clientsError) {
      setAuthError(clientsError instanceof Error ? clientsError.message : "Failed to fetch clients");
      toast.error(clientsError instanceof Error ? clientsError.message : "Failed to fetch clients");
    }
  }, [clientsError]);

  // Delete with toast confirmation
  const handleDelete = async (clientId: string, clientName: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete client");
      }
      await mutate("/api/clients");
      toast.success(`${clientName} deleted successfully!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete client");
    }
  };

  const handleEditNavigation = (clientId: string) => {
    setIsNavigatingToEdit(clientId);
    router.push(`/dashboard/clients/${clientId}/edit`);
    setTimeout(() => {
      setIsNavigatingToEdit((prev) => (prev === clientId ? null : prev));
    }, 5000);
  };

  const filteredClients = useMemo(() => {
    if (!clients || !Array.isArray(clients)) return [];

    let result = clients.filter((client) => {
      const clientName = client.name || "";
      const clientEmail = client.email || "";
      const clientCompany = client.company || "";
      const clientPhone = client.phone || "";

      const matchesSearch =
        !searchTerm.trim() ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientCompany.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientPhone.includes(searchTerm);

      if (!matchesSearch) return false;

      if (statusFilter !== "ALL") {
        const clientStatus = (client.status || "ACTIVE").toUpperCase();
        if (clientStatus !== statusFilter) return false;
      }

      if (projectFilter === "WITH_PROJECTS") {
        const activeCount = client.projects?.filter((p) => p.isActive)?.length || 0;
        if (activeCount === 0) return false;
      } else if (projectFilter === "NO_PROJECTS") {
        const totalProjects = client.projects?.length || 0;
        if (totalProjects > 0) return false;
      }

      return true;
    });

    return result.sort((a, b) => {
      if (sortBy === "OLDEST") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "NAME_ASC") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortBy === "NAME_DESC") {
        return (b.name || "").localeCompare(a.name || "");
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [clients, searchTerm, statusFilter, projectFilter, sortBy]);

  const canManageClients = can("clients", "update");
  const canViewClients = can("clients", "read");

  if (isCheckingPermissions || status === "loading") {
    return (
      <div className="space-y-6 animate-in fade-in-50 duration-200">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-fit">
          <Skeleton className="h-14 w-36 rounded-lg" />
          <Skeleton className="h-14 w-36 rounded-lg" />
          <Skeleton className="h-14 w-36 rounded-lg" />
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-12 text-center">
        <p className="text-sm font-medium text-destructive">Please sign in to view clients.</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-12 text-center">
        <p className="text-sm font-medium text-destructive">{authError}</p>
      </div>
    );
  }

  if (!canViewClients) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-12 text-center">
        <h3 className="mb-2 text-base font-semibold tracking-tight text-foreground">Access Denied</h3>
        <p className="text-center text-sm text-muted-foreground">You do not have permission to view clients.</p>
      </div>
    );
  }

  const totalClients = clients.length;
  const activeProjectsCount = clients.reduce((sum, c) => sum + (c.projects?.filter(p => p.isActive)?.length || 0), 0);

  return (
    <>
      <div className="space-y-6 animate-in fade-in-50 duration-200">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Clients</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage client directory, brand accounts, and active retainers.
            </p>
          </div>
          {canManageClients && (
            <Link href="/dashboard/clients/new">
              <Button size="sm" className="gap-1.5 shadow-2xs">
                <Plus className="size-4" />
                Add Client
              </Button>
            </Link>
          )}
        </div>

        {/* Quick Stat Chips */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-fit">
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-2 shadow-2xs">
            <div className="size-2 rounded-full bg-primary" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Clients</span>
              <span className="text-base font-bold tabular-nums text-foreground">{totalClients}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-2 shadow-2xs">
            <div className="size-2 rounded-full bg-emerald-500" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Projects</span>
              <span className="text-base font-bold tabular-nums text-foreground">{activeProjectsCount}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-2 shadow-2xs">
            <div className="size-2 rounded-full bg-blue-500" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtered Results</span>
              <span className="text-base font-bold tabular-nums text-foreground">{filteredClients.length}</span>
            </div>
          </div>
        </div>

        {/* Table & Search Container */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search clients by name, email, company, or phone..."
                aria-label="Search clients by name, email, company, or phone"
                className="h-9 w-full bg-background pl-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Status" className="h-9 w-[130px] bg-background text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Status</SelectItem>
                <SelectItem value="ACTIVE" className="text-xs">Active</SelectItem>
                <SelectItem value="INACTIVE" className="text-xs">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {/* Project Activity Filter */}
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger aria-label="Projects" className="h-9 w-[150px] bg-background text-xs">
                <SelectValue placeholder="Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Projects</SelectItem>
                <SelectItem value="WITH_PROJECTS" className="text-xs">With Active Projects</SelectItem>
                <SelectItem value="NO_PROJECTS" className="text-xs">No Projects</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Filter */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger aria-label="Sort" className="h-9 w-[140px] bg-background text-xs">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEWEST" className="text-xs">Newest First</SelectItem>
                <SelectItem value="OLDEST" className="text-xs">Oldest First</SelectItem>
                <SelectItem value="NAME_ASC" className="text-xs">Name (A-Z)</SelectItem>
                <SelectItem value="NAME_DESC" className="text-xs">Name (Z-A)</SelectItem>
              </SelectContent>
            </Select>

            {(searchTerm || statusFilter !== "ALL" || projectFilter !== "ALL" || sortBy !== "NEWEST") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("ALL");
                  setProjectFilter("ALL");
                  setSortBy("NEWEST");
                }}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-border/70 bg-card p-12 text-center shadow-2xs">
              <p className="text-sm text-muted-foreground">Loading clients…</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/70 bg-card py-16 shadow-2xs">
              <Building2 className="mb-3 size-10 text-muted-foreground/50" />
              <h3 className="mb-1 text-base font-semibold tracking-tight text-foreground">
                {searchTerm ? "No clients match your search" : "No clients found"}
              </h3>
              <p className="mb-5 max-w-sm text-center text-xs text-muted-foreground">
                {searchTerm
                  ? "Try searching with a different term or keyword."
                  : "Get started by adding your first client to the platform."}
              </p>
              {canManageClients && (
                <Link href="/dashboard/clients/new">
                  <Button size="sm" className="gap-1.5 shadow-2xs">
                    <Plus className="size-4" />
                    Add Client
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-2xs">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Projects</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-accent">
                          {client.avatar ? (
                            <img
                              src={getMediaUrl(client.avatar)}
                              alt={client.name}
                              className="h-full w-full cursor-pointer object-cover transition-opacity hover:opacity-80"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLogo({
                                  url: getMediaUrl(client.avatar!),
                                  filename: client.avatar!.split("/").pop() || `${client.name}.jpg`,
                                  type: "image",
                                });
                              }}
                              title="Click to view full image"
                            />
                          ) : (
                            <span className="text-xs font-semibold uppercase text-accent-foreground">
                              {client.name.split(" ").slice(0, 2).map(w => w[0]).join("")}
                            </span>
                          )}
                        </div>
                        <div className="max-w-[220px] truncate font-medium text-foreground" title={client.name}>{client.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">{client.company || "—"}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {client.industry && (
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {client.industry}
                            </span>
                          )}
                          {client.status && client.status !== "ACTIVE" && (
                            <span className="text-xs text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium">
                              {client.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="size-4 shrink-0" />
                        <span className="max-w-[240px] truncate" title={client.email}>{client.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.phone ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="size-4 shrink-0" />
                          <span>{client.phone}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{client.projects?.length || 0} Projects</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm tabular-nums text-muted-foreground">
                        {format(new Date(client.createdAt), "MMM dd, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/clients/${client.id}`}>
                          <Button variant="ghost" size="icon" title="View Client" aria-label="View Client">
                            <Eye className="size-4" />
                          </Button>
                        </Link>
                        {canManageClients && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              title="Edit Client"
                              aria-label="Edit Client"
                              onClick={() => handleEditNavigation(client.id)}
                              disabled={isNavigatingToEdit === client.id}
                            >
                              {isNavigatingToEdit === client.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Edit className="size-4" />
                              )}
                            </Button>
                            
                            <Button 
                              variant="ghost" 
                              size="icon"
                              title="Delete Client"
                              aria-label="Delete Client"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={isNavigatingToEdit === client.id}
                              onClick={() => setClientToDelete({ id: client.id, name: client.name })}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>

    <MediaPopup
        isOpen={!!selectedLogo}
        onClose={() => setSelectedLogo(null)}
        asset={selectedLogo}
      />

      <DeleteConfirmationDialog
        isOpen={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        onConfirm={async () => {
          if (!clientToDelete) return;
          setIsDeletingClient(true);
          try {
            await handleDelete(clientToDelete.id, clientToDelete.name);
            setClientToDelete(null);
          } finally {
            setIsDeletingClient(false);
          }
        }}
        itemName={clientToDelete?.name || "Client"}
        entityType="client"
        isLoading={isDeletingClient}
      />
    </>
  );
}
