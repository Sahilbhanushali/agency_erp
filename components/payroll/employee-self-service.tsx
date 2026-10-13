"use client";

import React, { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Banknote,
  Calendar,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Lock,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Clock,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
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

function formatInr(minorUnits: number): string {
  const rupees = (minorUnits || 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

export default function EmployeeSelfService() {
  const { data, isLoading, error } = useSWR("/api/payroll/self-service", fetcher);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-8 text-center border-dashed">
        <p className="text-xs text-muted-foreground">
          {error?.message || "Unable to load employee self-service records."}
        </p>
      </Card>
    );
  }

  const { user, payslips, ytd, leaveBalances, attendanceSummary } = data;
  const latestPayslip = payslips && payslips.length > 0 ? payslips[0] : null;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Employee Greeting & Quick Action Banner */}
      <Card className="border border-border/80 bg-gradient-to-r from-card via-card to-primary/5 shadow-2xs overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider text-primary">
                  Employee Self-Service Portal
                </Badge>
                <Badge variant="neutral" className="text-[10px]">
                  ID: #{user.id}
                </Badge>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Welcome, {user.name}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user.designation || "Staff Member"} • {user.department || "General"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/dashboard/attendance">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Clock className="size-3.5" />
                  Request Regularization
                </Button>
              </Link>
              <Link href="/dashboard/attendance">
                <Button size="sm" className="gap-1.5 text-xs bg-primary text-primary-foreground">
                  <Calendar className="size-3.5" />
                  Apply Leave
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* YTD Cumulative Compensation Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Financial Year Overview ({ytd.financialYear})
          </h3>
          <span className="text-[11px] text-muted-foreground">
            Tax Year: Apr – Mar
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-2xs border border-border/60">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Gross Compensation YTD
              </p>
              <h4 className="text-2xl font-black text-foreground mt-1">
                {formatInr(ytd.gross)}
              </h4>
              <p className="text-[10px] text-muted-foreground mt-1">
                Accumulated earnings this FY
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-2xs border border-border/60">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Net Disbursed YTD
              </p>
              <h4 className="text-2xl font-black text-emerald-600 mt-1">
                {formatInr(ytd.net)}
              </h4>
              <p className="text-[10px] text-muted-foreground mt-1">
                Credited take-home payout
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-2xs border border-border/60">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Income Tax (TDS) YTD
              </p>
              <h4 className="text-2xl font-black text-red-600 mt-1">
                {formatInr(ytd.tax)}
              </h4>
              <p className="text-[10px] text-muted-foreground mt-1">
                Section 192 tax withheld
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-2xs border border-border/60">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Provident Fund YTD
              </p>
              <h4 className="text-2xl font-black text-blue-600 mt-1">
                {formatInr(ytd.pf)}
              </h4>
              <p className="text-[10px] text-muted-foreground mt-1">
                Employee EPF contribution
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Leave Balances & Current Cycle Attendance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Leave Balances Card */}
        <Card className="shadow-2xs border border-border/60">
          <CardHeader className="py-3 px-4 border-b border-border/50">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center justify-between">
              <span>My Leave Balances</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Annual Allocation
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {leaveBalances && leaveBalances.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {leaveBalances.map((lb: any) => (
                  <div key={lb.id} className="p-3 rounded-lg border border-border/60 bg-muted/20 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block truncate">
                      {lb.leaveType?.name || "Leave"}
                    </span>
                    <span className="text-xl font-black text-foreground mt-1 block">
                      {lb.balance}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Used: {lb.used || 0}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No leave allocations recorded for this calendar year.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Cycle Attendance Card */}
        <Card className="shadow-2xs border border-border/60">
          <CardHeader className="py-3 px-4 border-b border-border/50">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center justify-between">
              <span>Current Cycle Attendance</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {MONTH_NAMES[attendanceSummary.month - 1]} {attendanceSummary.year}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-lg border border-border/50 bg-emerald-500/10">
                <span className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400 block">
                  Present
                </span>
                <span className="text-lg font-black text-emerald-600 mt-0.5 block">
                  {attendanceSummary.presentDays}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border border-border/50 bg-amber-500/10">
                <span className="text-[10px] uppercase font-semibold text-amber-700 dark:text-amber-400 block">
                  Half-Days
                </span>
                <span className="text-lg font-black text-amber-600 mt-0.5 block">
                  {attendanceSummary.halfDays}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border border-border/50 bg-blue-500/10">
                <span className="text-[10px] uppercase font-semibold text-blue-700 dark:text-blue-400 block">
                  On Leave
                </span>
                <span className="text-lg font-black text-blue-600 mt-0.5 block">
                  {attendanceSummary.onLeaveDays}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border border-border/50 bg-red-500/10">
                <span className="text-[10px] uppercase font-semibold text-red-700 dark:text-red-400 block">
                  LOP / Absent
                </span>
                <span className="text-lg font-black text-red-600 mt-0.5 block">
                  {attendanceSummary.absentDays}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historical Published Payslips Table */}
      <Card className="shadow-2xs border border-border/60 overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/20">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center justify-between">
            <span>My Official Salary Payslips</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              {payslips.length} published {payslips.length === 1 ? "payslip" : "payslips"}
            </span>
          </CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold">Pay Period</TableHead>
              <TableHead className="text-xs font-semibold">Payable Days</TableHead>
              <TableHead className="text-xs font-semibold">Gross Salary</TableHead>
              <TableHead className="text-xs font-semibold">Total Deductions</TableHead>
              <TableHead className="text-xs font-semibold">Net Take-Home</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-right text-xs font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payslips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                  No published payslips found yet. Once payroll is processed and published by HR, your payslips will appear here.
                </TableCell>
              </TableRow>
            ) : (
              payslips.map((p: any) => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="font-bold text-xs text-foreground">
                    {MONTH_NAMES[p.month - 1]} {p.year}
                  </TableCell>
                  <TableCell className="text-xs">{p.payableDays} Days</TableCell>
                  <TableCell className="text-xs font-mono">{formatInr(p.grossSalary)}</TableCell>
                  <TableCell className="text-xs font-mono text-red-600">
                    {formatInr(p.totalDeductions)}
                  </TableCell>
                  <TableCell className="text-xs font-mono font-bold text-emerald-600">
                    {formatInr(p.netSalary)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="success" className="text-[10px]">
                      {p.paymentStatus || "PAID"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => setSelectedPayslip(p)}
                        className="gap-1 text-xs"
                      >
                        <Eye className="size-3" />
                        View
                      </Button>
                      <a href={`/api/payroll/payslips/${p.id}/pdf`} download>
                        <Button size="xs" variant="outline" className="gap-1 text-xs">
                          <Download className="size-3" />
                          PDF
                        </Button>
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Modal for detailed payslip view */}
      {selectedPayslip && (
        <PayslipModal
          isOpen={!!selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
          payslip={{
            ...selectedPayslip,
            user,
          }}
        />
      )}
    </div>
  );
}
