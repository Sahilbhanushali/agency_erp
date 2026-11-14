"use client";

import React, { useRef } from "react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  Printer,
  X,
  Building,
  CheckCircle2,
  Calendar,
  CreditCard,
  User,
  ShieldCheck,
  Mail,
  Pencil,
  Plus,
  Save,
  Trash2,
  Loader2,
} from "lucide-react";
import { EmployeePayrollCalculation } from "@/lib/payroll/types";

interface PayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after an edit, email or delete so the list behind the modal refreshes. */
  onChanged?: () => void;
  /** Whether the viewer may edit/email/delete. Falsy hides those actions. */
  canManage?: boolean;
  payslip: {
    id: string;
    month: number;
    year: number;
    workingDays: number;
    payableDays: number;
    absentDays: number;
    grossSalary: number; // minor units
    netSalary: number; // minor units
    totalDeductions: number; // minor units
    employerCost: number; // minor units
    paymentStatus: string;
    calculationBreakdown?: EmployeePayrollCalculation | null;
    breakdownJson?: string;
    user: {
      id: number;
      name: string;
      email: string;
      designation?: string | null;
      department?: string | null;
      panNumber?: string | null;
      bankName?: string | null;
      bankAccountNumber?: string | null;
      bankIfsc?: string | null;
      joiningDate?: string | Date | null;
    };
  } | null;
  agencyName?: string;
}

