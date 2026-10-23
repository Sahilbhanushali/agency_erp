"use client";

import { useLiveRefresh } from "@/hooks/use-live-refresh"

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Copy,
  CheckCircle,
  Sparkles,
  RefreshCw,
  Eye,
  Archive,
  Star,
  RotateCcw,
  ExternalLink,
  Sliders,
  Globe,
  Image as ImageIcon,
} from "lucide-react";
import toast from "react-hot-toast";

interface Letterhead {
  id: string;
  name: string;
  companyName: string;
  logoUrl?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country: string;
  postalCode?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  headerHtml?: string | null;
  footerHtml?: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  watermarkText?: string | null;
  isDefault: boolean;
  status: string;
  _count?: {
    templates: number;
    offers: number;
  };
}

export function HrmsLetterheadsTab() {
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");

  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLetterhead, setEditingLetterhead] = useState<Letterhead | null>(null);

  // Preview State
  const [previewLetterhead, setPreviewLetterhead] = useState<Letterhead | null>(null);

  // Archive / Delete Modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
    isPermanent: boolean;
  }>({
    isOpen: false,
    id: "",
    name: "",
    isPermanent: false,
  });

  const [formData, setFormData] = useState({
    name: "Corporate Executive Letterhead",
    companyName: "It's Me Dezino Digital Technologies Pvt. Ltd.",
    logoUrl: "",
    address: "Level 4, Dezino Tower, Cyber City, Sector 44",
    city: "Gurugram",
    state: "Haryana",
    country: "India",
    postalCode: "122002",
    email: "careers@itsmedezino.com",
    phone: "+91 124 456 7890",
    website: "https://itsmedezino.com",
    headerHtml: "",
    footerHtml: "",
    watermarkText: "",
    primaryColor: "#1e40af",
    secondaryColor: "#64748b",
    fontFamily: "'Inter', sans-serif",
    marginTop: 25,
    marginBottom: 20,
    marginLeft: 20,
    marginRight: 20,
    isDefault: false,
    status: "ACTIVE",
  });

  const fetchLetterheads = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/hrms/letterheads?status=ALL");
      if (!res.ok) throw new Error("Failed to fetch letterheads");
      const data = await res.json();
      setLetterheads(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load letterheads");
    } finally {
      setLoading(false);
    }
  };
  // Live: re-read when someone else changes what this shows.
  useLiveRefresh(() => fetchLetterheads({ silent: true }), ["HrmsLetterhead"])

  useEffect(() => {
    fetchLetterheads();
  }, []);

  const handleOpenCreate = () => {
    setEditingLetterhead(null);
    setFormData({
      name: "New Branded Letterhead",
      companyName: "It's Me Dezino Digital Technologies Pvt. Ltd.",
      logoUrl: "",
      address: "Level 4, Dezino Tower, Cyber City, Sector 44",
      city: "Gurugram",
      state: "Haryana",
      country: "India",
      postalCode: "122002",
      email: "careers@itsmedezino.com",
      phone: "+91 124 456 7890",
      website: "https://itsmedezino.com",
      headerHtml: "",
      footerHtml: "",
      watermarkText: "",
      primaryColor: "#1e40af",
      secondaryColor: "#64748b",
      fontFamily: "'Inter', sans-serif",
      marginTop: 25,
      marginBottom: 20,
      marginLeft: 20,
      marginRight: 20,
      isDefault: letterheads.length === 0,
      status: "ACTIVE",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (lh: Letterhead) => {
    setEditingLetterhead(lh);
    setFormData({
      name: lh.name,
      companyName: lh.companyName,
      logoUrl: lh.logoUrl || "",
      address: lh.address || "",
      city: lh.city || "",
      state: lh.state || "",
      country: lh.country || "India",
      postalCode: lh.postalCode || "",
      email: lh.email || "",
      phone: lh.phone || "",
      website: lh.website || "",
      headerHtml: lh.headerHtml || "",
      footerHtml: lh.footerHtml || "",
      watermarkText: lh.watermarkText || "",
      primaryColor: lh.primaryColor || "#1e40af",
      secondaryColor: lh.secondaryColor || "#64748b",
      fontFamily: lh.fontFamily || "'Inter', sans-serif",
      marginTop: lh.marginTop ?? 25,
      marginBottom: lh.marginBottom ?? 20,
      marginLeft: lh.marginLeft ?? 20,
      marginRight: lh.marginRight ?? 20,
      isDefault: lh.isDefault,
      status: lh.status,
    });
    setIsDialogOpen(true);
  };

  const handleSaveLetterhead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLetterhead) {
        const res = await fetch(`/api/hrms/letterheads/${editingLetterhead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update letterhead");
        toast.success("Letterhead updated successfully");
      } else {
        const res = await fetch("/api/hrms/letterheads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create letterhead");
        toast.success("Letterhead created successfully");
      }
      setIsDialogOpen(false);
      fetchLetterheads();
    } catch (err: any) {
      toast.error(err.message || "Failed to save letterhead");
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/hrms/letterheads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DUPLICATE" }),
      });
      if (!res.ok) throw new Error("Failed to duplicate");
      toast.success("Letterhead duplicated");
      fetchLetterheads();
    } catch (e: any) {
      toast.error(e.message || "Failed to duplicate letterhead");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/hrms/letterheads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) throw new Error("Failed to set default");
      toast.success("Set as default letterhead");
      fetchLetterheads();
    } catch (e: any) {
      toast.error(e.message || "Failed to set default");
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/hrms/letterheads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      if (!res.ok) throw new Error("Failed to restore letterhead");
      toast.success("Letterhead restored to ACTIVE status");
      fetchLetterheads();
    } catch (e: any) {
      toast.error(e.message || "Failed to restore letterhead");
    }
  };

  const confirmDeleteLetterhead = async () => {
    if (!deleteModal.id) return;
    try {
      const url = deleteModal.isPermanent
        ? `/api/hrms/letterheads/${deleteModal.id}?permanent=true`
        : `/api/hrms/letterheads/${deleteModal.id}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete letterhead");

      toast.success(deleteModal.isPermanent ? "Letterhead permanently deleted" : "Letterhead moved to archive");
      setDeleteModal({ isOpen: false, id: "", name: "", isPermanent: false });
      fetchLetterheads();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete letterhead");
    }
  };

  const filteredLetterheads = letterheads.filter((lh) => {
    if (statusFilter === "ALL") return true;
    return lh.status === statusFilter;
  });


  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3.5 rounded-xl border border-border shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Building2 className="size-4 text-primary" /> Branded Letterheads & Entity Profiles
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure legal company info, branding colors, typography, margins, and custom headers/footers for offer letters and employment contracts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                statusFilter === "ALL" ? "bg-background text-foreground shadow-2xs font-bold" : "text-muted-foreground"
              }`}
            >
              All ({letterheads.length})
            </button>
            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                statusFilter === "ACTIVE" ? "bg-background text-foreground shadow-2xs font-bold" : "text-muted-foreground"
              }`}
            >
              Active ({letterheads.filter((l) => l.status === "ACTIVE").length})
            </button>
            <button
              onClick={() => setStatusFilter("ARCHIVED")}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                statusFilter === "ARCHIVED" ? "bg-background text-foreground shadow-2xs font-bold" : "text-muted-foreground"
              }`}
            >
              Archived ({letterheads.filter((l) => l.status === "ARCHIVED").length})
            </button>
          </div>

          <Button size="sm" onClick={handleOpenCreate} className="gap-1.5 text-xs font-semibold">
            <Plus className="size-3.5" />
            <span>New Letterhead</span>
          </Button>
        </div>
      </div>

      {/* Letterheads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-muted-foreground">
            <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
            Loading letterheads...
          </div>
        ) : filteredLetterheads.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-muted-foreground border border-dashed rounded-xl bg-card">
            No letterheads found in this filter. Click "New Letterhead" to create one.
          </div>
        ) : (
          filteredLetterheads.map((lh) => (
            <Card
              key={lh.id}
              className={`border transition-all flex flex-col justify-between shadow-xs ${
                lh.status === "ARCHIVED" ? "opacity-70 border-border/50 bg-muted/10" : "hover:border-primary/40 bg-card"
              }`}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between">
                  <div className="pr-2">
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                      <span>{lh.name}</span>
                      {lh.isDefault && (
                        <Badge variant="default" className="text-[10px] bg-primary gap-0.5 py-0 px-1.5">
                          <Star className="size-2.5 fill-current" /> Default
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {lh.companyName}
                    </CardDescription>
                  </div>

                  <Badge
                    variant={lh.status === "ACTIVE" ? "outline" : lh.status === "ARCHIVED" ? "destructive" : "secondary"}
                    className="text-[10px] shrink-0"
                  >
                    {lh.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-1 space-y-3">
                {/* Mini Realistic Preview Box */}
                <div className="rounded-lg border border-border p-3 bg-white text-slate-900 space-y-2 text-[10px] shadow-2xs">
                  <div
                    className="pb-2 border-b flex justify-between items-start gap-2"
                    style={{ borderColor: lh.primaryColor }}
                  >
                    <div className="flex items-center gap-2">
                      {lh.logoUrl ? (
                        <img src={lh.logoUrl} alt="Logo" className="h-6 max-w-[80px] object-contain" />
                      ) : (
                        <div
                          className="size-6 rounded flex items-center justify-center font-bold text-white text-[10px]"
                          style={{ backgroundColor: lh.primaryColor }}
                        >
                          {lh.companyName?.charAt(0) || "C"}
                        </div>
                      )}
                      <div>
                        <span className="font-extrabold uppercase text-[10px] tracking-tight block" style={{ color: lh.primaryColor }}>
                          {lh.companyName}
                        </span>
                        <div className="text-[9px] text-slate-500">{[lh.city, lh.country].filter(Boolean).join(", ")}</div>
                      </div>
                    </div>
                    <div className="text-right text-[9px] text-slate-500 shrink-0">
                      {lh.email && <div>{lh.email}</div>}
                      {lh.phone && <div>{lh.phone}</div>}
                    </div>
                  </div>

                  <div className="py-2 text-slate-400 italic text-center text-[9px]">
                    [ A4 Content: Margins T:{lh.marginTop}mm, B:{lh.marginBottom}mm, L:{lh.marginLeft}mm, R:{lh.marginRight}mm ]
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between text-[9px] text-slate-400">
                    <span>Confidential Document</span>
                    <span>{lh.website || <span className="italic text-slate-400">No website</span>}</span>
                  </div>
                </div>

                {/* Details row */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span className="text-[11px] font-mono">
                    Font: {lh.fontFamily.replace(/['"]/g, "").split(",")[0]}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="size-3.5 rounded-full border shadow-2xs"
                      style={{ backgroundColor: lh.primaryColor }}
                      title={`Primary: ${lh.primaryColor}`}
                    />
                    <span
                      className="size-3.5 rounded-full border shadow-2xs"
                      style={{ backgroundColor: lh.secondaryColor }}
                      title={`Secondary: ${lh.secondaryColor}`}
                    />
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                  <div>
                    {!lh.isDefault && lh.status === "ACTIVE" ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleSetDefault(lh.id)}
                        className="text-xs text-primary font-medium hover:underline p-0 h-auto"
                      >
                        Set as Default
                      </Button>
                    ) : lh.isDefault ? (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="size-3 text-emerald-600" /> Active Default
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">Archived</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Live Preview Button */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setPreviewLetterhead(lh)}
                      title="View A4 Preview"
                    >
                      <Eye className="size-3.5 text-muted-foreground" />
                    </Button>

                    {/* Duplicate Button */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDuplicate(lh.id)}
                      title="Duplicate Letterhead"
                    >
                      <Copy className="size-3.5 text-muted-foreground" />
                    </Button>

                    {/* Edit Button */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleOpenEdit(lh)}
                      title="Edit Letterhead"
                    >
                      <Edit className="size-3.5 text-muted-foreground" />
                    </Button>

                    {/* Restore or Delete/Archive */}
                    {lh.status === "ARCHIVED" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRestore(lh.id)}
                          title="Restore to Active"
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          <RotateCcw className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDeleteModal({ isOpen: true, id: lh.id, name: lh.name, isPermanent: true })}
                          title="Permanently Delete"
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    ) : !lh.isDefault ? (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDeleteModal({ isOpen: true, id: lh.id, name: lh.name, isPermanent: false })}
                        title="Archive Letterhead"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Archive className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ================= CREATE / EDIT LETTERHEAD DIALOG ================= */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-primary" />
              <span>{editingLetterhead ? "Edit Letterhead Profile" : "Create New Branded Letterhead"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure company legal entity coordinates, logo, page margins, typography, and color branding.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveLetterhead} className="space-y-4 py-2 text-xs">
            {/* Identity & Legal Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3.5 rounded-xl border border-border bg-muted/20">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs font-semibold">Letterhead Profile Name *</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Corporate Executive Letterhead"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Company Legal Entity Name *</Label>
                <Input
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="e.g. It's Me Dezino Digital Technologies Pvt. Ltd."
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Logo Image URL</Label>
                <Input
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  placeholder="https://agency.com/logo.png"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs font-semibold">Office Registered Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Floor, Tower, Business Hub, Sector"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Gurugram"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">State / Province</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="Haryana"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Country</Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="India"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Postal / PIN Code</Label>
                <Input
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder="122002"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* Coordinates & Contact */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-3.5 rounded-xl border border-border bg-muted/20">
              <div className="space-y-1">
                <Label className="text-xs">Official Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="careers@company.com"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Official Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 124 456 7890"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Company Website</Label>
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://company.com"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Typography, Margins & Brand Colors */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 p-3.5 rounded-xl border border-border bg-muted/20">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-semibold">Font Family</Label>
                <Select
                  value={formData.fontFamily}
                  onValueChange={(val) => setFormData({ ...formData, fontFamily: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="'Inter', sans-serif">Inter (Modern Clean)</SelectItem>
                    <SelectItem value="'Roboto', sans-serif">Roboto (Standard Sans)</SelectItem>
                    <SelectItem value="'Georgia', serif">Georgia (Executive Serif)</SelectItem>
                    <SelectItem value="'Times New Roman', serif">Times New Roman (Formal Legal)</SelectItem>
                    <SelectItem value="'Arial', sans-serif">Arial (Universal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="h-8 w-10 p-0.5"
                  />
                  <Input
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Secondary Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="h-8 w-10 p-0.5"
                  />
                  <Input
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Top Margin (mm)</Label>
                <Input
                  type="number"
                  min="5"
                  max="60"
                  value={formData.marginTop}
                  onChange={(e) => setFormData({ ...formData, marginTop: Number(e.target.value) })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Bottom Margin (mm)</Label>
                <Input
                  type="number"
                  min="5"
                  max="60"
                  value={formData.marginBottom}
                  onChange={(e) => setFormData({ ...formData, marginBottom: Number(e.target.value) })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Left Margin (mm)</Label>
                <Input
                  type="number"
                  min="5"
                  max="40"
                  value={formData.marginLeft}
                  onChange={(e) => setFormData({ ...formData, marginLeft: Number(e.target.value) })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Right Margin (mm)</Label>
                <Input
                  type="number"
                  min="5"
                  max="40"
                  value={formData.marginRight}
                  onChange={(e) => setFormData({ ...formData, marginRight: Number(e.target.value) })}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* Status & Default Flag */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="lh-is-default"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary size-4"
                />
                <Label htmlFor="lh-is-default" className="text-xs cursor-pointer font-medium">
                  Set as Agency Default Letterhead (applied automatically to all new offer templates)
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Status:</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="DRAFT">DRAFT</SelectItem>
                    <SelectItem value="ARCHIVED">ARCHIVED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-semibold">
                {editingLetterhead ? "Save Changes" : "Create Letterhead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= LIVE A4 LETTERHEAD PREVIEW MODAL ================= */}
      {previewLetterhead && (
        <Dialog open={!!previewLetterhead} onOpenChange={() => setPreviewLetterhead(null)}>
          <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 bg-slate-100">
            <DialogHeader className="pb-3 border-b border-slate-300">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-base text-slate-900 font-bold">
                    Letterhead Preview: {previewLetterhead.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-600">
                    Rendered in standard A4 format with configured header, margins, and typography.
                  </DialogDescription>
                </div>
                <Badge variant="outline" className="text-xs bg-white text-slate-800">
                  {previewLetterhead.companyName}
                </Badge>
              </div>
            </DialogHeader>

            {/* A4 Sheet Simulation */}
            <div className="my-4 mx-auto max-w-[750px] bg-white rounded-lg shadow-xl border border-slate-300 p-8 text-slate-900 space-y-6 min-h-[700px] flex flex-col justify-between font-sans">
              {/* Header */}
              <div
                className="pb-4 border-b-2 flex items-start justify-between"
                style={{ borderColor: previewLetterhead.primaryColor }}
              >
                <div className="flex items-center gap-3">
                  {previewLetterhead.logoUrl ? (
                    <img src={previewLetterhead.logoUrl} alt="Logo" className="h-10 max-w-[120px] object-contain" />
                  ) : (
                    <div
                      className="size-10 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                      style={{ backgroundColor: previewLetterhead.primaryColor }}
                    >
                      {previewLetterhead.companyName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h2
                      className="text-base font-extrabold uppercase tracking-tight"
                      style={{ color: previewLetterhead.primaryColor }}
                    >
                      {previewLetterhead.companyName}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {previewLetterhead.address || "Level 4, Corporate Plaza"}, {previewLetterhead.city}, {previewLetterhead.country} - {previewLetterhead.postalCode}
                    </p>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-600 space-y-0.5">
                  <div><strong>Email:</strong> {previewLetterhead.email || <span className="italic text-slate-400">Not added</span>}</div>
                  <div><strong>Phone:</strong> {previewLetterhead.phone || <span className="italic text-slate-400">Not added</span>}</div>
                  <div><strong>Web:</strong> {previewLetterhead.website || <span className="italic text-slate-400">Not added</span>}</div>
                </div>
              </div>

              {/* Sample Document Body */}
              <div
                className="flex-1 space-y-4 text-xs text-slate-700 leading-relaxed py-4"
                style={{
                  fontFamily: previewLetterhead.fontFamily || "'Inter', sans-serif",
                  paddingLeft: `${Math.max(0, previewLetterhead.marginLeft - 15)}mm`,
                  paddingRight: `${Math.max(0, previewLetterhead.marginRight - 15)}mm`,
                }}
              >
                <div className="flex justify-between text-slate-500 font-mono text-[11px]">
                  <span>Ref: OFR-2026-DEV-001</span>
                  <span>Date: October 17, 2026</span>
                </div>

                <p className="font-semibold text-slate-900">Dear Candidate,</p>
                <p>
                  We are pleased to extend an offer of employment with <strong>{previewLetterhead.companyName}</strong>. This official document represents your employment terms, compensation breakdown, and company policies as approved by human resources.
                </p>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <span className="font-semibold text-slate-900 block mb-1">Sample Employment Clause</span>
                  <p className="text-[11px] text-slate-600">
                    Your compensation and statutory benefits (PF, ESI, and Professional Tax) are computed in strict accordance with the governing labor laws and agency payroll policies.
                  </p>
                </div>

                <p>
                  We look forward to welcoming you to our team. Please sign and return a copy of this letterhead document within 7 days of receipt.
                </p>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
                <span>{previewLetterhead.companyName} • Confidential Official Communication</span>
                <span>Page 1 of 1</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setPreviewLetterhead(null)}>
                Close Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= ARCHIVE / PERMANENT DELETE DIALOG ================= */}
      <Dialog
        open={deleteModal.isOpen}
        onOpenChange={(open) => !open && setDeleteModal({ isOpen: false, id: "", name: "", isPermanent: false })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              <span>{deleteModal.isPermanent ? "Permanently Delete Letterhead" : "Archive Letterhead"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {deleteModal.isPermanent ? (
                <>
                  Are you sure you want to permanently delete <strong>{deleteModal.name}</strong>? This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to archive <strong>{deleteModal.name}</strong>? It will be removed from template selection, but historical offer letters will preserve its formatting.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModal({ isOpen: false, id: "", name: "", isPermanent: false })}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={confirmDeleteLetterhead}
              className="font-semibold"
            >
              {deleteModal.isPermanent ? "Delete Permanently" : "Archive Letterhead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
