"use client";

import { jsonFetcher } from "@/lib/fetcher";
import React, { useState, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import toast from "react-hot-toast";
import { format } from "date-fns";
import {
  Receipt,
  Upload,
  Building2,
  FolderKanban,
  DollarSign,
  Calendar,
  CreditCard,
  FileText,
  ArrowLeft,
  CheckCircle2,
  Paperclip,
  Trash2,
  Layers,
  HelpCircle,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";

// Throws on non-2xx, so a failed load is an error state, not an empty list.
const fetcher = (url: string) => jsonFetcher(url);

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

const STATUSES = [
  { value: "APPROVED", label: "Approved (Active in Accounting)" },
  { value: "PENDING", label: "Pending Approval" },
  { value: "REIMBURSED", label: "Reimbursed to Team" },
  { value: "REJECTED", label: "Rejected" },
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

export default function NewExpensePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams?.get("clientId") || "";
  const preselectedProjectId = searchParams?.get("projectId") || "";

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clientsData, isLoading: clientsLoading } = useSWR("/api/clients", fetcher);
  const { data: projectsData, isLoading: projectsLoading } = useSWR("/api/projects", fetcher);

  const clients = useMemo(() => {
    return Array.isArray(clientsData) ? clientsData : clientsData?.clients || [];
  }, [clientsData]);

  const projects = useMemo(() => {
    return Array.isArray(projectsData) ? projectsData : projectsData?.projects || [];
  }, [projectsData]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isBillable, setIsBillable] = useState(false);
  const [status, setStatus] = useState("APPROVED");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [notes, setNotes] = useState("");

  const [clientId, setClientId] = useState<string>(preselectedClientId);
  const [projectId, setProjectId] = useState<string>(preselectedProjectId);

  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Client options for SearchableSelect
  const clientOptions = useMemo(() => {
    return [
      { id: "", label: "None / Internal Agency Overhead", subLabel: "General Operational Cost" },
      ...clients.map((c: any) => ({
        id: c.id,
        label: c.name || "Client",
        subLabel: c.company ? `${c.company} • ${c.email}` : c.email,
      })),
    ];
  }, [clients]);

  // Project options for SearchableSelect filtered by client
  const projectOptions = useMemo(() => {
    const filtered = clientId
      ? projects.filter((p: any) => p.clientId === clientId)
      : projects;
    return [
      { id: "", label: "None / No Direct Project", subLabel: "General Overhead" },
      ...filtered.map((p: any) => ({
        id: p.id,
        label: p.name || "Unnamed Project",
        subLabel: p.client?.name ? `Client: ${p.client.name}` : undefined,
      })),
    ];
  }, [projects, clientId]);

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
    if (!date) {
      toast.error("Please select a date");
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
        clientId: clientId ? clientId : null,
        projectId: projectId ? projectId : null,
        receiptUrl: receiptUrl || null,
        receiptName: receiptName || null,
      };

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log expense");
      }

      toast.success("Expense logged successfully");
      router.push("/dashboard/expenses");
    } catch (err: any) {
      toast.error(err.message || "Failed to record expense");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in-50 duration-200">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/expenses">
            <ArrowLeft className="size-4" /> Back to Expenses
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Record Expense"
        description="Log operational costs, freelance disbursements, production equipment, or billable client expenses."
        badge={
          <Badge variant="outline" className="font-mono text-xs">
            Cost Accounting
          </Badge>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main 2-column info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Expense Classification */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="size-4 text-primary" />
                  Expense Details
                </CardTitle>
                <CardDescription className="text-xs">
                  Basic transaction particulars and categorisation
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs font-semibold">
                    Expense Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Adobe Creative Cloud Monthly Subscription"
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Expense Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger aria-label="Expense Category" className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value} className="text-xs">
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger aria-label="Payment Method" className="h-9 text-xs">
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount" className="text-xs font-semibold">
                      Amount <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      step="any"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-9 text-xs tabular-nums"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger aria-label="Currency" className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((cur) => (
                          <SelectItem key={cur} value={cur} className="text-xs">
                            {cur}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="date" className="text-xs font-semibold">
                      Transaction Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-9 text-xs"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Client & Project Association */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  Client & Project Association
                </CardTitle>
                <CardDescription className="text-xs">
                  Link expense to client/project for profitability tracking (showing top 3–4 with search)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Client Account</Label>
                    <SearchableSelect
                      value={clientId}
                      onValueChange={(val) => {
                        setClientId(val);
                        setProjectId("");
                      }}
                      placeholder={clientsLoading ? "Loading clients..." : "Search client or leave overhead..."}
                      icon={Building2}
                      options={clientOptions}
                      maxDisplay={4}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Associated Project</Label>
                    <SearchableSelect
                      value={projectId}
                      onValueChange={setProjectId}
                      placeholder={projectsLoading ? "Loading projects..." : "Search project or none..."}
                      icon={FolderKanban}
                      options={projectOptions}
                      maxDisplay={4}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes & Justification */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  Description & Justification
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Textarea aria-label="Expense notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional context, invoice breakdown or commercial justification..."
                  className="text-xs min-h-[90px] resize-y"
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Billing & Receipt */}
          <div className="space-y-6">
            {/* Accounting & Billing Status */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="size-4 text-emerald-600" />
                  Accounting & Billing
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Approval Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger aria-label="Approval Status" className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value} className="text-xs">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start space-x-2.5 pt-3 border-t border-border/40">
                  <Checkbox
                    id="isBillable"
                    checked={isBillable}
                    onCheckedChange={(checked) => setIsBillable(Boolean(checked))}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="isBillable" className="text-xs font-semibold cursor-pointer">
                      Billable to Client
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Mark to include in client invoice recharges
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Receipt Upload */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="size-4 text-primary" />
                  Receipt & Invoice Proof
                </CardTitle>
                <CardDescription className="text-xs">
                  Attach voucher, GST invoice or payment slip
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                {receiptUrl ? (
                  <div className="p-3 rounded-lg border border-border/70 bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-4 text-primary shrink-0" />
                      <span className="text-xs font-medium text-primary truncate">
                        {receiptName || "Attached Receipt"}
                      </span>
                    </div>
                    <Button aria-label="Remove receipt"
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setReceiptUrl(null);
                        setReceiptName(null);
                      }}
                      className="text-destructive hover:text-destructive"
                      title="Remove receipt"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border/80 rounded-xl p-6 text-center hover:bg-muted/30 hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <Upload className="size-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs font-medium text-foreground">
                      {uploading ? "Uploading receipt..." : "Click to upload receipt"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, PNG, JPG up to 10MB
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
          <Button variant="outline" type="button" asChild disabled={submitting}>
            <Link href="/dashboard/expenses">Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting} className="gap-2 shadow-2xs">
            <CheckCircle2 className="size-4" />
            {submitting ? "Saving Expense..." : "Save Expense"}
          </Button>
        </div>
      </form>
    </div>
  );
}
