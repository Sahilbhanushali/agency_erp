"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  CreditCard,
  FileText,
  Upload,
  X,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Briefcase,
  Layers,
} from "lucide-react";
import { getMediaUrl } from "@/lib/utils";

export interface ClientData {
  id?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  altPhone?: string | null;
  company?: string | null;
  website?: string | null;
  industry?: string | null;
  status?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  gstin?: string | null;
  panNumber?: string | null;
  notes?: string | null;
  avatar?: string | null;
}

interface ClientFormProps {
  client?: ClientData;
}

const INDUSTRIES = [
  "E-Commerce & Retail",
  "Technology & SaaS",
  "Healthcare & Wellness",
  "Real Estate & Construction",
  "Food, Hospitality & Dining",
  "Fashion & Lifestyle",
  "Finance & Legal",
  "Education & EdTech",
  "Media, Entertainment & Gaming",
  "Automotive & Mobility",
  "Creative & Marketing Agency",
  "Other Industry",
];

export function ClientForm({ client }: ClientFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: client?.name || "",
    company: client?.company || "",
    email: client?.email || "",
    phone: client?.phone || "",
    altPhone: client?.altPhone || "",
    website: client?.website || "",
    industry: client?.industry || "Technology & SaaS",
    status: client?.status || "ACTIVE",
    address: client?.address || "",
    city: client?.city || "",
    state: client?.state || "",
    country: client?.country || "India",
    postalCode: client?.postalCode || "",
    gstin: client?.gstin || "",
    panNumber: client?.panNumber || "",
    notes: client?.notes || "",
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(client?.avatar ? getMediaUrl(client.avatar) : null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Update preview when file changes
  useEffect(() => {
    if (avatarFile) {
      const objectUrl = URL.createObjectURL(avatarFile);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (removeAvatar) {
      setPreviewUrl(null);
    } else if (client?.avatar) {
      setPreviewUrl(getMediaUrl(client.avatar));
    }
  }, [avatarFile, removeAvatar, client?.avatar]);

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size should be less than 5MB.");
      return;
    }
    setAvatarFile(file);
    setRemoveAvatar(false);
  };

  const handleRemoveImage = () => {
    setAvatarFile(null);
    setRemoveAvatar(true);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getInitials = (text: string) => {
    if (!text) return "CL";
    const parts = text.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return text.substring(0, 2).toUpperCase();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Client name is required.");
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (formData.email.trim() && !emailRegex.test(formData.email.trim())) {
      toast.error("Please enter a valid email address (e.g. contact@client.com).");
      return;
    }

    setIsLoading(true);

    const url = client?.id ? `/api/clients/${client.id}` : "/api/clients";
    const method = client?.id ? "PUT" : "POST";

    const form = new FormData();
    form.append("name", formData.name.trim());
    form.append("company", formData.company.trim());
    form.append("email", formData.email.trim());
    form.append("phone", formData.phone.trim());
    form.append("altPhone", formData.altPhone.trim());
    form.append("website", formData.website.trim());
    form.append("industry", formData.industry.trim());
    form.append("status", formData.status);
    form.append("address", formData.address.trim());
    form.append("city", formData.city.trim());
    form.append("state", formData.state.trim());
    form.append("country", formData.country.trim());
    form.append("postalCode", formData.postalCode.trim());
    form.append("gstin", formData.gstin.trim());
    form.append("panNumber", formData.panNumber.trim());
    form.append("notes", formData.notes.trim());

    if (avatarFile) {
      form.append("avatar", avatarFile);
    } else if (removeAvatar) {
      form.append("removeAvatar", "true");
    }

    try {
      const response = await fetch(url, { method, body: form });

      if (response.ok) {
        toast.success(client?.id ? "Client profile updated!" : "Client account created successfully!");
        setTimeout(() => {
          router.push(client?.id ? `/dashboard/clients/${client.id}` : "/dashboard/clients");
          router.refresh();
        }, 600);
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || "Failed to save client details");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An unexpected error occurred while saving client details");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 2-Column Responsive Layout: Left Form (7 cols) + Right Preview (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Cards */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Identity & Branding */}
          <Card className="shadow-2xs border-border/70">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                Organization & Brand Identity
              </CardTitle>
              <CardDescription className="text-xs">
                Essential naming, brand identifiers, and industry classification.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              {/* Brand Logo Upload Field */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Brand Logo / Avatar</Label>
                <div className="flex items-center gap-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files?.[0]) {
                        handleFileSelect(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative flex items-center justify-center size-20 rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
                      isDragOver
                        ? "border-primary bg-primary/5 scale-102"
                        : "border-border/80 hover:border-foreground/40 bg-muted/30"
                    }`}
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Logo preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2 text-center text-muted-foreground">
                        <Upload className="size-5 mb-1" />
                        <span className="text-[10px] font-medium leading-none">Upload</span>
                      </div>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                    }}
                  />

                  <div className="flex-1 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {previewUrl ? "Change Logo" : "Choose Image"}
                      </Button>
                      {previewUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:bg-destructive/10"
                          onClick={handleRemoveImage}
                        >
                          <X className="size-3.5 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      PNG, JPG, SVG, or WebP. Recommended square aspect ratio (e.g. 400×400px).
                    </p>
                  </div>
                </div>
              </div>

              {/* Name & Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="client-name" className="text-xs font-medium">
                    Client / Contact Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="client-name"
                    placeholder="e.g. Sarah Jenkins"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client-company" className="text-xs font-medium">
                    Company / Organization Brand
                  </Label>
                  <Input
                    id="client-company"
                    placeholder="e.g. Lumina Cosmetics Inc."
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Industry & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="client-industry" className="text-xs font-medium">
                    Industry / Market Vertical
                  </Label>
                  <Select
                    value={formData.industry}
                    onValueChange={(val) => setFormData({ ...formData, industry: val })}
                  >
                    <SelectTrigger id="client-industry" className="h-9 text-xs">
                      <SelectValue placeholder="Select vertical" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind} className="text-xs">
                          {ind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client-status" className="text-xs font-medium">
                    Account Status
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val) => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger id="client-status" className="h-9 text-xs">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE" className="text-xs">
                        Active Client
                      </SelectItem>
                      <SelectItem value="ONBOARDING" className="text-xs">
                        Onboarding / Setup
                      </SelectItem>
                      <SelectItem value="INACTIVE" className="text-xs">
                        Inactive / Paused
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Website */}
              <div className="space-y-1.5">
                <Label htmlFor="client-website" className="text-xs font-medium">
                  Website URL
                </Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    id="client-website"
                    placeholder="https://clientbrand.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="h-9 pl-9 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Contact Information */}
          <Card className="shadow-2xs border-border/70">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="size-4 text-primary" />
                Contact & Communication Channels
              </CardTitle>
              <CardDescription className="text-xs">
                Direct phone lines, team emails, and secondary contacts for campaign updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="client-email" className="text-xs font-medium">
                  Official Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    id="client-email"
                    type="email"
                    placeholder="contact@clientbrand.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-9 pl-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="client-phone" className="text-xs font-medium">
                    Primary Phone / WhatsApp
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      id="client-phone"
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="h-9 pl-9 text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client-altPhone" className="text-xs font-medium">
                    Secondary / Alternate Phone
                  </Label>
                  <Input
                    id="client-altPhone"
                    placeholder="e.g. 9123456789"
                    value={formData.altPhone}
                    onChange={(e) => setFormData({ ...formData, altPhone: e.target.value })}
                    className="h-9 text-xs tabular-nums"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Tax Identification & Billing Address */}
          <Card className="shadow-2xs border-border/70">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                Tax Identifiers & Billing Address
              </CardTitle>
              <CardDescription className="text-xs">
                Commercial records printed on formal proposals and GST tax invoices.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="client-gstin" className="text-xs font-medium">
                    GSTIN / Tax ID
                  </Label>
                  <Input
                    id="client-gstin"
                    placeholder="27AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    className="h-9 text-xs font-mono uppercase"
                    maxLength={15}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client-pan" className="text-xs font-medium">
                    PAN Number
                  </Label>
                  <Input
                    id="client-pan"
                    placeholder="ABCDE1234F"
                    value={formData.panNumber}
                    onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                    className="h-9 text-xs font-mono uppercase"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-address" className="text-xs font-medium">
                  Street Address / Corporate Suite
                </Label>
                <Input
                  id="client-address"
                  placeholder="Suite 402, Apex Commercial Tower, MG Road"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="client-city" className="text-xs font-medium">
                    City
                  </Label>
                  <Input
                    id="client-city"
                    placeholder="Mumbai"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client-state" className="text-xs font-medium">
                    State
                  </Label>
                  <Input
                    id="client-state"
                    placeholder="Maharashtra"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client-pincode" className="text-xs font-medium">
                    PIN / Postal
                  </Label>
                  <Input
                    id="client-pincode"
                    placeholder="400001"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="h-9 text-xs tabular-nums"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client-country" className="text-xs font-medium">
                    Country
                  </Label>
                  <Input
                    id="client-country"
                    placeholder="India"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Internal Deliverable Guidelines */}
          <Card className="shadow-2xs border-border/70">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Internal Account Notes & Deliverable Guidelines
              </CardTitle>
              <CardDescription className="text-xs">
                Special client SLA terms, color palettes, tone of voice, or billing instructions.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Textarea
                id="client-notes"
                placeholder="Write internal guidelines, client tone preferences, key stakeholders, brand guidelines link, or billing frequency..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="text-xs leading-relaxed"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Interactive Client Preview Card */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
          <Card className="shadow-xs border-border/80 overflow-hidden">
            <div className="bg-gradient-to-r from-muted/60 via-muted/30 to-muted/60 p-4 border-b border-border/60 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Live Card Preview
              </span>
              <Badge
                variant={
                  formData.status === "ACTIVE"
                    ? "success"
                    : formData.status === "ONBOARDING"
                    ? "warning"
                    : "neutral"
                }
                className="text-[10px]"
              >
                {formData.status}
              </Badge>
            </div>

            <CardContent className="p-5 space-y-4">
              {/* Client Header Preview */}
              <div className="flex items-center gap-3.5">
                <Avatar className="size-14 rounded-xl border border-border shadow-xs">
                  {previewUrl && <AvatarImage src={previewUrl} className="object-cover" />}
                  <AvatarFallback className="rounded-xl font-bold text-sm bg-primary/10 text-primary">
                    {getInitials(formData.name || formData.company)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-base text-foreground truncate">
                    {formData.name || "Client Name"}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {formData.company || "Brand / Organization"}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded text-muted-foreground">
                      {formData.industry}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Preview Grid */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5" /> Email:
                  </span>
                  <span className="font-medium text-foreground truncate max-w-[180px]">
                    {formData.email || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5" /> Phone:
                  </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {formData.phone || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Globe className="size-3.5" /> Website:
                  </span>
                  <span className="font-medium text-foreground truncate max-w-[180px]">
                    {formData.website || "—"}
                  </span>
                </div>

                <div className="flex items-start justify-between text-muted-foreground pt-1 border-t border-border/40">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <MapPin className="size-3.5" /> Location:
                  </span>
                  <span className="font-medium text-foreground text-right truncate max-w-[180px]">
                    {[formData.city, formData.state].filter(Boolean).join(", ") || formData.country}
                  </span>
                </div>
              </div>

              {/* Commercial Identifiers Preview */}
              {(formData.gstin || formData.panNumber) && (
                <div className="rounded-lg border border-border/60 bg-card p-3 space-y-1.5 text-xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tax Records
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">GSTIN:</span>
                    <span className="font-mono text-xs font-semibold uppercase text-foreground">
                      {formData.gstin || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">PAN:</span>
                    <span className="font-mono text-xs font-semibold uppercase text-foreground">
                      {formData.panNumber || "—"}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips / Checklist Card */}
          <Card className="shadow-2xs border-border/70 bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                Agency Capabilities Unlocked
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Instantly create projects, content schedules, and assign design retainers.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Issue formal GST quotations and generate shareable proposal links.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Store client social media credentials in the encrypted vault.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating / Sticky Actions Footer */}
      <div className="sticky bottom-4 z-20 flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md shadow-lg">
        <p className="text-xs text-muted-foreground hidden sm:block">
          <span className="text-destructive">*</span> Client name is the only required field to start.
        </p>

        <div className="flex items-center gap-2.5 ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => router.push(client?.id ? `/dashboard/clients/${client.id}` : "/dashboard/clients")}
          >
            Cancel
          </Button>

          <Button type="submit" size="sm" loading={isLoading}>
            {client?.id ? "Save Changes" : "Create Client Account"}
          </Button>
        </div>
      </div>
    </form>
  );
}