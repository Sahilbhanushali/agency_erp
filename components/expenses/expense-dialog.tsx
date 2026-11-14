"use client";

import { jsonFetcher } from "@/lib/fetcher";
import React, { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { format } from "date-fns";
import {
  Receipt,
  Upload,
  X,
  FileText,
  DollarSign,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Building2,
  FolderKanban,
  CreditCard,
  RefreshCw,
  Eye,
  Trash2,
  Sparkles,
  Tag,
  ArrowRight,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getMediaUrl } from "@/lib/utils";

// Throws on non-2xx, so a failed load is an error state, not an empty list.
const fetcher = (url: string) => jsonFetcher(url);

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: any | null;
  preselectedClientId?: string;
  preselectedProjectId?: string;
  onSaved: () => void;
}

const CATEGORIES = [
  { value: "SOFTWARE_TOOL", label: "Software & SaaS Subscriptions", icon: "💻" },
  { value: "CONTRACTOR_FREELANCER", label: "Contractor & Freelancer Fees", icon: "👥" },
  { value: "AD_SPEND", label: "Ad Spend (Meta, Google, LinkedIn)", icon: "📈" },
  { value: "SHOOT_PRODUCTION", label: "Shoot, Studio & Production", icon: "🎬" },
  { value: "OFFICE_TRAVEL", label: "Travel & Client Entertainment", icon: "✈️" },
  { value: "HARDWARE_EQUIPMENT", label: "Hardware & Tech Equipment", icon: "🖥️" },
  { value: "OTHER", label: "Other Operational Expense", icon: "📁" },
];

const PAYMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "Bank Transfer (NEFT/RTGS/IMPS)" },
  { value: "UPI", label: "UPI / QR Code" },
  { value: "CARD", label: "Corporate Credit / Debit Card" },
  { value: "CASH", label: "Petty Cash" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other Payment Method" },
];

