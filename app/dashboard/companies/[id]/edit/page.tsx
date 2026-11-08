"use client";

import { jsonFetcher } from "@/lib/fetcher";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyPageForm } from "@/components/companies/company-page-form";
import { useBreadcrumbTitle } from "@/lib/route-labels";
import type { Company } from "@/types/finance";

// Throws on non-2xx, so a failed load is an error state, not an empty list.
const fetcher = (url: string) => jsonFetcher(url);

export default function EditCompanyPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;

  const { data, isLoading, error } = useSWR<{ company: Company }>(
    companyId ? `/api/companies/${companyId}` : null,
    fetcher
  );

  const company = data?.company;

  useBreadcrumbTitle(companyId, company?.name ? `Edit ${company.name}` : "Edit Company");

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-96 w-full max-w-6xl rounded-xl" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="py-12">
        <EmptyState
          icon={Building2}
          title="Company Not Found"
          description="The requested billing entity could not be found or has been removed."
          actionLabel="Back to Companies"
          onAction={() => router.push("/dashboard/companies")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title={`Edit Company: ${company.name}`}
        description="Update corporate details, letterhead banner, bank instructions, and tax identifiers."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/dashboard/companies">
            <ArrowLeft className="size-3.5" />
            Back to Companies
          </Link>
        </Button>
      </PageHeader>

      <div className="max-w-6xl">
        <CompanyPageForm initialCompany={company} isEditing={true} />
      </div>
    </div>
  );
}
