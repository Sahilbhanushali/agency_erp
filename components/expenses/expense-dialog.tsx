"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getMediaUrl } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: any | null;
  preselectedClientId?: string;
  preselectedProjectId?: string;
  onSaved: () => void;
}

const CATEGORIES = [
  { value: "SOFTWARE_TOOL", label: "Software & SaaS Subscriptions" },
  { value: "CONTRACTOR_FREELANCER", label: "Contractor & Freelancer Fees" },
  { value: "AD_SPEND", label: "Ad Spend (Meta, Google, LinkedIn)" },
  { value: "SHOOT_PRODUCTION", label: "Shoot, Studio & Production" },
  { value: "OFFICE_TRAVEL", label: "Travel & Client Entertainment" },
  { value: "HARDWARE_EQUIPMENT", label: "Hardware & Tech Equipment" },
  { value: "OTHER", label: "Other Operational Expense" },
];

const PAYMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "Bank Transfer (NEFT/RTGS/IMPS)" },
  { value: "UPI", label: "UPI / QR Code" },
  { value: "CARD", label: "Corporate Credit / Debit Card" },
  { value: "CASH", label: "Petty Cash" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other Payment Method" },
];

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

  // Fetch clients for selection
  const { data: clientsData } = useSWR("/api/clients", fetcher);
  const clients = clientsData?.clients || clientsData || [];

  // Fetch projects for selection
  const { data: projectsData } = useSWR("/api/projects", fetcher);
  const projects = Array.isArray(projectsData) ? projectsData : projectsData?.projects || [];

  useEffect(() => {
    if (expense) {
      setTitle(expense.title || "");
      setCategory(expense.category || "OTHER");
      setAmount(String(expense.amount || ""));
      setCurrency(expense.currency || "INR");
      setDate(
        expense.date
          ? format(new Date(expense.date), "yyyy-MM-dd")
          : format(new Date(), "yyyy-MM-dd")
      );
      setIsBillable(Boolean(expense.isBillable));
      setStatus(expense.status || "APPROVED");
      setPaymentMethod(expense.paymentMethod || "BANK_TRANSFER");
      setNotes(expense.notes || "");
      setClientId(expense.clientId || preselectedClientId || "NONE");
      setProjectId(expense.projectId || preselectedProjectId || "NONE");
      setReceiptUrl(expense.receiptUrl || null);
      setReceiptName(expense.receiptName || null);
    } else {
      setTitle("");
      setCategory("OTHER");
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
  }, [expense, open, preselectedClientId, preselectedProjectId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    if (receiptUrl) {
      formData.append("oldUrl", receiptUrl);
    }

    try {
      const res = await fetch("/api/expenses/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setReceiptUrl(data.url);
      setReceiptName(data.filename);
      toast.success("Receipt uploaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Could not upload receipt");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter an expense title");
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid expense amount");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        amount: Number(amount),
        currency,
        date: new Date(date).toISOString(),
        isBillable,
        status,
        paymentMethod,
        notes: notes.trim() || null,
        clientId: clientId !== "NONE" ? clientId : null,
        projectId: projectId !== "NONE" ? projectId : null,
        receiptUrl: receiptUrl || null,
        receiptName: receiptName || null,
      };

      const url = expense ? `/api/expenses/${expense.id}` : "/api/expenses";
      const method = expense ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save expense");

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            <DialogTitle className="text-base font-semibold">
              {expense ? "Edit Expense" : "Log New Expense"}
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Track direct project costs, freelancer contractor payments, tools, and calculate net margins.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Title & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Expense Title *</Label>
              <Input
                placeholder="e.g. Midjourney Annual License / Voiceover Artist"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Expense Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value} className="text-xs">
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount & Date & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Amount (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-xs h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Date Incurred *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-xs h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="text-xs h-9">
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

          {/* Attribution: Client & Project Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="size-3.5 text-muted-foreground" />
                Linked Client (Optional)
              </Label>
              <SearchableSelect
                value={clientId === "NONE" ? "" : clientId}
                onValueChange={(val) => {
                  setClientId(val ? val : "NONE");
                  setProjectId("NONE");
                }}
                placeholder="Agency Overhead (No client)"
                icon={Building2}
                options={[
                  { id: "", label: "Agency Overhead (No Client)" },
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
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <FolderKanban className="size-3.5 text-muted-foreground" />
                Linked Project (Optional)
              </Label>
              <SearchableSelect
                value={projectId === "NONE" ? "" : projectId}
                onValueChange={(val) => setProjectId(val ? val : "NONE")}
                placeholder="No specific project"
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

          {/* Billable Toggle & Approval Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/10">
              <input
                type="checkbox"
                id="isBillable"
                checked={isBillable}
                onChange={(e) => setIsBillable(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary size-4"
              />
              <label htmlFor="isBillable" className="text-xs cursor-pointer select-none">
                <span className="font-semibold block text-foreground">Rebillable to Client</span>
                <span className="text-[11px] text-muted-foreground">
                  Can be rebilled or attached to client's next invoice
                </span>
              </label>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Expense Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="text-xs h-9">
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

          {/* Receipt Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Receipt / Tax Invoice Upload</Label>
            {receiptUrl ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/30">
                <div className="flex items-center gap-2 text-xs truncate">
                  <FileText className="size-4 text-primary shrink-0" />
                  <a
                    href={getMediaUrl(receiptUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline font-medium text-foreground truncate"
                  >
                    {receiptName || "Uploaded Receipt"}
                  </a>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="size-7 text-destructive"
                  onClick={() => {
                    setReceiptUrl(null);
                    setReceiptName(null);
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.docx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="text-xs file:text-xs file:h-7 file:rounded file:border-0 file:bg-primary/10 file:text-primary file:font-medium"
                />
                {uploading && <span className="text-xs text-muted-foreground animate-pulse">Uploading...</span>}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes & Description</Label>
            <Textarea
              placeholder="Vendor details, PO reference, or commercial justifications..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs min-h-[70px] resize-none"
            />
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="text-xs" disabled={submitting || uploading}>
              {submitting ? "Saving..." : expense ? "Update Expense" : "Record Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
