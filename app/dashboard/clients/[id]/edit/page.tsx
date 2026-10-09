"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClientForm } from "@/components/forms/client-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";
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
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-96 w-full max-w-3xl rounded-xl" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="py-12">
        <EmptyState
          icon={Building2}
          title="Client Not Found"
          description={error || "The client you are trying to edit could not be found."}
          actionLabel="Back to Clients"
          onAction={() => router.push("/dashboard/clients")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title={`Edit Client: ${client.name}`}
        description="Update contact information, organization details, and company branding."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href={`/dashboard/clients/${client.id}`}>
            <ArrowLeft className="size-3.5" />
            View Profile
          </Link>
        </Button>
      </PageHeader>

      <div className="max-w-6xl">
        <ClientForm client={client} />
      </div>
    </div>
  );
}