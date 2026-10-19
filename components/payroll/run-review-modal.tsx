"use client";

import React, { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Lock,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserX,
  Users,
  XCircle,
  ChevronDown,
  Archive,
  Send,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "react-hot-toast";
import EmployeeVarianceDrawer from "./employee-variance-drawer";
import PayslipModal from "./payslip-modal";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }
  return res.json();
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatInr(minorUnits: number | null | undefined): string {
  if (minorUnits === null || minorUnits === undefined) return "—";
  const rupees = minorUnits / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

interface RunReviewModalProps {
  runId: string | null;
  onClose: () => void;
  userRole?: string;
  onRunUpdated: () => void;
}

export default function RunReviewModal({
  runId,
  onClose,
  userRole = "ADMIN",
  onRunUpdated,
}: RunReviewModalProps) {
  const [activeTab, setActiveTab] = useState("employees");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "FLAGGED" | "HOLD">("ALL");
  const [selectedDept, setSelectedDept] = useState("ALL");

  // Selected employee for side-by-side drawer
  const [drawerSlip, setDrawerSlip] = useState<any | null>(null);

  // Selected employee for printable PDF/dialog payslip
  const [printableSlip, setPrintableSlip] = useState<any | null>(null);

  // Action modals
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isVoidOpen, setIsVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // SWR for run details
  const {
    data: run,
    mutate: mutateRun,
    isLoading: isRunLoading,
  } = useSWR(runId ? `/api/payroll/runs/${runId}` : null, fetcher);

  // SWR for variance report
  const {
    data: varianceData,
    mutate: mutateVariance,
  } = useSWR(runId ? `/api/payroll/runs/${runId}/variance` : null, fetcher);

  // Payslip templates available for this run. Hooks run before the guard below, which
  // is why they sit here rather than next to the markup that uses them.
  const { data: templatesData } = useSWR("/api/payroll/payslip-templates", fetcher);
  const payslipTemplates: { id: string; name: string; isDefault: boolean }[] =
    templatesData?.templates ?? [];

  const [runTemplateId, setRunTemplateId] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (run?.payslipTemplateId !== undefined) {
      setRunTemplateId(run.payslipTemplateId ?? "");
    }
  }, [run?.payslipTemplateId]);

  const saveRunTemplate = async (value: string) => {
    setRunTemplateId(value);
    setSavingTemplate(true);
    try {
      const res = await fetch(`/api/payroll/runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payslipTemplateId: value || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not set the template");
      toast.success(
        value
          ? `Payslips in this run will use "${payslipTemplates.find((t) => t.id === value)?.name}"`
          : "Payslips in this run will use the default template",
      );
      mutateRun();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  if (!runId || !run) return null;

  const isLocked = ["LOCKED", "PAID"].includes(run.status);
  const payslips: any[] = run.payslips || [];
  const auditLogs: any[] = run.auditLogs || [];

  // Map variance per user
  const varianceMap = new Map<number, any>();
  if (varianceData?.employeeVariances) {
    for (const v of varianceData.employeeVariances) {
      varianceMap.set(v.userId, v);
    }
  }

  // Extract departments
  const departments = Array.from(
    new Set(payslips.map((p) => p.user?.department || p.department || "General").filter(Boolean))
  );

  // Filtered employees
  const filteredSlips = payslips.filter((slip) => {
    const v = varianceMap.get(slip.userId);
    const empName = (slip.user?.name || slip.employeeName || "").toLowerCase();
    const empDesig = (slip.user?.designation || slip.designation || "").toLowerCase();
    const dept = slip.user?.department || slip.department || "General";

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!empName.includes(q) && !empDesig.includes(q)) return false;
    }

    // Department filter
    if (selectedDept !== "ALL" && dept !== selectedDept) return false;

    // Filter pill
    if (filterType === "FLAGGED") return v?.isFlagged;
    if (filterType === "HOLD") return slip.status === "ON_HOLD";

    return true;
  });

  const flaggedCount = varianceData?.flaggedCount || 0;
  const holdCount = payslips.filter((p) => p.status === "ON_HOLD").length;

  // Handlers
  const handleTransition = async (newStatus: string) => {
    try {
      setIsActionLoading(true);
      const res = await fetch(`/api/payroll/runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update run status");

      toast.success(`Payroll status updated to ${newStatus}`);
      mutateRun();
      mutateVariance();
      onRunUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRecalculateBatch = async () => {
    try {
      setIsActionLoading(true);
      const res = await fetch(`/api/payroll/runs/${runId}/recalculate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to recalculate run");

      toast.success("Payroll run recalculated successfully with latest data!");
      mutateRun();
      mutateVariance();
      onRunUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to recalculate run");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please enter a rejection reason");
      return;
    }

    try {
      setIsActionLoading(true);
      const res = await fetch(`/api/payroll/runs/${runId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject run");

      toast.success("Run rejected back to Draft/Calculated");
      setIsRejectOpen(false);
      setRejectReason("");
      mutateRun();
      onRunUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject run");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidReason.trim()) {
      toast.error("Please enter a cancellation reason");
      return;
    }

    try {
      setIsActionLoading(true);
      const res = await fetch(`/api/payroll/runs/${runId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to void run");

      toast.success("Payroll run successfully voided");
      setIsVoidOpen(false);
      setVoidReason("");
      mutateRun();
      onRunUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to void run");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmPublish = async () => {
    try {
      setIsActionLoading(true);
      const res = await fetch(`/api/payroll/runs/${runId}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish payslips");

      toast.success(data.message || "Payslips successfully published to employees!");
      setIsPublishConfirmOpen(false);
      refreshAll();
    } catch (err: any) {
      toast.error(err.message || "Publishing failed");
    } finally {
      setIsActionLoading(false);
    }
  };

  const refreshAll = () => {
    mutateRun();
    mutateVariance();
    onRunUpdated();
  };

  return (
    <>
      <Dialog open={!!runId} onOpenChange={onClose}>
        <DialogContent className="w-[96vw] max-w-7xl sm:max-w-7xl max-h-[92vh] h-[90vh] p-0 flex flex-col gap-0 rounded-2xl overflow-hidden bg-background shadow-2xl border border-border">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border bg-card shrink-0 space-y-4">
            {/*
              The payslip template for this whole run. Setting it here means every
              payslip in the run — downloaded or emailed — uses it, rather than picking
              a template one document at a time.
            */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="run-payslip-template" className="text-xs font-medium">
                Payslip template for this run
              </label>
              <select
                id="run-payslip-template"
                value={runTemplateId}
                onChange={(e) => saveRunTemplate(e.target.value)}
                disabled={savingTemplate}
                className="h-8 min-w-[180px] rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Use the default template</option>
                {payslipTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
              {savingTemplate && (
                <span className="text-[11px] text-muted-foreground">Saving…</span>
              )}
              {payslipTemplates.length === 0 && (
                <span className="text-[11px] text-muted-foreground">
                  No templates yet — create one under Payroll → Payslip Templates.
                </span>
              )}
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <DialogTitle className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                    {MONTH_NAMES[run.month - 1]} {run.year} Payroll Run
                  </DialogTitle>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                    {run.runType || "REGULAR"}
                  </Badge>
                  {run.status === "LOCKED" ? (
                    <Badge variant="neutral" className="gap-1 text-[10px]">
                      <Lock className="size-2.5" /> Locked
                    </Badge>
                  ) : run.status === "PAID" ? (
                    <Badge variant="success" className="text-[10px]">
                      Paid & Disbursed
                    </Badge>
                  ) : run.status === "APPROVED" ? (
                    <Badge variant="success" className="text-[10px]">
                      Approved
                    </Badge>
                  ) : run.status === "UNDER_REVIEW" ? (
                    <Badge variant="info" className="text-[10px]">
                      Under Review
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="text-[10px]">
                      Calculated
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Pay Period: {new Date(run.payPeriodStart).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} — {new Date(run.payPeriodEnd).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  {run.approvedBy && ` • Approved by ${run.approvedBy.name}`}
                </DialogDescription>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {!isLocked && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={handleRecalculateBatch}
                    disabled={isActionLoading}
                    className="gap-1.5 text-xs"
                  >
                    <RefreshCw className={`size-3.5 ${isActionLoading ? "animate-spin" : ""}`} />
                    Recalculate
                  </Button>
                )}

                {/* Multi-bank format dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="xs" className="gap-1.5 text-xs">
                      <Download className="size-3.5" />
                      <span>Bank File</span>
                      <ChevronDown className="size-3 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 text-xs">
                    <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Disbursement Format</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <a href={`/api/payroll/runs/${run.id}/export/bank-csv?format=HDFC`} download className="cursor-pointer">
                        HDFC Bank (E-Net)
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/api/payroll/runs/${run.id}/export/bank-csv?format=ICICI`} download className="cursor-pointer">
                        ICICI Corporate Multi-Pay
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/api/payroll/runs/${run.id}/export/bank-csv?format=SBI`} download className="cursor-pointer">
                        SBI Corporate (CMP)
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href={`/api/payroll/runs/${run.id}/export/bank-csv?format=GENERIC`} download className="cursor-pointer">
                        Generic NEFT / RTGS
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Bulk Payslips ZIP download */}
                <a href={`/api/payroll/runs/${run.id}/export/payslips-zip`} download>
                  <Button variant="outline" size="xs" className="gap-1.5 text-xs">
                    <Archive className="size-3.5" />
                    Payslips ZIP
                  </Button>
                </a>

                {/* Statutory & Accounting Reports dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="xs" className="gap-1.5 text-xs">
                      <FileText className="size-3.5" />
                      <span>Reports</span>
                      <ChevronDown className="size-3 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 text-xs">
                    <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Statutory Registers</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <a href={`/api/payroll/runs/${run.id}/export/register-csv`} download className="cursor-pointer">
                        Statutory Register (CSV)
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/api/payroll/runs/${run.id}/export/reports?type=pf-ecr`} download className="cursor-pointer">
                        PF ECR Return File
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/api/payroll/runs/${run.id}/export/reports?type=esi-return`} download className="cursor-pointer">
                        ESI Monthly Return File
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/api/payroll/runs/${run.id}/export/reports?type=pt-summary`} download className="cursor-pointer">
                        Professional Tax Summary
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/api/payroll/runs/${run.id}/export/reports?type=tds-24q`} download className="cursor-pointer">
                        TDS 24Q Quarterly Summary
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/api/payroll/runs/${run.id}/export/reports?type=ctc-dept`} download className="cursor-pointer">
                        Departmental CTC Breakdown
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Accounting Journal</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <a href={`/api/payroll/runs/${run.id}/export/journal-entry?format=standard`} download className="cursor-pointer">
                        Standard Journal Entry (CSV)
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/api/payroll/runs/${run.id}/export/journal-entry?format=tally`} download className="cursor-pointer">
                        Tally ERP Import (XML)
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/api/payroll/runs/${run.id}/export/journal-entry?format=zoho`} download className="cursor-pointer">
                        Zoho Books Journal (CSV)
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Publish to Employees button */}
                {["APPROVED", "LOCKED", "PAID"].includes(run.status) && (
                  <Button
                    size="xs"
                    onClick={() => setIsPublishConfirmOpen(true)}
                    disabled={isActionLoading}
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    <Send className="size-3.5" />
                    Publish to Employees
                  </Button>
                )}

                {/* Workflow status buttons */}
                {run.status === "CALCULATED" && (
                  <Button
                    size="xs"
                    onClick={() => handleTransition("UNDER_REVIEW")}
                    disabled={isActionLoading}
                    className="gap-1.5 text-xs"
                  >
                    <FileCheck2 className="size-3.5" />
                    Submit for Review
                  </Button>
                )}

                {run.status === "UNDER_REVIEW" && (
                  <>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setIsRejectOpen(true)}
                      disabled={isActionLoading}
                      className="gap-1.5 text-xs text-red-600 hover:text-red-700"
                    >
                      <XCircle className="size-3.5" />
                      Reject
                    </Button>
                    <Button
                      size="xs"
                      onClick={() => handleTransition("APPROVED")}
                      disabled={isActionLoading}
                      className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Approve Run
                    </Button>
                  </>
                )}

                {run.status === "APPROVED" && (
                  <Button
                    size="xs"
                    onClick={() => handleTransition("LOCKED")}
                    disabled={isActionLoading}
                    className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Lock className="size-3.5" />
                    Lock Run
                  </Button>
                )}

                {run.status === "LOCKED" && (
                  <Button
                    size="xs"
                    onClick={() => handleTransition("PAID")}
                    disabled={isActionLoading}
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    <Banknote className="size-3.5" />
                    Mark as Paid
                  </Button>
                )}

                {/* Super-admin void button */}
                {userRole === "ADMIN" && run.status !== "PAID" && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setIsVoidOpen(true)}
                    className="text-muted-foreground hover:text-red-600 text-xs"
                  >
                    Void Run
                  </Button>
                )}
              </div>
            </div>

            {/* Top Metric & MoM Variance Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Net Disbursement */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Net Disbursement</span>
                  {varianceData?.summary?.net && (
                    <span
                      className={`font-mono font-bold flex items-center gap-0.5 text-xs ${
                        varianceData.summary.net.percent >= 0 ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {varianceData.summary.net.percent >= 0 ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      )}
                      {varianceData.summary.net.percent}%
                    </span>
                  )}
                </div>
                <div className="text-xl lg:text-2xl font-bold font-mono text-emerald-600 mt-1.5 tracking-tight">
                  {formatInr(run.totalNetPay)}
                </div>
              </div>

              {/* Headcount */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Processed Staff</span>
                  {varianceData?.summary?.headcount && (
                    <span className="font-mono text-xs font-semibold">
                      {varianceData.summary.headcount.delta > 0
                        ? `+${varianceData.summary.headcount.delta}`
                        : varianceData.summary.headcount.delta}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-xl lg:text-2xl font-bold font-mono text-foreground tracking-tight">
                    {run.totalHeadcount}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">Employees</span>
                </div>
              </div>

              {/* Gross */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Total Gross</span>
                  {varianceData?.summary?.gross && (
                    <span
                      className={`font-mono text-xs font-semibold ${
                        varianceData.summary.gross.percent >= 0 ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {varianceData.summary.gross.percent}%
                    </span>
                  )}
                </div>
                <div className="text-xl lg:text-2xl font-bold font-mono text-foreground mt-1.5 tracking-tight">
                  {formatInr(run.totalGross)}
                </div>
              </div>

              {/* Employer Cost (CTC) */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span className="font-medium">Total Employer Cost</span>
                  {flaggedCount > 0 && (
                    <Badge variant="warning" className="text-[10px] py-0 px-1 font-mono">
                      {flaggedCount} Flagged
                    </Badge>
                  )}
                </div>
                <div className="text-xl lg:text-2xl font-bold font-mono text-foreground mt-1.5 tracking-tight">
                  {formatInr(run.totalEmployerCost)}
                </div>
              </div>
            </div>
          </div>

          {/* Main Tabs Inside Modal */}
          <div className="flex-1 overflow-hidden flex flex-col p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                <TabsList className="bg-muted/60 p-1 border border-border/60 rounded-lg">
                  <TabsTrigger value="employees" className="text-xs">
                    Employees ({payslips.length})
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="text-xs">
                    Audit Trail & History ({auditLogs.length})
                  </TabsTrigger>
                </TabsList>

                {activeTab === "employees" && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Filter Pills */}
                    <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/20">
                      <button
                        onClick={() => setFilterType("ALL")}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                          filterType === "ALL" ? "bg-background text-foreground shadow-2xs font-bold" : "text-muted-foreground"
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setFilterType("FLAGGED")}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
                          filterType === "FLAGGED"
                            ? "bg-amber-500/10 text-amber-600 shadow-2xs font-bold"
                            : "text-muted-foreground"
                        }`}
                      >
                        Flagged ({flaggedCount})
                      </button>
                      <button
                        onClick={() => setFilterType("HOLD")}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
                          filterType === "HOLD"
                            ? "bg-red-500/10 text-red-600 shadow-2xs font-bold"
                            : "text-muted-foreground"
                        }`}
                      >
                        On Hold ({holdCount})
                      </button>
                    </div>

                    {/* Department Filter */}
                    {departments.length > 1 && (
                      <Select value={selectedDept} onValueChange={setSelectedDept}>
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue placeholder="Department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Depts</SelectItem>
                          {departments.map((d: any) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Search */}
                    <div className="relative w-44">
                      <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                      <Input
                        placeholder="Search employee..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* TAB 1: EMPLOYEES TABLE */}
              <TabsContent value="employees" className="flex-1 overflow-y-auto m-0 border border-border rounded-xl">
                <div className="overflow-x-auto">
                  <Table className="min-w-[950px]">
                    <TableHeader className="sticky top-0 bg-card z-10 shadow-2xs">
                      <TableRow>
                        <TableHead className="text-xs font-semibold w-64 min-w-[200px]">Employee</TableHead>
                        <TableHead className="text-right text-xs font-semibold w-28">Payable Days</TableHead>
                        <TableHead className="text-right text-xs font-semibold w-32">Earned Gross</TableHead>
                        <TableHead className="text-right text-xs font-semibold w-28">Deductions</TableHead>
                        <TableHead className="text-right text-xs font-semibold w-36">Net Pay</TableHead>
                        <TableHead className="text-xs font-semibold min-w-[220px]">Variance & Reasons</TableHead>
                        <TableHead className="text-center text-xs font-semibold w-24">Status</TableHead>
                        <TableHead className="text-right text-xs font-semibold w-36">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSlips.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-10 text-xs text-muted-foreground">
                            No employees matched the selected filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSlips.map((slip) => {
                          const v = varianceMap.get(slip.userId);
                          const isHeld = slip.status === "ON_HOLD";
                          return (
                            <TableRow key={slip.id} className="hover:bg-muted/30">
                              <TableCell className="w-64 min-w-[200px]">
                                <div>
                                  <p className="text-xs font-bold text-foreground">
                                    {slip.user?.name || slip.employeeName}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {slip.user?.designation || slip.designation || "Staff"} • {slip.user?.department || slip.department || "General"}
                                  </p>
                                </div>
                              </TableCell>

                              <TableCell className="text-right text-xs font-mono font-medium w-28">
                                {slip.payableDays} d
                              </TableCell>

                              <TableCell className="text-right text-xs font-mono w-32">
                                {formatInr(slip.grossSalary)}
                              </TableCell>

                              <TableCell className="text-right text-xs font-mono text-red-600 font-medium w-28">
                                {formatInr(slip.totalDeductions)}
                              </TableCell>

                              <TableCell className="text-right text-xs font-mono font-bold text-emerald-600 text-sm w-36">
                                {formatInr(slip.netSalary)}
                              </TableCell>

                              {/* MoM Variance & Operational Reasons */}
                              <TableCell className="min-w-[220px]">
                                <div className="flex flex-col gap-1 items-start">
                                  {v?.previousGross !== null && v ? (
                                    <span
                                      className={`text-[11px] font-mono font-bold flex items-center gap-0.5 ${
                                        v.percentDelta >= 0 ? "text-emerald-600" : "text-amber-600"
                                      }`}
                                    >
                                      {v.percentDelta >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                                      {v.percentDelta > 0 ? `+${v.percentDelta}%` : `${v.percentDelta}%`}
                                    </span>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] py-0">
                                      New Joiner
                                    </Badge>
                                  )}

                                  {v?.reasons && v.reasons.length > 0 && (
                                    <div className="flex flex-wrap gap-1 max-w-[280px]">
                                      {v.reasons.slice(0, 3).map((r: string, idx: number) => (
                                        <span
                                          key={idx}
                                          className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground truncate"
                                          title={r}
                                        >
                                          {r}
                                        </span>
                                      ))}
                                      {v.reasons.length > 3 && (
                                        <span className="text-[9px] text-muted-foreground font-medium">
                                          +{v.reasons.length - 3} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              {/* Status pill */}
                              <TableCell className="text-center w-24">
                                {isHeld ? (
                                  <Badge variant="destructive" className="text-[10px] py-0" title={slip.holdReason}>
                                    On Hold
                                  </Badge>
                                ) : (
                                  <Badge variant="neutral" className="text-[10px] py-0">
                                    Ready
                                  </Badge>
                                )}
                              </TableCell>

                              {/* Actions */}
                              <TableCell className="text-right w-36">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={() => setDrawerSlip(slip)}
                                    className="gap-1 text-xs"
                                  >
                                    <Eye className="size-3" />
                                    Compare
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setPrintableSlip(slip)}
                                    className="gap-1 text-xs"
                                  >
                                    <FileText className="size-3" />
                                    Payslip
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* TAB 2: AUDIT TRAIL & HISTORY */}
              <TabsContent value="audit" className="flex-1 overflow-y-auto m-0 border border-border rounded-xl p-4">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Run Lifecycle Events & Approvals
                  </h4>

                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No audit logs recorded for this run.
                    </p>
                  ) : (
                    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                      {auditLogs.map((log: any) => (
                        <div key={log.id} className="p-3 text-xs flex items-start justify-between gap-4 bg-card">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {log.action}
                              </Badge>
                              <span className="font-semibold text-foreground">
                                {log.user?.name || "System Automated"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {log.details || "Status change recorded"}
                            </p>
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Side-by-Side Employee Comparison Drawer */}
      {drawerSlip && (
        <EmployeeVarianceDrawer
          isOpen={!!drawerSlip}
          onClose={() => setDrawerSlip(null)}
          payslip={drawerSlip}
          varianceData={varianceMap.get(drawerSlip.userId)}
          payrollRunId={run.id}
          isRunLocked={isLocked}
          onRefresh={refreshAll}
        />
      )}

      {/* Printable Payslip Modal */}
      {printableSlip && (
        <PayslipModal
          payslip={printableSlip}
          isOpen={!!printableSlip}
          onClose={() => setPrintableSlip(null)}
        />
      )}

      {/* Reject Modal */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Payroll Run</DialogTitle>
            <DialogDescription>
              Provide mandatory feedback explaining why this run is rejected. The run will transition back to CALCULATED for amendments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label className="text-xs font-semibold">Rejection Reason *</Label>
            <Textarea
              placeholder="e.g. Incentive discrepancy in design team, unpaid leave unadjusted for Rahul..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs min-h-[90px]"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmReject}
              disabled={isActionLoading || !rejectReason.trim()}
            >
              {isActionLoading ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Modal */}
      <Dialog open={isVoidOpen} onOpenChange={setIsVoidOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Void Payroll Run (Super-Admin)</DialogTitle>
            <DialogDescription>
              Voiding cancels this run and voids any linked finance expense records. A mandatory audit reason is required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label className="text-xs font-semibold">Mandatory Void Reason *</Label>
            <Textarea
              placeholder="e.g. Duplicate batch initialized by mistake..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="text-xs min-h-[90px]"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsVoidOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmVoid}
              disabled={isActionLoading || !voidReason.trim()}
            >
              {isActionLoading ? "Voiding..." : "Confirm Void"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish to Employees Confirmation Modal */}
      <Dialog open={isPublishConfirmOpen} onOpenChange={setIsPublishConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Payslips to Employees</DialogTitle>
            <DialogDescription>
              This will mark all employee payslips for this period as published and paid, allowing employees to access and download their payslips immediately in their Self-Service portal.
            </DialogDescription>
          </DialogHeader>

          {run && (
            <div className="p-3 bg-muted/40 rounded-lg border border-border text-xs space-y-1.5 my-2">
              <div className="flex justify-between font-semibold">
                <span className="text-muted-foreground">Pay Period:</span>
                <span className="text-foreground">{MONTH_NAMES[run.month - 1]} {run.year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Employees Notified:</span>
                <span className="font-bold text-foreground">{run.payslips?.length || 0} staff</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Payout:</span>
                <span className="font-mono font-bold text-emerald-600">{formatInr(run.totalNetPay)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsPublishConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmPublish}
              disabled={isActionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {isActionLoading ? "Publishing..." : "Confirm & Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
