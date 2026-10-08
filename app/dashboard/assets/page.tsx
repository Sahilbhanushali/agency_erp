// app/assets/page.tsx
"use client";

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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-9 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-5 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-600 p-4"
              >
                <div className="h-48 w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg mb-4" />
                <div className="space-y-2">
                  <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-600 p-12 text-center">
          <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">Error</h3>
          <p className="text-gray-500 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const isAdmin = session?.user?.role === "ADMIN";
  const hasManageAssetsPermission = isAdmin || userPermissions.includes("Manage-assets");

  if (!hasManageAssetsPermission) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-600 p-12 text-center">
          <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">Access Denied</h3>
          <p className="text-gray-500 dark:text-gray-400">You do not have permission to manage assets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Asset Library</h1>
            <p className="text-gray-600 dark:text-gray-300">Manage all your media assets and files</p>
          </div>
        </div>
        <AssetManager assets={assets} hasManageAssetsPermission={hasManageAssetsPermission} />
      </div>
    </div>
  );
}