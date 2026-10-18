"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { toast } from "react-hot-toast";
import {
  Settings,
  Edit,
  RotateCcw,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Percent,
  Layers,
  ArrowRight,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export function CalculationRulesTab() {
  const { data, isLoading, mutate } = useSWR("/api/payroll/rules", fetcher);

  const settings = data?.settings;
  const statutory = data?.statutory;

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<any>({
    payPeriodType: "CALENDAR_DAYS",
    roundingRule: "ROUND_HALF_UP",
    lopRule: "PRORATE_GROSS",
    standardWorkHours: 8.0,
    enableOvertime: true,
    overtimeHourlyRateMultiplier: 1.5,
    lateMarkGraceMinutes: 15,
    lateMarksForHalfDayPenalty: 3,
    pfEmployeeRate: 12.0,
    pfEmployerEpfRate: 3.67,
    pfEmployerEpsRate: 8.33,
    pfWageCeilingRupees: 15000,
    esiEmployeeRate: 0.75,
    esiEmployerRate: 3.25,
    esiWageCeilingRupees: 21000,
  });

  // Simulator State
  const [simGross, setSimGross] = useState<number>(60000);
  const [simBasic, setSimBasic] = useState<number>(30000);
  const [simPf, setSimPf] = useState<boolean>(true);
  const [simEsi, setSimEsi] = useState<boolean>(false);
  const [simPt, setSimPt] = useState<boolean>(true);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleOpenEdit = () => {
    if (!settings) return;
    setFormData({
      payPeriodType: settings.payPeriodType || "CALENDAR_DAYS",
      roundingRule: settings.roundingRule || "ROUND_HALF_UP",
      lopRule: settings.lopRule || "PRORATE_GROSS",
      standardWorkHours: settings.standardWorkHours ?? 8.0,
      enableOvertime: settings.enableOvertime ?? true,
      overtimeHourlyRateMultiplier: settings.overtimeHourlyRateMultiplier ?? 1.5,
      lateMarkGraceMinutes: settings.lateMarkGraceMinutes ?? 15,
      lateMarksForHalfDayPenalty: settings.lateMarksForHalfDayPenalty ?? 3,
      pfEmployeeRate: statutory?.pfEmployeeRate ?? settings.pfEmployeeRate ?? 12.0,
      pfEmployerEpfRate: statutory?.pfEmployerEpfRate ?? 3.67,
      pfEmployerEpsRate: statutory?.pfEmployerEpsRate ?? 8.33,
      pfWageCeilingRupees: Math.round((statutory?.pfWageCeiling ?? settings.pfWageCeiling ?? 1500000) / 100),
      esiEmployeeRate: statutory?.esiEmployeeRate ?? settings.esiEmployeeRate ?? 0.75,
      esiEmployerRate: statutory?.esiEmployerRate ?? settings.esiEmployerRate ?? 3.25,
      esiWageCeilingRupees: Math.round((statutory?.esiWageCeiling ?? settings.esiWageCeiling ?? 2100000) / 100),
    });
    setIsEditModalOpen(true);
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const res = await fetch("/api/payroll/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            payPeriodType: formData.payPeriodType,
            roundingRule: formData.roundingRule,
            lopRule: formData.lopRule,
            standardWorkHours: Number(formData.standardWorkHours),
            enableOvertime: Boolean(formData.enableOvertime),
            overtimeHourlyRateMultiplier: Number(formData.overtimeHourlyRateMultiplier),
            lateMarkGraceMinutes: Number(formData.lateMarkGraceMinutes),
            lateMarksForHalfDayPenalty: Number(formData.lateMarksForHalfDayPenalty),
            pfEmployeeRate: Number(formData.pfEmployeeRate),
            pfEmployerRate: Number(formData.pfEmployerEpfRate) + Number(formData.pfEmployerEpsRate),
            pfWageCeiling: Math.round(Number(formData.pfWageCeilingRupees) * 100),
            esiEmployeeRate: Number(formData.esiEmployeeRate),
            esiEmployerRate: Number(formData.esiEmployerRate),
            esiWageCeiling: Math.round(Number(formData.esiWageCeilingRupees) * 100),
          },
          statutory: {
            pfEmployeeRate: Number(formData.pfEmployeeRate),
            pfEmployerEpfRate: Number(formData.pfEmployerEpfRate),
            pfEmployerEpsRate: Number(formData.pfEmployerEpsRate),
            pfWageCeiling: Math.round(Number(formData.pfWageCeilingRupees) * 100),
            esiEmployeeRate: Number(formData.esiEmployeeRate),
            esiEmployerRate: Number(formData.esiEmployerRate),
            esiWageCeiling: Math.round(Number(formData.esiWageCeilingRupees) * 100),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update rules");

      toast.success("Payroll calculation rules updated successfully");
      setIsEditModalOpen(false);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to update rules");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    try {
      const res = await fetch("/api/payroll/rules?action=reset", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset rules");

      toast.success("Calculation rules reset to statutory defaults");
      setIsResetModalOpen(false);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset rules");
    }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSimulating(true);
      const res = await fetch("/api/payroll/rules?action=simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gross: simGross,
          basic: simBasic,
          pf: simPf,
          esi: simEsi,
          pt: simPt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulation failed");
      setSimResult(data);
    } catch (err: any) {
      toast.error(err.message || "Simulation error");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-3.5 rounded-xl border border-border shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Settings className="size-4 text-primary" /> Payroll & Statutory Calculation Rules Engine
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure calendar divisors, overtime multipliers, attendance penalty thresholds, and statutory EPF/ESI/PT rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsResetModalOpen(true)}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset to Statutory Defaults</span>
          </Button>

          <Button size="sm" onClick={handleOpenEdit} className="gap-1.5 text-xs font-semibold">
            <Edit className="size-3.5" />
            <span>Edit Calculation Rules</span>
          </Button>
        </div>
      </div>

      {/* Grid of Active Calculation Rules */}
      {settings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: Core Agency Calculation Rules */}
          <Card className="border border-border shadow-xs bg-card">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="size-4 text-primary" /> Core Agency Calculation Rules
              </CardTitle>
              <CardDescription className="text-xs">
                Time, attendance, rounding, and loss-of-pay computation formulas.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Pay Period Divisor
                  </span>
                  <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                    {settings.payPeriodType}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Days per month calculation base</span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Rounding Rule
                  </span>
                  <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                    {settings.roundingRule || "ROUND_HALF_UP"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Disbursement paise rounding policy</span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Overtime Multiplier
                  </span>
                  <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                    {settings.overtimeHourlyRateMultiplier}x Hourly Rate
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Based on {settings.standardWorkHours}h standard workday
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Late Mark Policy
                  </span>
                  <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                    {settings.lateMarksForHalfDayPenalty} Marks = 0.5 Day LOP
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {settings.lateMarkGraceMinutes} min grace punch threshold
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Statutory Contribution & Tax Rules */}
          <Card className="border border-border shadow-xs bg-card">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" /> Statutory EPF, ESI & PT Rules
              </CardTitle>
              <CardDescription className="text-xs">
                Government statutory withholding and employer contribution rates.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Provident Fund (EPF)
                  </span>
                  <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                    {statutory?.pfEmployeeRate ?? settings.pfEmployeeRate}% (Employee)
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Ceiling: {formatInr(statutory?.pfWageCeiling ?? settings.pfWageCeiling ?? 1500000)}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    EPF Employer Share
                  </span>
                  <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                    {statutory?.pfEmployerEpfRate ?? 3.67}% EPF + {statutory?.pfEmployerEpsRate ?? 8.33}% EPS
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Total Employer: 12.0% + Admin charges
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    ESI Insurance
                  </span>
                  <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                    {statutory?.esiEmployeeRate ?? settings.esiEmployeeRate}% (EE) / {statutory?.esiEmployerRate ?? settings.esiEmployerRate}% (ER)
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Wage Ceiling: {formatInr(statutory?.esiWageCeiling ?? settings.esiWageCeiling ?? 2100000)}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Professional Tax (PT)
                  </span>
                  <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                    Active State Slabs
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Standard ₹200/mo above monthly slab threshold
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Interactive Calculation Simulator Sandbox */}
      <Card className="border border-primary/30 shadow-xs bg-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Calculator className="size-4 text-primary" /> Live Calculation Simulator & Sandbox
          </CardTitle>
          <CardDescription className="text-xs">
            Test and verify how the configured calculation rules impact an employee's gross-to-net deductions in real time.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <form onSubmit={handleRunSimulation} className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
            <div className="lg:col-span-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Test Monthly Gross (₹)</Label>
                  <Input
                    type="number"
                    min="1000"
                    step="500"
                    value={simGross}
                    onChange={(e) => {
                      const g = Number(e.target.value);
                      setSimGross(g);
                      setSimBasic(Math.round(g * 0.5));
                    }}
                    className="h-8 text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Test Basic Salary (₹)</Label>
                  <Input
                    type="number"
                    min="500"
                    step="500"
                    value={simBasic}
                    onChange={(e) => setSimBasic(Number(e.target.value))}
                    className="h-8 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 p-2.5 rounded-lg border border-border bg-muted/20">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={simPf}
                    onChange={(e) => setSimPf(e.target.checked)}
                    className="rounded border-border text-primary size-4"
                  />
                  <span>EPF Deduction</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={simEsi}
                    onChange={(e) => setSimEsi(e.target.checked)}
                    className="rounded border-border text-primary size-4"
                  />
                  <span>ESI Deduction</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={simPt}
                    onChange={(e) => setSimPt(e.target.checked)}
                    className="rounded border-border text-primary size-4"
                  />
                  <span>Professional Tax</span>
                </label>
              </div>

              <Button type="submit" size="sm" disabled={isSimulating} className="gap-1.5 text-xs font-semibold">
                <Sparkles className="size-3.5" />
                <span>{isSimulating ? "Simulating..." : "Calculate Rule Impact"}</span>
              </Button>
            </div>

            {/* Simulation Output Card */}
            <div className="lg:col-span-6">
              {simResult ? (
                <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                      Simulation Breakdown
                    </span>
                    <span className="text-xs font-mono font-bold text-foreground">
                      Gross: {formatInr(simResult.grossPaise)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-card border border-border">
                      <span className="text-[10px] text-muted-foreground block">Employee PF</span>
                      <span className="font-mono font-bold text-red-600">
                        {simResult.pfEmployeePaise > 0 ? `- ${formatInr(simResult.pfEmployeePaise)}` : "₹0"}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-card border border-border">
                      <span className="text-[10px] text-muted-foreground block">Employee ESI</span>
                      <span className="font-mono font-bold text-red-600">
                        {simResult.esiEmployeePaise > 0 ? `- ${formatInr(simResult.esiEmployeePaise)}` : "₹0"}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-card border border-border">
                      <span className="text-[10px] text-muted-foreground block">Professional Tax</span>
                      <span className="font-mono font-bold text-red-600">
                        {simResult.ptPaise > 0 ? `- ${formatInr(simResult.ptPaise)}` : "₹0"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                        Net Monthly Take-Home Pay
                      </span>
                      <span className="text-[10px] text-muted-foreground">Total Deductions: {formatInr(simResult.totalDeductionsPaise)}</span>
                    </div>
                    <span className="text-lg lg:text-xl font-bold font-mono text-emerald-600">
                      {formatInr(simResult.netPayPaise)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-xl p-6 text-center text-xs text-muted-foreground h-full flex flex-col items-center justify-center bg-muted/10">
                  <Calculator className="size-6 text-muted-foreground/40 mb-1.5" />
                  <p className="font-medium text-foreground">Run a Test Calculation</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Click "Calculate Rule Impact" to see how the configured rates apply.
                  </p>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ================= MODAL: EDIT CALCULATION RULES ================= */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <form onSubmit={handleSaveRules}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Edit className="size-4 text-primary" />
                <span>Edit Payroll Calculation Rules</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update formulas, attendance penalties, overtime rates, and statutory ceilings.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              {/* Section 1: Divisor & Rounding */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
                <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground block">
                  1. Calendar & Attendance Divisors
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Pay Period Divisor</Label>
                    <Select
                      value={formData.payPeriodType}
                      onValueChange={(val) => setFormData({ ...formData, payPeriodType: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CALENDAR_DAYS">Actual Calendar Days (28-31)</SelectItem>
                        <SelectItem value="FIXED_30">Fixed 30 Days Month</SelectItem>
                        <SelectItem value="FIXED_26">Fixed 26 Working Days</SelectItem>
                        <SelectItem value="WORKING_DAYS">Exact Working Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Rounding Policy</Label>
                    <Select
                      value={formData.roundingRule}
                      onValueChange={(val) => setFormData({ ...formData, roundingRule: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ROUND_HALF_UP">Round Half Up (Nearest Rupee)</SelectItem>
                        <SelectItem value="ROUND_NEAREST_RUPEE">Round Nearest Rupee</SelectItem>
                        <SelectItem value="ROUND_UP">Round Up Ceiling</SelectItem>
                        <SelectItem value="ROUND_DOWN">Round Down Floor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Standard Work Hours</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="4"
                      max="12"
                      value={formData.standardWorkHours}
                      onChange={(e) => setFormData({ ...formData, standardWorkHours: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Overtime Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="1.0"
                      max="3.0"
                      value={formData.overtimeHourlyRateMultiplier}
                      onChange={(e) => setFormData({ ...formData, overtimeHourlyRateMultiplier: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Late Mark Grace (Min)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="60"
                      value={formData.lateMarkGraceMinutes}
                      onChange={(e) => setFormData({ ...formData, lateMarkGraceMinutes: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Statutory Contribution Rates & Ceilings */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
                <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground block">
                  2. Statutory Rates & Ceilings
                </span>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">PF Employee Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.pfEmployeeRate}
                      onChange={(e) => setFormData({ ...formData, pfEmployeeRate: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Employer EPF Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.pfEmployerEpfRate}
                      onChange={(e) => setFormData({ ...formData, pfEmployerEpfRate: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">PF Wage Ceiling (₹)</Label>
                    <Input
                      type="number"
                      step="1000"
                      value={formData.pfWageCeilingRupees}
                      onChange={(e) => setFormData({ ...formData, pfWageCeilingRupees: e.target.value })}
                      className="h-8 text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">ESI Employee Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.esiEmployeeRate}
                      onChange={(e) => setFormData({ ...formData, esiEmployeeRate: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">ESI Employer Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.esiEmployerRate}
                      onChange={(e) => setFormData({ ...formData, esiEmployerRate: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">ESI Wage Ceiling (₹)</Label>
                    <Input
                      type="number"
                      step="1000"
                      value={formData.esiWageCeilingRupees}
                      onChange={(e) => setFormData({ ...formData, esiWageCeilingRupees: e.target.value })}
                      className="h-8 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving} className="font-semibold">
                {isSaving ? "Saving..." : "Save Calculation Rules"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: RESET CONFIRMATION ================= */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="size-5" />
              <span>Reset Calculation Rules to Statutory Defaults</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to reset calculation rules? All agency formulas will revert to official statutory standards (PF 12%, ESI 0.75%/3.25%, ₹15k/₹21k ceilings, 8h workday, calendar days divisor).
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsResetModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={handleResetToDefaults} className="font-semibold">
              Confirm Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
