"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Edit,
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Calendar,
  FolderKanban,
  ExternalLink,
  Globe,
  MapPin,
  CreditCard,
  FileText,
  Key,
  Plus,
  Receipt,
  FileCheck2,
  Clock,
  Sparkles,
  User,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { getMediaUrl } from "@/lib/utils";
import { useBreadcrumbTitle } from "@/lib/route-labels";

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  altPhone?: string | null;
  company?: string | null;
  website?: string | null;
  industry?: string | null;
  status: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  gstin?: string | null;
  panNumber?: string | null;
  notes?: string | null;
  avatar?: string | null;
  createdAt: string;
  updatedAt: string;
  projects?: Array<{
    id: string;
    name: string;
    description?: string | null;
    isActive: boolean;
    startDate: string;
    endDate?: string | null;
    createdAt: string;
    _count?: { posts: number };
  }>;
  quotations?: Array<{
    id: string;
    quotationNumber: string;
    title: string;
    totalAmount: number | string;
    status: string;
    createdAt: string;
  }>;
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    title: string;
    total: number | string;
    status: string;
    createdAt: string;
  }>;
  credentials?: Array<{
    id: string;
    title: string;
    username: string;
    url?: string | null;
    createdAt: string;
  }>;
}

export default function ClientIdPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);

  useBreadcrumbTitle(clientId, client?.name || "Client Details");

  useEffect(() => {
    const fetchUserRoleAndPermissions = async () => {
      if (status === "loading" || !session?.user?.id) return;

      try {
        const userRes = await fetch(`/api/users/role?id=${session.user.id}`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!userRes.ok) throw new Error("Failed to fetch user role");
        const userData = await userRes.json();

        if (userData.role) {
          const permRes = await fetch(`/api/role-permission/role/${userData.role}`, {
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          if (permRes.ok) {
            const permData = await permRes.json();
            const permissionStrings = Array.isArray(permData)
              ? permData.map((item: { permission: string }) => item.permission)
              : [];
            setPermissions(permissionStrings);
          }
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
      }
    };
    fetchUserRoleAndPermissions();
  }, [session, status]);

  const fetchClient = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Error ${res.status}`);
      }

      const clientData: Client = await res.json();
      setClient(clientData);
    } catch (error: any) {
      console.error("Failed to load client details:", error);
      setAuthError(error.message || "Could not retrieve client details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchClient();
    }
  }, [clientId]);

  const canManageClients = permissions.includes("Manage-clients");

  const formatDate = (date?: string | null) => {
    if (!date) return "—";
    try {
      return format(new Date(date), "MMM d, yyyy");
    } catch {
      return date;
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-md" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (authError || !client) {
    return (
      <div className="py-12">
        <EmptyState
          icon={Building2}
          title="Client Not Found"
          description={authError || "The requested client does not exist or you do not have permission."}
          actionLabel="Back to Clients"
          onAction={() => router.push("/dashboard/clients")}
        />
      </div>
    );
  }

  const projects = client.projects || [];
  const quotations = client.quotations || [];
  const invoices = client.invoices || [];
  const credentials = client.credentials || [];

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => router.push("/dashboard/clients")}
            aria-label="Back to clients"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="size-12 rounded-lg border border-border/80">
              {client.avatar && <AvatarImage src={getMediaUrl(client.avatar)} />}
              <AvatarFallback className="rounded-lg text-sm font-semibold bg-muted text-foreground">
                {client.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {client.name}
                </h1>
                {client.company && (
                  <span className="text-sm text-muted-foreground font-medium">
                    · {client.company}
                  </span>
                )}
                <Badge
                  variant={
                    client.status === "ACTIVE"
                      ? "success"
                      : client.status === "ONBOARDING"
                      ? "warning"
                      : "neutral"
                  }
                  className="text-[11px]"
                >
                  {client.status || "ACTIVE"}
                </Badge>
                {client.industry && (
                  <Badge variant="outline" className="text-[11px]">
                    {client.industry}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Client ID: <span className="font-mono text-[11px]">{client.id}</span> · Registered {formatDate(client.createdAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManageClients && (
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href={`/dashboard/clients/${client.id}/edit`}>
                <Edit className="size-3.5 mr-1.5" />
                Edit Profile
              </Link>
            </Button>
          )}
          <Button asChild size="sm" className="text-xs">
            <Link href={`/dashboard/projects/new?clientId=${client.id}`}>
              <Plus className="size-3.5 mr-1.5" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Projects</span>
              <FolderKanban className="size-4 text-primary" />
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">{projects.length}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {projects.filter((p) => p.isActive).length} active campaigns
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Quotations</span>
              <FileText className="size-4 text-sky-600" />
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">{quotations.length}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Commercial proposals</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Invoices</span>
              <Receipt className="size-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">{invoices.length}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Billing invoices</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Vault Items</span>
              <Key className="size-4 text-amber-600" />
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground">{credentials.length}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Stored credentials</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabbed Interface */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="overview" className="text-xs">
            Client Overview
          </TabsTrigger>
          <TabsTrigger value="projects" className="text-xs">
            Projects ({projects.length})
          </TabsTrigger>
          <TabsTrigger value="billing" className="text-xs">
            Quotations & Invoices ({quotations.length + invoices.length})
          </TabsTrigger>
          <TabsTrigger value="credentials" className="text-xs">
            Credentials Vault ({credentials.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Contact Details */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="size-4 text-primary" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted-foreground" /> Email
                  </span>
                  {client.email ? (
                    <a href={`mailto:${client.email}`} className="font-medium text-foreground hover:underline">
                      {client.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Phone className="size-3.5 text-muted-foreground" /> Phone
                  </span>
                  {client.phone ? (
                    <a href={`tel:${client.phone}`} className="font-medium text-foreground hover:underline tabular-nums">
                      {client.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Alt Phone</span>
                  <span className="font-medium text-foreground tabular-nums">{client.altPhone || "—"}</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Globe className="size-3.5 text-muted-foreground" /> Website
                  </span>
                  {client.website ? (
                    <a
                      href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      Visit <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tax & Commercial IDs */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="size-4 text-primary" />
                  Tax & Commercial
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">GSTIN / Tax ID</span>
                  <span className="font-mono text-xs font-semibold text-foreground uppercase">
                    {client.gstin || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">PAN Number</span>
                  <span className="font-mono text-xs font-semibold text-foreground uppercase">
                    {client.panNumber || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Industry</span>
                  <span className="font-medium text-foreground">{client.industry || "—"}</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Account Status</span>
                  <span className="font-medium text-foreground">{client.status || "ACTIVE"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Billing Address */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  Billing Address
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2 text-xs">
                <p className="font-medium text-foreground leading-relaxed">
                  {client.address || "No street address recorded"}
                </p>
                <div className="text-muted-foreground pt-1 space-y-0.5">
                  <p>
                    {[client.city, client.state, client.postalCode].filter(Boolean).join(", ") || "—"}
                  </p>
                  <p>{client.country || "India"}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Internal Notes */}
          {client.notes && (
            <Card className="shadow-2xs">
              <CardHeader className="pb-2 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Internal Account Notes & Deliverable Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {client.notes}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Projects */}
        <TabsContent value="projects">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FolderKanban className="size-4 text-primary" />
                    Campaigns & Workspaces
                  </CardTitle>
                  <CardDescription className="text-xs">
                    All marketing projects active or archived for this client
                  </CardDescription>
                </div>
                <Button asChild size="sm" className="text-xs">
                  <Link href={`/dashboard/projects/new?clientId=${client.id}`}>
                    <Plus className="size-3.5 mr-1.5" />
                    New Project
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {projects.length === 0 ? (
                <EmptyState
                  icon={FolderKanban}
                  title="No projects configured"
                  description="Create the first project workspace to start scheduling creatives and workflows."
                  actionLabel="Create Project"
                  onAction={() => router.push(`/dashboard/projects/new?clientId=${client.id}`)}
                />
              ) : (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Project Name</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="text-xs font-semibold">Timeline</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Posts Count</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.map((proj) => (
                        <TableRow key={proj.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs font-medium">
                            <Link
                              href={`/dashboard/projects/${proj.id}`}
                              className="hover:underline text-foreground font-semibold"
                            >
                              {proj.name}
                            </Link>
                            {proj.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                {proj.description}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant={proj.isActive ? "success" : "neutral"} className="text-[10px]">
                              {proj.isActive ? "Active" : "Archived"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(proj.startDate)} {proj.endDate ? `— ${formatDate(proj.endDate)}` : ""}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums font-semibold">
                            {proj._count?.posts || 0}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                              <Link href={`/dashboard/projects/${proj.id}`}>
                                View <ExternalLink className="size-3 ml-1" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Billing & Quotations */}
        <TabsContent value="billing" className="space-y-4">
          {/* Quotations Card */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="size-4 text-sky-600" />
                    Quotations & Proposals ({quotations.length})
                  </CardTitle>
                  <CardDescription className="text-xs">Commercial cost estimates for this client</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="text-xs">
                  <Link href={`/dashboard/quotations/new?clientId=${client.id}`}>
                    <Plus className="size-3.5 mr-1.5" />
                    New Quotation
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {quotations.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No quotations created for this client yet.
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Quote #</TableHead>
                        <TableHead className="text-xs font-semibold">Title</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Amount</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotations.map((q) => (
                        <TableRow key={q.id}>
                          <TableCell className="text-xs font-mono font-medium">{q.quotationNumber}</TableCell>
                          <TableCell className="text-xs font-medium">{q.title}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {q.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold tabular-nums">
                            ₹{Number(q.totalAmount || 0).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                              <Link href={`/dashboard/quotations/${q.id}`}>View</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoices Card */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="size-4 text-emerald-600" />
                Tax Invoices ({invoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {invoices.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No billing invoices issued yet.
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Invoice #</TableHead>
                        <TableHead className="text-xs font-semibold">Description</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="text-xs font-mono font-medium">{inv.invoiceNumber}</TableCell>
                          <TableCell className="text-xs">{inv.title}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold tabular-nums">
                            ₹{Number(inv.total || 0).toLocaleString("en-IN")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Credentials Vault */}
        <TabsContent value="credentials">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Key className="size-4 text-amber-600" />
                    Credentials & Social Access
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Encrypted logins, social handles, and API credentials stored for this client
                  </CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="text-xs">
                  <Link href={`/dashboard/credentials?clientId=${client.id}`}>
                    Manage Credentials
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {credentials.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No stored client credentials in the vault.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {credentials.map((cred) => (
                    <div
                      key={cred.id}
                      className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{cred.title}</span>
                        <Key className="size-3.5 text-muted-foreground" />
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">{cred.username}</p>
                      {cred.url && (
                        <a
                          href={cred.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-primary hover:underline flex items-center gap-1"
                        >
                          Login URL <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}