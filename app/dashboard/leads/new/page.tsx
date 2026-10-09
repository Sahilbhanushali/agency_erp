import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { LeadForm } from "@/components/leads/lead-form";

export default async function NewLeadPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title="Add Sales Lead"
        description="Record a new inquiry or commercial deal into the agency sales pipeline."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/dashboard/leads">
            <ArrowLeft className="size-3.5" />
            Back to Pipeline
          </Link>
        </Button>
      </PageHeader>

      <div className="max-w-4xl">
        <LeadForm />
      </div>
    </div>
  );
}
