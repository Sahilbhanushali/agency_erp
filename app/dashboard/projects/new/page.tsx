"use client";

import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/use-permissions";
import { useRouter } from "next/navigation";
import ProjectForm from "@/components/forms/project-form";
import useSWR from "swr";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertTriangle, ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";

interface User {
  id: string;
  name: string;
  role: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
}

const fetcher = async (url: string) => {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    console.error(`API Error for ${url}:`, {
      status: response.status,
      statusText: response.statusText,
      error: errorMessage,
    });

    throw new Error(errorMessage);
  }

  return response.json();
};

export default function NewProjectPage() {
  const { data: session, status } = useSession();
  const { can, role: userRole } = usePermissions();
  const [hasManageProjectsPermission, setHasManageProjectsPermission] = useState(false); // New state for permission check
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Fetch permissions with simple fetch
  /**
   * Permissions come from `/api/me/permissions` via usePermissions().
   *
   * This page used to fetch `/api/users/role?id=...` and then
   * `/api/role-permission/role/<roleName>`. Both are administrative endpoints — they
   * require `users:update` and `roles:read` — so a role holding only this module's
   * permission got 403 from them and the page rendered "Forbidden" despite being
   * allowed in. They also returned legacy names like "Manage-projects", which a role
   * created in the permission matrix never holds.
   */


  // Determine if user should see all projects or just their own
  // Was a role-name check; projects:create is what the API actually enforces.
  const isAdminOrManager = can("projects", "create");

  // Build projects URL conditionally
  const projectsUrl = session?.user?.id
    ? `/api/projects${!isAdminOrManager ? `?userId=${session.user.id}` : ""}`
    : null;

  // Fetch all users
  const { data: users = [], error: usersError, isLoading: usersLoading } = useSWR<User[]>(
    status === "authenticated" && session?.user?.id ? "/api/users" : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      onError: (error) => {
        console.error("Users SWR error:", error);
        toast.error(`Failed to fetch users: ${error.message}`);
      },
    }
  );

  // Fetch all clients
  const { data: clients = [], error: clientsError, isLoading: clientsLoading } = useSWR<Client[]>(
    status === "authenticated" && session?.user?.id ? "/api/clients" : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      onError: (error) => {
        console.error("Clients SWR error:", error);
        toast.error(`Failed to fetch clients: ${error.message}`);
      },
    }
  );

  // Fetch projects
  const { data: projects = [], error: projectsError, isLoading: projectsLoading } = useSWR(
    status === "authenticated" && session?.user?.id ? projectsUrl : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      onError: (error) => {
        console.error("Projects SWR error:", error);
        toast.error(`Failed to fetch projects: ${error.message}`);
      },
    }
  );

  // Handle SWR errors
  useEffect(() => {
    if (usersError) {
      console.error("Failed to fetch users:", usersError);
      setError(`Failed to fetch users: ${usersError.message}`);
    }
    if (clientsError) {
      console.error("Failed to fetch clients:", clientsError);
      setError(`Failed to fetch clients: ${clientsError.message}`);
    }
    if (projectsError) {
      console.error("Failed to fetch projects:", projectsError);
      setError(`Failed to fetch projects: ${projectsError.message}`);
    }
  }, [usersError, clientsError, projectsError]);

  // Filter users by role for managers and Team Leads
  const managers = users
    ?.filter((user) => user?.role === "Manager")
    ?.map((user) => ({
      id: parseInt(user.id),
      name: user.name,
    })) || [];

  const designerHeads = users
    ?.filter((user) => user?.role === "Team Lead")
    ?.map((user) => ({
      id: parseInt(user.id),
      name: user.name,
    })) || [];

  // Map clients to match ProjectForm's expected Client interface
  const formattedClients = clients.map((client) => ({
    id: client.id,
    name: client.name,
    company: client.company || "",
  }));

  // Show loading state
  if (status === "loading" || loading || usersLoading || clientsLoading || projectsLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Card className="shadow-2xs">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error or unauthorized state
  if (status === "unauthenticated" || !session?.user?.id || error) {
    return (
      <div className="py-12">
        <EmptyState
          icon={AlertTriangle}
          title={status === "unauthenticated" || !session?.user?.id ? "Authentication Required" : "Error Loading Data"}
          description={
            status === "unauthenticated" || !session?.user?.id
              ? "Please sign in to access project campaign creation."
              : error || "An unexpected error occurred while loading dependencies."
          }
          actionLabel={status === "unauthenticated" || !session?.user?.id ? "Sign In" : "Retry"}
          onAction={() =>
            status === "unauthenticated" || !session?.user?.id
              ? router.push("/auth/signin")
              : window.location.reload()
          }
        />
      </div>
    );
  }

  // Permission denied state
  if (!hasManageProjectsPermission) {
    return (
      <div className="py-12">
        <EmptyState
          icon={ShieldAlert}
          title="Access Restricted"
          description='You do not have the required permission ("Manage-projects") to create or configure campaigns. Please contact your administrator.'
          actionLabel="Go Back to Dashboard"
          onAction={() => router.push("/dashboard")}
        />
      </div>
    );
  }

  // Render the form if all checks pass
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title="Create New Project"
        description="Set up a new client campaign with assigned managers, lead designers, and monthly deliverable goals."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/dashboard/projects">
            <ArrowLeft className="size-3.5" />
            Back to Projects
          </Link>
        </Button>
      </PageHeader>

      <ProjectForm
        clients={formattedClients}
        managers={managers}
        designerHeads={designerHeads}
        users={users}
        projects={projects}
        currentUser={{
          id: session.user.id,
          name: session.user.name || "",
          role: session.user.role || "Unknown",
        }}
      />
    </div>
  );
}
