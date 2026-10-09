"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Building2, Mail, Phone, Search, Eye, Edit, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import toast, { Toaster } from "react-hot-toast"; // react-hot-toast
import { getMediaUrl } from "@/lib/utils";
import MediaPopup from "@/components/mediaPopup";
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog";

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
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
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<{ url: string; filename: string; type: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [isNavigatingToEdit, setIsNavigatingToEdit] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchUserRoleAndPermissions = async () => {
      if (status === "loading" || !session?.user?.id) {
        setIsCheckingPermissions(false);
        return;
      }

      try {
        const userRes = await fetch(`/api/users/role?id=${session.user.id}`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!userRes.ok) {
          const errorData = await userRes.json();
          throw new Error(errorData.error || "Failed to fetch user role");
        }
        const userData = await userRes.json();
        setUserRole(userData.role || "CLIENT");

        if (userData.role) {
          const permRes = await fetch(`/api/role-permission/role/${userData.role}`, {
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          if (!permRes.ok) {
            const errorData = await permRes.json();
            throw new Error(errorData.error || "Failed to fetch permissions");
          }
          const permData = await permRes.json();
          const permissionStrings = Array.isArray(permData)
            ? permData.map((item: { permission: string }) => item.permission)
            : [];
          setPermissions(permissionStrings);
        }
      } catch (error) {
        console.error("Error fetching user role/permissions:", error);
        setAuthError(error instanceof Error ? error.message : "Failed to load user permissions");
        toast.error(error instanceof Error ? error.message : "Failed to load permissions");
      } finally {
        setIsCheckingPermissions(false);
      }
    };
    fetchUserRoleAndPermissions();
  }, [session, status]);

  const clientsUrl = status !== "loading" && session && !isCheckingPermissions && permissions.includes("View-clients")
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
    const promise = async () => {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete client");
      }
      await mutate("/api/clients");
      return { name: clientName };
    };

    toast.promise(promise(), {
      loading: `Deleting ${clientName}...`,
      success: (data) => `${data.name} deleted successfully!`,
      error: (err) => err.message || "Failed to delete client",
    });
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

    return clients.filter((client) => {
      const clientName = client.name || "";
      const clientEmail = client.email || "";
      const clientCompany = client.company || "";
      const clientPhone = client.phone || "";

      return (
        clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientCompany.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientPhone.includes(searchTerm)
      );
    });
  }, [clients, searchTerm]);

  const canManageClients = permissions.includes("Manage-clients");
  const canViewClients = permissions.includes("View-clients");

  if (isCheckingPermissions || status === "loading") {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading clients…</p>
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-destructive">Please sign in to view clients.</p>
        </CardContent>
      </Card>
    );
  }

  if (authError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-destructive">{authError}</p>
        </CardContent>
      </Card>
    );
  }

  if (!canViewClients) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <h3 className="mb-2 text-base font-semibold tracking-tight text-foreground">Access Denied</h3>
          <p className="text-center text-sm text-muted-foreground">You do not have permission to view clients.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Toast container */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: "var(--neutral-800)", color: "var(--neutral-0)" },
          success: { style: { background: "var(--success)" } },
          error: { style: { background: "var(--destructive)" } },
        }}
      />

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Clients</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage your client relationships</p>
          </div>
          {canManageClients && (
            <Link href="/dashboard/clients/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            </Link>
          )}
        </div>

        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="min-w-0 flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search clients by name, email, company, or phone..."
                    aria-label="Search clients by name, email, company, or phone"
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="flex justify-center py-12">
              <p className="text-sm text-muted-foreground">Loading clients…</p>
            </CardContent>
          </Card>
        ) : filteredClients.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="mb-3 size-9 text-muted-foreground/60" />
              <h3 className="mb-2 text-base font-semibold tracking-tight text-foreground">
                {searchTerm ? "No clients match your search" : "No clients found"}
              </h3>
              <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
                {searchTerm
                  ? "Try adjusting your search criteria."
                  : "Get started by adding your first client to the system."}
              </p>
              {canManageClients && (
                <Link href="/dashboard/clients/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Client
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Active Projects</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell>{client.company || "N/A"}</TableCell>
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
          </Card>
        )}
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
