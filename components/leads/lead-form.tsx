"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Target,
  User,
  Building,
  Mail,
  Phone,
  Globe,
  DollarSign,
  Calendar,
  FileText,
  MapPin,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface LeadFormData {
  id?: string;
  title: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  city?: string | null;
  country?: string | null;
  source?: string | null;
  status: string;
  estimatedValue?: number | string | null;
  currency: string;
  assignedToId?: number | string | null;
  notes?: string | null;
  requirements?: string | null;
  nextFollowUp?: string | null;
}

interface LeadFormProps {
  initialData?: LeadFormData;
  isEditing?: boolean;
}

const SOURCES = [
  { value: "INBOUND", label: "Inbound Website / Contact Form" },
  { value: "INSTAGRAM", label: "Instagram DM / Campaign" },
  { value: "LINKEDIN", label: "LinkedIn Outreach" },
  { value: "REFERRAL", label: "Client Referral" },
  { value: "PAID_ADS", label: "Google / Meta Ads" },
  { value: "OUTBOUND", label: "Cold Email / Outbound" },
  { value: "EVENT", label: "Event / Conference" },
  { value: "OTHER", label: "Other Channel" },
];

const STAGES = [
  { value: "NEW", label: "New Inquiry" },
  { value: "CONTACTED", label: "Contacted / Intro Call" },
  { value: "QUALIFIED", label: "Qualified Opportunity" },
  { value: "PROPOSAL_SENT", label: "Proposal / Quote Sent" },
  { value: "WON", label: "Closed Won" },
  { value: "LOST", label: "Closed Lost" },
];

export function LeadForm({ initialData, isEditing = false }: LeadFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    name: initialData?.name || "",
    company: initialData?.company || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    website: initialData?.website || "",
    city: initialData?.city || "",
    country: initialData?.country || "India",
    source: initialData?.source || "INBOUND",
    status: initialData?.status || "NEW",
    estimatedValue: initialData?.estimatedValue ? String(initialData.estimatedValue) : "",
    currency: initialData?.currency || "INR",
    assignedToId: initialData?.assignedToId ? String(initialData.assignedToId) : "",
    nextFollowUp: initialData?.nextFollowUp ? initialData.nextFollowUp.split("T")[0] : "",
    requirements: initialData?.requirements || "",
    notes: initialData?.notes || "",
  });

  const { data: users = [] } = useSWR<any[]>("/api/users", fetcher);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Please enter a lead title or deal name.");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Please enter the contact person's name.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      title: formData.title.trim(),
      name: formData.name.trim(),
      company: formData.company.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      website: formData.website.trim() || null,
      city: formData.city.trim() || null,
      country: formData.country.trim() || null,
      source: formData.source,
      status: formData.status,
      estimatedValue: formData.estimatedValue ? Number(formData.estimatedValue) : null,
      currency: formData.currency,
      assignedToId: formData.assignedToId ? parseInt(formData.assignedToId, 10) : null,
      nextFollowUp: formData.nextFollowUp || null,
      requirements: formData.requirements.trim() || null,
      notes: formData.notes.trim() || null,
    };

    try {
      const url = isEditing && initialData?.id ? `/api/leads/${initialData.id}` : "/api/leads";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save lead");
      }

      toast.success(isEditing ? "Lead updated successfully!" : "Lead created successfully!");
      router.push(isEditing && initialData?.id ? `/dashboard/leads/${initialData.id}` : "/dashboard/leads");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-2xs border-border/70 max-w-4xl mx-auto">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground"
          >
            <Link
              href={isEditing && initialData?.id ? `/dashboard/leads/${initialData.id}` : "/dashboard/leads"}
              title="Back"
            >
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <CardTitle>{isEditing ? "Edit Sales Lead" : "Create New Sales Opportunity"}</CardTitle>
            <CardDescription className="text-xs">
              {isEditing
                ? "Update opportunity scope, commercial estimate, stage, and contact info."
                : "Record an inbound client inquiry or outbound prospecting deal for the sales pipeline."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Opportunity Headline */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
              <Target className="size-3.5 text-primary" />
              <span>Deal Opportunity</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="title" className="text-xs font-medium">
                  Opportunity Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. Q4 Social Media Retainer / Brand Identity Redesign"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs font-medium">
                  Pipeline Stage
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger id="status" className="h-9 text-xs">
                    <SelectValue placeholder="Select Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="source" className="text-xs font-medium">
                  Lead Channel / Source
                </Label>
                <Select
                  value={formData.source}
                  onValueChange={(val) => setFormData({ ...formData, source: val })}
                >
                  <SelectTrigger id="source" className="h-9 text-xs">
                    <SelectValue placeholder="Select Source" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((src) => (
                      <SelectItem key={src.value} value={src.value} className="text-xs">
                        {src.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="estimatedValue" className="text-xs font-medium">
                  Estimated Value (₹)
                </Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  placeholder="e.g. 75000"
                  value={formData.estimatedValue}
                  onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                  className="h-9 text-xs tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignedToId" className="text-xs font-medium">
                  Assigned Sales Rep / Manager
                </Label>
                <Select
                  value={formData.assignedToId || "unassigned"}
                  onValueChange={(val) =>
                    setFormData({ ...formData, assignedToId: val === "unassigned" ? "" : val })
                  }
                >
                  <SelectTrigger id="assignedToId" className="h-9 text-xs">
                    <SelectValue placeholder="Assign team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned" className="text-xs">
                      Unassigned
                    </SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)} className="text-xs">
                        {u.name} ({u.role?.name || "Member"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nextFollowUp" className="text-xs font-medium">
                  Next Follow-up Date
                </Label>
                <Input
                  id="nextFollowUp"
                  type="date"
                  value={formData.nextFollowUp}
                  onChange={(e) => setFormData({ ...formData, nextFollowUp: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
              <User className="size-3.5 text-primary" />
              <span>Contact & Company Details</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium">
                  Contact Person Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. Rajesh Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company" className="text-xs font-medium">
                  Company / Organization
                </Label>
                <Input
                  id="company"
                  placeholder="e.g. Nova Retail Labs"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@novalabs.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium">
                  Phone / WhatsApp Number
                </Label>
                <Input
                  id="phone"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-9 text-xs tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="website" className="text-xs font-medium">
                  Website / Social Link
                </Label>
                <Input
                  id="website"
                  placeholder="https://novalabs.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs font-medium">
                  City
                </Label>
                <Input
                  id="city"
                  placeholder="e.g. Bangalore"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="country" className="text-xs font-medium">
                  Country
                </Label>
                <Input
                  id="country"
                  placeholder="e.g. India"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Scope & Internal Notes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
              <FileText className="size-3.5 text-primary" />
              <span>Scope & Requirements</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="requirements" className="text-xs font-medium">
                Client Requirements & Deliverable Scope
              </Label>
              <Textarea
                id="requirements"
                placeholder="Required services, expected deliverables, timeline constraints, budget bracket..."
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-medium">
                Internal Sales Notes
              </Label>
              <Textarea
                id="notes"
                placeholder="Initial call summary, decision makers, follow-up pitch angles..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() =>
                router.push(isEditing && initialData?.id ? `/dashboard/leads/${initialData.id}` : "/dashboard/leads")
              }
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={isSubmitting}>
              {isEditing ? "Update Lead" : "Create Lead Opportunity"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
