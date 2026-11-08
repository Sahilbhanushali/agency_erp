"use client";

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Clock,
  DollarSign,
  FileText,
  Lock,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { toast } from "react-hot-toast";

function formatInr(minorUnits: number | null | undefined): string {
  if (minorUnits === null || minorUnits === undefined) return "—";
  const rupees = minorUnits / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

interface EmployeeVarianceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  payslip: any | null;
  varianceData?: any | null;
  payrollRunId: string;
  isRunLocked: boolean;
  onRefresh: () => void;
}

export default function EmployeeVarianceDrawer({
  isOpen,
  onClose,
  payslip,
  varianceData,
  payrollRunId,
  isRunLocked,
  onRefresh,
}: EmployeeVarianceDrawerProps) {
  // Hold / Release state
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [isUpdatingHold, setIsUpdatingHold] = useState(false);

  // Quick Adjustment state
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjType, setAdjType] = useState<string>("BONUS");
  const [adjTitle, setAdjTitle] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNotes, setAdjNotes] = useState("");
  const [isSavingAdj, setIsSavingAdj] = useState(false);

  // Single Recalculate state
  const [isRecalculating, setIsRecalculating] = useState(false);

  if (!payslip) return null;

  const employeeName = payslip.user?.name || payslip.employeeName || `Employee #${payslip.userId}`;
  const designation = payslip.user?.designation || payslip.designation || "Staff";
  const department = payslip.user?.department || payslip.department || "General";
  const isHeld = payslip.status === "ON_HOLD";

  let calcBreakdown: any = {};
  try {
    calcBreakdown = JSON.parse(payslip.breakdownJson);
  } catch {}

  const prevGross = varianceData?.previousGross ?? null;
  const prevNet = varianceData?.previousNet ?? null;
  const grossDelta = varianceData?.grossDelta ?? 0;
  const netDelta = varianceData?.netDelta ?? 0;
  const percentDelta = varianceData?.percentDelta ?? 0;

  // Handlers
  const handleToggleHold = async () => {
    try {
      setIsUpdatingHold(true);
      const action = isHeld ? "RELEASE" : "HOLD";
      const res = await fetch(`/api/payroll/payslips/${payslip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: isHeld ? undefined : holdReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update salary status");

      toast.success(isHeld ? `Salary released for ${employeeName}` : `Salary placed on hold for ${employeeName}`);
      setIsHoldModalOpen(false);
      setHoldReason("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update salary hold status");
    } finally {
      setIsUpdatingHold(false);
    }
  };

  const handleRecalculateSingle = async () => {
    try {
      setIsRecalculating(true);
      const res = await fetch(`/api/payroll/runs/${payrollRunId}/recalculate-employee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: payslip.userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Recalculation failed");

      toast.success(`Recalculated payslip for ${employeeName}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to recalculate payslip");
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjTitle.trim() || !adjAmount) {
      toast.error("Please enter adjustment title and amount");
      return;
    }

    try {
      setIsSavingAdj(true);
      const res = await fetch(`/api/payroll/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: payslip.userId,
          month: payslip.month,
          year: payslip.year,
          type: adjType,
          title: adjTitle.trim(),
          amount: Math.round(parseFloat(adjAmount) * 100), // paise
          notes: adjNotes,
          payrollRunId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save adjustment");

      toast.success(`Adjustment added & payslip recalculated for ${employeeName}`);
      setIsAdjModalOpen(false);
      setAdjTitle("");
      setAdjAmount("");
      setAdjNotes("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to add adjustment");
    } finally {
      setIsSavingAdj(false);
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="sm:max-w-xl w-full p-0 flex flex-col gap-0 overflow-hidden bg-background">
          {/* Header */}
          <div className="p-6 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">{employeeName}</h2>
                  {isHeld ? (
                    <Badge variant="destructive" className="text-xs uppercase font-mono tracking-wider">
                      On Hold
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {designation} • {department} • Emp #{payslip.userId}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {!isRunLocked && (
                  <>
                    <Button
                      variant={isHeld ? "default" : "outline"}
                      size="xs"
                      onClick={() => setIsHoldModalOpen(true)}
                      className="gap-1 text-xs"
                    >
                      {isHeld ? <PlayCircle className="size-3.5" /> : <PauseCircle className="size-3.5" />}
                      {isHeld ? "Release Salary" : "Put on Hold"}
                    </Button>

                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setIsAdjModalOpen(true)}
                      className="gap-1 text-xs"
                    >
                      <Plus className="size-3.5" />
                      Add Adjustment
                    </Button>

                    <Button aria-label="Recalculate Employee"
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleRecalculateSingle}
                      disabled={isRecalculating}
                      title="Recalculate Employee"
                    >
                      <RefreshCw className={`size-3.5 ${isRecalculating ? "animate-spin" : ""}`} />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Hold Banner if on hold */}
            {isHeld && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  <strong>Salary On Hold:</strong> {payslip.holdReason || "Pending verification"}
                </span>
              </div>
            )}
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. Side-by-Side MoM Variance Cards */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Month-Over-Month Comparison
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {/* Last Month Card */}
                <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Previous Cycle</p>
                  <div>
                    <p className="text-xs text-muted-foreground">Gross</p>
                    <p className="text-sm font-semibold font-mono">{formatInr(prevGross)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net Pay</p>
                    <p className="text-base font-bold font-mono text-foreground">{formatInr(prevNet)}</p>
                  </div>
                </div>

                {/* This Month Card with Delta */}
                <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-primary">This Cycle</p>
                    {prevGross !== null && (
                      <span
                        className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
                          percentDelta >= 0 ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        {percentDelta >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                        {percentDelta > 0 ? `+${percentDelta}%` : `${percentDelta}%`}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gross</p>
                    <p className="text-sm font-semibold font-mono">{formatInr(payslip.grossSalary)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net Pay</p>
                    <p className="text-base font-bold font-mono text-emerald-600">{formatInr(payslip.netSalary)}</p>
                  </div>
                </div>
              </div>

              {/* Operational Variance Reasons */}
              {varianceData?.reasons && varianceData.reasons.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {varianceData.reasons.map((r: string, idx: number) => (
                    <Badge key={idx} variant="neutral" className="text-xs py-0.5">
                      {r}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Attendance & Derived Working Metrics */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Attendance & Pay Days Derivation
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                  <p className="text-xs text-muted-foreground">Payable Days</p>
                  <p className="text-sm font-bold font-mono text-foreground mt-0.5">{payslip.payableDays} d</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                  <p className="text-xs text-muted-foreground">Present / Paid Leaves</p>
                  <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                    {calcBreakdown.presentDays || 0}P + {payslip.paidLeaveDays || 0}L
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                  <p className="text-xs text-muted-foreground">LOP / Late Penalty</p>
                  <p className="text-sm font-bold font-mono text-red-600 mt-0.5">
                    {payslip.lopDays || 0} LOP • {payslip.lateDeductionDays || 0}d Pen
                  </p>
                </div>
              </div>

              {calcBreakdown.formulaBreakdown?.payableDaysFormula && (
                <p className="text-xs font-mono text-muted-foreground bg-muted/30 p-2 rounded-md mt-2">
                  Formula: {calcBreakdown.formulaBreakdown.payableDaysFormula}
                </p>
              )}
            </div>

            {/* 3. Normalized Component Lines with Audit Notes */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Detailed Component Breakdown
              </h3>

              <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-card">
                {payslip.lines && payslip.lines.length > 0 ? (
                  payslip.lines.map((line: any) => {
                    const isEarning = line.type === "EARNING" || line.type === "REIMBURSEMENT";
                    const isDeduction = line.type === "DEDUCTION";
                    return (
                      <div key={line.id || line.code} className="p-3 text-xs flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground flex items-center gap-1.5">
                            <span
                              className={`size-1.5 rounded-full ${
                                isEarning ? "bg-emerald-500" : isDeduction ? "bg-red-500" : "bg-blue-500"
                              }`}
                            />
                            {line.name}
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              isEarning ? "text-emerald-600" : isDeduction ? "text-red-600" : "text-blue-600"
                            }`}
                          >
                            {isDeduction ? "-" : isEarning ? "+" : ""}
                            {formatInr(line.earnedAmount)}
                          </span>
                        </div>
                        {line.calculationNote && (
                          <p className="text-xs text-muted-foreground pl-3 font-mono">
                            ↳ {line.calculationNote}
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="p-4 text-xs text-muted-foreground text-center">No lines generated.</p>
                )}
              </div>
            </div>

            {/* 4. Statutory & Masked PII Snapshot */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Statutory & Bank Snapshot
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                  <span className="text-muted-foreground text-xs">PAN:</span>
                  <p className="font-mono font-bold mt-0.5">{payslip.panNumberMasked || "Not Linked"}</p>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                  <span className="text-muted-foreground text-xs">Bank A/C:</span>
                  <p className="font-mono font-bold mt-0.5">{payslip.bankAccountMasked || "Not Linked"}</p>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Hold Salary Confirmation Modal */}
      <Dialog open={isHoldModalOpen} onOpenChange={setIsHoldModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isHeld ? "Release Salary" : "Place Salary On Hold"}</DialogTitle>
            <DialogDescription>
              {isHeld
                ? `Are you sure you want to release the salary hold for ${employeeName}? This employee will be included in the disbursement batch.`
                : `Placing this salary on hold excludes ${employeeName} from the bank disbursement batch. A mandatory reason is required for audit compliance.`}
            </DialogDescription>
          </DialogHeader>

          {!isHeld && (
            <div className="space-y-2 py-2">
              <Label className="text-xs font-semibold">Mandatory Hold Reason *</Label>
              <Textarea aria-label="Mandatory Hold Reason"
                placeholder="e.g. Attendance regularisation pending, resignation clearance in progress..."
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                className="text-xs min-h-[80px]"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsHoldModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={isHeld ? "default" : "destructive"}
              size="sm"
              onClick={handleToggleHold}
              disabled={isUpdatingHold || (!isHeld && !holdReason.trim())}
            >
              {isUpdatingHold ? "Updating..." : isHeld ? "Confirm Release" : "Confirm Hold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Adjustment Modal */}
      <Dialog open={isAdjModalOpen} onOpenChange={setIsAdjModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Add Adjustment</DialogTitle>
            <DialogDescription>
              Add a one-time bonus, reimbursement, or deduction for {employeeName}. The payslip will be recalculated immediately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAdjustment} className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Adjustment Type</Label>
              <Select value={adjType} onValueChange={setAdjType}>
                <SelectTrigger aria-label="Adjustment Type" className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BONUS">Performance Bonus / Incentive (+)</SelectItem>
                  <SelectItem value="REIMBURSEMENT">Expense Claim Reimbursement (+)</SelectItem>
                  <SelectItem value="ARREARS">Salary Arrears (+)</SelectItem>
                  <SelectItem value="ONE_TIME_EARNING">One-Time Addition (+)</SelectItem>
                  <SelectItem value="DEDUCTION">Other Deduction (-)</SelectItem>
                  <SelectItem value="RECOVERY">Asset / Advance Recovery (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Title / Reason *</Label>
              <Input aria-label="Title / Reason"
                placeholder="e.g. Spot award for client launch"
                value={adjTitle}
                onChange={(e) => setAdjTitle(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Amount (₹ Rupees) *</Label>
              <Input aria-label="Amount (₹ Rupees)"
                type="number"
                step="any"
                min="1"
                placeholder="e.g. 5000"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Optional Notes</Label>
              <Input aria-label="Optional Notes"
                placeholder="Additional audit context"
                value={adjNotes}
                onChange={(e) => setAdjNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAdjModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSavingAdj}>
                {isSavingAdj ? "Saving..." : "Apply & Recalculate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
