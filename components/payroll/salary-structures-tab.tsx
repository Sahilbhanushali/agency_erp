"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { splitGross } from "@/lib/payroll/salary-basis";
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

/** One row of GET /api/payroll/structures/assign: salary as the HR profile has it. */
interface StaffSalary {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
  designation: string | null;
  department: string | null;
  currentSalary: number | null;
  salaryFrequency: string | null;
  /** Rupees per month derived from the profile, or null with `salaryProblem` saying why. */
  monthlyGross: number | null;
  salaryProblem: string | null;
  bankName: string | null;
  bankLast4: string | null;
  structure: { monthlyGross: number; template: { id: string; name: string } | null } | null;
}

export function SalaryStructuresTab({ onRefresh }: { onRefresh?: () => void }) {
  const [activeSubTab, setActiveSubTab] = useState<"roster" | "templates">("roster");
  const [searchTerm, setSearchTerm] = useState("");

  // SWR for templates
  const {
    data: templates = [],
    isLoading: isLoadingTemplates,
    mutate: mutateTemplates,
  } = useSWR<StructureTemplate[]>("/api/payroll/structures", fetcher);

  // Salaries come from each employee's HR profile; /api/users doesn't carry them.
  const {
    data: users = [],
    error: staffError,
    isLoading: isLoadingStaff,
    mutate: mutateStaff,
  } = useSWR<StaffSalary[]>("/api/payroll/structures/assign", fetcher);

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
  /**
   * Employees receiving the structure. A list, because a band or grade normally applies
   * to several people. Each keeps their own salary from the HR profile.
   */
  const [assignUserIds, setAssignUserIds] = useState<number[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignTemplateId, setAssignTemplateId] = useState<string>("");
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

  const handleOpenAssignModal = (user: StaffSalary) => {
    // The template they're on, else the default.
    const tmpl = templates.find((t) => t.id === user.structure?.template?.id) || templates.find((t) => t.isDefault) || templates[0];
    setAssignTemplateId(tmpl?.id || "");
    setAssignUserIds(user.monthlyGross !== null ? [Number(user.id)] : []);
    setEffectiveFrom(new Date().toISOString().split("T")[0]);
    setRevisionReason("Structure alignment & revision");
    setIsAssignModalOpen(true);
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
      mutateStaff();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Assignment failed");
    } finally {
      setIsAssigning(false);
    }
  };

  const currentSelectedTemplate = templates.find((t) => t.id === assignTemplateId);

  // Each selected employee's split, from their own salary.
  const previewRows = users
    .filter((u) => assignUserIds.includes(Number(u.id)) && u.monthlyGross !== null)
    .map((u) => {
      const gross = u.monthlyGross as number;
      const split = splitGross(Math.round(gross * 100), currentSelectedTemplate);
      const basic = split.basicSalary / 100;
      // Estimate only; the run applies the statutory rules exactly.
      const pf = currentSelectedTemplate?.pfApplicable ? Math.round(Math.min(basic, 15000) * 0.12) : 0;
      const esi = currentSelectedTemplate?.esiApplicable && gross <= 21000 ? Math.round(gross * 0.0075) : 0;
      const pt = currentSelectedTemplate?.professionalTax ? 200 : 0;
      return { u, gross, split, net: gross - pf - esi - pt };
    });

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
              <Input aria-label="Search employee, email, role"
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
                  {isLoadingStaff ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground">
                        Loading salaries…
                      </TableCell>
                    </TableRow>
                  ) : staffError ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-xs">
                        <span className="text-destructive">Could not load salaries. </span>
                        <Button variant="link" size="xs" onClick={() => mutateStaff()}>Try again</Button>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground">
                        {searchTerm ? "No employees match your search criteria." : "No employee profiles found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => {
                      const monthlyGross = u.monthlyGross ?? 0;
                      const annualCtc = monthlyGross * 12;

                      return (
                        <TableRow key={u.id} className="hover:bg-muted/20">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-7">
                                <AvatarImage src={u.avatar ?? undefined} />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                  {u.name?.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-xs font-bold text-foreground">{u.name}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium text-foreground">{u.designation || "Staff"}</span>
                            <span className="text-muted-foreground text-xs block">{u.department || "General"}</span>
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-bold text-foreground">
                            {monthlyGross > 0 ? (
                              formatInr(monthlyGross)
                            ) : (
                              <span className="text-amber-700 dark:text-amber-400 font-normal font-sans" title={u.salaryProblem ?? undefined}>
                                Set on HR profile
                              </span>
                            )}
                            {u.structure?.template && (
                              <span className="block text-xs font-sans font-normal text-muted-foreground">{u.structure.template.name}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-bold text-emerald-600">
                            {annualCtc > 0 ? formatInr(annualCtc) : <span className="text-muted-foreground font-normal">Not Set</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {u.bankLast4 ? (
                              <span className="text-xs text-foreground">
                                ••••{u.bankLast4} ({u.bankName || "Bank"})
                              </span>
                            ) : (
                              <Badge variant="destructive" className="text-xs py-0">Missing A/C</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleOpenAssignModal(u)}
                              disabled={u.monthlyGross === null}
                              title={u.salaryProblem ?? undefined}
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
                            <Badge variant="default" className="text-xs bg-primary gap-0.5 py-0 px-1.5">
                              <Star className="size-2.5 fill-current" /> Default
                            </Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-xs font-mono tracking-wider">
                            {t.code}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
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
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                        Component Allocation (% of Gross)
                      </span>
                      <div className="grid grid-cols-4 gap-1 text-center text-xs font-mono pt-1">
                        <div className="p-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                          <span className="text-xs block text-muted-foreground font-sans">Basic</span>
                          <strong>{t.basicPercentage}%</strong>
                        </div>
                        <div className="p-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          <span className="text-xs block text-muted-foreground font-sans">HRA</span>
                          <strong>{t.hraPercentage}%</strong>
                        </div>
                        <div className="p-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          <span className="text-xs block text-muted-foreground font-sans">Special</span>
                          <strong>{t.specialPercentage}%</strong>
                        </div>
                        <div className="p-1 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300">
                          <span className="text-xs block text-muted-foreground font-sans">Other</span>
                          <strong>{t.otherPercentage}%</strong>
                        </div>
                      </div>
                    </div>

                    {/* Statutory Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <Badge variant={t.pfApplicable ? "outline" : "neutral"} className="text-xs py-0">
                        {t.pfApplicable ? "PF (12%) Included" : "No PF"}
                      </Badge>
                      <Badge variant={t.esiApplicable ? "outline" : "neutral"} className="text-xs py-0">
                        {t.esiApplicable ? "ESI Applicable" : "No ESI"}
                      </Badge>
                      <Badge variant={t.professionalTax ? "outline" : "neutral"} className="text-xs py-0">
                        {t.professionalTax ? "PT Deducted" : "No PT"}
                      </Badge>
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setAssignUserIds([]);
                          setAssignTemplateId(t.id);
                          setIsAssignModalOpen(true);
                        }}
                        className="text-xs text-primary font-medium p-0 h-auto hover:underline"
                      >
                        Assign to Staff →
                      </Button>

                      <div className="flex items-center gap-1">
                        <Button aria-label="Edit Structure Template"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleOpenEditTemplate(t)}
                          title="Edit Structure Template"
                        >
                          <Edit className="size-3.5 text-muted-foreground" />
                        </Button>
                        {!t.isDefault && (
                          <Button aria-label="Delete Structure Template"
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
                  <Input aria-label="Structure Name"
                    required
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="e.g. Standard Corporate Executive"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label className="text-xs font-semibold">Structure Code *</Label>
                  <Input aria-label="Structure Code"
                    required
                    value={templateForm.code}
                    onChange={(e) => setTemplateForm({ ...templateForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. STD_CORP"
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Input aria-label="Description"
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
                    className="text-xs font-mono"
                  >
                    Sum: {percentageSum.toFixed(1)}% / 100%
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Basic Salary (%) *</Label>
                    <Input aria-label="Basic Salary (%)"
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
                    <Input aria-label="HRA (%)"
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
                    <Input aria-label="Special Allowance (%)"
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
                    <Input aria-label="Other Allowance (%)"
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
          <form onSubmit={handleExecuteAssign} className="min-w-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <UserCheck className="size-4 text-primary" />
                <span>Assign & Revise Employee Salary Structure</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Pick employees and a template. Each person&apos;s components are worked out from the salary on their HR profile.
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
                      .map((u) => {
                        const checked = assignUserIds.includes(Number(u.id));
                        const noSalary = u.monthlyGross === null;
                        return (
                          <label
                            key={u.id}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${noSalary ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/60"}`}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={noSalary}
                              onCheckedChange={(value) => {
                                const id = Number(u.id);
                                setAssignUserIds((prev) => (value ? [...prev, id] : prev.filter((x) => x !== id)));
                              }}
                              aria-label={`Assign to ${u.name ?? u.email}`}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {u.name}{" "}
                              <span className="text-muted-foreground">
                                ({u.designation || u.department || u.email})
                              </span>
                            </span>
                            <span className={`shrink-0 font-mono ${noSalary ? "text-amber-700 dark:text-amber-400 font-sans" : "text-foreground"}`}>
                              {noSalary ? (u.salaryProblem ?? "No salary") : `${formatInr(u.monthlyGross as number)}/mo`}
                            </span>
                          </label>
                        );
                      })
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Each employee&apos;s components are split from the salary on their HR profile.
                  To change a salary, edit it there; greyed-out employees have none set yet.
                </p>
              </div>

              {/* Structure Template Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Salary Structure Template *</Label>
                <Select value={assignTemplateId} onValueChange={setAssignTemplateId}>
                  <SelectTrigger aria-label="Salary Structure Template" className="h-8 text-xs w-full min-w-0 [&>span]:truncate">
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

              {/* Effective Date & Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Effective From Date</Label>
                  <Input aria-label="Effective From Date"
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Revision Reason</Label>
                  <Input aria-label="Revision Reason"
                    value={revisionReason}
                    onChange={(e) => setRevisionReason(e.target.value)}
                    placeholder="e.g. Annual Appraisal, Promotion"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Each selected employee's split, from their own salary */}
              <div className="rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border/60 px-3.5 py-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    Breakdown preview
                  </span>
                  <span className="text-xs text-muted-foreground">Net is an estimate</span>
                </div>
                {previewRows.length === 0 ? (
                  <p className="px-3.5 py-5 text-center text-xs text-muted-foreground">
                    Select employees above to see how {currentSelectedTemplate?.name ?? "the template"} splits their salary.
                  </p>
                ) : (
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card text-muted-foreground">
                        <tr className="text-left">
                          <th className="px-3 py-1.5 font-medium">Employee</th>
                          <th className="px-2 py-1.5 font-medium text-right">Gross</th>
                          <th className="px-2 py-1.5 font-medium text-right">Basic</th>
                          <th className="px-2 py-1.5 font-medium text-right">HRA</th>
                          <th className="px-2 py-1.5 font-medium text-right hidden sm:table-cell">Special</th>
                          <th className="px-2 py-1.5 font-medium text-right hidden sm:table-cell">Other</th>
                          <th className="px-3 py-1.5 font-medium text-right">Est. net</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {previewRows.map(({ u, gross, split, net }) => (
                          <tr key={u.id} className="border-t border-border/40">
                            <td className="px-3 py-1.5 font-sans truncate max-w-[9rem]" title={u.name ?? u.email}>{u.name ?? u.email}</td>
                            <td className="px-2 py-1.5 text-right font-semibold">{formatInr(gross)}</td>
                            <td className="px-2 py-1.5 text-right">{formatInr(split.basicSalary, true)}</td>
                            <td className="px-2 py-1.5 text-right">{formatInr(split.hra, true)}</td>
                            <td className="px-2 py-1.5 text-right hidden sm:table-cell">{formatInr(split.specialAllowance, true)}</td>
                            <td className="px-2 py-1.5 text-right hidden sm:table-cell">{formatInr(split.otherAllowances, true)}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-emerald-700 dark:text-emerald-400">{formatInr(net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isAssigning || assignUserIds.length === 0} className="font-semibold">
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
