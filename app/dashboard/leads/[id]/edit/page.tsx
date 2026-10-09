"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { LeadForm } from "@/components/leads/lead-form";
import { ArrowLeft, Target } from "lucide-react";
import Link from "next/link";
import { useBreadcrumbTitle } from "@/lib/route-labels";

export default function EditLeadPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useBreadcrumbTitle(leadId, lead?.title ? `Edit ${lead.title}` : "Edit Lead");

  useEffect(() => {
    const fetchLead = async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch lead");
        }
        const data = await res.json();
        setLead(data);
      } catch (err: any) {
        setError(err.message || "Failed to load lead");
      } finally {
        setLoading(false);
      }
    };
    if (leadId) fetchLead();
  }, [leadId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-96 w-full max-w-4xl rounded-xl" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="py-12">
        <EmptyState
          icon={Target}
          title="Lead Not Found"
          description={error || "The sales lead you are trying to edit could not be found."}
          actionLabel="Back to Pipeline"
          onAction={() => router.push("/dashboard/leads")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title={`Edit Lead: ${lead.title}`}
        description="Update opportunity details, pipeline stage, and commercial values."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href={`/dashboard/leads/${lead.id}`}>
            <ArrowLeft className="size-3.5" />
            View Lead
          </Link>
        </Button>
      </PageHeader>

      <div className="max-w-4xl">
        <LeadForm initialData={lead} isEditing={true} />
      </div>
    </div>
  );
}
