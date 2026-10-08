"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

// Define TypeScript interfaces based on Prisma schema
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
  content: string;
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Fetch current user's role and permissions
  useEffect(() => {
    const fetchUserRoleAndPermissions = async () => {
      if (status === "loading" || !session?.user?.id) return;

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
          console.log("Received permissions:", permData);
          const permissionStrings = Array.isArray(permData) ? permData.map((item: { permission: string }) => item.permission) : [];
          console.log("Extracted permission strings:", permissionStrings);
          setPermissions(permissionStrings);
        }
      } catch (error) {
        console.error("Error fetching user role/permissions:", error);
        setAuthError(error instanceof Error ? error.message : "Failed to load user permissions");
      }
    };
    fetchUserRoleAndPermissions();
  }, [session, status]);

  // Fetch client details and projects
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
      if (!data || typeof data !== "object") {
        throw new Error("Invalid client data format");
      }
      setClient(data);
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Error fetching client:", error);
      setAuthError(error instanceof Error ? error.message : "Failed to fetch client");
    } finally {
      setLoading(false);
    }
  };

  // Fetch posts for each project
  const fetchPosts = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/posts`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to fetch posts for project ${projectId}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error("Invalid posts data format");
      }
      setPosts((prev) => ({ ...prev, [projectId]: data }));
    } catch (error) {
      console.error(`Error fetching posts for project ${projectId}:`, error);
      setPosts((prev) => ({ ...prev, [projectId]: [] }));
    }
  };

  // Fetch client and posts when session and permissions are loaded
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

  // Check if user has manage-clients permission
  const canManageClients = permissions.includes("manage-clients");

  // Format date
  const formatDate = (date: string) => {
    return format(new Date(date), "MMM dd, yyyy");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {status === "loading" ? (
        <p className="text-gray-600">Loading authentication...</p>
      ) : !session ? (
        <p className="text-red-600">Please sign in to view client details.</p>
      ) : authError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-red-600">{authError}</p>
          </CardContent>
        </Card>
      ) : !client ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-600">{loading ? "Loading client..." : "Client not found."}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => router.push("/dashboard/clients")} title="Back to Clients">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
            </div>
            {canManageClients && (
              <Link href={`/clients/${client.id}/edit`}>
                <Button>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Client
                </Button>
              </Link>
            )}
          </div>

          {/* Client Details */}
          <Card>
            <CardHeader>
              <CardTitle>Client Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium">{client.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{client.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{client.phone || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Company</p>
                  <p className="font-medium">{client.company || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="font-medium">{formatDate(client.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Updated</p>
                  <p className="font-medium">{formatDate(client.updatedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Projects */}
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <p className="text-gray-600">No active projects found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Posts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell>{project.name}</TableCell>
                        <TableCell>
                          <Badge variant={project.isActive ? "default" : "secondary"}>
                            {project.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(project.createdAt)}</TableCell>
                        <TableCell>
                          {posts[project.id] ? (
                            posts[project.id].length === 0 ? (
                              <p className="text-gray-600">No posts</p>
                            ) : (
                              <ul className="space-y-2">
                                {posts[project.id].map((post) => (
                                  <li key={post.id} className="text-sm border-b pb-2">
                                    <p>{post.content}</p>
                                    <p className="text-gray-500 text-xs">
                                      Posted on {formatDate(post.createdAt)}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            )
                          ) : (
                            <p className="text-gray-600">Loading posts...</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}