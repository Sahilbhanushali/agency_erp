"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import toast from "react-hot-toast";
import { format, differenceInDays } from "date-fns";
import {
  FileSignature,
  Building,
  FolderKanban,
  DollarSign,
  Calendar,
  Clock,
  RotateCw,
  Mail,
  Trash2,
  ArrowLeft,
  ExternalLink,
  Layers,
  CheckCircle2,
  AlertTriangle,
  User,
  ShieldCheck,
  FileCheck,
  Edit,
  ArrowUpRight,
  Download,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContractDialog } from "@/components/contracts/contract-dialog";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatCurrency = (amount: number | string, currency: string = "INR") => {
  const num = Number(amount) || 0;
  if (currency === "INR") {
    return `₹${num.toLocaleString("en-IN")}`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
};

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data, isLoading, mutate } = useSWR(id ? `/api/contracts/${id}` : null, fetcher);
  const contract = data?.contract;

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleRenew = async () => {
    if (!contract) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/contracts/${contract.id}/renew`, {
        method: "POST",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to renew agreement");
      toast.success("Contract renewed for the next cycle");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Could not renew contract");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendReminder = async () => {
    if (!contract) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/contracts/${contract.id}/reminder`, {
        method: "POST",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send reminder");
      toast.success(result.message || "Renewal reminder email dispatched");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to send reminder");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!contract) return;
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to delete agreement");
      toast.success("Contract removed successfully");
      router.push("/dashboard/contracts");
    } catch (err: any) {
      toast.error(err.message || "Could not delete contract");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in-50">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 md:col-span-2 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <AlertTriangle className="size-10 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold">Agreement Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The requested contract could not be located or has been deleted.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard/contracts">Back to Contracts</Link>
        </Button>
      </div>
    );
  }

  const quota = contract.deliverableQuota as Record<string, number> | null;
  const isExpiringSoon =
    contract.renewalDate &&
    differenceInDays(new Date(contract.renewalDate), new Date()) <= 30 &&
    differenceInDays(new Date(contract.renewalDate), new Date()) >= 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in-50 duration-200">
      {/* Top back nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/contracts">
            <ArrowLeft className="size-4" /> Back to Agreements
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={actionLoading}
            onClick={handleRenew}
            className="gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30 text-xs"
          >
            <RotateCw className="size-3.5" /> Renew Cycle
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={actionLoading}
            onClick={handleSendReminder}
            className="gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 border-amber-500/30 text-xs"
          >
            <Mail className="size-3.5" /> Send Reminder
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditDialogOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Edit className="size-3.5" /> Edit
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteAlertOpen(true)}
            className="gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30 text-xs"
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Main Header Card */}
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {contract.title}
              </h1>
              <Badge variant="outline" className="font-mono text-xs">
                {contract.contractNumber || "NO-REF"}
              </Badge>
              <Badge
                variant={
                  contract.status === "ACTIVE"
                    ? "success"
                    : contract.status === "EXPIRING_SOON"
                    ? "warning"
                    : "secondary"
                }
                className="text-xs"
              >
                {contract.status}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {contract.type === "MASTER_SERVICES_AGREEMENT" ? "MSA" : contract.type}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <span>Billing Cycle: <strong className="text-foreground uppercase">{contract.billingCycle}</strong></span>
              <span>•</span>
              <span>Notice Period: <strong className="text-foreground">{contract.noticePeriodDays} days</strong></span>
              {contract.autoRenew && (
                <>
                  <span>•</span>
                  <span className="text-emerald-600 font-medium">Auto-renew enabled</span>
                </>
              )}
            </p>
          </div>

          <div className="text-left md:text-right">
            <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {formatCurrency(contract.value, contract.currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              per {contract.billingCycle.toLowerCase()}
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Details & Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Deliverables, Timeline, Document */}
        <div className="md:col-span-2 space-y-6">
          {/* Deliverable Quotas */}
          {(contract.type === "RETAINER" || contract.type === "FIXED_SOW") && (
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="size-4 text-violet-600" />
                  Deliverable Quotas & Hourly Allocation
                </CardTitle>
                <CardDescription className="text-xs">
                  Allocations contracted per billing period
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase">Posts</span>
                    <p className="text-xl font-bold text-foreground mt-1 tabular-nums">
                      {quota?.posts ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase">Reels</span>
                    <p className="text-xl font-bold text-foreground mt-1 tabular-nums">
                      {quota?.reels ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase">Stories</span>
                    <p className="text-xl font-bold text-foreground mt-1 tabular-nums">
                      {quota?.stories ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase">Hours</span>
                    <p className="text-xl font-bold text-foreground mt-1 tabular-nums">
                      {contract.retainerHours ? `${contract.retainerHours} hrs` : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline & Renewal Card */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="size-4 text-sky-600" />
                Agreement Timeline & Renewal Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Effective Start Date</span>
                  <p className="text-sm font-semibold text-foreground">
                    {contract.startDate ? format(new Date(contract.startDate), "PPP") : "Not set"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Agreement End Date</span>
                  <p className="text-sm font-semibold text-foreground">
                    {contract.endDate ? format(new Date(contract.endDate), "PPP") : "Ongoing"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Next Renewal Date</span>
                  <p className={`text-sm font-semibold ${isExpiringSoon ? "text-amber-600 font-bold" : "text-foreground"}`}>
                    {contract.renewalDate ? format(new Date(contract.renewalDate), "PPP") : "Ongoing"}
                  </p>
                </div>
              </div>

              {contract.reminderSent && (
                <div className="mt-4 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                  <Mail className="size-3.5 shrink-0" />
                  <span>Renewal reminder notification email has already been dispatched to client.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Attachment */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="size-4 text-primary" />
                Contract Document
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {contract.documentUrl ? (
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-muted/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileSignature className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        Signed Agreement File
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate font-mono">
                        {contract.documentUrl}
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0 text-xs">
                    <a href={contract.documentUrl} target="_blank" rel="noreferrer">
                      <Download className="size-3.5" /> View / Download
                    </a>
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No signed PDF file attached to this agreement.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {contract.notes && (
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base">Notes & Special Clauses</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                  {contract.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Col: Associated Entities */}
        <div className="space-y-6">
          {/* Client Account Card */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="size-4 text-primary" />
                Client Account
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {contract.client ? (
                <div className="flex items-start gap-3">
                  <Avatar className="size-10 border border-border/60">
                    <AvatarImage src={contract.client.avatar || ""} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                      {contract.client.name?.slice(0, 2).toUpperCase() || "CL"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {contract.client.name}
                    </p>
                    {contract.client.company && (
                      <p className="text-xs text-muted-foreground truncate">
                        {contract.client.company}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {contract.client.email}
                    </p>
                    <div className="mt-3">
                      <Button asChild size="xs" variant="outline" className="gap-1 text-xs">
                        <Link href={`/dashboard/clients/${contract.client.id}`}>
                          View Client Profile <ArrowUpRight className="size-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No client associated</p>
              )}
            </CardContent>
          </Card>

          {/* Associated Project */}
          {contract.project && (
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderKanban className="size-4 text-primary" />
                  Assigned Project
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">
                  {contract.project.name}
                </p>
                {contract.project._count?.posts !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {contract.project._count.posts} posts logged
                  </p>
                )}
                <Button asChild size="xs" variant="outline" className="gap-1 text-xs">
                  <Link href={`/dashboard/projects/${contract.project.id}`}>
                    View Project <ArrowUpRight className="size-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Audit & Record Details */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                Record Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created On</span>
                <span className="font-medium text-foreground">
                  {contract.createdAt ? format(new Date(contract.createdAt), "dd MMM yyyy") : "—"}
                </span>
              </div>
              {contract.createdBy && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created By</span>
                  <span className="font-medium text-foreground truncate max-w-[150px]">
                    {contract.createdBy.name || contract.createdBy.email}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="font-medium text-foreground">
                  {contract.updatedAt ? format(new Date(contract.updatedAt), "dd MMM yyyy") : "—"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Contract Dialog */}
      <ContractDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        contract={contract}
        onSaved={() => mutate()}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract Agreement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{contract.title}</strong> and its recorded SOW deliverable allowances.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Agreement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
