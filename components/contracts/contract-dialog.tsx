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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft / Under Review" },
  { value: "EXPIRING_SOON", label: "Expiring Soon" },
  { value: "EXPIRED", label: "Expired" },
  { value: "RENEWED", label: "Renewed" },
  { value: "TERMINATED", label: "Terminated" },
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

  const { data: clientsData } = useSWR(open ? "/api/clients" : null, fetcher);
  const { data: projectsData } = useSWR(open ? "/api/projects" : null, fetcher);

  const clients = Array.isArray(clientsData) ? clientsData : clientsData?.clients || [];
  const projects = Array.isArray(projectsData) ? projectsData : projectsData?.projects || [];

  const [formData, setFormData] = useState<ContractData>({
    clientId: preselectedClientId || "",
    projectId: "",
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
        ...formData,
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileSignature className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {isEditing ? `Edit Contract — ${formData.title}` : "New Client Contract / Retainer"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Record service agreements, monthly retainers, deliverable allowances, and renewal schedules.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-3">
          {/* Top Row: Client & Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Client Account *</Label>
              <SearchableSelect
                value={formData.clientId}
                onValueChange={(val) => setFormData({ ...formData, clientId: val, projectId: "" })}
                disabled={!!preselectedClientId}
                placeholder="Search client..."
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
              <Label className="text-xs font-medium">Associated Project / Campaign (Optional)</Label>
              <SearchableSelect
                value={formData.projectId || ""}
                onValueChange={(val) => setFormData({ ...formData, projectId: val || null })}
                placeholder="Select project..."
                icon={FolderKanban}
                options={[
                  { id: "", label: "Entire Client Account (No specific project)" },
                  ...filteredProjects.map((p: any) => ({
                    id: p.id,
                    label: p.name,
                  })),
                ]}
                maxDisplay={4}
              />
            </div>
          </div>

          {/* Title & Agreement Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium">Agreement Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Monthly Social Media Retainer (2026)"
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Agreement Type</Label>
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
          </div>

          {/* Financials & Billing Cycle */}
          <div className="rounded-xl border border-border/70 p-4 bg-muted/15 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <DollarSign className="size-4 text-primary" />
              <span>Financial Terms & Remittance</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Contract Value (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="h-8 text-xs font-mono"
                  placeholder="50000"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Billing Cadence</Label>
                <Select
                  value={formData.billingCycle}
                  onValueChange={(val) => setFormData({ ...formData, billingCycle: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
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

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Allocated Retainer Hours / Cycle</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.retainerHours || ""}
                  onChange={(e) => setFormData({ ...formData, retainerHours: e.target.value })}
                  className="h-8 text-xs font-mono"
                  placeholder="e.g. 40 hours"
                />
              </div>
            </div>
          </div>

          {/* Timeline & Renewal Governance */}
          <div className="rounded-xl border border-border/70 p-4 bg-muted/15 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Calendar className="size-4 text-primary" />
                <span>Agreement Schedule & Renewal Governance</span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Notice Period: {formData.noticePeriodDays} Days
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Effective Start Date *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Agreement End Date</Label>
                <Input
                  type="date"
                  value={formData.endDate || ""}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Renewal Review Date</Label>
                <Input
                  type="date"
                  value={formData.renewalDate || ""}
                  onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border/60">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoRenew"
                  checked={formData.autoRenew}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, autoRenew: !!checked })
                  }
                />
                <Label htmlFor="autoRenew" className="text-xs font-medium cursor-pointer">
                  Auto-Renew agreement unless cancelled before notice window
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground whitespace-nowrap">
                  Notice Window (Days):
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.noticePeriodDays}
                  onChange={(e) => setFormData({ ...formData, noticePeriodDays: e.target.value })}
                  className="h-7 w-20 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Deliverable Quota Allowance (For Retainers) */}
          {formData.type === "RETAINER" && (
            <div className="rounded-xl border border-border/70 p-4 bg-muted/15 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Layers className="size-4 text-primary" />
                  <span>Monthly Deliverables Allowance (SOW Quota)</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  Recurring Allowance
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Static Posts</Label>
                  <Input
                    type="number"
                    min="0"
                    value={quotaPosts}
                    onChange={(e) => setQuotaPosts(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Video Reels / TikTok</Label>
                  <Input
                    type="number"
                    min="0"
                    value={quotaReels}
                    onChange={(e) => setQuotaReels(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Stories</Label>
                  <Input
                    type="number"
                    min="0"
                    value={quotaStories}
                    onChange={(e) => setQuotaStories(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Signed Document Upload */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Signed Agreement / SOW Document (PDF)</Label>
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
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileCheck className="size-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">
                      {formData.documentUrl.split("/").pop()}
                    </p>
                    <a
                      href={formData.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-primary hover:underline"
                    >
                      View uploaded document
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setFormData({ ...formData, documentUrl: "" })}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-border/80 hover:border-primary/50 hover:bg-muted/10 transition-colors rounded-lg p-5 text-center space-y-1"
              >
                <Upload className="size-5 mx-auto text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">
                  {isUploading ? "Uploading document..." : "Click to upload signed SOW or Contract PDF"}
                </p>
                <p className="text-[10px] text-muted-foreground">PDF, DOCX, or scan up to 15MB</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Internal Notes & Special Terms</Label>
            <Textarea
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Record custom SLA commitments, penalty clauses, or renewal history..."
              className="text-xs resize-none"
              rows={2}
            />
          </div>

          <DialogFooter className="pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting || isUploading}>
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Agreement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
