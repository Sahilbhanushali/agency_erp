import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyPageForm } from "@/components/companies/company-page-form";

export default async function NewCompanyPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title="Add Billing Company"
        description="Register a new legal agency entity with document letterhead, bank details, and GST configuration."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/dashboard/companies">
            <ArrowLeft className="size-3.5" />
            Back to Companies
          </Link>
        </Button>
      </PageHeader>

      <div className="max-w-6xl">
        <CompanyPageForm />
      </div>
    </div>
  );
}
