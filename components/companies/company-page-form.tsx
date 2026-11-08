"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building2,
  FileImage,
  PenTool,
  CreditCard,
  Landmark,
  MapPin,
  Mail,
  Phone,
  Globe,
  Upload,
  X,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  FileText,
  Eye,
  ShieldCheck,
  Receipt,
} from "lucide-react";
import type { Company } from "@/types/finance";

interface CompanyPageFormProps {
  initialCompany?: Company | null;
  isEditing?: boolean;
}

export function CompanyPageForm({ initialCompany, isEditing = false }: CompanyPageFormProps) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: initialCompany?.name || "",
    legalName: initialCompany?.legalName || "",
    email: initialCompany?.email || "",
    phone: initialCompany?.phone || "",
    website: initialCompany?.website || "",
    logo: initialCompany?.logo || "",
    letterhead: initialCompany?.letterhead || "",
    signature: initialCompany?.signature || "",
    gstNumber: initialCompany?.gstNumber || "",
    panNumber: initialCompany?.panNumber || "",
    hsnNumber: initialCompany?.hsnNumber || "998314",
    bankName: initialCompany?.bankName || "",
    bankAccountName: initialCompany?.bankAccountName || "",
    bankAccountNumber: initialCompany?.bankAccountNumber || "",
    bankIfsc: initialCompany?.bankIfsc || "",
    bankBranch: initialCompany?.bankBranch || "",
    addressLine1: initialCompany?.addressLine1 || "",
    addressLine2: initialCompany?.addressLine2 || "",
    city: initialCompany?.city || "",
    state: initialCompany?.state || "",
    postalCode: initialCompany?.postalCode || "",
    country: initialCompany?.country || "India",
    currency: initialCompany?.currency || "INR",
    notes: initialCompany?.notes || "",
    isActive: initialCompany?.isActive ?? true,
  });

  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const logoInputRef = useRef<HTMLInputElement>(null);
  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const setField = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (file: File, fieldKey: "letterhead" | "signature" | "logo") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit.");
      return;
    }

    setUploadingField(fieldKey);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", fieldKey);
      if (formData[fieldKey]) {
        form.append("oldUrl", String(formData[fieldKey]));
      }

      const res = await fetch("/api/companies/upload", {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to upload file");
        return;
      }

      setField(fieldKey, data.url);
      toast.success(`${fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)} uploaded successfully!`);
    } catch {
      toast.error("Network error while uploading");
    } finally {
      setUploadingField(null);
    }
  };

  const handleRemoveFile = async (fieldKey: "letterhead" | "signature" | "logo") => {
    const currentUrl = formData[fieldKey];
    setField(fieldKey, "");
    if (currentUrl) {
      try {
        await fetch("/api/companies/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: currentUrl }),
        });
      } catch (e) {
        console.warn("Could not clean file from disk", e);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Company display name is required.");
      return;
    }

    setIsSaving(true);
    setErrors({});

    try {
      const url = isEditing && initialCompany?.id ? `/api/companies/${initialCompany.id}` : "/api/companies";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 422 && data.details) {
          setErrors(data.details);
          toast.error("Please check the highlighted fields.");
        } else {
          toast.error(data.error || "Failed to save company");
        }
        return;
      }

      toast.success(isEditing ? "Company details updated!" : "Billing company registered!");
      router.push("/dashboard/companies");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("An unexpected network error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 2-Column Responsive Layout: Left Form (7 cols) + Right Live Preview (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Fields */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Identity & Legal Naming */}
          <Card className="shadow-2xs border-border/70">
            <CardHeader className="pb-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="size-4 text-primary" />
                    Company Identity & Registration
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Legal company title and primary contact details for billing documents.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="active-toggle" className="text-xs cursor-pointer">
                    {formData.isActive ? "Active Issuer" : "Inactive"}
                  </Label>
                  <Switch
                    id="active-toggle"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setField("isActive", checked)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="company-name" className="text-xs font-medium">
                    Display Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="company-name"
                    placeholder="e.g. itsmeDezino"
                    value={formData.name}
                    onChange={(e) => setField("name", e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company-legalName" className="text-xs font-medium">
                    Legal Registered Entity Name
                  </Label>
                  <Input
                    id="company-legalName"
                    placeholder="e.g. itsmeDezino Media Private Limited"
                    value={formData.legalName}
                    onChange={(e) => setField("legalName", e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="company-email" className="text-xs font-medium">
                    Official Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      id="company-email"
                      type="email"
                      placeholder="accounts@agency.com"
                      value={formData.email}
                      onChange={(e) => setField("email", e.target.value)}
                      className="h-9 pl-9 text-xs"
                    />
                  </div>
                  {errors.email && <p className="text-xs text-destructive">{errors.email[0]}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company-phone" className="text-xs font-medium">
                    Official Phone
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      id="company-phone"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      className="h-9 pl-9 text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company-website" className="text-xs font-medium">
                    Website URL
                  </Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      id="company-website"
                      placeholder="https://agency.com"
                      value={formData.website}
                      onChange={(e) => setField("website", e.target.value)}
                      className="h-9 pl-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Document Letterhead & Template Branding */}
          <Card className="shadow-2xs border-border/70">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileImage className="size-4 text-primary" />
                Document Letterhead & Signature Assets
              </CardTitle>
              <CardDescription className="text-xs">
                Upload your official letterhead banner, logo, and signature for PDF and quotation generation.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-6">
              {/* Letterhead Banner Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <FileImage className="size-3.5 text-primary" />
                      Letterhead Top Banner
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Appears across the top of every generated proposal and invoice. Recommended: 1200×250px.
                    </p>
                  </div>
                  {formData.letterhead && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRemoveFile("letterhead")}
                      className="text-xs text-destructive hover:bg-destructive/10"
                    >
                      <X className="size-3.5 mr-1" />
                      Remove Banner
                    </Button>
                  )}
                </div>

                <input
                  type="file"
                  ref={letterheadInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0], "letterhead");
                  }}
                />

                {formData.letterhead ? (
                  <div className="relative rounded-xl border border-border bg-card p-2 overflow-hidden group">
                    <img
                      src={formData.letterhead}
                      alt="Letterhead Preview"
                      className="w-full h-24 object-contain rounded-lg bg-white"
                    />
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                      <span className="truncate max-w-[260px] text-xs">{formData.letterhead}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => letterheadInputRef.current?.click()}
                      >
                        Change Banner
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => letterheadInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-border/80 hover:border-foreground/40 bg-muted/20 cursor-pointer transition-all hover:bg-muted/30"
                  >
                    <Upload className="size-6 text-muted-foreground mb-2" />
                    <p className="text-xs font-semibold text-foreground">Click to upload letterhead banner</p>
                    <p className="text-xs text-muted-foreground mt-0.5">PNG or JPG banner header (Max 5MB)</p>
                  </div>
                )}
              </div>

              {/* Logo & Signature 2-Col Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-border/40">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-primary" />
                      Company Logo
                    </Label>
                    {formData.logo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => handleRemoveFile("logo")}
                        className="text-xs text-destructive hover:bg-destructive/10"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={logoInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileUpload(e.target.files[0], "logo");
                    }}
                  />

                  {formData.logo ? (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card">
                      <img
                        src={formData.logo}
                        alt="Company logo"
                        className="size-12 rounded-lg object-contain bg-white border border-border/60"
                      />
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-medium text-foreground truncate">Logo attached</p>
                        <Button
                          type="button"
                          variant="link"
                          size="xs"
                          className="p-0 h-auto text-xs text-primary"
                          onClick={() => logoInputRef.current?.click()}
                        >
                          Replace image
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-16 border-dashed gap-2"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <Upload className="size-4 text-muted-foreground" />
                      Upload Logo (Square / Icon)
                    </Button>
                  )}
                </div>

                {/* Signature Upload */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <PenTool className="size-3.5 text-primary" />
                      Authorised Signature
                    </Label>
                    {formData.signature && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => handleRemoveFile("signature")}
                        className="text-xs text-destructive hover:bg-destructive/10"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={signatureInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileUpload(e.target.files[0], "signature");
                    }}
                  />

                  {formData.signature ? (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card">
                      <img
                        src={formData.signature}
                        alt="Authorised signature"
                        className="h-12 w-24 object-contain bg-white rounded border border-border/60"
                      />
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-medium text-foreground truncate">Signature attached</p>
                        <Button
                          type="button"
                          variant="link"
                          size="xs"
                          className="p-0 h-auto text-xs text-primary"
                          onClick={() => signatureInputRef.current?.click()}
                        >
                          Replace signature
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-16 border-dashed gap-2"
                      onClick={() => signatureInputRef.current?.click()}
                    >
                      <PenTool className="size-4 text-muted-foreground" />
                      Upload Signatory PNG
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Statutory & Tax Identification */}
          <Card className="shadow-2xs border-border/70">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                Statutory & Tax Identification
              </CardTitle>
              <CardDescription className="text-xs">
                Printed on formal tax invoices and commercial quotation summaries.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="company-gstin" className="text-xs font-medium">
                    GSTIN / Tax ID
                  </Label>
                  <Input
                    id="company-gstin"
                    placeholder="27AAAAA0000A1Z5"
                    value={formData.gstNumber}
                    onChange={(e) => setField("gstNumber", e.target.value.toUpperCase())}
                    className="h-9 text-xs font-mono uppercase"
                    maxLength={15}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company-pan" className="text-xs font-medium">
                    PAN Number
                  </Label>
                  <Input
                    id="company-pan"
                    placeholder="AAAAA0000A"
                    value={formData.panNumber}
                    onChange={(e) => setField("panNumber", e.target.value.toUpperCase())}
                    className="h-9 text-xs font-mono uppercase"
                    maxLength={10}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company-hsn" className="text-xs font-medium">
                    Default HSN / SAC Code
                  </Label>
                  <Input
                    id="company-hsn"
                    placeholder="998314"
                    value={formData.hsnNumber}
                    onChange={(e) => setField("hsnNumber", e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Bank Details & Remittance */}
          <Card className="shadow-2xs border-border/70">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Landmark className="size-4 text-primary" />
                Bank Remittance & Payment Instructions
              </CardTitle>
              <CardDescription className="text-xs">
                Direct wire instructions printed on invoices for client fund transfers.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="company-bank" className="text-xs font-medium">
                    Bank Name
                  </Label>
                  <Input
                    id="company-bank"
                    placeholder="e.g. HDFC Bank Ltd"
                    value={formData.bankName}
                    onChange={(e) => setField("bankName", e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company-accName" className="text-xs font-medium">
                    Beneficiary Account Name
                  </Label>
                  <Input
                    id="company-accName"
                    placeholder="e.g. itsmeDezino Media Pvt Ltd"
                    value={formData.bankAccountName}
                    onChange={(e) => setField("bankAccountName", e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="company-accNo" className="text-xs font-medium">
                    Account Number
                  </Label>
                  <Input
                    id="company-accNo"
                    placeholder="50200012345678"
                    value={formData.bankAccountNumber}
                    onChange={(e) => setField("bankAccountNumber", e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company-ifsc" className="text-xs font-medium">
                    IFSC Code
                  </Label>
                  <Input
                    id="company-ifsc"
                    placeholder="HDFC0001234"
                    value={formData.bankIfsc}
                    onChange={(e) => setField("bankIfsc", e.target.value.toUpperCase())}
                    className="h-9 text-xs font-mono uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company-branch" className="text-xs font-medium">
                    Branch Name
                  </Label>
                  <Input
                    id="company-branch"
                    placeholder="Bandra West, Mumbai"
                    value={formData.bankBranch}
                    onChange={(e) => setField("bankBranch", e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 5: Registered Office Address */}
          <Card className="shadow-2xs border-border/70">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                Registered Corporate Address
              </CardTitle>
              <CardDescription className="text-xs">
                The official location printed as the issuing address.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="company-addr1" className="text-xs font-medium">
                  Address Line 1
                </Label>
                <Input
                  id="company-addr1"
                  placeholder="Suite 500, Cyber Hub Tower B"
                  value={formData.addressLine1}
                  onChange={(e) => setField("addressLine1", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company-addr2" className="text-xs font-medium">
                  Address Line 2 (Optional)
                </Label>
                <Input
                  id="company-addr2"
                  placeholder="DLF Phase 2, Sector 25"
                  value={formData.addressLine2}
                  onChange={(e) => setField("addressLine2", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="company-city" className="text-xs font-medium">
                    City
                  </Label>
                  <Input
                    id="company-city"
                    placeholder="Gurugram"
                    value={formData.city}
                    onChange={(e) => setField("city", e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company-state" className="text-xs font-medium">
                    State
                  </Label>
                  <Input
                    id="company-state"
                    placeholder="Haryana"
                    value={formData.state}
                    onChange={(e) => setField("state", e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company-pincode" className="text-xs font-medium">
                    PIN Code
                  </Label>
                  <Input
                    id="company-pincode"
                    placeholder="122002"
                    value={formData.postalCode}
                    onChange={(e) => setField("postalCode", e.target.value)}
                    className="h-9 text-xs tabular-nums"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company-country" className="text-xs font-medium">
                    Country
                  </Label>
                  <Input
                    id="company-country"
                    placeholder="India"
                    value={formData.country}
                    onChange={(e) => setField("country", e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Quotation/Invoice Letterhead Mockup Preview */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
          <Card className="shadow-xs border-border/80 overflow-hidden bg-card">
            <div className="bg-gradient-to-r from-muted/60 via-muted/30 to-muted/60 p-4 border-b border-border/60 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Live Document Template Preview
              </span>
              <Badge variant={formData.isActive ? "success" : "neutral"} className="text-xs">
                {formData.isActive ? "Active Issuer" : "Inactive"}
              </Badge>
            </div>

            <CardContent className="p-0">
              {/* Mockup Sheet Container */}
              <div className="border border-border/60 m-4 rounded-xl overflow-hidden shadow-2xs bg-white text-neutral-900">
                {/* 1. Header Banner */}
                {formData.letterhead ? (
                  <div className="w-full bg-neutral-100 border-b border-neutral-200">
                    <img
                      src={formData.letterhead}
                      alt="Letterhead"
                      className="w-full max-h-24 object-contain mx-auto"
                    />
                  </div>
                ) : (
                  <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {formData.logo ? (
                        <img
                          src={formData.logo}
                          alt="Logo"
                          className="size-10 object-contain rounded border border-neutral-200"
                        />
                      ) : (
                        <div className="size-10 rounded bg-neutral-900 text-white flex items-center justify-center font-bold text-xs">
                          {formData.name.substring(0, 2).toUpperCase() || "CO"}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-sm text-neutral-900">
                          {formData.name || "Company Display Name"}
                        </h4>
                        <p className="text-xs text-neutral-500">
                          {formData.legalName || "Official Billing Entity"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-neutral-600 space-y-0.5">
                      <p className="font-semibold text-neutral-800">TAX INVOICE</p>
                      <p>INV-2026-001</p>
                    </div>
                  </div>
                )}

                {/* 2. Mockup Issuer Metadata */}
                <div className="p-4 space-y-3 text-xs leading-relaxed">
                  <div className="flex justify-between items-start border-b border-neutral-100 pb-2">
                    <div>
                      <p className="font-semibold text-neutral-800">
                        {formData.legalName || formData.name || "Company Name"}
                      </p>
                      <p className="text-neutral-500">
                        {[formData.addressLine1, formData.city, formData.state].filter(Boolean).join(", ") ||
                          "Registered Office Address"}
                      </p>
                      <p className="text-neutral-500">
                        {[formData.email, formData.phone].filter(Boolean).join(" · ") || <span className="font-normal italic text-neutral-400">Email · phone not added</span>}
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs space-y-0.5">
                      <p>
                        <span className="text-neutral-500">GST:</span>{" "}
                        <span className="font-bold text-neutral-800">{formData.gstNumber || <span className="font-normal italic text-neutral-400">Not added</span>}</span>
                      </p>
                      <p>
                        <span className="text-neutral-500">PAN:</span>{" "}
                        <span className="font-bold text-neutral-800">{formData.panNumber || <span className="font-normal italic text-neutral-400">Not added</span>}</span>
                      </p>
                    </div>
                  </div>

                  {/* 3. Where line items go. Deliberately not a sample item: a made-up
                      service and amount on a preview reads as real billing data. */}
                  <div className="rounded border border-dashed border-neutral-200 p-2 text-xs text-center italic text-neutral-400">
                    Invoice line items appear here
                  </div>

                  {/* 4. Bank Details & Signature Section */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-100">
                    <div className="bg-neutral-50 p-2 rounded text-xs space-y-0.5 text-neutral-600">
                      <p className="font-semibold text-neutral-800 text-xs">Payment Remittance:</p>
                      <p>Bank: {formData.bankName || <span className="font-normal italic text-neutral-400">Not added</span>}</p>
                      <p>A/C: {formData.bankAccountNumber || <span className="font-normal italic text-neutral-400">Not added</span>}</p>
                      <p>IFSC: {formData.bankIfsc || <span className="font-normal italic text-neutral-400">Not added</span>}</p>
                    </div>

                    <div className="text-right flex flex-col justify-end items-end">
                      {formData.signature ? (
                        <img
                          src={formData.signature}
                          alt="Signature"
                          className="h-10 object-contain mb-1"
                        />
                      ) : (
                        <div className="h-10 flex items-center justify-end text-xs text-neutral-400 italic">
                          [Signatory Stamp]
                        </div>
                      )}
                      <p className="text-xs font-semibold text-neutral-800">Authorised Signatory</p>
                      <p className="text-xs text-neutral-500">For {formData.name || "Agency"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Capabilities Card */}
          <Card className="shadow-2xs border-border/70 bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                Billing Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Multiple companies let you issue invoices from different legal entities or brands.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Letterhead banner automatically formats on PDF quotation exports.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>GST itemization and bank instructions embed automatically into client invoices.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating / Sticky Actions Footer */}
      <div className="sticky bottom-4 z-20 flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md shadow-lg">
        <p className="text-xs text-muted-foreground hidden sm:block">
          <span className="text-destructive">*</span> Display name is required. All other fields customize document exports.
        </p>

        <div className="flex items-center gap-2.5 ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => router.push("/dashboard/companies")}
          >
            Cancel
          </Button>

          <Button type="submit" size="sm" loading={isSaving}>
            {isEditing ? "Save Changes" : "Register Billing Company"}
          </Button>
        </div>
      </div>
    </form>
  );
}
