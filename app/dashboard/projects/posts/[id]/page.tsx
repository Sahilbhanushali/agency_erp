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
      <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 animate-pulse">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-28" />
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
      <div className="max-w-2xl mx-auto py-12">
        <EmptyState
          icon={isNotFound ? FolderOpen : AlertCircle}
          title={isNotFound ? "Post not found" : "Error loading post"}
          description={
            isNotFound
              ? "The post you are looking for does not exist or has been deleted."
              : "An unexpected error occurred while loading this post."
          }
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard/projects/posts")}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              Back to Posts
            </Button>
          }
        />
      </div>
    );
  }

  return <PostDetail post={post} />;
}
