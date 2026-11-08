"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { toast } from "react-hot-toast";
import {
  FileCheck2,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  FileText,
  ShieldCheck,
  Calculator,
  UserX,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }
  return res.json();
};

function formatInr(paise: number): string {
  const rupees = (paise || 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

export default function FnFTab({ users = [], currentUserId }: { users?: any[]; currentUserId?: number }) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [confirmApprove, setConfirmApprove] = useState<{ settlementId: string; employeeUserId: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const url = statusFilter === "ALL"
    ? "/api/payroll/fnf"
    : `/api/payroll/fnf?status=${statusFilter}`;

  const { data: settlements = [], error, isLoading, mutate } = useSWR(url, fetcher);

  // Initiate Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [resignationDate, setResignationDate] = useState<string>("");
  const [lastWorkingDate, setLastWorkingDate] = useState<string>("");
  const [noticePeriodDays, setNoticePeriodDays] = useState<string>("30");
  const [servedNoticeDays, setServedNoticeDays] = useState<string>("30");
  const [otherDeductions, setOtherDeductions] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");

  const [previewData, setPreviewData] = useState<any | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Details Modal
  const [selectedSettlement, setSelectedSettlement] = useState<any | null>(null);

  // Approval state
  const [isApproving, setIsApproving] = useState(false);

  const filteredSettlements = settlements.filter((s: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const name = s.user?.name?.toLowerCase() || "";
    const email = s.user?.email?.toLowerCase() || "";
    return name.includes(term) || email.includes(term);
  });

  const totalDraftedCount = settlements.filter((s: any) => s.status === "DRAFT").length;
  const totalApprovedCount = settlements.filter((s: any) => s.status === "APPROVED").length;
  const totalNetSettlementAmount = settlements.reduce(
    (sum: number, s: any) => sum + (s.netSettlementAmount || 0),
    0
  );

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !resignationDate || !lastWorkingDate) {
      toast.error("Please fill in Employee, Resignation Date, and Last Working Date");
      return;
    }

    setIsPreviewing(true);
    try {
      const res = await fetch("/api/payroll/fnf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(userId),
          resignationDate,
          lastWorkingDate,
          noticePeriodDays: Number(noticePeriodDays) || 30,
          servedNoticeDays: Number(servedNoticeDays) || 30,
          otherDeductions: parseFloat(otherDeductions) || 0,
          inMajorUnits: true,
          notes,
          action: "preview",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to calculate preview");

      setPreviewData(data);
      toast.success("Settlement preview calculated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to preview FnF calculation");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleSaveSettlement() {
    if (!userId || !resignationDate || !lastWorkingDate) {
      toast.error("Please fill in Employee, Resignation Date, and Last Working Date");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/payroll/fnf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(userId),
          resignationDate,
          lastWorkingDate,
          noticePeriodDays: Number(noticePeriodDays) || 30,
          servedNoticeDays: Number(servedNoticeDays) || 30,
          otherDeductions: parseFloat(otherDeductions) || 0,
          inMajorUnits: true,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settlement");

      toast.success("FnF settlement draft saved successfully");
      setShowCreateModal(false);
      setPreviewData(null);
      setUserId("");
      setResignationDate("");
      setLastWorkingDate("");
      setNotes("");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to save FnF settlement");
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Asks first (in the app's own dialog, not window.confirm): approval is irreversible. */
  function handleApprove(settlementId: string, employeeUserId: number) {
    if (currentUserId && employeeUserId === currentUserId) {
      toast.error("Separation of duties violation: You cannot approve your own Full & Final Settlement");
      return;
    }
    setConfirmApprove({ settlementId, employeeUserId });
  }

  async function approveSettlement(settlementId: string) {
    setConfirmApprove(null);

    setIsApproving(true);
    try {
      const res = await fetch(`/api/payroll/fnf/${settlementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve settlement");

      toast.success("Settlement approved! Employee marked as SEPARATED and loans settled.");
      setSelectedSettlement(null);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve settlement");
    } finally {
      setIsApproving(false);
    }
  }

  const pendingApproval = confirmApprove
    ? settlements.find((x: any) => x.id === confirmApprove.settlementId)
    : null;

  return (
    <div className="space-y-6">
      <AlertDialog open={!!confirmApprove} onOpenChange={(open) => !open && setConfirmApprove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Approve the settlement{pendingApproval?.user?.name ? ` for ${pendingApproval.user.name}` : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This finalizes every payout figure, closes the employee&apos;s outstanding loans and marks them as
              separated. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmApprove && approveSettlement(confirmApprove.settlementId)}>
              Approve settlement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Settlement Outflow</span>
              <FileCheck2 className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatInr(totalNetSettlementAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total net settlement value across all records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Pending Drafts</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totalDraftedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Settlements awaiting review and approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Finalized & Separated</span>
              <UserX className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalApprovedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Approved settlements with completed exit clearance</p>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search employee"
              placeholder="Search employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Status" className="w-32 h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => mutate()} className="h-9">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button size="sm" onClick={() => setShowCreateModal(true)} className="h-9 w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1.5" /> Initiate FnF Settlement
        </Button>
      </div>

      {/* Settlements Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Employee</TableHead>
                <TableHead className="text-xs">Relieved On</TableHead>
                <TableHead className="text-xs">Notice Served</TableHead>
                <TableHead className="text-xs">Pending Salary</TableHead>
                <TableHead className="text-xs">Leave Encashment</TableHead>
                <TableHead className="text-xs">Gratuity</TableHead>
                <TableHead className="text-xs font-semibold">Net Settlement</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-xs text-muted-foreground">
                    Loading Full & Final settlements...
                  </TableCell>
                </TableRow>
              ) : filteredSettlements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-xs text-muted-foreground">
                    No Full and Final settlements found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSettlements.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">
                      <div className="font-medium text-foreground">{s.user?.name}</div>
                      <div className="text-xs text-muted-foreground">{s.user?.designation || s.user?.department}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(s.lastWorkingDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.servedNoticeDays} / {s.noticePeriodDays} days
                      {s.shortfallDays > 0 && (
                        <div className="text-xs text-red-500 font-medium">({s.shortfallDays}d shortfall)</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{formatInr(s.pendingSalaryAmount)}</TableCell>
                    <TableCell className="text-xs">{formatInr(s.leaveEncashmentAmount)} ({s.leaveEncashmentDays}d)</TableCell>
                    <TableCell className="text-xs">
                      {s.gratuityAmount > 0 ? (
                        <span className="font-semibold text-emerald-600">{formatInr(s.gratuityAmount)}</span>
                      ) : (
                        <span className="text-muted-foreground">Nil</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-foreground">
                      {formatInr(s.netSettlementAmount)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.status === "APPROVED" ? (
                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-xs">
                          APPROVED
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-xs">
                          DRAFT
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedSettlement(s)}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" /> View Breakdown
                      </Button>
                      {s.status === "DRAFT" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-emerald-600 hover:text-emerald-700 border-emerald-200"
                          onClick={() => handleApprove(s.id, s.userId)}
                          disabled={isApproving}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ================= INITIATE FNF MODAL ================= */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 bg-background">
          <form onSubmit={handlePreview}>
            <DialogHeader className="pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-500/10 text-red-600">
                  <UserX className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold">Initiate Full & Final Settlement (FnF)</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Statutory separation computation covering prorated final month salary, earned leave encashment, Payment of Gratuity Act 1972, notice period shortfall recovery, and loan clearance.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 py-4 text-xs">
              {/* LEFT COLUMN: Exit Parameters & Inputs */}
              <div className="lg:col-span-6 space-y-4">
                <div className="p-3.5 rounded-xl border border-border bg-card space-y-3.5 shadow-2xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    1. Separation Coordinates
                  </span>

                  <div className="space-y-1.5">
                    <Label htmlFor="fnf-user" className="text-xs font-semibold">Departing Employee *</Label>
                    <Select value={userId} onValueChange={(val) => { setUserId(val); setPreviewData(null); }}>
                      <SelectTrigger id="fnf-user" className="h-8 text-xs">
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u: any) => (
                          <SelectItem key={u.id} value={String(u.id)} className="text-xs">
                            {u.name} ({u.designation || u.department || u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="resignation-date" className="text-xs font-semibold">Resignation Date *</Label>
                      <Input
                        id="resignation-date"
                        type="date"
                        value={resignationDate}
                        onChange={(e) => { setResignationDate(e.target.value); setPreviewData(null); }}
                        required
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lwd-date" className="text-xs font-semibold">Last Working Date *</Label>
                      <Input
                        id="lwd-date"
                        type="date"
                        value={lastWorkingDate}
                        onChange={(e) => { setLastWorkingDate(e.target.value); setPreviewData(null); }}
                        required
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card space-y-3.5 shadow-2xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    2. Notice & Deductions
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="notice-days" className="text-xs">Contractual Notice (Days)</Label>
                      <Input
                        id="notice-days"
                        type="number"
                        min="0"
                        value={noticePeriodDays}
                        onChange={(e) => { setNoticePeriodDays(e.target.value); setPreviewData(null); }}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="served-days" className="text-xs">Served Notice (Days)</Label>
                      <Input
                        id="served-days"
                        type="number"
                        min="0"
                        value={servedNoticeDays}
                        onChange={(e) => { setServedNoticeDays(e.target.value); setPreviewData(null); }}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="other-deductions" className="text-xs">Asset / Equipment / Other Recoveries (₹)</Label>
                    <Input
                      id="other-deductions"
                      type="number"
                      min="0"
                      step="0.01"
                      value={otherDeductions}
                      onChange={(e) => { setOtherDeductions(e.target.value); setPreviewData(null); }}
                      className="h-8 text-xs font-mono"
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fnf-notes" className="text-xs">Exit & Handover Remarks</Label>
                    <Input
                      id="fnf-notes"
                      placeholder="e.g. Asset handover confirmed, project transition completed"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button type="submit" variant="default" size="sm" disabled={isPreviewing} className="gap-1.5 text-xs font-semibold">
                    <Calculator className="size-3.5" />
                    <span>{isPreviewing ? "Calculating..." : "Compute Statutory Settlement"}</span>
                  </Button>
                </div>
              </div>

              {/* RIGHT COLUMN: Live Calculation Preview Sheet */}
              <div className="lg:col-span-6 flex flex-col justify-between">
                {previewData ? (
                  <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-4 shadow-2xs h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-border">
                        <div>
                          <span className="font-bold text-xs uppercase tracking-wider text-foreground">
                            Settlement Breakdown
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Employee Tenure: {previewData.tenureYears} Years, {previewData.tenureMonths} Months
                          </p>
                        </div>
                        <Badge
                          variant={previewData.gratuityAmount > 0 ? "success" : "outline"}
                          className="text-xs py-0.5"
                        >
                          {previewData.gratuityAmount > 0 ? "Gratuity Eligible (>= 5y)" : "No Gratuity (< 5y)"}
                        </Badge>
                      </div>

                      {/* Itemized Table */}
                      <div className="divide-y divide-border/60 text-xs mt-3">
                        {/* Earnings */}
                        <div className="flex justify-between py-2">
                          <div>
                            <span className="font-medium text-foreground">Final Month Salary</span>
                            <span className="text-xs text-muted-foreground block">Prorated to Last Working Day</span>
                          </div>
                          <span className="font-mono font-bold text-foreground">
                            {formatInr(previewData.pendingSalaryAmount)}
                          </span>
                        </div>

                        <div className="flex justify-between py-2">
                          <div>
                            <span className="font-medium text-foreground">Earned Leave Encashment</span>
                            <span className="text-xs text-muted-foreground block">{previewData.leaveEncashmentDays} Days (Formula: Basic/30)</span>
                          </div>
                          <span className="font-mono font-bold text-foreground">
                            {formatInr(previewData.leaveEncashmentAmount)}
                          </span>
                        </div>

                        <div className="flex justify-between py-2">
                          <div>
                            <span className="font-medium text-foreground">Statutory Gratuity</span>
                            <span className="text-xs text-muted-foreground block">Payment of Gratuity Act 1972</span>
                          </div>
                          <span className={`font-mono font-bold ${previewData.gratuityAmount > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {formatInr(previewData.gratuityAmount)}
                          </span>
                        </div>

                        {/* Deductions */}
                        <div className="flex justify-between py-2">
                          <div>
                            <span className="font-medium text-red-600">Notice Shortfall Recovery</span>
                            <span className="text-xs text-muted-foreground block">
                              {previewData.shortfallDays > 0 ? `${previewData.shortfallDays} Days Shortfall` : "Notice Fully Served"}
                            </span>
                          </div>
                          <span className={`font-mono font-bold ${previewData.noticeRecoveryAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                            {previewData.noticeRecoveryAmount > 0 ? `- ${formatInr(previewData.noticeRecoveryAmount)}` : "₹0"}
                          </span>
                        </div>

                        <div className="flex justify-between py-2">
                          <div>
                            <span className="font-medium text-red-600">Outstanding Loan Recovery</span>
                            <span className="text-xs text-muted-foreground block">Active Advance Balance</span>
                          </div>
                          <span className={`font-mono font-bold ${previewData.outstandingLoanBalance > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                            {previewData.outstandingLoanBalance > 0 ? `- ${formatInr(previewData.outstandingLoanBalance)}` : "₹0"}
                          </span>
                        </div>

                        <div className="flex justify-between py-2">
                          <div>
                            <span className="font-medium text-red-600">Asset & Other Deductions</span>
                            <span className="text-xs text-muted-foreground block">Equipment / Clearance</span>
                          </div>
                          <span className={`font-mono font-bold ${previewData.otherDeductions > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                            {previewData.otherDeductions > 0 ? `- ${formatInr(previewData.otherDeductions)}` : "₹0"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Hero Net Payout Card */}
                    <div className="pt-2">
                      <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                            Net Settlement Payout
                          </span>
                          <span className="text-xs text-muted-foreground">Disbursable on exit approval</span>
                        </div>
                        <span className="text-xl lg:text-2xl font-bold font-mono text-emerald-600 tracking-tight">
                          {formatInr(previewData.netSettlementAmount)}
                        </span>
                      </div>

                      {/* Calculation Notes */}
                      {previewData.calculationNotes?.length > 0 && (
                        <div className="mt-2.5 p-2 rounded-lg bg-card border border-border text-xs text-muted-foreground space-y-0.5">
                          {previewData.calculationNotes.map((note: string, idx: number) => (
                            <div key={idx} className="truncate">• {note}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-border rounded-xl p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-full min-h-[300px] bg-muted/10">
                    <Calculator className="size-8 text-muted-foreground/40 mb-2" />
                    <p className="font-semibold text-foreground">No Preview Computed</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      Select an employee, resignation date, and last working date, then click "Compute Statutory Settlement" to view the live calculation sheet.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveSettlement}
                disabled={isSubmitting || !previewData}
                className="font-semibold"
              >
                {isSubmitting ? "Saving..." : "Save Settlement Draft"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= VIEW BREAKDOWN DETAILS MODAL ================= */}
      <Dialog open={!!selectedSettlement} onOpenChange={() => setSelectedSettlement(null)}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto p-6 bg-background">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Full & Final Settlement Statement
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Official clearance voucher and final dues settlement record.
                </DialogDescription>
              </div>
              <Badge
                variant={selectedSettlement?.status === "APPROVED" ? "success" : "warning"}
                className="text-xs"
              >
                {selectedSettlement?.status}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {/* Employee Metadata Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl border border-border bg-muted/20">
              <div>
                <span className="text-xs uppercase font-semibold text-muted-foreground block">Employee</span>
                <span className="font-bold text-foreground text-xs">{selectedSettlement?.user?.name}</span>
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-muted-foreground block">Designation</span>
                <span className="text-foreground text-xs">{selectedSettlement?.user?.designation || "Staff"}</span>
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-muted-foreground block">Relieved On</span>
                <span className="text-foreground text-xs font-mono">
                  {selectedSettlement?.lastWorkingDate ? new Date(selectedSettlement.lastWorkingDate).toLocaleDateString("en-IN") : "-"}
                </span>
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-muted-foreground block">Notice Served</span>
                <span className="text-foreground text-xs font-mono">
                  {selectedSettlement?.servedNoticeDays} / {selectedSettlement?.noticePeriodDays} Days
                </span>
              </div>
            </div>

            {/* Top 3 Metric Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-border bg-card">
                <span className="text-xs uppercase font-semibold text-muted-foreground block">Gross Earnings</span>
                <span className="text-base font-bold font-mono text-foreground mt-1 block">
                  {formatInr(
                    (selectedSettlement?.pendingSalaryAmount || 0) +
                    (selectedSettlement?.leaveEncashmentAmount || 0) +
                    (selectedSettlement?.gratuityAmount || 0)
                  )}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border bg-card">
                <span className="text-xs uppercase font-semibold text-muted-foreground block">Total Deductions</span>
                <span className="text-base font-bold font-mono text-red-600 mt-1 block">
                  - {formatInr(
                    (selectedSettlement?.noticeRecoveryAmount || 0) +
                    (selectedSettlement?.otherDeductions || 0)
                  )}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                <span className="text-xs uppercase font-bold text-emerald-800 dark:text-emerald-300 block">Net Payout</span>
                <span className="text-base font-bold font-mono text-emerald-600 mt-1 block">
                  {formatInr(selectedSettlement?.netSettlementAmount)}
                </span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs font-semibold">Settlement Component</TableHead>
                    <TableHead className="text-xs font-semibold">Calculation Basis</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-xs">Final Month Pending Salary</TableCell>
                    <TableCell className="text-xs text-muted-foreground">Prorated to Last Working Day</TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs">{formatInr(selectedSettlement?.pendingSalaryAmount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-xs">Leave Encashment</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{selectedSettlement?.leaveEncashmentDays} Days (Basic/30)</TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs">{formatInr(selectedSettlement?.leaveEncashmentAmount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-xs">Statutory Gratuity</TableCell>
                    <TableCell className="text-xs text-muted-foreground">Payment of Gratuity Act 1972 (15/26 * Basic * Years)</TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-emerald-600">{formatInr(selectedSettlement?.gratuityAmount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-xs text-red-600">Notice Shortfall Recovery</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{selectedSettlement?.shortfallDays || 0} Days Shortfall Recovery</TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-red-600">- {formatInr(selectedSettlement?.noticeRecoveryAmount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-xs text-red-600">Asset & Other Deductions</TableCell>
                    <TableCell className="text-xs text-muted-foreground">Clearance & Handover Deductions</TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-red-600">- {formatInr(selectedSettlement?.otherDeductions)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {selectedSettlement?.notes && (
              <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs whitespace-pre-wrap font-mono">
                <strong>Exit Remarks:</strong> {selectedSettlement.notes}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setSelectedSettlement(null)}>
              Close
            </Button>
            {selectedSettlement?.status === "DRAFT" && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                onClick={() => handleApprove(selectedSettlement.id, selectedSettlement.userId)}
                disabled={isApproving}
              >
                <CheckCircle2 className="size-3.5 mr-1.5" />
                Approve & Mark Employee Separated
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
