"use client";

import { use } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { PostDetail } from "@/components/posts/post-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, FolderOpen } from "lucide-react";
import { useBreadcrumbTitle } from "@/lib/route-labels";
import TaskPanel from "@/components/tasks/task-panel";

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const error = new Error("Failed to fetch data");
    (error as any).status = res.status;
    throw error;
  }
  return res.json();
};

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const { data: post, error, isLoading, mutate } = useSWR(`/api/posts/${id}`, fetcher);

  useBreadcrumbTitle(id, post?.title);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isNotFound = (error as any).status === 404;
    return (
      <div className="py-12">
        <EmptyState
          icon={isNotFound ? FolderOpen : AlertCircle}
          title={isNotFound ? "Post Not Found" : "Error Loading Post"}
          description={
            isNotFound
              ? "The post deliverable you are looking for does not exist or has been removed."
              : "An unexpected error occurred while loading this post."
          }
          actionLabel="Back to Posts"
          onAction={() => router.push("/dashboard/projects/posts")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PostDetail post={post} />
      {/* Work on this post that is not the post itself — revisions, approvals chasing,
          asset sourcing. Pre-linked to the post and its project. */}
      <TaskPanel
        link={{ postId: id, projectId: post.projectId ?? undefined }}
        title="Tasks on this post"
      />
    </div>
  );
}
