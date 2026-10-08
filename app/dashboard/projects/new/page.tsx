"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ProjectForm from "@/components/forms/project-form";
import useSWR from "swr";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast"; // Import react-hot-toast

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
  const [permissions, setPermissions] = useState<string[]>([]);
  const [hasManageProjectsPermission, setHasManageProjectsPermission] = useState(false); // New state for permission check
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Fetch permissions with simple fetch
  useEffect(() => {
    const fetchPermissions = async () => {
      if (status !== "authenticated" || !session?.user?.id) {
        setLoading(false);
        return;
      }

      try {
        console.log("Fetching permissions for user:", session.user.id);

        // Fetch user role
        const roleResponse = await fetch(`/api/users/role?id=${session.user.id}`, {
          credentials: "include",
        });

        if (!roleResponse.ok) {
          throw new Error(`Failed to fetch user role: ${roleResponse.status}`);
        }

        const userData = await roleResponse.json();
        console.log("User role data:", userData);

        if (userData.role) {
          // Fetch permissions for this role
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

          // Check for Manage-projects permission
          const hasPermission = userPermissions.includes("Manage-projects");
          setHasManageProjectsPermission(hasPermission);
          console.log("Has Manage-projects permission:", hasPermission);

          if (!hasPermission) {
            toast.error("You do not have permission to manage projects.");
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching permissions:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch permissions");
        toast.error(err instanceof Error ? err.message : "Failed to fetch permissions");
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [session, status]);

  // Determine if user should see all projects or just their own
  const userRole = session?.user?.role;
  const isAdminOrManager = userRole === "ADMIN" || userRole === "Manager";

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
    company: client.company,
  }));

  // Show loading state
  if (status === "loading" || loading || usersLoading || clientsLoading || projectsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
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
  if (status === "unauthenticated" || !session?.user?.id || error) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {status === "unauthenticated" || !session?.user?.id ? "Unauthorized" : "Error Loading Data"}
            </h3>
            <p className="text-gray-600 text-center mb-4">
              {status === "unauthenticated" || !session?.user?.id
                ? "Please sign in to access this page."
                : error || "An error occurred."}
            </p>
            <Button
              onClick={() =>
                status === "unauthenticated" || !session?.user?.id
                  ? router.push("/auth/signin")
                  : window.location.reload()
              }
            >
              {status === "unauthenticated" || !session?.user?.id ? "Sign In" : "Retry"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // NEW: Show permission denied state
  if (!hasManageProjectsPermission) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-4xl mb-4">🚫</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600 text-center mb-4">
              You do not have the required permission ("Manage-projects") to create or manage projects.
              <br />
              Please contact your administrator for access.
            </p>
            <Button onClick={() => router.push("/dashboard")}>Go Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render the form if all checks pass
  return (
    <div>
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
