"use client";

import { use } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { PostDetail } from "@/components/posts/post-detail";

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

  const { data: post, error, isLoading } = useSWR(`/api/posts/${id}`, fetcher);

  if (isLoading) {
    return <div className="p-4">Loading post...</div>;
  }

  if (error) {
    if ((error as any).status === 404) {
      return <div className="p-4 text-red-500">Post not found</div>;
    }
    if ((error as any).status === 403) {
      router.push("/dashboard");
      return null;
    }
    return <div className="p-4 text-red-500">Failed to load post</div>;
  }

  return <PostDetail post={post} />;
}
