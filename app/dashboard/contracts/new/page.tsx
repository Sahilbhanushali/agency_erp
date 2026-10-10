"use client";

import React, { useState, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import toast from "react-hot-toast";
import {
  FileSignature,
  Building,
  FolderKanban,
  DollarSign,
  Calendar,
  Upload,
  FileText,
  Clock,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Paperclip,
  Trash2,
  Layers,
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CONTRACT_TYPES = [
  { value: "RETAINER", label: "Monthly / Recurring Retainer" },
  { value: "FIXED_SOW", label: "Fixed-Scope Statement of Work (SOW)" },
  { value: "MASTER_SERVICES_AGREEMENT", label: "Master Services Agreement (MSA)" },
  { value: "NDA", label: "Non-Disclosure Agreement (NDA)" },
  { value: "ONE_TIME", label: "One-Time Project Agreement" },
  { value: "CUSTOM", label: "Custom Agreement" },
];

const BILLING_CYCLES = [
  { value: "MONTHLY", label: "Monthly Billing" },
  { value: "QUARTERLY", label: "Quarterly Billing" },
  { value: "ANNUALLY", label: "Annual Billing" },
  { value: "ONE_TIME", label: "One-Time Milestone" },
];

const CONTRACT_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft / Under Review" },
  { value: "EXPIRING_SOON", label: "Expiring Soon" },
  { value: "EXPIRED", label: "Expired" },
  { value: "RENEWED", label: "Renewed" },
  { value: "TERMINATED", label: "Terminated" },
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "CAD", "AUD"];

export default function NewContractPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams?.get("clientId") || "";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clientsData, isLoading: clientsLoading } = useSWR("/api/clients", fetcher);
  const { data: projectsData, isLoading: projectsLoading } = useSWR("/api/projects", fetcher);

  const clients = useMemo(() => {
    return Array.isArray(clientsData) ? clientsData : clientsData?.clients || [];
  }, [clientsData]);

  const projects = useMemo(() => {
    return Array.isArray(projectsData) ? projectsData : projectsData?.projects || [];
  }, [projectsData]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const inOneMonthStr = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  }, []);

  const [formData, setFormData] = useState({
    clientId: preselectedClientId,
    projectId: "",
    title: "Monthly Agency Retainer Agreement",
    type: "RETAINER",
    status: "ACTIVE",
    value: "50000",
    currency: "INR",
    billingCycle: "MONTHLY",
    startDate: todayStr,
    endDate: inOneMonthStr,
    renewalDate: inOneMonthStr,
    autoRenew: true,
    noticePeriodDays: "30",
    retainerHours: "40",
    documentUrl: "",
    notes: "",
  });

  const [quotaPosts, setQuotaPosts] = useState<number>(12);
  const [quotaReels, setQuotaReels] = useState<number>(8);
  const [quotaStories, setQuotaStories] = useState<number>(15);

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client options for SearchableSelect
  const clientOptions = useMemo(() => {
    return clients.map((c: any) => ({
      id: c.id,
      label: c.name || "Client",
      subLabel: c.company ? `${c.company} • ${c.email}` : c.email,
    }));
  }, [clients]);

  // Project options for SearchableSelect filtered by client
  const projectOptions = useMemo(() => {
    const filtered = formData.clientId
      ? projects.filter((p: any) => p.clientId === formData.clientId)
      : projects;
    return [
      { id: "", label: "None / Agency Direct", subLabel: "No specific project" },
      ...filtered.map((p: any) => ({
        id: p.id,
        label: p.name || "Unnamed Project",
        subLabel: p.client?.name ? `Client: ${p.client.name}` : undefined,
      })),
    ];
  }, [projects, formData.clientId]);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      if (formData.documentUrl) {
        uploadForm.append("oldUrl", formData.documentUrl);
      }

      const res = await fetch("/api/contracts/upload", {
        method: "POST",
        body: uploadForm,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setFormData((prev) => ({ ...prev, documentUrl: data.url }));
      toast.success("Agreement PDF uploaded");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clientId) {
      toast.error("Please select a client");
      return;
    }
    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!formData.startDate) {
      toast.error("Please select a start date");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        clientId: formData.clientId,
        projectId: formData.projectId || undefined,
        title: formData.title.trim(),
        type: formData.type,
        status: formData.status,
        value: Number(formData.value) || 0,
        currency: formData.currency,
        billingCycle: formData.billingCycle,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        renewalDate: formData.renewalDate || undefined,
        autoRenew: formData.autoRenew,
        noticePeriodDays: Number(formData.noticePeriodDays) || 30,
        retainerHours: formData.retainerHours ? Number(formData.retainerHours) : null,
        deliverableQuota:
          formData.type === "RETAINER" || formData.type === "FIXED_SOW"
            ? { posts: quotaPosts, reels: quotaReels, stories: quotaStories }
            : null,
        documentUrl: formData.documentUrl || undefined,
        notes: formData.notes.trim() || undefined,
      };

      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create contract");
      }

      toast.success("Agreement registered successfully");
      router.push(`/dashboard/contracts/${data.contract.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to register contract");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in-50 duration-200">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/contracts">
            <ArrowLeft className="size-4" /> Back to Agreements
          </Link>
        </Button>
      </div>

      <PageHeader
        title="New Agreement / Statement of Work"
        description="Configure retainer parameters, commercial billing cycles, deliverable quotas, and auto-renewal timelines."
        badge={
          <Badge variant="outline" className="font-mono text-xs">
            Contract Generator
          </Badge>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main 2-column info */}
          <div className="lg:col-span-2 space-y-6">
            {/* General Agreement Classification */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSignature className="size-4 text-primary" />
                  Agreement Classification
                </CardTitle>
                <CardDescription className="text-xs">
                  Basic agreement identity and legal nature
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs font-semibold">
                    Agreement Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Annual Digital Marketing Retainer"
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Agreement Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(val) => setFormData({ ...formData, type: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTRACT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value} className="text-xs">
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Initial Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(val) => setFormData({ ...formData, status: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTRACT_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value} className="text-xs">
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Client & Project Assignment */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building className="size-4 text-primary" />
                  Client & Project Association
                </CardTitle>
                <CardDescription className="text-xs">
                  Searchable account linkage with immediate record filtering
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Client Account <span className="text-destructive">*</span>
                    </Label>
                    <SearchableSelect
                      value={formData.clientId}
                      onValueChange={(val) => {
                        setFormData((prev) => ({ ...prev, clientId: val, projectId: "" }));
                      }}
                      placeholder={clientsLoading ? "Loading clients..." : "Search and select client..."}
                      icon={Building}
                      options={clientOptions}
                      maxDisplay={4}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Associated Project (Optional)</Label>
                    <SearchableSelect
                      value={formData.projectId}
                      onValueChange={(val) => setFormData((prev) => ({ ...prev, projectId: val }))}
                      placeholder={projectsLoading ? "Loading projects..." : "Select project..."}
                      icon={FolderKanban}
                      options={projectOptions}
                      maxDisplay={4}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Commercial Terms & Fee Structure */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="size-4 text-emerald-600" />
                  Commercials & Billing Structure
                </CardTitle>
                <CardDescription className="text-xs">
                  Financial valuation, currency and recurring cadence
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="value" className="text-xs font-semibold">
                      Fee Amount
                    </Label>
                    <Input
                      id="value"
                      type="number"
                      min="0"
                      step="any"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      placeholder="50000"
                      className="h-9 text-xs tabular-nums"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(val) => setFormData({ ...formData, currency: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c} className="text-xs">
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Billing Frequency</Label>
                    <Select
                      value={formData.billingCycle}
                      onValueChange={(val) => setFormData({ ...formData, billingCycle: val })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BILLING_CYCLES.map((bc) => (
                          <SelectItem key={bc.value} value={bc.value} className="text-xs">
                            {bc.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deliverables Quota (if Retainer or Fixed SOW) */}
            {(formData.type === "RETAINER" || formData.type === "FIXED_SOW") && (
              <Card className="shadow-2xs">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="size-4 text-violet-600" />
                    Deliverable Quotas & Hourly Allocation
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Allowances per billing cycle tracked automatically against project activities
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5 p-3 rounded-lg border border-border/60 bg-muted/20">
                      <Label className="text-[11px] font-medium text-muted-foreground uppercase">
                        Posts Quota
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={quotaPosts}
                        onChange={(e) => setQuotaPosts(Number(e.target.value) || 0)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5 p-3 rounded-lg border border-border/60 bg-muted/20">
                      <Label className="text-[11px] font-medium text-muted-foreground uppercase">
                        Reels Quota
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={quotaReels}
                        onChange={(e) => setQuotaReels(Number(e.target.value) || 0)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5 p-3 rounded-lg border border-border/60 bg-muted/20">
                      <Label className="text-[11px] font-medium text-muted-foreground uppercase">
                        Stories Quota
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={quotaStories}
                        onChange={(e) => setQuotaStories(Number(e.target.value) || 0)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5 p-3 rounded-lg border border-border/60 bg-muted/20">
                      <Label className="text-[11px] font-medium text-muted-foreground uppercase">
                        Retainer Hours
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.retainerHours}
                        onChange={(e) => setFormData({ ...formData, retainerHours: e.target.value })}
                        placeholder="e.g. 40"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Schedule & Document Upload */}
          <div className="space-y-6">
            {/* Timeline & Renewal Governance */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="size-4 text-sky-600" />
                  Schedule & Renewal Terms
                </CardTitle>
                <CardDescription className="text-xs">
                  Automated renewal dates & governance
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate" className="text-xs font-semibold">
                    Agreement Start Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="endDate" className="text-xs font-semibold">
                    End Date (Optional)
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="renewalDate" className="text-xs font-semibold">
                    Next Renewal Date
                  </Label>
                  <Input
                    id="renewalDate"
                    type="date"
                    value={formData.renewalDate}
                    onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="noticePeriodDays" className="text-xs font-semibold">
                    Notice Period (Days)
                  </Label>
                  <Input
                    id="noticePeriodDays"
                    type="number"
                    min="0"
                    value={formData.noticePeriodDays}
                    onChange={(e) => setFormData({ ...formData, noticePeriodDays: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-2 border-t border-border/40">
                  <Checkbox
                    id="autoRenew"
                    checked={formData.autoRenew}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, autoRenew: Boolean(checked) })
                    }
                  />
                  <Label htmlFor="autoRenew" className="text-xs font-medium cursor-pointer">
                    Auto-renew agreement upon expiration
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Document Upload */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="size-4 text-primary" />
                  Signed PDF Agreement
                </CardTitle>
                <CardDescription className="text-xs">
                  Attach signed legal agreement or SOW document
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />

                {formData.documentUrl ? (
                  <div className="p-3 rounded-lg border border-border/70 bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-4 text-primary shrink-0" />
                      <a
                        href={formData.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-primary hover:underline truncate"
                      >
                        Attached Agreement File
                      </a>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setFormData({ ...formData, documentUrl: "" })}
                      className="text-destructive hover:text-destructive"
                      title="Remove file"
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
                      {isUploading ? "Uploading file..." : "Click to upload contract PDF"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      PDF or DOCX up to 15MB
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes / Special Clauses */}
            <Card className="shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  Notes & Special Clauses
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Special milestones, termination conditions, or custom scope terms..."
                  className="text-xs min-h-[90px] resize-y"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
          <Button variant="outline" type="button" asChild disabled={isSubmitting}>
            <Link href="/dashboard/contracts">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2 shadow-2xs">
            <CheckCircle2 className="size-4" />
            {isSubmitting ? "Creating Agreement..." : "Create Agreement"}
          </Button>
        </div>
      </form>
    </div>
  );
}
