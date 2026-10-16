"use client";

import React, { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { EmployeePayrollCalculation } from "@/lib/payroll/types";

interface PayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  agencyName = "Marketing Agency",
}: PayslipModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

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
        className="max-w-4xl max-h-[92vh] p-0 flex flex-col gap-0 rounded-2xl overflow-hidden border border-border bg-background shadow-2xl"
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
              className="text-[10px] py-0 font-mono"
            >
              {payslip.paymentStatus}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/api/payroll/payslips/${payslip.id}/pdf`} download>
              <Button variant="outline" size="xs" className="gap-1.5 text-xs">
                <Download className="size-3.5" />
                <span>Download PDF</span>
              </Button>
            </a>
            <Button variant="outline" size="xs" onClick={handlePrint} className="gap-1.5 text-xs">
              <Printer className="size-3.5" />
              <span>Print</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="rounded-full size-7"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable Printable Payslip Body */}
        <div ref={printRef} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 bg-white text-slate-900 print:p-0 print:overflow-visible">
          {/* Branded Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-900 pb-5 gap-3">
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                {agencyName}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Official Employee Pay Advice & Salary Certificate
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Ref ID: PAY-{payslip.id.slice(-8).toUpperCase()}
              </p>
            </div>
            <div className="sm:text-right">
              <div className="inline-block bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded">
                PAYSLIP FOR {monthLabel.toUpperCase()}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                Currency: INR (₹)
              </p>
            </div>
          </div>

          {/* Employee & Bank Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Employee Name</span>
              <span className="font-bold text-slate-900">{payslip.user.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Designation</span>
              <span className="font-medium text-slate-800">{payslip.user.designation || "Team Member"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Department</span>
              <span className="font-medium text-slate-800">{payslip.user.department || "Operations"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">PAN Number</span>
              <span className="font-mono font-medium text-slate-800">{payslip.user.panNumber || "N/A"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Bank Name</span>
              <span className="font-medium text-slate-800">{payslip.user.bankName || "HDFC Bank"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Account Number</span>
              <span className="font-mono font-medium text-slate-800">{payslip.user.bankAccountNumber || "N/A"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">IFSC Code</span>
              <span className="font-mono font-medium text-slate-800">{payslip.user.bankIfsc || "N/A"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Payable Days</span>
              <span className="font-bold text-emerald-700">
                {payslip.payableDays} / {calc?.divisorDays || 30} Days
              </span>
            </div>
          </div>

          {/* Earnings & Deductions Tables Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Earnings Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 font-bold text-xs text-slate-800 border-b border-slate-200 flex justify-between">
                <span>EARNINGS</span>
                <span>EARNED AMOUNT</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {earnings.map((e, idx) => (
                  <div key={idx} className="flex justify-between px-4 py-2 hover:bg-slate-50">
                    <span className="text-slate-700">{e.component}</span>
                    <span className="font-mono font-medium text-slate-900">{formatInr(e.earned)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex justify-between text-xs font-bold">
                <span>TOTAL GROSS EARNINGS</span>
                <span className="font-mono text-emerald-700">{formatInr(payslip.grossSalary)}</span>
              </div>
            </div>

            {/* Deductions Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 font-bold text-xs text-slate-800 border-b border-slate-200 flex justify-between">
                <span>DEDUCTIONS</span>
                <span>AMOUNT</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {deductions.map((d, idx) => (
                  <div key={idx} className="flex justify-between px-4 py-2 hover:bg-slate-50">
                    <span className="text-slate-700">{d.component}</span>
                    <span className="font-mono font-medium text-red-600">
                      {formatInr(d.earned || d.rate)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex justify-between text-xs font-bold">
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
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                Transparent Computation Derivation:
              </p>
              <p className="font-mono">{calc.formulaBreakdown.payableDaysFormula}</p>
              <p className="font-mono">{calc.formulaBreakdown.earnedGrossFormula}</p>
            </div>
          )}

          {/* Signatures Footer */}
          <div className="pt-8 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>
              <p className="font-bold text-slate-800">HR & Accounts Department</p>
              <p className="text-[10px]">Digitally authenticated system payslip</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-800">Authorized Signatory</p>
              <p className="text-[10px]">{agencyName}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
