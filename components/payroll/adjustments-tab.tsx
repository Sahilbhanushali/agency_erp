"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { toast } from "react-hot-toast";
import {
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Layers,
  Sparkles,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const ADJUSTMENT_TYPES = [
  { value: "BONUS", label: "Performance / Festivity Bonus", isDeduction: false },
  { value: "INCENTIVE", label: "Sales / Project Incentive", isDeduction: false },
  { value: "REIMBURSEMENT", label: "Expense Reimbursement", isDeduction: false },
  { value: "ARREARS", label: "Salary Arrears / Backdated", isDeduction: false },
  { value: "ONE_TIME_EARNING", label: "Other One-Time Earning", isDeduction: false },
  { value: "DEDUCTION", label: "General Deduction / Recovery", isDeduction: true },
  { value: "LOAN_ADVANCE", label: "Salary Advance Deduction", isDeduction: true },
];

export function AdjustmentsTab({
  users = [],
  currentYear = new Date().getFullYear(),
}: {
  users?: any[];
  currentYear?: number;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [year, setYear] = useState(currentYear);

  const {
    data: adjustments = [],
    isLoading,
    mutate,
  } = useSWR(`/api/payroll/adjustments?year=${year}`, fetcher);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewAdjustment, setViewAdjustment] = useState<any | null>(null);
  const [editingAdjustment, setEditingAdjustment] = useState<any | null>(null);
  const [deleteAdjustment, setDeleteAdjustment] = useState<any | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    userId: "",
    title: "",
    type: "BONUS",
    amountRupees: "",
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    notes: "",
  });

  const handleOpenCreate = () => {
    setFormData({
      userId: users[0]?.id ? String(users[0].id) : "",
      title: "",
      type: "BONUS",
      amountRupees: "",
      month: String(new Date().getMonth() + 1),
      year: String(new Date().getFullYear()),
      notes: "",
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (adj: any) => {
    setEditingAdjustment(adj);
    setFormData({
      userId: String(adj.userId),
      title: adj.title,
      type: adj.type,
      amountRupees: String(Math.round(adj.amount / 100)),
      month: String(adj.month),
      year: String(adj.year),
      notes: adj.notes || "",
    });
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userId || !formData.title.trim() || !formData.amountRupees) {
      toast.error("Please fill in employee, title, and amount");
      return;
    }

    try {
      const res = await fetch("/api/payroll/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(formData.userId),
          title: formData.title.trim(),
          type: formData.type,
          amount: Math.round(Number(formData.amountRupees) * 100),
          month: Number(formData.month),
          year: Number(formData.year),
          notes: formData.notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create adjustment");

      toast.success("Monthly adjustment added");
      setIsCreateOpen(false);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to save adjustment");
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdjustment) return;

    try {
      const res = await fetch(`/api/payroll/adjustments/${editingAdjustment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title.trim(),
          type: formData.type,
          amount: Math.round(Number(formData.amountRupees) * 100),
          month: Number(formData.month),
          year: Number(formData.year),
          notes: formData.notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update adjustment");

      toast.success("Monthly adjustment updated");
      setEditingAdjustment(null);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to update adjustment");
    }
  };

  const confirmDelete = async () => {
    if (!deleteAdjustment) return;
    try {
      const res = await fetch(`/api/payroll/adjustments/${deleteAdjustment.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete adjustment");

      toast.success("Adjustment deleted successfully");
      setDeleteAdjustment(null);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete adjustment");
    }
  };

  const filteredAdjustments = adjustments.filter((a: any) => {
    if (typeFilter !== "ALL" && a.type !== typeFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.title?.toLowerCase().includes(term) ||
      a.user?.name?.toLowerCase().includes(term) ||
      a.user?.email?.toLowerCase().includes(term) ||
      a.notes?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-3.5 rounded-xl border border-border shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <DollarSign className="size-4 text-primary" /> Monthly Variable Adjustments
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Record, view, edit, and audit one-time bonuses, expense reimbursements, arrears, and ad-hoc deductions for payroll cycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative w-44 sm:w-56">
            <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input aria-label="Search title, employee"
              placeholder="Search title, employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger aria-label="All Types" className="h-8 text-xs w-32">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {ADJUSTMENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label.split("/")[0]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" onClick={handleOpenCreate} className="gap-1.5 text-xs font-semibold">
            <Plus className="size-3.5" />
            <span>Add Adjustment</span>
          </Button>
        </div>
      </div>

      {/* Adjustments Table */}
      <Card className="shadow-2xs overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold">Employee</TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">Title / Description</TableHead>
                <TableHead className="text-right text-xs font-semibold">Amount</TableHead>
                <TableHead className="text-center text-xs font-semibold">Cycle</TableHead>
                <TableHead className="text-xs font-semibold">Remarks</TableHead>
                <TableHead className="text-right text-xs font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                    Loading adjustments...
                  </TableCell>
                </TableRow>
              ) : filteredAdjustments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                    {searchTerm || typeFilter !== "ALL"
                      ? "No adjustments match your filter."
                      : "No variable adjustments recorded for this period."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAdjustments.map((a: any) => {
                  const isDeduction = a.type.includes("DEDUCTION") || a.type.includes("ADVANCE");
                  return (
                    <TableRow key={a.id} className="hover:bg-muted/20">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                              {a.user?.name?.charAt(0) || "E"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs font-bold text-foreground">{a.user?.name || "Staff"}</p>
                            <p className="text-xs text-muted-foreground">{a.user?.designation || a.user?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isDeduction ? "destructive" : "success"}
                          className="text-xs py-0 font-medium"
                        >
                          {a.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground max-w-[200px] truncate">
                        {a.title}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold">
                        <span className={isDeduction ? "text-red-600" : "text-emerald-600"}>
                          {isDeduction ? `- ${formatInr(a.amount)}` : `+ ${formatInr(a.amount)}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono">
                        {MONTH_NAMES[a.month - 1]?.slice(0, 3)} {a.year}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                        {a.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* VIEW ACTION */}
                          <Button aria-label="View Details"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setViewAdjustment(a)}
                            title="View Details"
                          >
                            <Eye className="size-3.5 text-muted-foreground" />
                          </Button>

                          {/* EDIT ACTION */}
                          <Button aria-label="Edit Adjustment"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleOpenEdit(a)}
                            title="Edit Adjustment"
                          >
                            <Edit className="size-3.5 text-muted-foreground" />
                          </Button>

                          {/* DELETE ACTION */}
                          <Button aria-label="Delete Adjustment"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setDeleteAdjustment(a)}
                            title="Delete Adjustment"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
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
      </Card>

      {/* ================= MODAL: CREATE ADJUSTMENT ================= */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <form onSubmit={handleSaveCreate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Plus className="size-4 text-primary" />
                <span>Add Monthly Salary Adjustment</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Apply one-time bonuses, reimbursements, or ad-hoc deductions to an employee's payroll.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Employee *</Label>
                <Select
                  value={formData.userId}
                  onValueChange={(val) => setFormData({ ...formData, userId: val })}
                >
                  <SelectTrigger aria-label="Employee" className="h-8 text-xs">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)} className="text-xs">
                        {u.name} ({u.designation || u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Adjustment Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(val) => setFormData({ ...formData, type: val })}
                  >
                    <SelectTrigger aria-label="Adjustment Type" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Amount (₹) *</Label>
                  <Input aria-label="Amount (₹)"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 5000"
                    value={formData.amountRupees}
                    onChange={(e) => setFormData({ ...formData, amountRupees: e.target.value })}
                    className="h-8 text-xs font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Title / Description *</Label>
                <Input aria-label="Title / Description"
                  required
                  placeholder="e.g. Q3 Sales Performance Bonus"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Pay Month</Label>
                  <Select
                    value={formData.month}
                    onValueChange={(val) => setFormData({ ...formData, month: val })}
                  >
                    <SelectTrigger aria-label="Pay Month" className="h-8 text-xs">
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

                <div className="space-y-1">
                  <Label className="text-xs">Pay Year</Label>
                  <Input aria-label="Pay Year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="h-8 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Audit Remarks / Notes</Label>
                <Input aria-label="Audit Remarks / Notes"
                  placeholder="Optional reference details, invoice number..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-semibold">
                Save Adjustment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: EDIT ADJUSTMENT ================= */}
      <Dialog open={!!editingAdjustment} onOpenChange={() => setEditingAdjustment(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Edit className="size-4 text-primary" />
                <span>Edit Monthly Salary Adjustment</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update amount, classification, or cycle for {editingAdjustment?.user?.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Adjustment Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(val) => setFormData({ ...formData, type: val })}
                  >
                    <SelectTrigger aria-label="Adjustment Type" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Amount (₹) *</Label>
                  <Input aria-label="Amount (₹)"
                    type="number"
                    min="1"
                    step="1"
                    value={formData.amountRupees}
                    onChange={(e) => setFormData({ ...formData, amountRupees: e.target.value })}
                    className="h-8 text-xs font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Title / Description *</Label>
                <Input aria-label="Title / Description"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Pay Month</Label>
                  <Select
                    value={formData.month}
                    onValueChange={(val) => setFormData({ ...formData, month: val })}
                  >
                    <SelectTrigger aria-label="Pay Month" className="h-8 text-xs">
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

                <div className="space-y-1">
                  <Label className="text-xs">Pay Year</Label>
                  <Input aria-label="Pay Year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="h-8 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Remarks / Notes</Label>
                <Input aria-label="Remarks / Notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingAdjustment(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-semibold">
                Update Adjustment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: VIEW ADJUSTMENT DETAILS ================= */}
      {viewAdjustment && (
        <Dialog open={!!viewAdjustment} onOpenChange={() => setViewAdjustment(null)}>
          <DialogContent className="w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-primary" />
                <span>Adjustment Audit Details</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Detailed record and payroll impact of this entry.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              {/* Employee info card */}
              <div className="p-3 rounded-xl border border-border bg-muted/20 flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                    {viewAdjustment.user?.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-bold text-foreground text-xs">{viewAdjustment.user?.name}</h4>
                  <p className="text-xs text-muted-foreground">{viewAdjustment.user?.designation || viewAdjustment.user?.email}</p>
                </div>
              </div>

              {/* Amount hero */}
              <div className="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-muted-foreground block">
                    Adjustment Amount
                  </span>
                  <Badge
                    variant={viewAdjustment.type.includes("DEDUCTION") ? "destructive" : "success"}
                    className="text-xs mt-1"
                  >
                    {viewAdjustment.type}
                  </Badge>
                </div>
                <span className={`text-xl font-bold font-mono ${viewAdjustment.type.includes("DEDUCTION") ? "text-red-600" : "text-emerald-600"}`}>
                  {formatInr(viewAdjustment.amount)}
                </span>
              </div>

              {/* Metadata rows */}
              <div className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground">Title / Purpose:</span>
                  <span className="font-semibold text-foreground text-right">{viewAdjustment.title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground">Applicable Cycle:</span>
                  <span className="font-mono text-foreground">
                    {MONTH_NAMES[viewAdjustment.month - 1]} {viewAdjustment.year}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground">Recorded On:</span>
                  <span className="font-mono text-foreground">
                    {new Date(viewAdjustment.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {viewAdjustment.notes && (
                  <div className="py-1">
                    <span className="text-muted-foreground block mb-0.5">Notes:</span>
                    <p className="text-foreground bg-muted/40 p-2 rounded text-xs font-mono">
                      {viewAdjustment.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setViewAdjustment(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      <Dialog open={!!deleteAdjustment} onOpenChange={() => setDeleteAdjustment(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              <span>Delete Monthly Adjustment</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to remove <strong>{deleteAdjustment?.title}</strong> ({formatInr(deleteAdjustment?.amount)}) for <strong>{deleteAdjustment?.user?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteAdjustment(null)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={confirmDelete} className="font-semibold">
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
