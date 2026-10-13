"use client";

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
  isDefault: boolean;
  status: string;
}

export function HrmsLetterheadsTab() {
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLetterhead, setEditingLetterhead] = useState<Letterhead | null>(null);

  // Archive Confirmation Dialog
  const [archiveModal, setArchiveModal] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
  }>({
    isOpen: false,
    id: "",
    name: "",
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

  const fetchLetterheads = async () => {
    setLoading(true);
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
      primaryColor: lh.primaryColor || "#1e40af",
      secondaryColor: lh.secondaryColor || "#64748b",
      fontFamily: lh.fontFamily || "'Inter', sans-serif",
      marginTop: lh.marginTop,
      marginBottom: lh.marginBottom,
      marginLeft: lh.marginLeft,
      marginRight: lh.marginRight,
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
        if (!res.ok) throw new Error("Failed to update letterhead");
        toast.success("Letterhead updated");
      } else {
        const res = await fetch("/api/hrms/letterheads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Failed to create letterhead");
        toast.success("Letterhead created");
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

  const triggerArchiveLetterhead = (lh: Letterhead) => {
    setArchiveModal({
      isOpen: true,
      id: lh.id,
      name: lh.name,
    });
  };

  const confirmArchiveLetterhead = async () => {
    if (!archiveModal.id) return;
    try {
      const res = await fetch(`/api/hrms/letterheads/${archiveModal.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to archive letterhead");
      toast.success("Letterhead moved to archive");
      setArchiveModal({ isOpen: false, id: "", name: "" });
      fetchLetterheads();
    } catch (e: any) {
      toast.error(e.message || "Failed to archive letterhead");
    }
  };


  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 p-3 rounded-lg border border-border/60">
        <div>
          <h3 className="text-sm font-bold text-foreground">Branded Letterheads</h3>
          <p className="text-xs text-muted-foreground">
            Configure entity details, header & footer styles, margins, and typography for official documents.
          </p>
        </div>

        <Button size="sm" onClick={handleOpenCreate} className="gap-1.5 text-xs font-semibold">
          <Plus className="size-3.5" />
          <span>New Letterhead</span>
        </Button>
      </div>

      {/* Letterheads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-muted-foreground">
            Loading letterheads...
          </div>
        ) : letterheads.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
            No letterheads found. Click "New Letterhead" or "Load Sample Data".
          </div>
        ) : (
          letterheads.map((lh) => (
            <Card
              key={lh.id}
              className="border-border/70 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between"
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      {lh.name}
                      {lh.isDefault && (
                        <Badge variant="default" className="text-[10px] bg-primary">
                          Default
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      {lh.companyName}
                    </CardDescription>
                  </div>

                  <Badge
                    variant={lh.status === "ACTIVE" ? "outline" : "secondary"}
                    className="text-[10px]"
                  >
                    {lh.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-1 space-y-3">
                {/* Mini Preview Box */}
                <div className="rounded-lg border border-border/60 p-3 bg-white text-slate-900 space-y-2 text-[10px]">
                  <div
                    className="pb-2 border-b flex justify-between items-start"
                    style={{ borderColor: lh.primaryColor }}
                  >
                    <div>
                      <span className="font-extrabold uppercase" style={{ color: lh.primaryColor }}>
                        {lh.companyName}
                      </span>
                      <div className="text-[9px] text-slate-500">{lh.city}, {lh.country}</div>
                    </div>
                    <div className="text-right text-[9px] text-slate-500">
                      <div>{lh.email}</div>
                      <div>{lh.phone}</div>
                    </div>
                  </div>

                  <div className="py-2 text-slate-400 italic text-center">
                    [ Document content rendered with {lh.marginTop}mm top margin ]
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between text-[9px] text-slate-400">
                    <span>Confidential Document</span>
                    <span>{lh.website || "www.agency.com"}</span>
                  </div>
                </div>

                {/* Margins & Colors */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Margins: {lh.marginTop}mm / {lh.marginLeft}mm</span>
                  <div className="flex items-center gap-1">
                    <span
                      className="size-3.5 rounded-full border"
                      style={{ backgroundColor: lh.primaryColor }}
                      title="Primary Color"
                    />
                    <span
                      className="size-3.5 rounded-full border"
                      style={{ backgroundColor: lh.secondaryColor }}
                      title="Secondary Color"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-2">
                  {!lh.isDefault ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleSetDefault(lh.id)}
                      className="text-xs text-primary"
                    >
                      Make Default
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Active Default</span>
                  )}

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDuplicate(lh.id)}
                        title="Duplicate"
                      >
                        <Copy className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleOpenEdit(lh)}
                        title="Edit"
                      >
                        <Edit className="size-3.5 text-muted-foreground" />
                      </Button>
                      {!lh.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => triggerArchiveLetterhead(lh)}
                          title="Archive"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create / Edit Letterhead Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLetterhead ? "Edit Letterhead" : "Create New Letterhead"}</DialogTitle>
            <DialogDescription className="text-xs">
              Configure company branding details, typography, margins, and contact coordinates.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveLetterhead} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Letterhead Profile Name *</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Corporate Executive Letterhead"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Company Legal Entity Name *</Label>
                <Input
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="e.g. It's Me Dezino Digital Technologies Pvt. Ltd."
                  className="text-xs"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Office Registered Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street / Suite / Landmark"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">State / Province</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Primary Brand Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="h-8 w-12 p-0.5"
                  />
                  <Input
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Secondary Brand Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="h-8 w-12 p-0.5"
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
                  value={formData.marginTop}
                  onChange={(e) => setFormData({ ...formData, marginTop: Number(e.target.value) })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Bottom Margin (mm)</Label>
                <Input
                  type="number"
                  value={formData.marginBottom}
                  onChange={(e) =>
                    setFormData({ ...formData, marginBottom: Number(e.target.value) })
                  }
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
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

      {/* Archive Confirmation Dialog */}
      <Dialog
        open={archiveModal.isOpen}
        onOpenChange={(open) => !open && setArchiveModal({ isOpen: false, id: "", name: "" })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              <span>Archive Letterhead</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to archive <strong>{archiveModal.name}</strong>? It will be removed from active template selection but historical documents will retain its design.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setArchiveModal({ isOpen: false, id: "", name: "" })}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={confirmArchiveLetterhead}
              className="font-semibold"
            >
              Archive Letterhead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
