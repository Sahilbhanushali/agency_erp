"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import ProjectForm from "@/components/forms/project-form";
import useSWR from "swr";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "react-hot-toast";

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
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (status !== "authenticated" || !session?.user?.id) {
        return;
      }

      try {
        console.log("Fetching permissions for user:", session.user.id);
        const roleResponse = await fetch(`/api/users/role?id=${session.user.id}`, {
          credentials: "include",
        });

        if (!roleResponse.ok) {
          throw new Error(`Failed to fetch user role: ${roleResponse.status}`);
        }

        const userData = await roleResponse.json();
        console.log("User role data:", userData);

        if (userData.role) {
          const permResponse = await fetch(`/api/role-permission/role/${userData.role}`, {
            credentials: "include",
          });

          if (!permResponse.ok) {
            throw new Error(`Failed to fetch permissions: ${permResponse.status}`);
          }

          const permData = await permResponse.json();
          const userPermissions = permData.map((item: { permission: string }) => item.permission);
          console.log("User permissions:", userPermissions);
          setPermissions(userPermissions);
        }
      } catch (err) {
        console.error("Error fetching permissions:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch permissions");
      }
    };

    fetchPermissions();
  }, [session, status]);

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
  }));

  // Get current month and year
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  console.log(permissions," User permissions loaded");

// Updated fetchPermissions useEffect
useEffect(() => {
  const fetchPermissions = async () => {
    if (status !== "authenticated" || !session?.user?.id) {
      setPermissionsLoaded(true); // Early exit: treat as loaded (no perms)
      return;
    }

    try {
      console.log("Fetching permissions for user:", session.user.id);
      const roleResponse = await fetch(`/api/users/role?id=${session.user.id}`, {
        credentials: "include",
      });

      if (!roleResponse.ok) {
        throw new Error(`Failed to fetch user role: ${roleResponse.status}`);
      }

      const userData = await roleResponse.json();
      console.log("User role data:", userData);

      if (userData.role) {
        const permResponse = await fetch(`/api/role-permission/role/${userData.role}`, {
          credentials: "include",
        });

        if (!permResponse.ok) {
          throw new Error(`Failed to fetch permissions: ${permResponse.status}`);
        }

        const permData = await permResponse.json();
        const userPermissions = permData.map((item: { permission: string }) => item.permission);
        console.log("User permissions:", userPermissions);
        setPermissions(userPermissions);
      }
    } catch (err) {
      console.error("Error fetching permissions:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch permissions");
    } finally {
      // Always set loaded after attempt (success or fail)
      setPermissionsLoaded(true);
    }
  };

  fetchPermissions();
}, [session, status]);

// Updated auth check useEffect (with loaded guard + case-insensitive check)
useEffect(() => {
  // Only check if we've attempted to load permissions
  if (!permissionsLoaded) {
    return; // Skip until loaded
  }

  // Case-insensitive check: normalize to lowercase
  const hasManageProjectsPerm = permissions.some(perm => 
    perm.toLowerCase() === "manage-projects"
  );

  if (!hasManageProjectsPerm) {
    console.log("Unauthorized permission. Loaded perms:", permissions);
    toast.error("You do not have permission to edit projects");
    router.push("/dashboard");
  } else {
    console.log("✅ Authorized: Manage-projects permission found");
  }
}, [status, session, router, permissions, permissionsLoaded]); //

  // Show loading state
  if (status === "loading" || projectLoading || clientsLoading || usersLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Skeleton className="h-8 w-32 mb-2" />
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
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
      <div className="space-y-6 max-w-7xl mx-auto">
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {status === "unauthenticated" || !session?.user?.id ? "Unauthorized" : "Error Loading Data"}
            </h3>
            <p className="text-gray-600 text-center mb-4">
              {status === "unauthenticated" || !session?.user?.id
                ? "Please sign in to access this page."
                : error || "Project not found or an error occurred."}
            </p>
            <Button
              onClick={() =>
                status === "unauthenticated" || !session?.user?.id
                  ? router.push("/auth/signin")
                  : router.push("/dashboard/projects")
              }
            >
              {status === "unauthenticated" || !session?.user?.id ? "Sign In" : "Back to Projects"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  console.log("=== FINAL PROPS BEING PASSED TO PROJECTFORM ===");
  console.log("Clients:", formattedClients.length);
  console.log("Managers:", managers.length);
  console.log("Team Leads:", designerHeads.length);
  console.log("Content Writers:", contentWriters.length);
  console.log("Users (Team):", transformedUsers.length);
  console.log("Project assigned users:", project.assignedUsers?.length || 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Edit Project</h1>
        <p className="text-gray-600">Update project details</p>
      </div>
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