/** A payslip line as the editor holds it. Amounts stay in paise throughout. */
interface EditableLine {
  code: string;
  name: string;
  type: "EARNING" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION" | "REIMBURSEMENT";
  earnedAmount: number;
  order?: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatInr(minorUnits: number): string {
  const rupees = minorUnits / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(rupees);
}

function numberToWords(amount: number): string {
  // Simple INR words formatter
  const rupees = Math.floor(amount / 100);
  if (rupees === 0) return "Zero Rupees";
  return `Rupees ${rupees.toLocaleString("en-IN")} Only`;
}

export default function PayslipModal({
  isOpen,
  onClose,
  payslip,
  onChanged,
  canManage = false,
  agencyName = "Marketing Agency",
}: PayslipModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  /** Lines come from the stored breakdown; this is what the editor works on. */
  const storedLines: EditableLine[] = React.useMemo(() => {
    if (!payslip) return [];
    const source =
      (payslip as any).lines ??
      (payslip.calculationBreakdown as any)?.lines ??
      [];
    return (Array.isArray(source) ? source : []).map((l: any, i: number) => ({
      code: l.code ?? `LINE_${i + 1}`,
      name: l.name ?? l.code ?? `Line ${i + 1}`,
      type: (l.type ?? "EARNING") as EditableLine["type"],
      earnedAmount: Number(l.earnedAmount ?? l.amount ?? 0),
      order: Number(l.order ?? i),
    }));
  }, [payslip]);

  const [editing, setEditing] = React.useState(false);
  const [lines, setLines] = React.useState<EditableLine[]>([]);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState<null | "save" | "send" | "delete">(null);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [emailTo, setEmailTo] = React.useState("");
  const [emailNote, setEmailNote] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  /**
   * Which template to render with. Empty means "whatever the payroll run or the
   * default says", which is the normal case — this is an override for one document.
   */
  const [templateId, setTemplateId] = React.useState("");
  const [templates, setTemplates] = React.useState<{ id: string; name: string; isDefault: boolean }[]>([]);

  React.useEffect(() => {
    if (!isOpen || !canManage) return;
    fetch("/api/payroll/payslip-templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]));
  }, [isOpen, canManage]);

  React.useEffect(() => {
    if (isOpen && payslip) {
      setLines(storedLines);
      setEmailTo(payslip.user.email ?? "");
      setEditing(false);
      setReason("");
    }
  }, [isOpen, payslip, storedLines]);

  const totals = React.useMemo(() => {
    const sum = (type: string) =>
      lines.filter((l) => l.type === type).reduce((t, l) => t + (Number(l.earnedAmount) || 0), 0);
    const earnings = sum("EARNING") + sum("REIMBURSEMENT");
    const deductions = sum("DEDUCTION");
    return { earnings, deductions, net: earnings - deductions };
  }, [lines]);

  const save = async () => {
    if (!payslip) return;
    setBusy("save");
    try {
      const res = await fetch(`/api/payroll/payslips/${payslip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE", lines, reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save the payslip");
      toast.success(`Payslip updated — net pay ${formatInr(data.payslip.netSalary)}`);
      setEditing(false);
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!payslip) return;
    setBusy("send");
    try {
      const res = await fetch(`/api/payroll/payslips/${payslip.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim() || undefined,
          message: emailNote.trim() || undefined,
          templateId: templateId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not send the payslip");
      toast.success(`Payslip emailed to ${data.to}`);
      setEmailOpen(false);
      setEmailNote("");
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!payslip) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/payroll/payslips/${payslip.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not delete the payslip");
      toast.success("Payslip deleted");
      setConfirmDelete(false);
      onChanged?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };


  if (!isOpen || !payslip) return null;

  let calc: EmployeePayrollCalculation | null = payslip.calculationBreakdown || null;
  if (!calc && payslip.breakdownJson) {
    try {
      calc = JSON.parse(payslip.breakdownJson);
    } catch {}
  }

  const monthLabel = `${MONTH_NAMES[payslip.month - 1]} ${payslip.year}`;

  const earnings = calc?.formulaBreakdown?.components.filter((c) => !c.isDeduction) || [
    { component: "Basic Salary", rate: calc?.fixedBasic || 0, earned: calc?.earnedBasic || 0 },
    { component: "HRA", rate: calc?.fixedHra || 0, earned: calc?.earnedHra || 0 },
    { component: "Special Allowance", rate: calc?.fixedSpecialAllowance || 0, earned: calc?.earnedSpecialAllowance || 0 },
  ];

  const deductions = calc?.formulaBreakdown?.components.filter((c) => c.isDeduction) || [
    { component: "Provident Fund", rate: calc?.pfEmployee || 0, earned: calc?.pfEmployee || 0 },
    { component: "Professional Tax", rate: calc?.professionalTax || 0, earned: calc?.professionalTax || 0 },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-[95vw] sm:max-w-4xl max-h-[92vh] p-0 flex flex-col gap-0 rounded-2xl overflow-hidden border border-border bg-background shadow-2xl"
      >
        {/* Modal Toolbar Header */}
        <div className="shrink-0 bg-card border-b border-border/80 px-6 py-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Building className="size-4 text-primary" />
            <span className="text-xs font-bold text-foreground">
              Salary Payslip — {monthLabel}
            </span>
            <Badge
              variant={payslip.paymentStatus === "PAID" ? "success" : "warning"}
              className="text-xs py-0 font-mono"
            >
              {payslip.paymentStatus}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/payroll/payslips/${payslip.id}/pdf${templateId ? `?templateId=${templateId}` : ""}`}
              download
            >
              <Button variant="outline" size="xs" className="gap-1.5 text-xs">
                <Download className="size-3.5" />
                <span>Download PDF</span>
              </Button>
            </a>
            <Button variant="outline" size="xs" onClick={handlePrint} className="gap-1.5 text-xs">
              <Printer className="size-3.5" />
              <span>Print</span>
            </Button>

            {canManage && templates.length > 0 && (
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                aria-label="Payslip template to render with"
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                title="Which template the download and email use"
              >
                <option value="">Template: run default</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            )}

            {canManage && (
              <>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setEmailOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Mail className="size-3.5" />
                  <span>Email</span>
                </Button>
                <Button
                  variant={editing ? "secondary" : "outline"}
                  size="xs"
                  onClick={() => setEditing((v) => !v)}
                  className="gap-1.5 text-xs"
                >
                  <Pencil className="size-3.5" />
                  <span>{editing ? "Stop editing" : "Edit"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setConfirmDelete(true)}
                  className="gap-1.5 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  <span className="sr-only sm:not-sr-only">Delete</span>
                </Button>
              </>
            )}
            <Button aria-label="Close payslip"
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="rounded-full size-7"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Line editor — deliberately outside the printable area. */}
        {editing && canManage && (
          <div className="shrink-0 max-h-[45vh] overflow-y-auto border-b border-border bg-muted/20 px-6 py-4 print:hidden">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold">Edit payslip lines</h3>
                <p className="text-xs text-muted-foreground">
                  Amounts are in rupees. Totals and net pay are recalculated from these
                  lines when you save.
                </p>
              </div>
              <Button
                variant="outline"
                size="xs"
                className="gap-1.5 text-xs"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    { code: "", name: "", type: "EARNING", earnedAmount: 0, order: prev.length },
                  ])
                }
              >
                <Plus className="size-3.5" />
                Add line
              </Button>
            </div>

            {lines.length === 0 ? (
              <p className="rounded-lg border border-border/60 bg-background px-3 py-6 text-center text-xs text-muted-foreground">
                This payslip has no lines. Add one to build the breakdown.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {lines.map((line, index) => (
                  <li
                    key={index}
                    className="grid grid-cols-1 gap-1.5 rounded-lg border border-border/60 bg-background p-2 sm:grid-cols-[1fr_1.4fr_auto_auto_auto] sm:items-center"
                  >
                    <Input
                      value={line.code}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, i) => (i === index ? { ...l, code: e.target.value } : l)),
                        )
                      }
                      placeholder="CODE"
                      aria-label={`Code for line ${index + 1}`}
                      className="h-8 font-mono text-xs uppercase"
                    />
                    <Input
                      value={line.name}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, i) => (i === index ? { ...l, name: e.target.value } : l)),
                        )
                      }
                      placeholder="Description"
                      aria-label={`Name for line ${index + 1}`}
                      className="h-8 text-xs"
                    />
                    <select
                      value={line.type}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === index ? { ...l, type: e.target.value as EditableLine["type"] } : l,
                          ),
                        )
                      }
                      aria-label={`Type for line ${index + 1}`}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="EARNING">Earning</option>
                      <option value="DEDUCTION">Deduction</option>
                      <option value="REIMBURSEMENT">Reimbursement</option>
                      <option value="EMPLOYER_CONTRIBUTION">Employer cost</option>
                    </select>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.earnedAmount / 100}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === index
                              ? { ...l, earnedAmount: Math.round(Number(e.target.value) * 100) || 0 }
                              : l,
                          ),
                        )
                      }
                      aria-label={`Amount for line ${index + 1}`}
                      className="h-8 w-28 text-right text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Remove line ${index + 1}`}
                      className="size-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-border/60 pt-3">
              <div className="space-y-1">
                <Label htmlFor="payslip-reason" className="text-xs font-medium">
                  Reason for the change (recorded in the audit log)
                </Label>
                <Input
                  id="payslip-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. missed travel reimbursement"
                  className="h-8 w-72 text-xs"
                />
              </div>
              <div className="flex items-center gap-4">
                <dl className="text-right text-xs">
                  <div className="flex gap-3">
                    <dt className="text-muted-foreground">Earnings</dt>
                    <dd className="font-mono">{formatInr(totals.earnings)}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="text-muted-foreground">Deductions</dt>
                    <dd className="font-mono">{formatInr(totals.deductions)}</dd>
                  </div>
                  <div className="flex gap-3 font-semibold">
                    <dt>Net pay</dt>
                    <dd className="font-mono">{formatInr(totals.net)}</dd>
                  </div>
                </dl>
                <Button size="sm" disabled={busy === "save"} onClick={save} className="gap-1.5">
                  {busy === "save" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save payslip
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Printable Payslip Body */}
        <div ref={printRef} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 bg-card text-foreground print:p-0 print:overflow-visible">
          {/* Branded Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-900 pb-5 gap-3">
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-foreground">
                {agencyName}
              </h1>
              <p className="text-xs text-muted-foreground font-medium">
                Official Employee Pay Advice & Salary Certificate
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ref ID: PAY-{payslip.id.slice(-8).toUpperCase()}
              </p>
            </div>
            <div className="sm:text-right">
              <div className="inline-block bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded">
                PAYSLIP FOR {monthLabel.toUpperCase()}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                Currency: INR (₹)
              </p>
            </div>
          </div>

          {/* Employee & Bank Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 p-4 rounded-xl border border-border bg-muted/50 text-xs">
            <div>
              <span className="text-muted-foreground block text-xs uppercase font-semibold">Employee Name</span>
              <span className="font-bold text-foreground">{payslip.user.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs uppercase font-semibold">Designation</span>
              <span className="font-medium text-foreground">{payslip.user.designation || "Team Member"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs uppercase font-semibold">Department</span>
              <span className="font-medium text-foreground">{payslip.user.department || "Operations"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs uppercase font-semibold">PAN Number</span>
              <span className="font-mono font-medium text-foreground">{payslip.user.panNumber || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs uppercase font-semibold">Bank Name</span>
              <span className="font-medium text-foreground">{payslip.user.bankName || "Not provided"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs uppercase font-semibold">Account Number</span>
              <span className="font-mono font-medium text-foreground">{payslip.user.bankAccountNumber || "Not provided"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs uppercase font-semibold">IFSC Code</span>
              <span className="font-mono font-medium text-foreground">{payslip.user.bankIfsc || "Not provided"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs uppercase font-semibold">Payable Days</span>
              <span className="font-bold text-emerald-700">
                {payslip.payableDays} / {calc?.divisorDays || 30} Days
              </span>
            </div>
          </div>

          {/* Earnings & Deductions Tables Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Earnings Table */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted px-4 py-2 font-bold text-xs text-foreground border-b border-border flex justify-between">
                <span>EARNINGS</span>
                <span>EARNED AMOUNT</span>
              </div>
              <div className="divide-y divide-border text-xs">
                {earnings.map((e, idx) => (
                  <div key={idx} className="flex justify-between px-4 py-2 hover:bg-slate-50">
                    <span className="text-foreground">{e.component}</span>
                    <span className="font-mono font-medium text-foreground">{formatInr(e.earned)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-muted/50 border-t border-border px-4 py-2.5 flex justify-between text-xs font-bold">
                <span>TOTAL GROSS EARNINGS</span>
                <span className="font-mono text-emerald-700">{formatInr(payslip.grossSalary)}</span>
              </div>
            </div>

            {/* Deductions Table */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted px-4 py-2 font-bold text-xs text-foreground border-b border-border flex justify-between">
                <span>DEDUCTIONS</span>
                <span>AMOUNT</span>
              </div>
              <div className="divide-y divide-border text-xs">
                {deductions.map((d, idx) => (
                  <div key={idx} className="flex justify-between px-4 py-2 hover:bg-slate-50">
                    <span className="text-foreground">{d.component}</span>
                    <span className="font-mono font-medium text-red-600">
                      {formatInr(d.earned || d.rate)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-muted/50 border-t border-border px-4 py-2.5 flex justify-between text-xs font-bold">
                <span>TOTAL DEDUCTIONS</span>
                <span className="font-mono text-red-600">{formatInr(payslip.totalDeductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Salary Highlight Box */}
          <div className="border-2 border-slate-900 rounded-xl p-5 bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Net Take-Home Salary
              </span>
              <span className="text-sm text-slate-300 font-medium">
                {numberToWords(payslip.netSalary)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                {formatInr(payslip.netSalary)}
              </span>
            </div>
          </div>

          {/* Formula Transparency Callout */}
          {calc?.formulaBreakdown && (
            <div className="p-3.5 rounded-lg border border-border bg-muted/50 text-xs text-muted-foreground space-y-1">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                Transparent Computation Derivation:
              </p>
              <p className="font-mono">{calc.formulaBreakdown.payableDaysFormula}</p>
              <p className="font-mono">{calc.formulaBreakdown.earnedGrossFormula}</p>
            </div>
          )}

          {/* Signatures Footer */}
          <div className="pt-8 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <div>
              <p className="font-bold text-foreground">HR & Accounts Department</p>
              <p className="text-xs">Digitally authenticated system payslip</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-foreground">Authorized Signatory</p>
              <p className="text-xs">{agencyName}</p>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Email the payslip */}
      <Dialog open={emailOpen} onOpenChange={(open) => !open && setEmailOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Email this payslip</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="payslip-to" className="text-xs font-medium">
                Send to
              </Label>
              <Input
                id="payslip-to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="employee@example.com"
                className="h-9 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Defaults to the employee&apos;s address on file. The PDF is attached.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payslip-note" className="text-xs font-medium">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="payslip-note"
                value={emailNote}
                onChange={(e) => setEmailNote(e.target.value)}
                rows={3}
                placeholder="Anything the employee should know about this payslip"
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy === "send" || !emailTo.trim()} onClick={send} className="gap-1.5">
              {busy === "send" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Send payslip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation — names the employee and the period being destroyed. */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {payslip.user.name}&apos;s payslip for {monthLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The payslip and its full breakdown are removed. This cannot be undone, and a
              payslip already marked paid will be refused.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "delete"}
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy === "delete" && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete payslip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
