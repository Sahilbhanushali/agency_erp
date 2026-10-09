"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClientForm } from "@/components/forms/client-form";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";
import { useBreadcrumbTitle } from "@/lib/route-labels";

export default function ClientEditPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useBreadcrumbTitle(clientId, client?.name ? `Edit ${client.name}` : "Edit Client");

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch client");
        }
        const data = await res.json();
        setClient(data);
      } catch (err: any) {
        setError(err.message || "Failed to load client");
      } finally {
        setLoading(false);
      }
    };
    if (clientId) fetchClient();
  }, [clientId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <EmptyState
          icon={Building2}
          title="Client Not Found"
          description={error || "The client you are trying to edit could not be found."}
          action={{
            label: "Back to Clients",
            onClick: () => router.push("/dashboard/clients"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <ClientForm client={client} />
    </div>
  );
}