const STATUS_VARIANTS: Record<string, { label: string; variant: "success" | "warning" | "info" | "destructive" }> = {
  APPROVED: { label: "Approved / Paid", variant: "success" },
  PENDING: { label: "Pending Review", variant: "warning" },
  REIMBURSED: { label: "Reimbursed", variant: "info" },
  REJECTED: { label: "Rejected", variant: "destructive" },
};

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  preselectedClientId,
  preselectedProjectId,
  onSaved,
}: ExpenseDialogProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isBillable, setIsBillable] = useState(false);
  const [status, setStatus] = useState("APPROVED");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [notes, setNotes] = useState("");
  const [clientId, setClientId] = useState<string>("NONE");
  const [projectId, setProjectId] = useState<string>("NONE");

  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch clients for selection
  const { data: clientsData } = useSWR(open ? "/api/clients" : null, fetcher);
  const clients = Array.isArray(clientsData) ? clientsData : clientsData?.clients || [];

  // Fetch projects for selection
  const { data: projectsData } = useSWR(open ? "/api/projects" : null, fetcher);
  const projects = Array.isArray(projectsData) ? projectsData : projectsData?.projects || [];

  useEffect(() => {
    if (expense) {
      setTitle(expense.title || "");
      setCategory(expense.category || "OTHER");
      setAmount(expense.amount ? String(expense.amount) : "");
      setCurrency(expense.currency || "INR");
      setDate(
        expense.date
          ? format(new Date(expense.date), "yyyy-MM-dd")
          : format(new Date(), "yyyy-MM-dd")
      );
      setIsBillable(!!expense.isBillable);
      setStatus(expense.status || "APPROVED");
      setPaymentMethod(expense.paymentMethod || "BANK_TRANSFER");
      setNotes(expense.notes || "");
      setClientId(expense.clientId || "NONE");
      setProjectId(expense.projectId || "NONE");
      setReceiptUrl(expense.receiptUrl || null);
      setReceiptName(
        expense.receiptUrl ? expense.receiptUrl.split("/").pop() || "Receipt" : null
      );
    } else {
      setTitle("");
      setCategory("SOFTWARE_TOOL");
      setAmount("");
      setCurrency("INR");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setIsBillable(false);
      setStatus("APPROVED");
      setPaymentMethod("BANK_TRANSFER");
      setNotes("");
      setClientId(preselectedClientId || "NONE");
      setProjectId(preselectedProjectId || "NONE");
      setReceiptUrl(null);
      setReceiptName(null);
    }
  }, [expense, preselectedClientId, preselectedProjectId, open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("File upload failed");
      const data = await res.json();

      setReceiptUrl(data.url);
      setReceiptName(file.name);
      toast.success("Receipt invoice attached successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload receipt");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Expense title is required");
      return;
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid expense amount greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        amount: parseFloat(amount),
        currency,
        date: new Date(date).toISOString(),
        isBillable,
        status,
        paymentMethod,
        notes: notes.trim() || null,
        clientId: clientId && clientId !== "NONE" ? clientId : null,
        projectId: projectId && projectId !== "NONE" ? projectId : null,
        receiptUrl: receiptUrl || null,
      };

      const url = expense ? `/api/expenses/${expense.id}` : "/api/expenses";
      const method = expense ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save expense record");

      toast.success(
        expense ? "Expense updated successfully" : "Expense recorded successfully"
      );
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Error saving expense");
    } finally {
      setSubmitting(false);
    }
  };

  const statusConfig = STATUS_VARIANTS[status] || STATUS_VARIANTS.APPROVED;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl">
        {/* Modal Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Receipt className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  {expense ? "Edit Commercial Expense" : "Log New Agency Expense"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Track vendor bills, software tools, production costs, and associate them to client margins.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">
                {CATEGORIES.find((c) => c.value === category)?.label.split(" ")[0] || category}
              </Badge>
              <Badge
                variant={statusConfig.variant}
                className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5"
              >
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Section 1: Core Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Expense Title *</Label>
              <Input aria-label="Expense Title"
                placeholder="e.g. Midjourney Annual License / Voiceover Artist Fee"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs h-10"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Expense Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label="Expense Category" className="text-xs h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value} className="text-xs">
                      <span className="mr-1.5">{cat.icon}</span>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 2: Financials & Dates */}
          <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <DollarSign className="size-4 text-emerald-600" />
              <span>Financial Value & Payment Channel</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Amount (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    ₹
                  </span>
                  <Input aria-label="Amount (₹)"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-xs h-10 font-mono font-bold pl-7"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Date Incurred *</Label>
                <div className="relative">
                  <Input aria-label="Date Incurred"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="text-xs h-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger aria-label="Payment Method" className="text-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((pm) => (
                      <SelectItem key={pm.value} value={pm.value} className="text-xs">
                        {pm.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 3: Commercial Attribution (Client & Project) */}
          <div className="p-4 rounded-xl border border-border/70 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Building2 className="size-4 text-primary" />
                <span>Client & Project Profit Margin Allocation</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {clientId !== "NONE" ? "Direct Client Cost" : "Agency Overhead"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Attributed Client Account</Label>
                <SearchableSelect
                  value={clientId === "NONE" ? "" : clientId}
                  onValueChange={(val) => {
                    setClientId(val ? val : "NONE");
                    setProjectId("NONE");
                  }}
                  placeholder="Select Client (or Overhead)..."
                  icon={Building2}
                  options={[
                    { id: "", label: "🏢 Agency Overhead (Not Client-Billed)" },
                    ...clients.map((c: any) => ({
                      id: c.id,
                      label: c.name || "Client",
                      subLabel: c.company ? `${c.company}` : c.email,
                    })),
                  ]}
                  maxDisplay={4}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Attributed Project Campaign</Label>
                <SearchableSelect
                  value={projectId === "NONE" ? "" : projectId}
                  onValueChange={(val) => setProjectId(val ? val : "NONE")}
                  placeholder="Select Project Campaign..."
                  icon={FolderKanban}
                  options={[
                    { id: "", label: "No Specific Project" },
                    ...(clientId && clientId !== "NONE"
                      ? projects.filter((p: any) => p.clientId === clientId)
                      : projects
                    ).map((p: any) => ({
                      id: p.id,
                      label: p.name,
                    })),
                  ]}
                  maxDisplay={4}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Rebillable Toggle & Approval Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="p-3.5 rounded-xl border border-border/70 bg-muted/15 flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <Label className="text-xs font-bold text-foreground block">
                  Rebillable to Client
                </Label>
                <p className="text-xs text-muted-foreground leading-tight">
                  Pass through this cost directly on the client's next invoice.
                </p>
              </div>
              <Switch
                checked={isBillable}
                onCheckedChange={setIsBillable}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Approval / Settlement Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-label="Approval / Settlement Status" className="text-xs h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVED" className="text-xs">
                    Approved / Paid
                  </SelectItem>
                  <SelectItem value="PENDING" className="text-xs">
                    Pending Reimbursement / Review
                  </SelectItem>
                  <SelectItem value="REIMBURSED" className="text-xs">
                    Reimbursed to Employee
                  </SelectItem>
                  <SelectItem value="REJECTED" className="text-xs">
                    Rejected
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 5: Receipt Upload */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Receipt / Tax Invoice Document</Label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />

            {receiptUrl ? (
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <a
                      href={getMediaUrl(receiptUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold hover:underline truncate text-foreground block"
                    >
                      {receiptName || "Uploaded Receipt"}
                    </a>
                    <span className="text-xs text-muted-foreground">Document attached</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-xs h-8"
                  >
                    Replace
                  </Button>
                  <Button aria-label="Remove receipt"
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setReceiptUrl(null);
                      setReceiptName(null);
                    }}
                    className="text-destructive hover:bg-destructive/10 size-8"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-border/80 hover:border-primary/50 hover:bg-muted/15 transition-all rounded-xl p-6 text-center space-y-1.5"
              >
                <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <Upload className="size-4" />
                </div>
                <p className="text-xs font-bold text-foreground">
                  {uploading ? "Uploading receipt document..." : "Click to attach receipt or invoice voucher"}
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, PNG, JPG, or DOCX up to 15MB
                </p>
              </div>
            )}
          </div>

          {/* Section 6: Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Commercial Notes & Description</Label>
            <Textarea aria-label="Commercial Notes & Description"
              placeholder="Vendor details, commercial justifications, PO number, or disbursement notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs min-h-[75px] resize-none"
            />
          </div>

          {/* Sticky Modal Footer */}
          <DialogFooter className="pt-3 border-t border-border/60 flex items-center justify-between">
            <div className="text-xs text-muted-foreground hidden sm:block">
              {amount ? `Total: ₹${Number(amount).toLocaleString("en-IN")}` : "Enter amount"}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-9"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs h-9 px-4 font-bold"
                disabled={submitting || uploading}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="mr-2 size-3.5 animate-spin" />
                    Saving...
                  </>
                ) : expense ? (
                  "Update Expense Record"
                ) : (
                  "Record Expense"
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
