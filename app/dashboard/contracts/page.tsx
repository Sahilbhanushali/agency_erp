"use client";

import { LoadError } from "@/components/load-error";
import { jsonFetcher } from "@/lib/fetcher";
import React, { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { format, differenceInDays } from "date-fns";
import {
  FileSignature,
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  AlertTriangle,
  RotateCw,
  Mail,
  Edit,
  Eye,
  Trash2,
  FileCheck,
  CheckCircle,
  Clock,
  Layers,
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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

// Throws on non-2xx, so a failed load is an error state, not an empty list.
const fetcher = (url: string) => jsonFetcher(url);

export default function ContractsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [deletingContract, setDeletingContract] = useState<any | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const { data, error: contractsError, isLoading, mutate } = useSWR(
    `/api/contracts?status=${statusFilter}&type=${typeFilter}`,
    fetcher
  );

  const contracts: any[] = data?.contracts || [];
  const metrics = data?.metrics || {
    totalContracts: 0,
    activeRetainers: 0,
    monthlyRetainerValue: 0,
    expiringCount: 0,
  };

  const filteredContracts = useMemo(() => {
    if (!search.trim()) return contracts;
    const q = search.toLowerCase();
    return contracts.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.contractNumber?.toLowerCase().includes(q) ||
        c.client?.name?.toLowerCase().includes(q) ||
        c.client?.company?.toLowerCase().includes(q)
    );
  }, [contracts, search]);

  const handleRenew = async (contract: any) => {
    try {
      setActionLoadingId(contract.id);
      const res = await fetch(`/api/contracts/${contract.id}/renew`, {
        method: "POST",
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to renew agreement");

      toast.success(resData.message || "Agreement renewed successfully");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Could not renew contract");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendReminder = async (contract: any) => {
    try {
      setActionLoadingId(contract.id);
      const res = await fetch(`/api/contracts/${contract.id}/reminder`, {
        method: "POST",
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to send reminder");

      toast.success(resData.message || "Renewal reminder dispatched");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Could not send reminder");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingContract) return;
    try {
      const res = await fetch(`/api/contracts/${deletingContract.id}`, {
        method: "DELETE",
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to delete");

      toast.success("Contract removed successfully");
      setDeletingContract(null);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Could not delete contract");
    }
  };

  const formatCurrency = (val: number | string) => {
    return `₹${Number(val || 0).toLocaleString("en-IN")}`;
  };

  const getStatusBadge = (contract: any) => {
    const targetDate = contract.renewalDate || contract.endDate;
    const daysLeft = targetDate ? differenceInDays(new Date(targetDate), new Date()) : null;

    if (contract.status === "TERMINATED") {
      return <Badge variant="destructive" className="text-xs">Terminated</Badge>;
    }
    if (contract.status === "EXPIRED" || (daysLeft !== null && daysLeft < 0)) {
      return <Badge variant="neutral" className="text-xs">Expired</Badge>;
    }
    if (daysLeft !== null && daysLeft <= 30 && daysLeft >= 0) {
      return (
        <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/40 bg-amber-500/10 font-medium">
          Expires in {daysLeft}d
        </Badge>
      );
    }
    return (
      <Badge variant="success" className="text-xs">
        Active
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title="Contracts, SOW & Retainers"
        description="Client service level agreements, monthly retainer allocations, deliverable quotas, and renewal governance."
        badge={
          <Badge variant="outline" className="font-mono text-xs">
            {metrics.totalContracts} Total Agreements
          </Badge>
        }
      >
        <Button size="sm" asChild className="gap-1.5 shadow-2xs">
          <Link href="/dashboard/contracts/new">
            <Plus className="size-3.5" />
            New Agreement
          </Link>
        </Button>
      </PageHeader>

      {/* KPI Metric Chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Active Retainers</span>
            <FileSignature className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {metrics.activeRetainers}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Monthly MRR</span>
            <DollarSign className="size-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {formatCurrency(metrics.monthlyRetainerValue)}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Expiring (30 Days)</span>
            <AlertTriangle className="size-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 tabular-nums">
            {metrics.expiringCount}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Filtered View</span>
            <Layers className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {filteredContracts.length}
          </p>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search by title, contract # or client"
            placeholder="Search by title, contract # or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs bg-card"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger aria-label="All Types" className="h-8 w-36 text-xs bg-card">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All Types</SelectItem>
            <SelectItem value="RETAINER" className="text-xs">Retainer</SelectItem>
            <SelectItem value="FIXED_SOW" className="text-xs">Fixed SOW</SelectItem>
            <SelectItem value="MASTER_SERVICES_AGREEMENT" className="text-xs">MSA</SelectItem>
            <SelectItem value="NDA" className="text-xs">NDA</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="All Statuses" className="h-8 w-36 text-xs bg-card">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
            <SelectItem value="ACTIVE" className="text-xs">Active</SelectItem>
            <SelectItem value="EXPIRING_SOON" className="text-xs">Expiring Soon</SelectItem>
            <SelectItem value="DRAFT" className="text-xs">Draft</SelectItem>
            <SelectItem value="EXPIRED" className="text-xs">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contracts Table */}
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
        {contractsError && !data ? (
          <LoadError what="agreements" error={contractsError} onRetry={() => mutate()} className="m-4" />
        ) : isLoading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2, 3].map((r) => (
              <Skeleton key={r} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredContracts.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            title={search ? "No agreements match your search" : "No client contracts yet"}
            description={
              search
                ? "Try adjusting your search criteria or filters."
                : "Record client retainer agreements, SOW scopes, deliverable allowances, and automated renewal reminders."
            }
            actionLabel={!search ? "Register your first contract" : undefined}
            onAction={
              !search
                ? () => {
                    router.push("/dashboard/contracts/new");
                  }
                : undefined
            }
            className="my-6"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Agreement & Reference</TableHead>
                  <TableHead className="text-xs font-semibold">Client Account</TableHead>
                  <TableHead className="text-xs font-semibold">Type & Cycle</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Fee / Cycle</TableHead>
                  <TableHead className="text-xs font-semibold">Deliverables Quota</TableHead>
                  <TableHead className="text-xs font-semibold">Renewal Date</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((c) => {
                  const quota = c.deliverableQuota as Record<string, number> | null;
                  const isActionLoading = actionLoadingId === c.id;

                  return (
                    <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-xs text-foreground truncate">
                            {c.title}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs text-muted-foreground">
                              {c.contractNumber || "NO-REF"}
                            </span>
                            {c.documentUrl && (
                              <a
                                href={c.documentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                                title="View signed agreement"
                              >
                                <ExternalLink className="size-2.5" />
                                PDF
                              </a>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/dashboard/clients/${c.client?.id}`}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                          <Avatar className="size-6 border border-border/60">
                            <AvatarImage src={c.client?.avatar || ""} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                              {c.client?.name?.slice(0, 2).toUpperCase() || "CL"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              {c.client?.name}
                            </p>
                            {c.client?.company && (
                              <p className="text-xs text-muted-foreground truncate">
                                {c.client?.company}
                              </p>
                            )}
                          </div>
                        </Link>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-foreground">
                            {c.type === "MASTER_SERVICES_AGREEMENT" ? "MSA" : c.type}
                          </span>
                          <span className="text-xs text-muted-foreground uppercase font-mono">
                            {c.billingCycle}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {formatCurrency(c.value)}
                        </span>
                        {c.retainerHours && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {c.retainerHours} hrs
                          </p>
                        )}
                      </TableCell>

                      <TableCell>
                        {quota ? (
                          <div className="flex flex-wrap gap-1 text-xs">
                            {quota.posts ? (
                              <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono">
                                {quota.posts} Posts
                              </span>
                            ) : null}
                            {quota.reels ? (
                              <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono">
                                {quota.reels} Reels
                              </span>
                            ) : null}
                            {quota.stories ? (
                              <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono">
                                {quota.stories} Stories
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs">
                        <span className="text-foreground tabular-nums">
                          {c.renewalDate
                            ? format(new Date(c.renewalDate), "dd MMM yyyy")
                            : c.endDate
                            ? format(new Date(c.endDate), "dd MMM yyyy")
                            : "Ongoing"}
                        </span>
                        {c.reminderSent && (
                          <span className="block text-xs text-muted-foreground mt-0.5">
                            Notice Sent
                          </span>
                        )}
                      </TableCell>

                      <TableCell>{getStatusBadge(c)}</TableCell>

                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick 1-click renewal */}
                          <Button aria-label="Renew Agreement for next cycle"
                            variant="ghost"
                            size="icon-xs"
                            disabled={isActionLoading}
                            onClick={() => handleRenew(c)}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            title="Renew Agreement for next cycle"
                          >
                            <RotateCw className="size-3.5" />
                          </Button>

                          {/* Dispatch renewal reminder email */}
                          <Button aria-label="Send Renewal Reminder Email to Client"
                            variant="ghost"
                            size="icon-xs"
                            disabled={isActionLoading}
                            onClick={() => handleSendReminder(c)}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                            title="Send Renewal Reminder Email to Client"
                          >
                            <Mail className="size-3.5" />
                          </Button>

                          {/* View Contract Details */}
                          <Button aria-label="View Agreement Details"
                            variant="ghost"
                            size="icon-xs"
                            asChild
                            className="text-muted-foreground hover:text-foreground"
                            title="View Agreement Details"
                          >
                            <Link href={`/dashboard/contracts/${c.id}`}>
                              <Eye className="size-3.5" />
                            </Link>
                          </Button>

                          {/* Edit Contract */}
                          <Button aria-label="Edit Contract Terms"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => {
                              setSelectedContract(c);
                              setDialogOpen(true);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                            title="Edit Contract Terms"
                          >
                            <Edit className="size-3.5" />
                          </Button>

                          {/* Delete Contract */}
                          <Button aria-label="Delete Agreement"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setDeletingContract(c)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Delete Agreement"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Contract Create / Edit Modal */}
      <ContractDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contract={selectedContract}
        onSaved={() => mutate()}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={!!deletingContract}
        onOpenChange={(open) => !open && setDeletingContract(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract Agreement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{deletingContract?.title}</strong> and its recorded SOW deliverable allowances. Uploaded agreement files will be removed from local storage.
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
