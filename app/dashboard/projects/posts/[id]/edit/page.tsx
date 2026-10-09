"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { PostForm } from "@/components/forms/post-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { useBreadcrumbTitle } from "@/lib/route-labels";

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
  const id = resolvedParams.id as string;
  const [postData, setPostData] = useState<PostData | null>(null);
  const [projectsData, setProjectsData] = useState<ProjectsApiResponse | null>(null);
  const [designers, setDesigners] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useBreadcrumbTitle(id, postData?.title || "Edit Post");

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
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Card className="shadow-2xs">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-10 w-1/2 rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Error Loading Post</AlertTitle>
          <AlertDescription className="text-xs">{error}</AlertDescription>
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
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title={`Edit Post: ${postData.title}`}
        description="Update deliverable metadata, platform tags, schedule timings, and creative references."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href={`/dashboard/projects/posts/${postData.id}`}>
            <ArrowLeft className="size-3.5" />
            View Deliverable
          </Link>
        </Button>
      </PageHeader>
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