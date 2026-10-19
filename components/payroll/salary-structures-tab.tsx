"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { toast } from "react-hot-toast";
import {
  Briefcase,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  Search,
  UserCheck,
  Percent,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Building,
  Star,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }
  return res.json();
};

function formatInr(paiseOrRupees: number, isPaise = false): string {
  const rupees = isPaise ? (paiseOrRupees || 0) / 100 : (paiseOrRupees || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

interface StructureTemplate {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  basicPercentage: number;
  hraPercentage: number;
  specialPercentage: number;
  otherPercentage: number;
  pfApplicable: boolean;
  esiApplicable: boolean;
  professionalTax: boolean;
  isDefault: boolean;
  isActive: boolean;
  _count?: {
    assignedStructures: number;
  };
}

export function SalaryStructuresTab({
  users = [],
  onRefresh,
}: {
  users?: any[];
  onRefresh?: () => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"roster" | "templates">("roster");
  const [searchTerm, setSearchTerm] = useState("");

  // SWR for templates
  const {
    data: templates = [],
    isLoading: isLoadingTemplates,
    mutate: mutateTemplates,
  } = useSWR<StructureTemplate[]>("/api/payroll/structures", fetcher);

  // Template Create/Edit Modal
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<StructureTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    code: "",
    description: "",
    basicPercentage: 50,
    hraPercentage: 25,
    specialPercentage: 15,
    otherPercentage: 10,
    pfApplicable: true,
    esiApplicable: false,
    professionalTax: true,
    isDefault: false,
  });

  // Assign Structure to User Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  /**
   * Employees receiving the structure. A list, because a band or grade normally applies
   * to several people and assigning it one at a time was the only option before.
   * `selectedUser` is kept as "the one whose current salary seeded the amounts".
   */
  const [assignUserIds, setAssignUserIds] = useState<number[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignTemplateId, setAssignTemplateId] = useState<string>("");
  const [annualCtcRupees, setAnnualCtcRupees] = useState<number>(600000);
  const [monthlyGrossRupees, setMonthlyGrossRupees] = useState<number>(50000);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [revisionReason, setRevisionReason] = useState<string>("Standard Compensation Alignment");
  const [isAssigning, setIsAssigning] = useState(false);

  // Delete Template Confirmation Modal
  const [deleteTemplateModal, setDeleteTemplateModal] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
  }>({
    isOpen: false,
    id: "",
    name: "",
  });

  // Calculate live sum of template percentages
  const percentageSum =
    Number(templateForm.basicPercentage || 0) +
    Number(templateForm.hraPercentage || 0) +
    Number(templateForm.specialPercentage || 0) +
    Number(templateForm.otherPercentage || 0);

  const handleOpenCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: "",
      code: "",
      description: "",
      basicPercentage: 50,
      hraPercentage: 25,
      specialPercentage: 15,
      otherPercentage: 10,
      pfApplicable: true,
      esiApplicable: false,
      professionalTax: true,
      isDefault: templates.length === 0,
    });
    setIsTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (t: StructureTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({
      name: t.name,
      code: t.code,
      description: t.description || "",
      basicPercentage: t.basicPercentage,
      hraPercentage: t.hraPercentage,
      specialPercentage: t.specialPercentage,
      otherPercentage: t.otherPercentage,
      pfApplicable: t.pfApplicable,
      esiApplicable: t.esiApplicable,
      professionalTax: t.professionalTax,
      isDefault: t.isDefault,
    });
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Math.abs(percentageSum - 100) > 0.01) {
      toast.error(`Percentages must total 100% (currently ${percentageSum.toFixed(1)}%)`);
      return;
    }

    try {
      if (editingTemplate) {
        const res = await fetch(`/api/payroll/structures/${editingTemplate.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templateForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update template");
        toast.success("Salary structure template updated");
      } else {
        const res = await fetch("/api/payroll/structures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templateForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create template");
        toast.success("New salary structure template created");
      }

      setIsTemplateModalOpen(false);
      mutateTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to save salary structure template");
    }
  };

  const confirmDeleteTemplate = async () => {
    if (!deleteTemplateModal.id) return;
    try {
      const res = await fetch(`/api/payroll/structures/${deleteTemplateModal.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete structure");

      if (data.deactivated) {
        toast.success(data.message || "Deactivated structure");
      } else {
        toast.success("Salary structure template deleted");
      }
      setDeleteTemplateModal({ isOpen: false, id: "", name: "" });
      mutateTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete template");
    }
  };

  const handleOpenAssignModal = (user: any) => {
    setSelectedUser(user);
    const defaultTmpl = templates.find((t) => t.isDefault) || templates[0];
    setAssignTemplateId(defaultTmpl?.id || "");

    const currentSalary = Number(user.currentSalary) || 50000;
    setMonthlyGrossRupees(currentSalary);
    setAnnualCtcRupees(currentSalary * 12);
    setEffectiveFrom(new Date().toISOString().split("T")[0]);
    setRevisionReason("Structure alignment & revision");
    setIsAssignModalOpen(true);
  };

  const handleAnnualChange = (val: number) => {
    setAnnualCtcRupees(val);
    setMonthlyGrossRupees(Math.round(val / 12));
  };

  const handleMonthlyChange = (val: number) => {
    setMonthlyGrossRupees(val);
    setAnnualCtcRupees(val * 12);
  };

  const handleExecuteAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assignUserIds.length === 0 || !assignTemplateId) {
      toast.error("Please select at least one employee and a salary structure template");
      return;
    }

    try {
      setIsAssigning(true);
      const res = await fetch("/api/payroll/structures/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The same structure can go to several people at once.
          userIds: assignUserIds,
          templateId: assignTemplateId,
          monthlyGross: monthlyGrossRupees,
          annualCtc: annualCtcRupees,
          effectiveFrom,
          revisionReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign structure");

      toast.success(data.message || `Assigned ${data.templateName}`);
      // 207 means some landed and some did not; say which, rather than claiming success.
      if (Array.isArray(data.failed) && data.failed.length > 0) {
        toast.error(
          `Could not assign to ${data.failed
            .map((f: any) => f.name ?? f.userId)
            .join(", ")}`,
          { duration: 6000 },
        );
      }
      setIsAssignModalOpen(false);
      setAssignUserIds([]);
      setAssignSearch("");
      mutateTemplates();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Assignment failed");
    } finally {
      setIsAssigning(false);
    }
  };

  const currentSelectedTemplate = templates.find((t) => t.id === assignTemplateId);

  // Live computed breakdown for the assignment preview
  const previewBasic = currentSelectedTemplate
    ? Math.round(monthlyGrossRupees * (currentSelectedTemplate.basicPercentage / 100))
    : Math.round(monthlyGrossRupees * 0.5);
  const previewHra = currentSelectedTemplate
    ? Math.round(monthlyGrossRupees * (currentSelectedTemplate.hraPercentage / 100))
    : Math.round(monthlyGrossRupees * 0.25);
  const previewSpecial = currentSelectedTemplate
    ? Math.round(monthlyGrossRupees * (currentSelectedTemplate.specialPercentage / 100))
    : Math.round(monthlyGrossRupees * 0.15);
  const previewOther = Math.max(0, monthlyGrossRupees - (previewBasic + previewHra + previewSpecial));

  const previewPf = currentSelectedTemplate?.pfApplicable ? Math.round(Math.min(previewBasic, 15000) * 0.12) : 0;
  const previewEsi = currentSelectedTemplate?.esiApplicable && monthlyGrossRupees <= 21000 ? Math.round(monthlyGrossRupees * 0.0075) : 0;
  const previewPt = currentSelectedTemplate?.professionalTax ? 200 : 0;
  const previewNet = monthlyGrossRupees - (previewPf + previewEsi + previewPt);

  const filteredUsers = users.filter((u: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.designation?.toLowerCase().includes(term) ||
      u.department?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Header & Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-3.5 rounded-xl border border-border shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Briefcase className="size-4 text-primary" /> Salary Structures & Compensation Plans
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure master salary structures (Basic, HRA, Allowances, PF/ESI/PT) and assign them to employees with version tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub Tab Switcher */}
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
            <button
              onClick={() => setActiveSubTab("roster")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                activeSubTab === "roster"
                  ? "bg-background text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground"
              }`}
            >
              Employee Roster ({users.length})
            </button>
            <button
              onClick={() => setActiveSubTab("templates")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                activeSubTab === "templates"
                  ? "bg-background text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground"
              }`}
            >
              Master Structures ({templates.length})
            </button>
          </div>

          {activeSubTab === "templates" && (
            <Button size="sm" onClick={handleOpenCreateTemplate} className="gap-1.5 text-xs font-semibold">
              <Plus className="size-3.5" />
              <span>New Structure</span>
            </Button>
          )}
        </div>
      </div>

      {/* ================= SUB-TAB 1: EMPLOYEE SALARY ROSTER ================= */}
      {activeSubTab === "roster" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search employee, email, role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <span className="text-xs text-muted-foreground hidden sm:block">
              Showing {filteredUsers.length} employee compensation profiles
            </span>
          </div>

          <Card className="shadow-2xs overflow-hidden border border-border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs font-semibold">Employee</TableHead>
                    <TableHead className="text-xs font-semibold">Role & Dept</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Monthly Gross</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Annual CTC</TableHead>
                    <TableHead className="text-xs font-semibold">Bank Info</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground">
                        {searchTerm ? "No employees match your search criteria." : "No employee profiles found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u: any) => {
                      const monthlyGross = Number(u.currentSalary) || 0;
                      const annualCtc = monthlyGross * 12;

                      return (
                        <TableRow key={u.id} className="hover:bg-muted/20">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-7">
                                <AvatarImage src={u.avatar} />
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                                  {u.name?.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-xs font-bold text-foreground">{u.name}</p>
                                <p className="text-[10px] text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium text-foreground">{u.designation || "Staff"}</span>
                            <span className="text-muted-foreground text-[10px] block">{u.department || "General"}</span>
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-bold text-foreground">
                            {monthlyGross > 0 ? formatInr(monthlyGross) : <span className="text-muted-foreground font-normal">Not Set</span>}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-bold text-emerald-600">
                            {annualCtc > 0 ? formatInr(annualCtc) : <span className="text-muted-foreground font-normal">Not Set</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {u.bankAccountNumber ? (
                              <span className="text-[11px] text-foreground">
                                ••••{u.bankAccountNumber.slice(-4)} ({u.bankName || "Bank"})
                              </span>
                            ) : (
                              <Badge variant="destructive" className="text-[9px] py-0">Missing A/C</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleOpenAssignModal(u)}
                              className="gap-1.5 text-xs text-primary font-medium hover:bg-primary/5"
                            >
                              <UserCheck className="size-3.5" />
                              <span>Assign Structure</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* ================= SUB-TAB 2: MASTER STRUCTURE TEMPLATES CATALOG ================= */}
      {activeSubTab === "templates" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingTemplates ? (
              <div className="col-span-full py-16 text-center text-xs text-muted-foreground">
                <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
                Loading structure templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-muted-foreground border border-dashed rounded-xl bg-card">
                No salary structure templates found. Click "New Structure" to configure one.
              </div>
            ) : (
              templates.map((t) => (
                <Card
                  key={t.id}
                  className={`border transition-all flex flex-col justify-between shadow-xs bg-card ${
                    !t.isActive ? "opacity-60" : "hover:border-primary/40"
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                          <span>{t.name}</span>
                          {t.isDefault && (
                            <Badge variant="default" className="text-[10px] bg-primary gap-0.5 py-0 px-1.5">
                              <Star className="size-2.5 fill-current" /> Default
                            </Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-[10px] font-mono tracking-wider">
                            {t.code}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {t._count?.assignedStructures || 0} Employees Assigned
                          </span>
                        </div>
                      </div>
                    </div>
                    {t.description && (
                      <CardDescription className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {t.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    {/* Component percentage split bar */}
                    <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/20">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Component Allocation (% of Gross)
                      </span>
                      <div className="grid grid-cols-4 gap-1 text-center text-xs font-mono pt-1">
                        <div className="p-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                          <span className="text-[9px] block text-muted-foreground font-sans">Basic</span>
                          <strong>{t.basicPercentage}%</strong>
                        </div>
                        <div className="p-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          <span className="text-[9px] block text-muted-foreground font-sans">HRA</span>
                          <strong>{t.hraPercentage}%</strong>
                        </div>
                        <div className="p-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          <span className="text-[9px] block text-muted-foreground font-sans">Special</span>
                          <strong>{t.specialPercentage}%</strong>
                        </div>
                        <div className="p-1 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300">
                          <span className="text-[9px] block text-muted-foreground font-sans">Other</span>
                          <strong>{t.otherPercentage}%</strong>
                        </div>
                      </div>
                    </div>

                    {/* Statutory Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <Badge variant={t.pfApplicable ? "outline" : "neutral"} className="text-[10px] py-0">
                        {t.pfApplicable ? "PF (12%) Included" : "No PF"}
                      </Badge>
                      <Badge variant={t.esiApplicable ? "outline" : "neutral"} className="text-[10px] py-0">
                        {t.esiApplicable ? "ESI Applicable" : "No ESI"}
                      </Badge>
                      <Badge variant={t.professionalTax ? "outline" : "neutral"} className="text-[10px] py-0">
                        {t.professionalTax ? "PT Deducted" : "No PT"}
                      </Badge>
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          const firstUser = users[0];
                          if (firstUser) {
                            setSelectedUser(firstUser);
                            setAssignTemplateId(t.id);
                            setIsAssignModalOpen(true);
                          }
                        }}
                        className="text-xs text-primary font-medium p-0 h-auto hover:underline"
                      >
                        Assign to Staff →
                      </Button>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleOpenEditTemplate(t)}
                          title="Edit Structure Template"
                        >
                          <Edit className="size-3.5 text-muted-foreground" />
                        </Button>
                        {!t.isDefault && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setDeleteTemplateModal({ isOpen: true, id: t.id, name: t.name })}
                            title="Delete Structure Template"
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
        </div>
      )}

      {/* ================= MODAL: CREATE / EDIT SALARY STRUCTURE TEMPLATE ================= */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <form onSubmit={handleSaveTemplate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Sliders className="size-4 text-primary" />
                <span>{editingTemplate ? "Edit Salary Structure Template" : "New Salary Structure Template"}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Define the percentage component allocation (must equal 100%) and statutory applicability.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label className="text-xs font-semibold">Structure Name *</Label>
                  <Input
                    required
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="e.g. Standard Corporate Executive"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label className="text-xs font-semibold">Structure Code *</Label>
                  <Input
                    required
                    value={templateForm.code}
                    onChange={(e) => setTemplateForm({ ...templateForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. STD_CORP"
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                    placeholder="Target employee tier, applicability notes..."
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Component % Allocation */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground">
                    Earnings Breakdown (% of Monthly Gross)
                  </span>
                  <Badge
                    variant={Math.abs(percentageSum - 100) < 0.01 ? "success" : "destructive"}
                    className="text-[10px] font-mono"
                  >
                    Sum: {percentageSum.toFixed(1)}% / 100%
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Basic Salary (%) *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={templateForm.basicPercentage}
                      onChange={(e) => setTemplateForm({ ...templateForm, basicPercentage: Number(e.target.value) })}
                      className="h-8 text-xs font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">HRA (%) *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={templateForm.hraPercentage}
                      onChange={(e) => setTemplateForm({ ...templateForm, hraPercentage: Number(e.target.value) })}
                      className="h-8 text-xs font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Special Allowance (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={templateForm.specialPercentage}
                      onChange={(e) => setTemplateForm({ ...templateForm, specialPercentage: Number(e.target.value) })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Other Allowance (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={templateForm.otherPercentage}
                      onChange={(e) => setTemplateForm({ ...templateForm, otherPercentage: Number(e.target.value) })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Statutory Applicability */}
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
                <span className="font-semibold text-xs text-foreground block">
                  Statutory Deductions Applicable
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={templateForm.pfApplicable}
                      onChange={(e) => setTemplateForm({ ...templateForm, pfApplicable: e.target.checked })}
                      className="rounded border-border text-primary size-4"
                    />
                    <span>Provident Fund (PF)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={templateForm.esiApplicable}
                      onChange={(e) => setTemplateForm({ ...templateForm, esiApplicable: e.target.checked })}
                      className="rounded border-border text-primary size-4"
                    />
                    <span>ESI Insurance</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={templateForm.professionalTax}
                      onChange={(e) => setTemplateForm({ ...templateForm, professionalTax: e.target.checked })}
                      className="rounded border-border text-primary size-4"
                    />
                    <span>Professional Tax (PT)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="tmpl-default"
                  checked={templateForm.isDefault}
                  onChange={(e) => setTemplateForm({ ...templateForm, isDefault: e.target.checked })}
                  className="rounded border-border text-primary size-4"
                />
                <Label htmlFor="tmpl-default" className="text-xs cursor-pointer">
                  Set as Company Default Template for new employee onboardings
                </Label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsTemplateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-semibold">
                {editingTemplate ? "Save Changes" : "Create Structure"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: ASSIGN STRUCTURE TO EMPLOYEE ================= */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <form onSubmit={handleExecuteAssign}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <UserCheck className="size-4 text-primary" />
                <span>Assign & Revise Employee Salary Structure</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Select an employee and structure template to automatically compute CTC components and store the effective-dated revision.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              {/* Employee Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Employees *{" "}
                  <span className="font-normal text-muted-foreground">
                    ({assignUserIds.length} selected)
                  </span>
                </Label>

                <Input
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Search employees..."
                  className="h-8 text-xs"
                  aria-label="Search employees to assign"
                />

                {/* Tick as many people as the structure applies to. */}
                <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 p-1.5">
                  {users.filter((u: any) =>
                    !assignSearch.trim()
                      ? true
                      : `${u.name ?? ""} ${u.email ?? ""} ${u.designation ?? ""} ${u.department ?? ""}`
                          .toLowerCase()
                          .includes(assignSearch.trim().toLowerCase()),
                  ).length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                      No employees match that search.
                    </p>
                  ) : (
                    users
                      .filter((u: any) =>
                        !assignSearch.trim()
                          ? true
                          : `${u.name ?? ""} ${u.email ?? ""} ${u.designation ?? ""} ${u.department ?? ""}`
                              .toLowerCase()
                              .includes(assignSearch.trim().toLowerCase()),
                      )
                      .map((u: any) => {
                        const checked = assignUserIds.includes(Number(u.id));
                        return (
                          <label
                            key={u.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/60"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                const id = Number(u.id);
                                if (value) {
                                  setAssignUserIds((prev) => [...prev, id]);
                                  // The first person picked seeds the amounts from their
                                  // current salary; after that the figures are the
                                  // structure's, shared by everyone selected.
                                  if (assignUserIds.length === 0) {
                                    setSelectedUser(u);
                                    const currentSalary = Number(u.currentSalary) || 50000;
                                    setMonthlyGrossRupees(currentSalary);
                                    setAnnualCtcRupees(currentSalary * 12);
                                  }
                                } else {
                                  setAssignUserIds((prev) => prev.filter((x) => x !== id));
                                }
                              }}
                              aria-label={`Assign to ${u.name ?? u.email}`}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {u.name}{" "}
                              <span className="text-muted-foreground">
                                ({u.designation || u.department || u.email})
                              </span>
                            </span>
                          </label>
                        );
                      })
                  )}
                </div>

                {assignUserIds.length > 1 && (
                  <p className="text-[11px] text-muted-foreground">
                    All {assignUserIds.length} employees get the same components and the same
                    effective date. Each still gets their own versioned revision.
                  </p>
                )}
              </div>

              {/* Structure Template Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Salary Structure Template *</Label>
                <Select value={assignTemplateId} onValueChange={setAssignTemplateId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select salary structure template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name} ({t.code}) — Basic {t.basicPercentage}%, HRA {t.hraPercentage}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Compensation Input: CTC vs Monthly Gross */}
              <div className="grid grid-cols-2 gap-3.5 p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Annual Cost-to-Company (CTC ₹)</Label>
                  <Input
                    type="number"
                    min="1000"
                    step="1000"
                    value={annualCtcRupees}
                    onChange={(e) => handleAnnualChange(Number(e.target.value))}
                    className="h-8 text-xs font-mono font-bold"
                    required
                  />
                  <span className="text-[10px] text-muted-foreground">Annualized compensation</span>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Monthly Gross (₹)</Label>
                  <Input
                    type="number"
                    min="100"
                    step="100"
                    value={monthlyGrossRupees}
                    onChange={(e) => handleMonthlyChange(Number(e.target.value))}
                    className="h-8 text-xs font-mono font-bold text-emerald-600"
                    required
                  />
                  <span className="text-[10px] text-muted-foreground">Base gross per pay cycle</span>
                </div>
              </div>

              {/* Effective Date & Reason */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Effective From Date</Label>
                  <Input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Revision Reason</Label>
                  <Input
                    value={revisionReason}
                    onChange={(e) => setRevisionReason(e.target.value)}
                    placeholder="e.g. Annual Appraisal, Promotion"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Live Computed Component Split Preview */}
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-border/60">
                  <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    Live Component Breakdown Preview
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-primary">
                    Gross: {formatInr(monthlyGrossRupees)}/mo
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-muted/40">
                    <span className="text-[10px] text-muted-foreground block">Basic Salary</span>
                    <span className="font-mono font-bold text-foreground">{formatInr(previewBasic)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40">
                    <span className="text-[10px] text-muted-foreground block">HRA</span>
                    <span className="font-mono font-bold text-foreground">{formatInr(previewHra)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40">
                    <span className="text-[10px] text-muted-foreground block">Special Allowance</span>
                    <span className="font-mono font-bold text-foreground">{formatInr(previewSpecial)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40">
                    <span className="text-[10px] text-muted-foreground block">Other Allowance</span>
                    <span className="font-mono font-bold text-foreground">{formatInr(previewOther)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block">PF (Employee)</span>
                    <span className="font-mono font-medium text-red-500">
                      {previewPf > 0 ? `- ${formatInr(previewPf)}` : "Nil"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">ESI / PT</span>
                    <span className="font-mono font-medium text-red-500">
                      - {formatInr(previewEsi + previewPt)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground block">Est. Net Take-Home</span>
                    <span className="font-mono font-bold text-emerald-600 text-xs">
                      {formatInr(previewNet)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isAssigning} className="font-semibold">
                {isAssigning ? "Assigning..." : "Assign & Save Structure"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: DELETE TEMPLATE CONFIRMATION ================= */}
      <Dialog
        open={deleteTemplateModal.isOpen}
        onOpenChange={(open) => !open && setDeleteTemplateModal({ isOpen: false, id: "", name: "" })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              <span>Delete Salary Structure Template</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete <strong>{deleteTemplateModal.name}</strong>? If employees are currently assigned to it, it will be safely deactivated to preserve historical payroll accuracy.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTemplateModal({ isOpen: false, id: "", name: "" })}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={confirmDeleteTemplate}
              className="font-semibold"
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
