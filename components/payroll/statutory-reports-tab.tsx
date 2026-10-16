"use client";

import React, { useState } from "react";
import useSWR from "swr";
import {
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Building,
  TrendingUp,
  Receipt,
  Layers,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface StatutoryReportsTabProps {
  runs: Array<{
    id: string;
    month: number;
    year: number;
    totalHeadcount: number;
    totalGross: number;
    totalNetPay: number;
    status: string;
  }>;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function StatutoryReportsTab({ runs }: StatutoryReportsTabProps) {
  const [selectedRunId, setSelectedRunId] = useState<string>(
    runs.length > 0 ? runs[0].id : ""
  );

  const activeRun = runs.find((r) => r.id === selectedRunId) || runs[0];

  if (!runs || runs.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <p className="text-xs text-muted-foreground">
          No payroll runs found. Calculate a payroll run first to generate statutory challans and accounting reports.
        </p>
      </Card>
    );
  }

  const periodLabel = activeRun ? `${MONTH_NAMES[activeRun.month - 1]} ${activeRun.year}` : "—";

  return (
    <div className="space-y-6">
      {/* Run Selector Bar */}
      <Card className="border border-border/80 shadow-2xs">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Statutory Challans, Compliance & Accounting Exports
              </h3>
              <p className="text-xs text-muted-foreground">
                Download EPFO ECR, ESIC return, State PT, TDS 24Q, and balanced double-entry accounting journals.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Payroll Period:</span>
            <Select value={selectedRunId} onValueChange={setSelectedRunId}>
              <SelectTrigger className="w-full sm:w-56 h-9 text-xs">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {runs.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    {MONTH_NAMES[r.month - 1]} {r.year} ({r.totalHeadcount} Staff)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grid of Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Report 1: Monthly Payroll Register */}
        <Card className="border border-border/70 shadow-2xs hover:border-border transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] font-mono">
                HR / AUDIT
              </Badge>
              <FileText className="size-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-bold text-foreground mt-2">
              Monthly Payroll Register
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Comprehensive employee-level tabular register with attendance, all allowances, and statutory deductions.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="pt-3 border-t border-border/40 flex items-center justify-between">
              <span className="text-[11px] font-mono text-muted-foreground">{periodLabel}</span>
              <a href={`/api/payroll/runs/${selectedRunId}/export/register-csv`} download>
                <Button size="xs" variant="outline" className="gap-1.5 text-xs">
                  <Download className="size-3.5" />
                  Download CSV
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Report 2: PF Electronic Challan cum Return (ECR) */}
        <Card className="border border-border/70 shadow-2xs hover:border-border transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] font-mono text-blue-600">
                EPFO COMPLIANT
              </Badge>
              <ShieldCheck className="size-4 text-blue-600" />
            </div>
            <CardTitle className="text-sm font-bold text-foreground mt-2">
              Provident Fund ECR Return
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              EPFO official ECR file format with UAN, Gross, EPF wages, EPS 8.33% & EPF 3.67% share splits.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="pt-3 border-t border-border/40 flex items-center justify-between">
              <span className="text-[11px] font-mono text-muted-foreground">{periodLabel}</span>
              <a href={`/api/payroll/runs/${selectedRunId}/export/reports?type=pf-ecr`} download>
                <Button size="xs" variant="outline" className="gap-1.5 text-xs text-blue-600">
                  <Download className="size-3.5" />
                  Export ECR
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Report 3: ESI Monthly Return */}
        <Card className="border border-border/70 shadow-2xs hover:border-border transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] font-mono text-emerald-600">
                ESIC COMPLIANT
              </Badge>
              <Receipt className="size-4 text-emerald-600" />
            </div>
            <CardTitle className="text-sm font-bold text-foreground mt-2">
              ESI Monthly Contribution Statement
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              ESIC portal contribution return listing IP numbers, paid days, employee 0.75% and employer 3.25% share.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="pt-3 border-t border-border/40 flex items-center justify-between">
              <span className="text-[11px] font-mono text-muted-foreground">{periodLabel}</span>
              <a href={`/api/payroll/runs/${selectedRunId}/export/reports?type=esi-return`} download>
                <Button size="xs" variant="outline" className="gap-1.5 text-xs text-emerald-600">
                  <Download className="size-3.5" />
                  Export ESI
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Report 4: Professional Tax State Summary */}
        <Card className="border border-border/70 shadow-2xs hover:border-border transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] font-mono">
                STATE TAX
              </Badge>
              <Building className="size-4 text-foreground" />
            </div>
            <CardTitle className="text-sm font-bold text-foreground mt-2">
              Professional Tax (PT) Summary
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              State-wise summary of employee headcount, eligible salary slabs, and total PT deduction challan liability.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="pt-3 border-t border-border/40 flex items-center justify-between">
              <span className="text-[11px] font-mono text-muted-foreground">{periodLabel}</span>
              <a href={`/api/payroll/runs/${selectedRunId}/export/reports?type=pt-summary`} download>
                <Button size="xs" variant="outline" className="gap-1.5 text-xs">
                  <Download className="size-3.5" />
                  Download PT
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Report 5: TDS Quarterly 24Q Summary */}
        <Card className="border border-border/70 shadow-2xs hover:border-border transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] font-mono text-purple-600">
                INCOME TAX (SEC 192)
              </Badge>
              <TrendingUp className="size-4 text-purple-600" />
            </div>
            <CardTitle className="text-sm font-bold text-foreground mt-2">
              TDS Quarterly 24Q Statement
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Form 24Q quarterly return schedule with PAN, employee designation, gross compensation and tax deducted.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="pt-3 border-t border-border/40 flex items-center justify-between">
              <span className="text-[11px] font-mono text-muted-foreground">{periodLabel}</span>
              <a href={`/api/payroll/runs/${selectedRunId}/export/reports?type=tds-24q`} download>
                <Button size="xs" variant="outline" className="gap-1.5 text-xs text-purple-600">
                  <Download className="size-3.5" />
                  Export 24Q
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Report 6: Departmental CTC Breakdown */}
        <Card className="border border-border/70 shadow-2xs hover:border-border transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] font-mono">
                MANAGEMENT / COST
              </Badge>
              <Layers className="size-4 text-foreground" />
            </div>
            <CardTitle className="text-sm font-bold text-foreground mt-2">
              Department Cost-to-Company (CTC)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Departmental analysis of total payroll expenditure, employer contributions, and average employee CTC.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="pt-3 border-t border-border/40 flex items-center justify-between">
              <span className="text-[11px] font-mono text-muted-foreground">{periodLabel}</span>
              <a href={`/api/payroll/runs/${selectedRunId}/export/reports?type=ctc-dept`} download>
                <Button size="xs" variant="outline" className="gap-1.5 text-xs">
                  <Download className="size-3.5" />
                  Download CTC
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounting Journal Entry Voucher Section */}
      <Card className="border border-border/80 shadow-2xs overflow-hidden">
        <CardHeader className="p-6 pb-3 border-b border-border/50 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 border-emerald-500/20 bg-emerald-500/10">
                  DOUBLE-ENTRY BALANCED (DR = CR)
                </Badge>
              </div>
              <CardTitle className="text-base font-bold text-foreground mt-1">
                Accounting Journal Voucher Export
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Export balanced double-entry payroll ledger entries directly into Tally ERP, Zoho Books, or standard ERP CSV.
              </CardDescription>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5 text-xs bg-primary text-primary-foreground">
                  <Download className="size-3.5" />
                  <span>Export Journal Voucher</span>
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 text-xs">
                <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Accounting Systems</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <a href={`/api/payroll/runs/${selectedRunId}/export/journal-entry?format=standard`} download className="cursor-pointer">
                    Standard Journal Entry (CSV)
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/payroll/runs/${selectedRunId}/export/journal-entry?format=tally`} download className="cursor-pointer">
                    Tally ERP Import (XML)
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/payroll/runs/${selectedRunId}/export/journal-entry?format=zoho`} download className="cursor-pointer">
                    Zoho Books Journal (CSV)
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-2">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-emerald-600" />
              Automated Ledger Mapping Schema:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-muted-foreground font-mono">
              <div className="p-2 rounded bg-card border border-border/40">
                <span className="font-bold text-foreground block mb-0.5">Debit Accounts (Expenses):</span>
                • Salaries & Wages Expense Dr (Gross)<br />
                • Employer PF Contribution Expense Dr<br />
                • Employer ESI Contribution Expense Dr
              </div>
              <div className="p-2 rounded bg-card border border-border/40">
                <span className="font-bold text-foreground block mb-0.5">Credit Accounts (Liabilities):</span>
                • Salaries Payable Cr (Net Take-Home)<br />
                • Provident Fund (EE + ER) Payable Cr<br />
                • ESI (EE + ER) Payable Cr<br />
                • Professional Tax & TDS Payable Cr
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
