"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, ArrowLeft, Building2, Mail, Phone, Calendar, FolderKanban, ExternalLink } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { getMediaUrl } from "@/lib/utils";
import { useBreadcrumbTitle } from "@/lib/route-labels";

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  avatar?: string | null;
  createdAt: string;
  updatedAt: string;
  projects: Project[];
}

interface Project {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Post {
  id: string;
  title?: string;
  caption?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ClientIdPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [posts, setPosts] = useState<{ [projectId: string]: Post[] }>({});
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
        throw new Error(errorData.error || "Failed to fetch client");
      }
      const data = await res.json();
      setClient(data);
      setProjects(data.projects || []);
    } catch (error: any) {
      console.error("Error fetching client:", error);
      setAuthError(error.message || "Failed to fetch client");
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/posts`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setPosts((prev) => ({ ...prev, [projectId]: data }));
      }
    } catch (error) {
      console.error(`Error fetching posts for project ${projectId}:`, error);
    }
  };

  useEffect(() => {
    if (status !== "loading" && session && clientId) {
      fetchClient();
    }
  }, [session, status, clientId]);

  useEffect(() => {
    if (projects.length > 0) {
      projects.forEach((project) => fetchPosts(project.id));
    }
  }, [projects]);

  const canManageClients = permissions.includes("manage-clients");

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), "MMM dd, yyyy");
    } catch {
      return date;
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-60" />
          </div>
        </div>
        <Card className="shadow-2xs">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authError || !client) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <EmptyState
          icon={Building2}
          title="Client Not Found"
          description={authError || "The requested client does not exist or you do not have permission."}
          action={{
            label: "Back to Clients",
            onClick: () => router.push("/dashboard/clients"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
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
            <Avatar className="size-11 border border-border/80">
              {client.avatar && <AvatarImage src={getMediaUrl(client.avatar)} />}
              <AvatarFallback className="text-xs font-semibold bg-muted text-foreground">
                {client.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {client.name}
                </h1>
                {client.company && (
                  <Badge variant="secondary" className="text-xs">
                    {client.company}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Client profile and active marketing campaigns
              </p>
            </div>
          </div>
        </div>

        {canManageClients && (
          <Button asChild size="sm" className="text-xs self-start sm:self-auto">
            <Link href={`/dashboard/clients/${client.id}/edit`}>
              <Edit className="size-3.5 mr-1.5" />
              Edit Client
            </Link>
          </Button>
        )}
      </div>

      {/* Client Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-2xs">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" /> Email
              </span>
              <span className="font-medium text-foreground">{client.email}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Phone className="size-3.5 text-muted-foreground" /> Phone
              </span>
              <span className="font-medium text-foreground">{client.phone || "—"}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Building2 className="size-3.5 text-muted-foreground" /> Company
              </span>
              <span className="font-medium text-foreground">{client.company || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              Account Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Client ID</span>
              <span className="font-mono text-[11px] text-muted-foreground">{client.id}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Onboarded Date</span>
              <span className="font-medium text-foreground">{formatDate(client.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="font-medium text-foreground">{formatDate(client.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Section */}
      <Card className="shadow-2xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FolderKanban className="size-4 text-primary" />
                Active Projects & Campaigns
              </CardTitle>
              <CardDescription className="text-xs">
                Total {projects.length} campaign(s) running for this client
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {projects.length === 0 ? (
            <div className="py-8">
              <EmptyState
                icon={FolderKanban}
                title="No active projects"
                description="This client does not have any active campaigns yet."
                action={{
                  label: "Create Project",
                  onClick: () => router.push("/dashboard/projects/new"),
                }}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs">Project Campaign</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Created</TableHead>
                    <TableHead className="text-xs">Posts / Deliverables</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => {
                    const projectPosts = posts[project.id] || [];
                    return (
                      <TableRow key={project.id} className="hover:bg-muted/20">
                        <TableCell className="font-medium text-xs">
                          <Link
                            href={`/dashboard/projects/${project.id}`}
                            className="text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            <span>{project.name}</span>
                            <ExternalLink className="size-3 opacity-60" />
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={project.isActive ? "success" : "secondary"} className="text-[10px]">
                            {project.isActive ? "Active" : "Archived"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {formatDate(project.createdAt)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium tabular-nums text-foreground">
                            {projectPosts.length} posts
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="xs" className="h-7 text-xs">
                            <Link href={`/dashboard/projects/${project.id}`}>
                              View Campaign
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}