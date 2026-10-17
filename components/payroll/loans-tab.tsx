"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { toast } from "react-hot-toast";
import {
  Banknote,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  PauseCircle,
  PlayCircle,
  Calendar,
  AlertCircle,
  Receipt,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function LoansTab({ users = [] }: { users?: any[] }) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const url = statusFilter === "ALL"
    ? "/api/payroll/loans"
    : `/api/payroll/loans?status=${statusFilter}`;

  const { data: loans = [], error, isLoading, mutate } = useSWR(url, fetcher);

  // Create Loan Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUserId, setCreateUserId] = useState<string>("");
  const [createPrincipal, setCreatePrincipal] = useState<string>("");
  const [createTenure, setCreateTenure] = useState<string>("6");
  const [createReason, setCreateReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Installments Modal
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null);

  // Manual Repayment Modal
  const [repayLoan, setRepayLoan] = useState<any | null>(null);
  const [repayAmount, setRepayAmount] = useState<string>("");
  const [repayNotes, setRepayNotes] = useState<string>("");
  const [isRepaying, setIsRepaying] = useState(false);

  const filteredLoans = loans.filter((l: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const name = l.user?.name?.toLowerCase() || "";
    const email = l.user?.email?.toLowerCase() || "";
    const reason = l.reason?.toLowerCase() || "";
    return name.includes(term) || email.includes(term) || reason.includes(term);
  });

  const totalActivePrincipal = loans
    .filter((l: any) => l.status === "ACTIVE")
    .reduce((sum: number, l: any) => sum + (l.principalAmount || 0), 0);

  const totalOutstandingBalance = loans
    .filter((l: any) => l.status === "ACTIVE")
    .reduce((sum: number, l: any) => sum + (l.balanceAmount || 0), 0);

  const totalRepaidAmount = loans.reduce(
    (sum: number, l: any) => sum + (l.totalRepaid || 0),
    0
  );

  async function handleCreateLoan(e: React.FormEvent) {
    e.preventDefault();
    if (!createUserId || !createPrincipal || !createTenure) {
      toast.error("Please fill in all mandatory fields");
      return;
    }

    const principalRupees = parseFloat(createPrincipal);
    const tenureMonths = parseInt(createTenure, 10);
    if (isNaN(principalRupees) || principalRupees <= 0) {
      toast.error("Please enter a valid principal amount");
      return;
    }
    if (isNaN(tenureMonths) || tenureMonths < 1) {
      toast.error("Tenure must be at least 1 month");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/payroll/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(createUserId),
          principalAmount: principalRupees,
          inMajorUnits: true,
          totalTenure: tenureMonths,
          reason: createReason || "Employee Salary Advance",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create loan");

      toast.success("Loan successfully disbursed with scheduled EMI installments");
      setShowCreateModal(false);
      setCreateUserId("");
      setCreatePrincipal("");
      setCreateTenure("6");
      setCreateReason("");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to create loan");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleStatus(loan: any) {
    const newStatus = loan.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch(`/api/payroll/loans/${loan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update loan");
      toast.success(`Loan marked as ${newStatus}`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to update loan status");
    }
  }

  async function handleManualRepayment(e: React.FormEvent) {
    e.preventDefault();
    if (!repayLoan || !repayAmount) return;

    const amountRupees = parseFloat(repayAmount);
    if (isNaN(amountRupees) || amountRupees <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    setIsRepaying(true);
    try {
      const res = await fetch(`/api/payroll/loans/${repayLoan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "repayment",
          amount: amountRupees,
          inMajorUnits: true,
          notes: repayNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record repayment");

      toast.success("Repayment recorded successfully");
      setRepayLoan(null);
      setRepayAmount("");
      setRepayNotes("");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to record repayment");
    } finally {
      setIsRepaying(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Active Disbursed Principal</span>
              <Banknote className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatInr(totalActivePrincipal)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all active advances</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Outstanding Balance</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatInr(totalOutstandingBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">To be recovered via monthly payroll</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Total Recovered</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatInr(totalRepaidAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">Recovered EMIs and manual settlements</p>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="PAUSED">Paused</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => mutate()} className="h-9">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button size="sm" onClick={() => setShowCreateModal(true)} className="h-9 w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1.5" /> Disburse Loan / Advance
        </Button>
      </div>

      {/* Loans Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Employee</TableHead>
                <TableHead className="text-xs">Principal</TableHead>
                <TableHead className="text-xs">Monthly EMI</TableHead>
                <TableHead className="text-xs">Repaid / Balance</TableHead>
                <TableHead className="text-xs">Tenure</TableHead>
                <TableHead className="text-xs">Disbursed On</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                    Loading loan records...
                  </TableCell>
                </TableRow>
              ) : filteredLoans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                    No loan advances found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLoans.map((l: any) => {
                  const percent = l.principalAmount > 0
                    ? Math.round((l.totalRepaid / l.principalAmount) * 100)
                    : 100;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">
                        <div className="font-medium text-foreground">{l.user?.name}</div>
                        <div className="text-[11px] text-muted-foreground">{l.user?.department || l.user?.email}</div>
                        <div className="text-[10px] text-muted-foreground/80 italic mt-0.5">{l.reason}</div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold">{formatInr(l.principalAmount)}</TableCell>
                      <TableCell className="text-xs">{formatInr(l.installmentEmi)}/mo</TableCell>
                      <TableCell className="text-xs">
                        <div>{formatInr(l.totalRepaid)} / <span className="font-medium text-amber-600">{formatInr(l.balanceAmount)}</span></div>
                        <div className="w-24 bg-muted h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full ${percent === 100 ? "bg-emerald-500" : "bg-primary"}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{l.totalTenure} mos</TableCell>
                      <TableCell className="text-xs">
                        {new Date(l.disbursedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.status === "ACTIVE" && (
                          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-[10px]">
                            ACTIVE
                          </Badge>
                        )}
                        {l.status === "PAUSED" && (
                          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px]">
                            PAUSED
                          </Badge>
                        )}
                        {l.status === "COMPLETED" && (
                          <Badge variant="outline" className="text-muted-foreground bg-muted text-[10px]">
                            COMPLETED
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setSelectedLoan(l)}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" /> Schedule
                        </Button>
                        {l.status !== "COMPLETED" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setRepayLoan(l)}
                            >
                              <Receipt className="h-3.5 w-3.5 mr-1" /> Repay
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleToggleStatus(l)}
                            >
                              {l.status === "ACTIVE" ? (
                                <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                              ) : (
                                <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                              )}
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* CREATE LOAN DIALOG */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleCreateLoan}>
            <DialogHeader>
              <DialogTitle>Disburse Employee Loan / Salary Advance</DialogTitle>
              <DialogDescription>
                Create a loan with automated monthly EMI installments deducted during payroll processing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="employee-select">Employee *</Label>
                <Select value={createUserId} onValueChange={setCreateUserId}>
                  <SelectTrigger id="employee-select" className="h-9">
                    <SelectValue placeholder="Select an active employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter((u: any) => u.exitStatus !== "SEPARATED")
                      .map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name} ({u.designation || u.department || u.email})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="principal-amount">Principal Amount (₹) *</Label>
                  <Input
                    id="principal-amount"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 50000"
                    value={createPrincipal}
                    onChange={(e) => setCreatePrincipal(e.target.value)}
                    required
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tenure-months">Tenure (Months) *</Label>
                  <Input
                    id="tenure-months"
                    type="number"
                    min="1"
                    max="60"
                    placeholder="e.g. 6"
                    value={createTenure}
                    onChange={(e) => setCreateTenure(e.target.value)}
                    required
                    className="h-9"
                  />
                </div>
              </div>

              {createPrincipal && createTenure && Number(createTenure) > 0 && (
                <div className="p-3 bg-muted/50 rounded border text-muted-foreground flex items-center justify-between">
                  <span>Estimated Monthly EMI:</span>
                  <span className="font-semibold text-foreground text-sm">
                    {formatInr(Math.ceil((parseFloat(createPrincipal) / parseInt(createTenure, 10)) * 100))}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="loan-reason">Reason / Purpose</Label>
                <Input
                  id="loan-reason"
                  placeholder="e.g. Emergency medical advance, home relocation"
                  value={createReason}
                  onChange={(e) => setCreateReason(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Disbursing..." : "Disburse Loan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SCHEDULE & INSTALLMENTS MODAL */}
      <Dialog open={!!selectedLoan} onOpenChange={() => setSelectedLoan(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Loan Repayment Schedule</DialogTitle>
            <DialogDescription>
              {selectedLoan?.user?.name} — Principal {formatInr(selectedLoan?.principalAmount)} ({selectedLoan?.totalTenure} months)
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="grid grid-cols-3 gap-2 p-3 bg-muted/40 rounded-lg text-center mb-4 text-xs">
              <div>
                <div className="text-muted-foreground">Disbursed</div>
                <div className="font-semibold text-sm">{formatInr(selectedLoan?.principalAmount)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Repaid</div>
                <div className="font-semibold text-sm text-emerald-600">{formatInr(selectedLoan?.totalRepaid)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Remaining</div>
                <div className="font-semibold text-sm text-amber-600">{formatInr(selectedLoan?.balanceAmount)}</div>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Month / Year</TableHead>
                    <TableHead className="text-xs">Expected EMI</TableHead>
                    <TableHead className="text-xs">Deducted</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedLoan?.installments?.map((inst: any) => (
                    <TableRow key={inst.id}>
                      <TableCell className="text-xs font-medium">
                        {new Date(inst.year, inst.month - 1).toLocaleDateString("en-IN", {
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-xs">{formatInr(inst.expectedEmi)}</TableCell>
                      <TableCell className="text-xs font-semibold">{formatInr(inst.deductedEmi)}</TableCell>
                      <TableCell className="text-xs">
                        {inst.status === "RECOVERED" && (
                          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">RECOVERED</Badge>
                        )}
                        {inst.status === "PARTIAL" && (
                          <Badge variant="outline" className="text-amber-700 bg-amber-50 text-[10px]">PARTIAL</Badge>
                        )}
                        {inst.status === "SCHEDULED" && (
                          <Badge variant="outline" className="text-muted-foreground text-[10px]">SCHEDULED</Badge>
                        )}
                        {inst.status === "SKIPPED" && (
                          <Badge variant="outline" className="text-red-700 bg-red-50 text-[10px]">SKIPPED</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLoan(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MANUAL REPAYMENT MODAL */}
      <Dialog open={!!repayLoan} onOpenChange={() => setRepayLoan(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleManualRepayment}>
            <DialogHeader>
              <DialogTitle>Record Loan Repayment</DialogTitle>
              <DialogDescription>
                Record an off-cycle or direct bank transfer repayment for {repayLoan?.user?.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              <div className="p-3 bg-muted/40 rounded flex justify-between">
                <span>Outstanding Balance:</span>
                <span className="font-semibold text-amber-600">{formatInr(repayLoan?.balanceAmount)}</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="repay-amount">Repayment Amount (₹) *</Label>
                <Input
                  id="repay-amount"
                  type="number"
                  min="1"
                  max={(repayLoan?.balanceAmount || 0) / 100}
                  step="0.01"
                  placeholder="e.g. 10000"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  required
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="repay-notes">Transaction Reference / Notes</Label>
                <Input
                  id="repay-notes"
                  placeholder="e.g. UPI Ref #123456789, Cheque clearance"
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRepayLoan(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isRepaying}>
                {isRepaying ? "Recording..." : "Confirm Repayment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
