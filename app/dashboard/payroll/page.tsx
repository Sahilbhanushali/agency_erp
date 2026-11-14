"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "react-hot-toast";
import {
  Banknote,
  DollarSign,
  Users,
  FileCheck2,
  TrendingUp,
  Download,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  Lock,
  Clock,
  ShieldCheck,
  Settings,
  Calendar,
  AlertCircle,
  AlertTriangle,
  FileText,
  ChevronRight,
  ExternalLink,
  Search,
  Trash2,
} from "lucide-react";
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import PayslipModal from "@/components/payroll/payslip-modal";
import PayslipTemplatesTab from "@/components/payroll/payslip-templates-tab";
import RunReviewModal from "@/components/payroll/run-review-modal";
import EmployeeSelfService from "@/components/payroll/employee-self-service";
import StatutoryReportsTab from "@/components/payroll/statutory-reports-tab";
import LoansTab from "@/components/payroll/loans-tab";
import FnFTab from "@/components/payroll/fnf-tab";
import { SalaryStructuresTab } from "@/components/payroll/salary-structures-tab";
import { AdjustmentsTab } from "@/components/payroll/adjustments-tab";
import { CalculationRulesTab } from "@/components/payroll/calculation-rules-tab";

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

function formatInr(minorUnits: number): string {
  const rupees = (minorUnits || 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

export default function PayrollPage() {
  // Decides only whether payslip edit/email/delete controls are shown; the server
  // re-checks payroll:update and payroll:delete on every one of those calls.
  const { can } = usePermissions();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "";
  const isHRorAdmin = ["ADMIN", "MANAGER", "HR", "FINANCE"].includes(userRole);

  const [activeTab, setActiveTab] = useState("runs");

  // Selected run for detailed view
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Run awaiting delete confirmation
  const [deletingRun, setDeletingRun] = useState<any | null>(null);
  const [deletingRunBusy, setDeletingRunBusy] = useState(false);

  const handleDeleteRun = async () => {
    if (!deletingRun) return;
    setDeletingRunBusy(true);
    try {
      const res = await fetch(`/api/payroll/runs/${deletingRun.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete the payroll run");
      toast.success(`Deleted the ${MONTH_NAMES[deletingRun.month - 1]} ${deletingRun.year} run`);
      if (selectedRunId === deletingRun.id) setSelectedRunId(null);
      setDeletingRun(null);
      mutateRuns();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletingRunBusy(false);
    }
  };

  // New Payroll Run modal
  const [isCreateRunOpen, setIsCreateRunOpen] = useState(false);
  const [runMonth, setRunMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [runYear, setRunYear] = useState<string>(String(new Date().getFullYear()));
  const [runType, setRunType] = useState<string>("REGULAR");
  const [runNotes, setRunNotes] = useState("");
  const [isCreatingRun, setIsCreatingRun] = useState(false);

  // Payroll Readiness Pre-flight state
  const [readinessReport, setReadinessReport] = useState<any | null>(null);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(false);

  const fetchReadiness = async (m: string, y: string) => {
    try {
      setIsLoadingReadiness(true);
      const res = await fetch(`/api/payroll/readiness?month=${m}&year=${y}`);
      if (res.ok) {
        const data = await res.json();
        setReadinessReport(data);
      }
    } catch {
      // Non-critical check
    } finally {
      setIsLoadingReadiness(false);
    }
  };

  // Salary Structure Modal
  const [editingSalaryUser, setEditingSalaryUser] = useState<any | null>(null);
  const [salaryGross, setSalaryGross] = useState<number>(50000); // rupees
  const [salaryBasic, setSalaryBasic] = useState<number>(25000);
  const [salaryHra, setSalaryHra] = useState<number>(12500);
  const [salarySpecial, setSalarySpecial] = useState<number>(12500);
  const [salaryPf, setSalaryPf] = useState<boolean>(true);
  const [salaryEsi, setSalaryEsi] = useState<boolean>(false);
  const [salaryPt, setSalaryPt] = useState<boolean>(true);
  const [salaryTds, setSalaryTds] = useState<number>(0);
  const [isSavingSalary, setIsSavingSalary] = useState(false);

  // Adjustment Modal
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjUserId, setAdjUserId] = useState<string>("");
  const [adjType, setAdjType] = useState<string>("BONUS");
  const [adjTitle, setAdjTitle] = useState("");
  const [adjAmount, setAdjAmount] = useState<string>("");
  const [adjNotes, setAdjNotes] = useState("");
  const [isSavingAdj, setIsSavingAdj] = useState(false);

  // Search / Filters
  const [salarySearch, setSalarySearch] = useState("");
  const [adjSearch, setAdjSearch] = useState("");

  // Selected payslip for printable view
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);

  // SWR Fetches
  const { data: runs = [], mutate: mutateRuns, isLoading: runsLoading } = useSWR(
    isHRorAdmin ? "/api/payroll/runs" : null,
    fetcher
  );

  const { data: selectedRun, mutate: mutateSelectedRun } = useSWR(
    selectedRunId ? `/api/payroll/runs/${selectedRunId}` : null,
    fetcher
  );

  const { data: users = [] } = useSWR(
    isHRorAdmin ? "/api/users" : null,
    fetcher
  );

  const { data: adjustments = [], mutate: mutateAdjustments } = useSWR(
    isHRorAdmin ? `/api/payroll/adjustments?year=${new Date().getFullYear()}` : null,
    fetcher
  );

  const { data: myPayslips = [] } = useSWR(
    !isHRorAdmin ? "/api/payroll/payslips" : null,
    fetcher
  );

  const { data: settings, mutate: mutateSettings } = useSWR(
    isHRorAdmin ? "/api/payroll/settings" : null,
    fetcher
  );

  const safeRuns = Array.isArray(runs) ? runs : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeAdjustments = Array.isArray(adjustments) ? adjustments : [];
  const safeMyPayslips = Array.isArray(myPayslips) ? myPayslips : [];

  const filteredUsers = safeUsers.filter((u: any) =>
    !salarySearch.trim() ||
    u.name?.toLowerCase().includes(salarySearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(salarySearch.toLowerCase()) ||
    u.designation?.toLowerCase().includes(salarySearch.toLowerCase()) ||
    u.role?.toLowerCase().includes(salarySearch.toLowerCase())
  );

  const filteredAdjustments = safeAdjustments.filter((a: any) =>
    !adjSearch.trim() ||
    a.user?.name?.toLowerCase().includes(adjSearch.toLowerCase()) ||
    a.title?.toLowerCase().includes(adjSearch.toLowerCase()) ||
    a.type?.toLowerCase().includes(adjSearch.toLowerCase())
  );

  // Quick stats
  const latestRun = safeRuns.length > 0 ? safeRuns[0] : null;
  const totalPayout = latestRun ? latestRun.totalNetPay : 0;
  const totalHeadcount = latestRun ? latestRun.totalHeadcount : 0;
  const totalDeductions = latestRun ? latestRun.totalDeductions : 0;

  // Handlers
  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingRun(true);
      const res = await fetch("/api/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: Number(runMonth),
          year: Number(runYear),
          runType,
          notes: runNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payroll run");
      toast.success(`Payroll calculated for ${MONTH_NAMES[Number(runMonth) - 1]} ${runYear}!`);
      setIsCreateRunOpen(false);
      setRunNotes("");
      mutateRuns();
      setSelectedRunId(data.id);
    } catch (err: any) {
      toast.error(err.message || "Calculation failed");
    } finally {
      setIsCreatingRun(false);
    }
  };

  const handleStatusTransition = async (runId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/payroll/runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Status update failed");
      toast.success(`Payroll run status updated to ${newStatus}.`);
      mutateRuns();
      if (selectedRunId === runId) mutateSelectedRun();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleRecalculate = async (runId: string) => {
    try {
      const res = await fetch(`/api/payroll/runs/${runId}/recalculate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Recalculation failed");
      toast.success("Payroll run recalculated with latest attendance and adjustments.");
      mutateRuns();
      if (selectedRunId === runId) mutateSelectedRun();
    } catch (err: any) {
      toast.error(err.message || "Recalculation failed");
    }
  };

  const handleOpenSalaryModal = async (u: any) => {
    setEditingSalaryUser(u);
    try {
      const res = await fetch(`/api/payroll/salary/${u.id}`);
      const data = await res.json();
      if (data.active) {
        const grossRupees = data.active.monthlyGross / 100;
        setSalaryGross(grossRupees);
        setSalaryBasic(data.active.basicSalary / 100);
        setSalaryHra(data.active.hra / 100);
        setSalarySpecial(data.active.specialAllowance / 100);
        setSalaryPf(data.active.pfDeduction);
        setSalaryEsi(data.active.esiDeduction);
        setSalaryPt(data.active.professionalTax);
        setSalaryTds((data.active.tdsMonthly || 0) / 100);
      } else {
        // Defaults: Gross 50k => Basic 50%, HRA 25%, Special 25%
        setSalaryGross(50000);
        setSalaryBasic(25000);
        setSalaryHra(12500);
        setSalarySpecial(12500);
        setSalaryPf(true);
        setSalaryEsi(false);
        setSalaryPt(true);
        setSalaryTds(0);
      }
    } catch {
      setSalaryGross(50000);
      setSalaryBasic(25000);
      setSalaryHra(12500);
      setSalarySpecial(12500);
    }
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSalaryUser) return;
    try {
      setIsSavingSalary(true);
      const res = await fetch(`/api/payroll/salary/${editingSalaryUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basicSalary: Math.round(salaryBasic * 100),
          hra: Math.round(salaryHra * 100),
          specialAllowance: Math.round(salarySpecial * 100),
          pfDeduction: salaryPf,
          esiDeduction: salaryEsi,
          professionalTax: salaryPt,
          tdsMonthly: Math.round(salaryTds * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update salary");
      toast.success(`Salary structure updated for ${editingSalaryUser.name}!`);
      setEditingSalaryUser(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save salary");
    } finally {
      setIsSavingSalary(false);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjUserId || !adjTitle.trim() || !adjAmount) {
      toast.error("Please fill all required adjustment fields.");
      return;
    }
    try {
      setIsSavingAdj(true);
      const res = await fetch("/api/payroll/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: adjUserId,
          month: Number(runMonth),
          year: Number(runYear),
          type: adjType,
          title: adjTitle.trim(),
          amount: Math.round(parseFloat(adjAmount) * 100), // convert rupees to paise
          notes: adjNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save adjustment");
      toast.success("Adjustment saved successfully!");
      setIsAdjustmentModalOpen(false);
      setAdjTitle("");
      setAdjAmount("");
      setAdjNotes("");
      mutateAdjustments();
    } catch (err: any) {
      toast.error(err.message || "Failed to save adjustment");
    } finally {
      setIsSavingAdj(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CALCULATED":
        return <Badge variant="warning" className="text-xs py-0">Calculated</Badge>;
      case "UNDER_REVIEW":
        return <Badge variant="info" className="text-xs py-0">Under Review</Badge>;
      case "APPROVED":
        return <Badge variant="success" className="text-xs py-0">Approved</Badge>;
      case "PAID":
        return <Badge variant="success" className="text-xs py-0">Paid & Published</Badge>;
      case "LOCKED":
        return <Badge variant="neutral" className="text-xs py-0 gap-1"><Lock className="size-2.5" /> Locked</Badge>;
      default:
        return <Badge variant="neutral" className="text-xs py-0">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Banknote className="size-6 text-primary" />
            Payroll & Compensation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Calculate monthly runs, statutory deductions, download bank transfer CSVs, and generate branded payslips.
          </p>
        </div>
        {isHRorAdmin && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsCreateRunOpen(true)}
              className="gap-1.5 shadow-2xs text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              New Payroll Run
            </Button>
          </div>
        )}
      </div>

      {/* KPI Cards (for Admin/HR) */}
      {isHRorAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-2xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Latest Net Payout
                </p>
                <h3 className="text-2xl font-black text-foreground mt-1">
                  {formatInr(totalPayout)}
                </h3>
              </div>
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <DollarSign className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Employees Processed
                </p>
                <h3 className="text-2xl font-black text-foreground mt-1">
                  {totalHeadcount}
                </h3>
              </div>
              <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Users className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Statutory Deductions
                </p>
                <h3 className="text-2xl font-black text-foreground mt-1 text-red-600">
                  {formatInr(totalDeductions)}
                </h3>
              </div>
              <div className="size-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center">
                <TrendingUp className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payroll Cycle Status
                </p>
                <div className="mt-1">
                  {latestRun ? getStatusBadge(latestRun.status) : <Badge variant="neutral">No Runs</Badge>}
                </div>
              </div>
              <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <FileCheck2 className="size-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      {isHRorAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/60 p-1 border border-border/60 rounded-lg flex-wrap">
            <TabsTrigger value="runs" className="text-xs">Payroll Runs</TabsTrigger>
            <TabsTrigger value="salaries" className="text-xs">Salary Structures</TabsTrigger>
            <TabsTrigger value="payslip-templates" className="text-xs">Payslip Templates</TabsTrigger>
            <TabsTrigger value="adjustments" className="text-xs">Monthly Adjustments</TabsTrigger>
            <TabsTrigger value="loans" className="text-xs">Loans & Advances</TabsTrigger>
            <TabsTrigger value="fnf" className="text-xs">Full & Final (FnF)</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">Rules & Settings</TabsTrigger>
            <TabsTrigger value="reports" className="text-xs">Statutory & Reports</TabsTrigger>
            <TabsTrigger value="self-service" className="text-xs">My Self-Service</TabsTrigger>
          </TabsList>

          {/* TAB 1: PAYROLL RUNS */}
          <TabsContent value="runs" className="space-y-4">
            <Card className="shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Pay Period</TableHead>
                      <TableHead className="text-xs font-semibold">Headcount</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Gross Payout</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Deductions</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Net Disbursement</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runsLoading ? (
                      [1, 2, 3].map((i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : safeRuns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                          No payroll runs created yet. Click &quot;New Payroll Run&quot; to calculate this month&apos;s payout.
                        </TableCell>
                      </TableRow>
                    ) : (
                      safeRuns.map((r: any) => (
                        <TableRow key={r.id} className="hover:bg-muted/30">
                          <TableCell className="font-bold text-xs text-foreground">
                            {MONTH_NAMES[r.month - 1]} {r.year}
                          </TableCell>
                          <TableCell className="text-xs">{r.totalHeadcount} Staff</TableCell>
                          <TableCell className="text-right text-xs font-mono">{formatInr(r.totalGross)}</TableCell>
                          <TableCell className="text-right text-xs font-mono text-red-600">
                            {formatInr(r.totalDeductions)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-bold text-emerald-600">
                            {formatInr(r.totalNetPay)}
                          </TableCell>
                          <TableCell>{getStatusBadge(r.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => setSelectedRunId(r.id)}
                                className="gap-1 text-xs"
                              >
                                <Eye className="size-3.5" />
                                View Breakdown
                              </Button>

                            {/* Paid and locked runs are the record of salaries paid; the server refuses those too. */}
                            {can("payroll", "delete") && r.status !== "PAID" && r.status !== "LOCKED" && (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setDeletingRun(r)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                aria-label={`Delete the ${MONTH_NAMES[r.month - 1]} ${r.year} payroll run`}
                                title="Delete run"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}

                              {/* Export Toolbar */}
                              <a href={`/api/payroll/runs/${r.id}/export/bank-csv`} download>
                                <Button aria-label="Download Bank Transfer CSV" variant="ghost" size="icon-xs" title="Download Bank Transfer CSV">
                                  <Download className="size-3.5" />
                                </Button>
                              </a>

                              {/* Status transitions */}
                              {r.status === "CALCULATED" && (
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => handleStatusTransition(r.id, "UNDER_REVIEW")}
                                  className="text-blue-600"
                                >
                                  Send for Review
                                </Button>
                              )}

                              {r.status === "UNDER_REVIEW" && (
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => handleStatusTransition(r.id, "APPROVED")}
                                  className="text-emerald-600"
                                >
                                  Approve Run
                                </Button>
                              )}

                            {r.status === "APPROVED" && (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => handleStatusTransition(r.id, "PAID")}
                                className="text-emerald-600 font-bold"
                              >
                                Mark as Paid
                              </Button>
                            )}

                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Run Review & Variance Audit Modal */}
            {selectedRunId && (
              <RunReviewModal
                runId={selectedRunId}
                onClose={() => setSelectedRunId(null)}
                userRole={userRole}
                onRunUpdated={mutateRuns}
              />
            )}
          </TabsContent>

          {/* TAB 2: SALARY STRUCTURES & COMPENSATION */}
          <TabsContent value="payslip-templates" className="space-y-4">
            <PayslipTemplatesTab canManage={can("payroll", "update")} />
          </TabsContent>

          <TabsContent value="salaries" className="space-y-4">
            <SalaryStructuresTab onRefresh={mutateRuns} />
          </TabsContent>

          {/* TAB 3: MONTHLY ADJUSTMENTS */}
          <TabsContent value="adjustments" className="space-y-4">
            <AdjustmentsTab users={safeUsers} currentYear={new Date().getFullYear()} />
          </TabsContent>

          {/* TAB 4: CALCULATION RULES & SETTINGS */}
          <TabsContent value="settings" className="space-y-4">
            <CalculationRulesTab />
          </TabsContent>

          {/* TAB: LOANS & ADVANCES */}
          <TabsContent value="loans" className="space-y-4">
            <LoansTab users={safeUsers} />
          </TabsContent>

          {/* TAB: FULL AND FINAL SETTLEMENT (FnF) */}
          <TabsContent value="fnf" className="space-y-4">
            <FnFTab users={safeUsers} currentUserId={Number((session?.user as any)?.id)} />
          </TabsContent>

          {/* TAB 5: STATUTORY & FINANCIAL REPORTS */}
          <TabsContent value="reports" className="space-y-4">
            <StatutoryReportsTab runs={safeRuns} />
          </TabsContent>

          {/* TAB 6: EMPLOYEE SELF SERVICE */}
          <TabsContent value="self-service" className="space-y-4">
            <EmployeeSelfService />
          </TabsContent>
        </Tabs>
      ) : (
        /* Regular Employee Self-Service View */
        <EmployeeSelfService />
      )}

      {/* ================= MODAL: CREATE PAYROLL RUN ================= */}
      {isCreateRunOpen && (
        <Dialog open={isCreateRunOpen} onOpenChange={setIsCreateRunOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Plus className="size-5 text-primary" /> Calculate New Payroll Run
              </DialogTitle>
              <DialogDescription className="text-xs">
                Auto-calculates gross, payable days, statutory deductions, and net salary for all active employees.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRun} className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-medium">Month</Label>
                  <Select value={runMonth} onValueChange={setRunMonth}>
                    <SelectTrigger aria-label="Month" className="mt-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((m, idx) => (
                        <SelectItem key={idx} value={String(idx + 1)} className="text-xs">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium">Year</Label>
                  <Input aria-label="Year"
                    type="number"
                    value={runYear}
                    onChange={(e) => setRunYear(e.target.value)}
                    className="mt-1 h-8 text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Cycle Type</Label>
                  <Select value={runType} onValueChange={setRunType}>
                    <SelectTrigger aria-label="Cycle Type" className="mt-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REGULAR" className="text-xs">Regular Monthly</SelectItem>
                      <SelectItem value="OFF_CYCLE" className="text-xs">Off-Cycle</SelectItem>
                      <SelectItem value="BONUS" className="text-xs">Bonus Run</SelectItem>
                      <SelectItem value="FN_F" className="text-xs">Full & Final (F&F)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pre-Flight Readiness Check */}
              <div className="space-y-2 pt-1 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Pre-Flight Readiness Check
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => fetchReadiness(runMonth, runYear)}
                    loading={isLoadingReadiness}
                    className="h-6 text-xs gap-1 text-primary hover:bg-primary/10"
                  >
                    <RefreshCw className="size-3" /> Check Readiness
                  </Button>
                </div>

                {readinessReport && (
                  <div className="space-y-2">
                    {readinessReport.blockers?.length > 0 && (
                      <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="size-3.5" />
                          <span>{readinessReport.blockers.length} Blocker(s) Found</span>
                        </div>
                        {readinessReport.blockers.map((b: any, idx: number) => (
                          <p key={idx} className="text-xs text-red-600/90 pl-5">
                            • {b.title}: {b.description}
                          </p>
                        ))}
                      </div>
                    )}

                    {readinessReport.warnings?.length > 0 && (
                      <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <AlertCircle className="size-3.5" />
                          <span>{readinessReport.warnings.length} Warning(s)</span>
                        </div>
                        {readinessReport.warnings.map((w: any, idx: number) => (
                          <p key={idx} className="text-xs text-amber-700/90 pl-5">
                            • {w.title}: {w.description}
                          </p>
                        ))}
                      </div>
                    )}

                    {readinessReport.blockers?.length === 0 && readinessReport.warnings?.length === 0 && (
                      <div className="p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-xs flex items-center gap-2">
                        <CheckCircle2 className="size-3.5" />
                        <span>All pre-flight checks passed! Ready for calculation.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateRunOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={isCreatingRun}
                  disabled={readinessReport?.blockers?.length > 0}
                  className={readinessReport?.blockers?.length > 0 ? "opacity-50 cursor-not-allowed" : ""}
                >
                  Run Calculation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= MODAL: CONFIGURE SALARY STRUCTURE ================= */}
      {editingSalaryUser && (
        <Dialog open={!!editingSalaryUser} onOpenChange={() => setEditingSalaryUser(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Settings className="size-5 text-primary" /> Configure Salary Structure
              </DialogTitle>
              <DialogDescription className="text-xs">
                Set monthly compensation components for {editingSalaryUser.name}. Preserves version history.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveSalary} className="space-y-3 py-2">
              <div>
                <Label className="text-xs font-semibold">Monthly Gross Salary (₹)</Label>
                <Input aria-label="Monthly Gross Salary (₹)"
                  type="number"
                  value={salaryGross}
                  onChange={(e) => {
                    const gross = parseFloat(e.target.value) || 0;
                    setSalaryGross(gross);
                    // Automatic split: 50% Basic, 25% HRA, 25% Special
                    setSalaryBasic(Math.round(gross * 0.5));
                    setSalaryHra(Math.round(gross * 0.25));
                    setSalarySpecial(Math.round(gross * 0.25));
                  }}
                  className="mt-1 h-9 font-mono font-bold text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                <div>
                  <Label className="text-xs font-medium">Basic (50%)</Label>
                  <Input aria-label="Basic (50%)"
                    type="number"
                    value={salaryBasic}
                    onChange={(e) => setSalaryBasic(parseFloat(e.target.value) || 0)}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">HRA (25%)</Label>
                  <Input aria-label="HRA (25%)"
                    type="number"
                    value={salaryHra}
                    onChange={(e) => setSalaryHra(parseFloat(e.target.value) || 0)}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Special (25%)</Label>
                  <Input aria-label="Special (25%)"
                    type="number"
                    value={salarySpecial}
                    onChange={(e) => setSalarySpecial(parseFloat(e.target.value) || 0)}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs font-semibold block">Statutory Deductions & TDS</Label>
                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
                    <Checkbox
                      checked={salaryPf}
                      onCheckedChange={(checked) => setSalaryPf(Boolean(checked))}
                    />
                    <span className="font-medium text-foreground">PF (12%)</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
                    <Checkbox
                      checked={salaryEsi}
                      onCheckedChange={(checked) => setSalaryEsi(Boolean(checked))}
                    />
                    <span className="font-medium text-foreground">ESI</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
                    <Checkbox
                      checked={salaryPt}
                      onCheckedChange={(checked) => setSalaryPt(Boolean(checked))}
                    />
                    <span className="font-medium text-foreground">Prof. Tax</span>
                  </label>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">Monthly TDS Deduction (₹)</Label>
                <Input aria-label="Monthly TDS Deduction (₹)"
                  type="number"
                  value={salaryTds}
                  onChange={(e) => setSalaryTds(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingSalaryUser(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={isSavingSalary}>
                  Save Structure
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= MODAL: ADD ADJUSTMENT ================= */}
      {isAdjustmentModalOpen && (
        <Dialog open={isAdjustmentModalOpen} onOpenChange={setIsAdjustmentModalOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Plus className="size-5 text-primary" /> Add Variable Adjustment
              </DialogTitle>
              <DialogDescription className="text-xs">
                Add a bonus, reimbursement, or loan recovery for this month&apos;s payroll.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveAdjustment} className="space-y-3 py-2">
              <div>
                <Label className="text-xs font-medium">Employee</Label>
                <Select value={adjUserId} onValueChange={setAdjUserId}>
                  <SelectTrigger aria-label="Employee" className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {safeUsers.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)} className="text-xs">
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Type</Label>
                  <Select value={adjType} onValueChange={setAdjType}>
                    <SelectTrigger aria-label="Type" className="mt-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BONUS" className="text-xs">Bonus</SelectItem>
                      <SelectItem value="REIMBURSEMENT" className="text-xs">Reimbursement</SelectItem>
                      <SelectItem value="ONE_TIME_EARNING" className="text-xs">One-Time Earning</SelectItem>
                      <SelectItem value="LOAN_ADVANCE" className="text-xs">Loan / Advance Recovery</SelectItem>
                      <SelectItem value="DEDUCTION" className="text-xs">Other Deduction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium">Amount (₹)</Label>
                  <Input aria-label="Amount (₹)"
                    type="number"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="mt-1 h-8 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">Title *</Label>
                <Input aria-label="Title"
                  value={adjTitle}
                  onChange={(e) => setAdjTitle(e.target.value)}
                  placeholder="e.g. Client Travel Allowance"
                  className="mt-1 h-8 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Notes (Optional)</Label>
                <Input aria-label="Notes (Optional)"
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  placeholder="e.g. Approved by Director"
                  className="mt-1 h-8 text-xs"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={isSavingAdj}>
                  Save Adjustment
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= BRANDED PAYSLIP PRINTABLE MODAL ================= */}
      {selectedPayslip && (
        <PayslipModal
          isOpen={!!selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
          payslip={selectedPayslip}
          // Editing, emailing and deleting a payslip are all payroll:update or
          // stricter on the server; this only decides whether the controls show.
          canManage={can("payroll", "update")}
          onChanged={() => {
            mutateSelectedRun();
            mutateRuns();
          }}
          agencyName={settings?.companyName || "Marketing Agency"}
        />
      )}

      <DeleteConfirmationDialog
        isOpen={deletingRun !== null}
        onClose={() => !deletingRunBusy && setDeletingRun(null)}
        onConfirm={handleDeleteRun}
        itemName={deletingRun ? `${MONTH_NAMES[deletingRun.month - 1]} ${deletingRun.year}` : ""}
        entityType="payroll_run"
        isLoading={deletingRunBusy}
      />
    </div>
  );
}
