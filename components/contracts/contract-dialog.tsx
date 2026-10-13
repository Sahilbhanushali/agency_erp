"use client";

import React, { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import {
  FileSignature,
  Calendar,
  Building,
  DollarSign,
  Upload,
  FileText,
  Clock,
  Layers,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  FileCheck,
  Hash,
  RefreshCw,
  Eye,
  ShieldCheck,
  Info,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchableSelect } from "@/components/ui/searchable-select";

export interface ContractData {
  id?: string;
  clientId: string;
  projectId?: string | null;
  contractNumber?: string | null;
  title: string;
  type: string;
  status: string;
  value: number | string;
  currency: string;
  billingCycle: string;
  startDate: string;
  endDate?: string | null;
  renewalDate?: string | null;
  autoRenew: boolean;
  noticePeriodDays: number | string;
  retainerHours?: number | string | null;
  deliverableQuota?: Record<string, number> | null;
  documentUrl?: string | null;
  signedAt?: string | null;
  signedBy?: string | null;
  notes?: string | null;
}

interface ContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: ContractData | null;
  preselectedClientId?: string;
  onSaved?: () => void;
}

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
  { value: "ACTIVE", label: "Active", variant: "success" },
  { value: "DRAFT", label: "Draft / Under Review", variant: "neutral" },
  { value: "EXPIRING_SOON", label: "Expiring Soon", variant: "warning" },
  { value: "EXPIRED", label: "Expired", variant: "destructive" },
  { value: "RENEWED", label: "Renewed", variant: "info" },
  { value: "TERMINATED", label: "Terminated", variant: "destructive" },
];

