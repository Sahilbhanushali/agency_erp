"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { PostForm } from "@/components/forms/post-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";

interface PostData {
  id: string;
  title: string;
  caption?: string;
  type: string;
  platforms: { platform: string }[];
  projectId: string;
  scheduledAt?: string;
  designDueDate?: string;
  assignedToId?: string;
  festivalId?: number;
  customData?: {
    customType?: string;
    comment?: string;
    notes?: string;
    referenceUrl?: string;
  };
  assets: Array<{
    id: string;
    filename: string;
    url: string;
    type: string;
    size: number;
    isReference: boolean;
    isEdited: boolean;
  }>;
  writeUp?: string;
  project: {
    id: string;
    name: string;
    client: {
      id: string;
      name: string;
      email?: string;
      company?: string;
    };
  };
  assignedTo?: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
}

interface ProjectsApiResponse {
  projects: Array<{
    id: string;
    name: string;
    client: {
      id: string;
      name: string;
      email?: string;
      company?: string;
    };
    assignedUsers?: Array<{
      id: number;
      name: string;
      role: { name: string };
    }>;
  }>;
}

interface User {
  id: string;
  name: string;
  role: string;
  email: string;
  assignedProjects: { id: string; name: string }[];
}

interface PostApiResponse {
  post: PostData;
}

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = useParams();
  const id = resolvedParams.id;
  const [postData, setPostData] = useState<PostData | null>(null);
  const [projectsData, setProjectsData] = useState<ProjectsApiResponse | null>(null);
  const [designers, setDesigners] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      let hasError = false;

      try {
        // Fetch post data
        const postResponse = await fetch(`/api/posts/${id}`);
        if (!postResponse.ok) {
          const errorData = await postResponse.json();
          if (postResponse.status === 401) {
            router.push("/auth/signin");
            return;
          }
          if (postResponse.status === 403) {
            router.push("/dashboard");
            return;
          }
          if (postResponse.status === 404) {
            setError("Post not found");
            hasError = true;
            return;
          }
          throw new Error(errorData.error || "Failed to fetch post data");
        }
        const postResult = await postResponse.json();
        setPostData(postResult);
      } catch (err) {
        console.error("Error fetching post data:", err);
        setError("Failed to load post data. Please try again.");
        hasError = true;
      }

      // Fetch projects data
      try {
        const projectsResponse = await fetch(`/api/projects`);
        if (!projectsResponse.ok) {
          const errorData = await projectsResponse.json();
          throw new Error(errorData.error || "Failed to fetch projects data");
        }
        const projectsResult = await projectsResponse.json();
        const projects = Array.isArray(projectsResult)
          ? projectsResult
          : projectsResult.projects;

        if (!projects || !Array.isArray(projects)) {
          console.error("Invalid projects data structure:", projectsResult);
          throw new Error("Invalid projects data structure");
        }

        setProjectsData({ projects });
      } catch (err) {
        console.error("Error fetching projects data:", err);
        setError((prev) => prev || "Failed to load projects data. Please try again.");
        hasError = true;
      }

      // Fetch designers
      try {
        // Only fetch users with roles Designer or Video Editor
        const usersResponse = await fetch(`/api/users?role=Designer,Video%20Editor,Creative%20Executive%28Design%20%26%20Media%29`);
        if (!usersResponse.ok) {
          const errorData = await usersResponse.json();
          throw new Error(errorData.error || "Failed to fetch designers data");
        }
        const usersResult = await usersResponse.json();
        const users = Array.isArray(usersResult)
          ? usersResult
          : usersResult.users || [];

        if (!users || !Array.isArray(users)) {
          console.error("Invalid users data structure:", usersResult);
          throw new Error("Invalid users data structure");
        }

        const formattedDesigners: User[] = users.map((user: any) => ({
          id: user.id.toString(),
          name: user.name || "Unknown",
          role: user.role || "Designer",
          email: user.email || "",
          assignedProjects: user.assignedProjects
            ? user.assignedProjects.map((proj: any) => ({
                id: proj.id.toString(),
                name: proj.name || "Unknown",
              }))
            : [],
        }));

        setDesigners(formattedDesigners);
      } catch (err) {
        console.error("Error fetching designers data:", err);
        setError((prev) => prev || "Failed to load designers data. Please try again.");
        hasError = true;
      }

      if (hasError) {
        toast.error("Some data failed to load. Please try again.", {
          duration: 5000,
          position: "top-right",
        });
      }
      setLoading(false);
    }

    fetchData();
  }, [id, router]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!postData || !projectsData) {
    console.log("Missing data:", { postData, projectsData });
    return null;
  }

  // Transform the post data to match PostForm's expected format
  const formattedPost = {
    id: postData.id,
    title: postData.title,
    caption: postData.caption,
    type: postData.type,
    platforms: postData.platforms.map((p) => p.platform) || [],
    projectId: postData.projectId,
    scheduledAt: postData.scheduledAt
      ? new Date(postData.scheduledAt).toISOString().slice(0, 10)
      : undefined,
    designDueDate: postData.designDueDate
      ? new Date(postData.designDueDate).toISOString().slice(0, 10)
      : undefined,
   assignedToId: postData.assignedToId ? postData.assignedToId.toString() : "unassigned", 
    festivalId: postData.festivalId,
    customData: postData.customData,
    writeUp: postData.writeUp,
  };

  // Extract reference assets
  const referenceAssets = postData.assets.filter((asset) => asset.isReference);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Edit Post</h1>
        <p className="text-gray-600">Update and manage your scheduled social media post</p>
      </div>
      <PostForm
        projects={projectsData.projects}
        designers={designers}
        post={formattedPost}
        initialProjectId={postData.projectId}
        initialAssets={referenceAssets}
      />
    </div>
  );
}