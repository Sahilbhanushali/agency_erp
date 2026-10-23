// app/assets/page.tsx
"use client";

import { useLiveRefresh } from "@/hooks/use-live-refresh"

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AssetManager } from "@/components/assets/assets-manager";

type Asset = {
  id: string;
  filename: string;
  url: string;
  type: string | null;
  size: number | null;
  order: number;
  createdAt: string;
  isReference: boolean;
  post: {
    id: string;
    title: string;
    status: string;
    project: {
      id: string;
      name: string;
      company: string;
    };
  };
  uploadedBy: {
    id: number;
    name: string;
  } | null;
};

export default function AssetsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      fetchAssets();
      fetchPermissions();
    }
  }, [status, router]);

  const fetchAssets = async () => {
    try {
      const response = await fetch("/api/assets");
      if (!response.ok) {
        throw new Error("Failed to fetch assets");
      }
      const data = await response.json();
      setAssets(data);
      setLoading(false);
    } catch (err) {
      setError("Error fetching assets");
      setLoading(false);
    }
  };
  // Live: re-read when someone else changes what this shows.
  useLiveRefresh(fetchAssets, ["Asset", "Post"])

  const fetchPermissions = async () => {
    try {
      const response = await fetch(`/api/users/permissions?id=${session?.user?.id}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch permissions");
      }
      const data = await response.json();
      setUserPermissions(data.permissions || []);
    } catch (err) {
      console.error("Error fetching permissions:", err);
      setUserPermissions([]);
    } finally {
      setIsPermissionsLoading(false);
    }
  };

  if (status === "loading" || loading || isPermissionsLoading) {

    return (
      <div className="space-y-6 animate-in fade-in-50 duration-200">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 bg-muted rounded-md animate-pulse" />
          <div className="h-4 w-72 bg-muted rounded-md animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs"
            >
              <div className="h-40 w-full bg-muted animate-pulse rounded-lg mb-3" />
              <div className="space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-12 text-center shadow-2xs">
        <h3 className="text-base font-semibold text-destructive mb-1">Error Loading Assets</h3>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  const isAdmin = session?.user?.role === "ADMIN";
  const hasManageAssetsPermission = isAdmin || userPermissions.includes("Manage-assets");

  if (!hasManageAssetsPermission) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-12 text-center shadow-2xs">
        <h3 className="text-base font-semibold text-destructive mb-1">Access Denied</h3>
        <p className="text-xs text-muted-foreground">You do not have permission to manage assets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Asset Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Central repository for images, video reels, and client campaign files ({assets.length} total).
          </p>
        </div>
      </div>
      <AssetManager assets={assets as any} hasManageAssetsPermission={hasManageAssetsPermission} />
    </div>
  );
}