export function ContractDialog({
  open,
  onOpenChange,
  contract,
  preselectedClientId,
  onSaved,
}: ContractDialogProps) {
  const isEditing = !!contract?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("general");

  const { data: clientsData } = useSWR(open ? "/api/clients" : null, fetcher);
  const { data: projectsData } = useSWR(open ? "/api/projects" : null, fetcher);

  const clients = Array.isArray(clientsData) ? clientsData : clientsData?.clients || [];
  const projects = Array.isArray(projectsData) ? projectsData : projectsData?.projects || [];

  const [formData, setFormData] = useState<ContractData>({
    clientId: preselectedClientId || "",
    projectId: "",
    contractNumber: "",
    title: "",
    type: "RETAINER",
    status: "ACTIVE",
    value: "50000",
    currency: "INR",
    billingCycle: "MONTHLY",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    renewalDate: "",
    autoRenew: false,
    noticePeriodDays: "30",
    retainerHours: "",
    deliverableQuota: { posts: 12, reels: 8, stories: 15 },
    documentUrl: "",
    notes: "",
  });

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deliverable quota sub-inputs
  const [quotaPosts, setQuotaPosts] = useState<number>(12);
  const [quotaReels, setQuotaReels] = useState<number>(8);
  const [quotaStories, setQuotaStories] = useState<number>(15);

  useEffect(() => {
    if (contract) {
      setFormData({
        ...contract,
        contractNumber: contract.contractNumber || "",
        startDate: contract.startDate ? contract.startDate.split("T")[0] : "",
        endDate: contract.endDate ? contract.endDate.split("T")[0] : "",
        renewalDate: contract.renewalDate ? contract.renewalDate.split("T")[0] : "",
        value: String(contract.value || 0),
        noticePeriodDays: String(contract.noticePeriodDays || 30),
        retainerHours: contract.retainerHours ? String(contract.retainerHours) : "",
      });

      if (contract.deliverableQuota) {
        setQuotaPosts(Number(contract.deliverableQuota.posts || 0));
        setQuotaReels(Number(contract.deliverableQuota.reels || 0));
        setQuotaStories(Number(contract.deliverableQuota.stories || 0));
      }
    } else {
      const today = new Date();
      const inOneMonth = new Date(today);
      inOneMonth.setMonth(inOneMonth.getMonth() + 1);

      setFormData({
        clientId: preselectedClientId || (clients[0]?.id || ""),
        projectId: "",
        contractNumber: "",
        title: "Monthly Agency Retainer Agreement",
        type: "RETAINER",
        status: "ACTIVE",
        value: "50000",
        currency: "INR",
        billingCycle: "MONTHLY",
        startDate: today.toISOString().split("T")[0],
        endDate: inOneMonth.toISOString().split("T")[0],
        renewalDate: inOneMonth.toISOString().split("T")[0],
        autoRenew: true,
        noticePeriodDays: "30",
        retainerHours: "40",
        deliverableQuota: { posts: 12, reels: 8, stories: 15 },
        documentUrl: "",
        notes: "",
      });
      setQuotaPosts(12);
      setQuotaReels(8);
      setQuotaStories(15);
    }
    setActiveTab("general");
  }, [contract, preselectedClientId, open]);

  // Filter projects by selected client
  const filteredProjects = projects.filter(
    (p: any) => !formData.clientId || p.clientId === formData.clientId
  );

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
      toast.success("Agreement document uploaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      toast.error("Contract title is required");
      setActiveTab("general");
      return;
    }
    if (!formData.clientId) {
      toast.error("Please select a client account");
      setActiveTab("general");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        contractNumber: formData.contractNumber?.trim() || null,
        value: Number(formData.value) || 0,
        noticePeriodDays: Number(formData.noticePeriodDays) || 30,
        retainerHours: formData.retainerHours ? Number(formData.retainerHours) : null,
        deliverableQuota:
          formData.type === "RETAINER"
            ? { posts: quotaPosts, reels: quotaReels, stories: quotaStories }
            : null,
      };

      const url = isEditing ? `/api/contracts/${contract!.id}` : "/api/contracts";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save agreement");
      }

      toast.success(isEditing ? "Contract updated successfully" : "Contract agreement registered");
      onOpenChange(false);
      if (onSaved) onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save contract");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileSignature className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  {isEditing ? "Edit Contract Agreement" : "Register New Client Contract"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {isEditing
                    ? `Modifying contract reference and SLA terms for ${formData.title}`
                    : "Create binding service contracts, retainers, and deliverable commitments."}
                </DialogDescription>
              </div>
            </div>

            {/* Live Status Indicators */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">
                {CONTRACT_TYPES.find((t) => t.value === formData.type)?.label.split(" ")[0] || formData.type}
              </Badge>
              <Badge
                variant={
                  (CONTRACT_STATUSES.find((s) => s.value === formData.status)?.variant as any) || "neutral"
                }
                className="text-xs px-2.5 py-0.5 font-bold uppercase tracking-wider"
              >
                {formData.status.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Form Body with Tabbed Layout */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-3 border-b border-border/60 bg-background">
              <TabsList className="bg-muted/60 p-1 rounded-lg border border-border/40 grid grid-cols-4 w-full sm:w-auto sm:inline-flex">
                <TabsTrigger value="general" className="text-xs gap-1.5 py-1.5 font-medium">
                  <Building className="size-3.5" />
                  <span>General & Parties</span>
                </TabsTrigger>
                <TabsTrigger value="commercials" className="text-xs gap-1.5 py-1.5 font-medium">
                  <DollarSign className="size-3.5" />
                  <span>Commercials & SOW</span>
                </TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs gap-1.5 py-1.5 font-medium">
                  <Calendar className="size-3.5" />
                  <span>Dates & Renewal</span>
                </TabsTrigger>
                <TabsTrigger value="documents" className="text-xs gap-1.5 py-1.5 font-medium">
                  <FileText className="size-3.5" />
                  <span>SOW Document & Notes</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: GENERAL & PARTIES */}
              <TabsContent value="general" className="m-0 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Client Account *</Label>
                    <SearchableSelect
                      value={formData.clientId}
                      onValueChange={(val) => setFormData({ ...formData, clientId: val, projectId: "" })}
                      disabled={!!preselectedClientId}
                      placeholder="Select client account..."
                      icon={Building}
                      options={clients.map((c: any) => ({
                        id: c.id,
                        label: c.name || "Client",
                        subLabel: c.company ? `${c.company} • ${c.email}` : c.email,
                      }))}
                      maxDisplay={4}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Associated Project (Optional)</Label>
                    <SearchableSelect
                      value={formData.projectId || ""}
                      onValueChange={(val) => setFormData({ ...formData, projectId: val || null })}
                      placeholder="Select project..."
                      icon={FolderKanban}
                      options={[
                        { id: "", label: "Entire Client Account (Retainer-wide)" },
                        ...filteredProjects.map((p: any) => ({
                          id: p.id,
                          label: p.name,
                        })),
                      ]}
                      maxDisplay={4}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Agreement Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Monthly Social Media Retainer & Brand Management"
                    className="h-10 text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Contract Reference #</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input
                        value={formData.contractNumber || ""}
                        onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                        placeholder="e.g. CNT-2026-001"
                        className="h-10 text-xs font-mono pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Agreement Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(val) => setFormData({ ...formData, type: val })}
                    >
                      <SelectTrigger className="h-10 text-xs">
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
                    <Label className="text-xs font-semibold">Contract Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(val) => setFormData({ ...formData, status: val })}
                    >
                      <SelectTrigger className="h-10 text-xs">
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
              </TabsContent>

              {/* TAB 2: COMMERCIALS & SOW */}
              <TabsContent value="commercials" className="m-0 space-y-5">
                <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <DollarSign className="size-4 text-emerald-600" />
                    <span>Commercial Remittance & Invoicing Cadence</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Contract Value (INR) *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                          ₹
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.value}
                          onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                          className="h-10 text-xs font-mono font-bold pl-7"
                          placeholder="50000"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Billing Cadence</Label>
                      <Select
                        value={formData.billingCycle}
                        onValueChange={(val) => setFormData({ ...formData, billingCycle: val })}
                      >
                        <SelectTrigger className="h-10 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BILLING_CYCLES.map((b) => (
                            <SelectItem key={b.value} value={b.value} className="text-xs">
                              {b.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Allocated Hours / Cycle</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                          type="number"
                          min="0"
                          value={formData.retainerHours || ""}
                          onChange={(e) => setFormData({ ...formData, retainerHours: e.target.value })}
                          className="h-10 text-xs font-mono pl-9"
                          placeholder="e.g. 40"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scope & Deliverables Allowance */}
                <div className="p-4 rounded-xl border border-border/70 bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <Layers className="size-4 text-primary" />
                      <span>Monthly Scope & Content Deliverables Allowance</span>
                    </div>
                    {formData.type === "RETAINER" ? (
                      <Badge variant="success" className="text-[10px]">
                        Included in Retainer
                      </Badge>
                    ) : (
                      <Badge variant="neutral" className="text-[10px]">
                        Fixed Milestone
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div className="p-3 rounded-lg border border-border/60 bg-muted/10 space-y-1.5">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Static Image Posts / Carousels
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={quotaPosts}
                        onChange={(e) => setQuotaPosts(Number(e.target.value) || 0)}
                        className="h-9 text-xs font-mono font-bold"
                      />
                    </div>

                    <div className="p-3 rounded-lg border border-border/60 bg-muted/10 space-y-1.5">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Video Reels & Motion Shorts
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={quotaReels}
                        onChange={(e) => setQuotaReels(Number(e.target.value) || 0)}
                        className="h-9 text-xs font-mono font-bold"
                      />
                    </div>

                    <div className="p-3 rounded-lg border border-border/60 bg-muted/10 space-y-1.5">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Stories & Micro-Updates
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={quotaStories}
                        onChange={(e) => setQuotaStories(Number(e.target.value) || 0)}
                        className="h-9 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: DATES & RENEWAL */}
              <TabsContent value="timeline" className="m-0 space-y-5">
                <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Calendar className="size-4 text-primary" />
                    <span>Term Validity & Milestones</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Effective Start Date *</Label>
                      <Input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="h-10 text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Contract End Date</Label>
                      <Input
                        type="date"
                        value={formData.endDate || ""}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="h-10 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Renewal Review Date</Label>
                      <Input
                        type="date"
                        value={formData.renewalDate || ""}
                        onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
                        className="h-10 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Auto-Renewal Governance */}
                <div className="p-4 rounded-xl border border-border/70 bg-card space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-foreground">Auto-Renewal Clause</div>
                      <p className="text-[11px] text-muted-foreground">
                        Automatically renew the contract upon reaching the end date unless notice is served.
                      </p>
                    </div>
                    <Switch
                      checked={formData.autoRenew}
                      onCheckedChange={(checked) => setFormData({ ...formData, autoRenew: checked })}
                    />
                  </div>

                  <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold">Cancellation Notice Period</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Days prior to renewal where notice must be submitted.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min="0"
                        value={formData.noticePeriodDays}
                        onChange={(e) => setFormData({ ...formData, noticePeriodDays: e.target.value })}
                        className="h-9 w-24 text-xs font-mono font-bold text-right"
                      />
                      <span className="text-xs text-muted-foreground font-medium">Days</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 4: DOCUMENTS & NOTES */}
              <TabsContent value="documents" className="m-0 space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Signed SOW Agreement Document (PDF/DOCX)</Label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.doc,.docx,.png,.jpg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />

                  {formData.documentUrl ? (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                          <FileCheck className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-foreground">
                            {formData.documentUrl.split("/").pop()}
                          </p>
                          <a
                            href={formData.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1 mt-0.5"
                          >
                            <Eye className="size-3" />
                            View Attached SOW
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="text-xs h-8"
                        >
                          Replace File
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setFormData({ ...formData, documentUrl: "" })}
                          className="text-destructive hover:bg-destructive/10 size-8"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer border-2 border-dashed border-border/80 hover:border-primary/50 hover:bg-muted/15 transition-all rounded-xl p-8 text-center space-y-2"
                    >
                      <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                        <Upload className="size-5" />
                      </div>
                      <p className="text-xs font-bold text-foreground">
                        {isUploading ? "Uploading agreement..." : "Click to upload signed SOW or Contract PDF"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Supports PDF, Word Documents (.docx), scans up to 15MB
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Internal Notes & Special Terms</Label>
                  <Textarea
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Record custom SLA commitments, penalty clauses, or contract renewal notes..."
                    className="text-xs min-h-[90px] resize-none"
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {/* Sticky Footer */}
          <DialogFooter className="p-4 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-between">
            <div className="text-[11px] text-muted-foreground hidden sm:block">
              {formData.clientId ? `Client: ${clients.find((c: any) => c.id === formData.clientId)?.name || "Selected"}` : "Select client"}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || isUploading}
                className="text-xs h-9 px-4 font-bold"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="mr-2 size-3.5 animate-spin" />
                    Saving...
                  </>
                ) : isEditing ? (
                  "Save Contract Changes"
                ) : (
                  "Create Agreement"
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
