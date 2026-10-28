"use client";

import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/use-permissions";
import { useRouter, useParams } from "next/navigation";
import ProjectForm from "@/components/forms/project-form";
import useSWR from "swr";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { useBreadcrumbTitle } from "@/lib/route-labels";

interface User {
  id: string;
  name: string;
  role: string;
  email?: string;
  avatar?: string | null;
  createdAt?: string;
  assignedProjects?: any[];
}

interface Client {
  id: string;
  name: string;
  company: string | null;
  companies?: { id: string; name: string }[];
}

interface AssignedUser {
  id: string;
  role: {
    name: string;
  };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  clientCompanyId?: string | null;
  managerId: number | null;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  image?: string | null;
  postTypes: { [key: string]: number } | null;
  assignedUsers?: AssignedUser[];
  strategies?: { id: number; month: number; year: number; postTypes: { [key: string]: number } }[];
}

const fetcher = async (url: string) => {
  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}t=${Date.now()}`;
  
  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    cache: "no-store",
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

export default function EditProjectPage() {
  const { data: session, status } = useSession();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [error, setError] = useState<string | null>(null);

  useBreadcrumbTitle(id, "Edit Project");

  useEffect(() => {
    console.log("Project ID:", id);
    if (!id || typeof id !== "string") {
      console.error("Invalid project ID:", id);
      setError("Invalid project ID");
      toast.error("Invalid project ID");
    }
  }, [id]);

  // Fetch project
  const { data: projectRaw, error: projectError, isLoading: projectLoading } = useSWR<Project>(
    id && status === "authenticated" && session?.user?.id ? `/api/projects/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      onError: (error) => {
        console.error(`Failed to fetch project ${id}:`, error);
        toast.error(`Failed to fetch project: ${error.message}`);
      },
    }
  );

  // Fetch clients
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

  // Fetch users - API returns role as a flat string
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

  // Handle errors
  useEffect(() => {
    if (projectError) {
      console.error("Failed to fetch project:", projectError);
      setError(`Failed to fetch project: ${projectError.message}`);
    }
    if (clientsError) {
      console.error("Failed to fetch clients:", clientsError);
      setError(`Failed to fetch clients: ${clientsError.message}`);
    }
    if (usersError) {
      console.error("Failed to fetch users:", usersError);
      setError(`Failed to fetch users: ${usersError.message}`);
    }
  }, [projectError, clientsError, usersError]);

  // CRITICAL FIX: Ensure project structure matches server-side format
  // The server component gets assignedUsers from Prisma with: { id, role: { name } }
  // We need to ensure the same structure here
  const project = projectRaw ? {
    ...projectRaw,
    assignedUsers: projectRaw.assignedUsers || []
  } : undefined;

  useEffect(() => {
    if (project) {
      console.log("=== PROJECT DATA CHECK ===");
      console.log("Project ID:", project.id);
      console.log("Project Name:", project.name);
      console.log("Total Assigned Users:", project.assignedUsers?.length || 0);
      
      if (project.assignedUsers && project.assignedUsers.length > 0) {
        console.log("Assigned Users Full Data:", project.assignedUsers);
        console.log("First Assigned User:", {
          id: project.assignedUsers[0].id,
          role: project.assignedUsers[0].role
        });
        
        // Check if role has the expected structure
        const firstUser = project.assignedUsers[0];
        if (firstUser.role && typeof firstUser.role === 'object' && 'name' in firstUser.role) {
          console.log("✅ Role structure is correct: { name: '" + firstUser.role.name + "' }");
        } else {
          console.log("❌ Role structure is WRONG:", typeof firstUser.role, firstUser.role);
        }
        
        // Find Team Lead
        const designerHead = project.assignedUsers.find(u => u.role?.name === "Team Lead");
        console.log("Team Lead found:", designerHead ? `${designerHead.id}` : "NONE");
        
        // List all assigned user roles
        console.log("All assigned user roles:", project.assignedUsers.map(u => ({
          id: u.id,
          roleName: u.role?.name || 'UNDEFINED'
        })));
      } else {
        console.log("⚠️ No assigned users found in project");
      }
    }
  }, [project]);

  // Transform users for ProjectForm dropdowns
  console.log("=== ALL USERS FROM API ===");
  console.log("Total users:", users.length);
  console.log("Users:", users);
  
  const uniqueRoles = [...new Set(users.map(u => u.role))];
  console.log("Unique roles in system:", uniqueRoles);

  // Transform users for ProjectForm
  const managers = users
    .filter((user) => ["ADMIN", "Manager"].includes(user.role))
    .map((user) => ({
      id: parseInt(user.id),
      name: user.name,
    }));

  console.log("=== MANAGERS ===", managers);

  const designerHeads = users
    .filter((user) => user.role === "Team Lead")
    .map((user) => ({
      id: parseInt(user.id),
      name: user.name,
    }));

  console.log("=== Team LeadS ===", designerHeads);

  const contentWriters = users
    .filter((user) => user.role === "Content Writer")
    .map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log("=== CONTENT WRITERS ===", contentWriters);

  const transformedUsers = users
    .map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log("=== TRANSFORMED USERS (Team Members) ===", transformedUsers);

  // Format clients for ProjectForm
  const formattedClients = clients.map((client) => ({
    id: client.id,
    name: client.name,
    company: client.company || "",
    companies: client.companies ?? [],
  }));

  // Get current month and year
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  /**
   * Permissions come from `/api/me/permissions` via usePermissions().
   */
  useEffect(() => {
    if (status === "loading" || permissionsLoading) {
      return;
    }

    if (!can("projects", "update")) {
      toast.error("You do not have permission to edit projects");
      router.push("/dashboard/projects");
    }
  }, [status, permissionsLoading, can, router]);

  // Show loading state
  if (status === "loading" || permissionsLoading || projectLoading || clientsLoading || usersLoading) {
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
  if (status === "unauthenticated" || !session?.user?.id || error || !project) {
    return (
      <div className="py-12">
        <EmptyState
          icon={AlertTriangle}
          title={status === "unauthenticated" || !session?.user?.id ? "Authentication Required" : "Error Loading Project"}
          description={
            status === "unauthenticated" || !session?.user?.id
              ? "Please sign in to edit project campaigns."
              : error || "Project campaign not found or an unexpected error occurred."
          }
          actionLabel={status === "unauthenticated" || !session?.user?.id ? "Sign In" : "Back to Projects"}
          onAction={() =>
            status === "unauthenticated" || !session?.user?.id
              ? router.push("/auth/signin")
              : router.push("/dashboard/projects")
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title={`Edit Project: ${project.name}`}
        description="Update project details, monthly strategy, and cross-functional team assignments."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href={`/dashboard/projects/${id}`}>
            <ArrowLeft className="size-3.5" />
            View Project
          </Link>
        </Button>
      </PageHeader>
      <ProjectForm
        clients={formattedClients}
        managers={managers}
        designerHeads={designerHeads}
        users={transformedUsers}
        project={project}
        isEditing={true}
        defaultMonth={currentMonth}
        defaultYear={currentYear}
        currentUser={{
          id: session.user.id,
          name: session.user.name || "Unknown",
          role: session.user.role || "Unknown",
        }}
      />
    </div>
  );
}
