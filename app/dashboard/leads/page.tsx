"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import {
  Target,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Award,
  CheckCircle2,
  Calendar,
  Phone,
  Mail,
  Building,
  User,
  ArrowRight,
  MoreHorizontal,
  Trash2,
  Edit,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Kanban,
  Table as TableIcon,
  XCircle,
  Clock,
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "WON"
  | "LOST";

interface Lead {
  id: string;
  title: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status: LeadStatus;
  estimatedValue?: number | string | null;
  currency: string;
  assignedToId?: number | null;
  assignedTo?: { id: number; name: string; email: string; avatar?: string } | null;
  notes?: string | null;
  requirements?: string | null;
  nextFollowUp?: string | null;
  convertedToClientId?: string | null;
  convertedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  activities?: Array<{
    id: string;
    type: string;
    content: string;
    createdAt: string;
  }>;
}

const PIPELINE_COLUMNS: Array<{
  id: LeadStatus;
  title: string;
  color: string;
  badgeVariant: "neutral" | "info" | "warning" | "purple" | "success" | "destructive";
}> = [
  { id: "NEW", title: "New Inquiries", color: "border-neutral-300 text-neutral-700 dark:text-neutral-300", badgeVariant: "neutral" },
  { id: "CONTACTED", title: "Contacted", color: "border-sky-300 text-sky-700 dark:text-sky-300", badgeVariant: "info" },
  { id: "QUALIFIED", title: "Qualified", color: "border-amber-300 text-amber-700 dark:text-amber-300", badgeVariant: "warning" },
  { id: "PROPOSAL_SENT", title: "Proposal Sent", color: "border-purple-300 text-purple-700 dark:text-purple-300", badgeVariant: "purple" },
  { id: "WON", title: "Closed Won", color: "border-emerald-300 text-emerald-700 dark:text-emerald-300", badgeVariant: "success" },
  { id: "LOST", title: "Closed Lost", color: "border-rose-300 text-rose-700 dark:text-rose-300", badgeVariant: "destructive" },
];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function LeadsPage() {
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("ALL");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [createProjectOnConvert, setCreateProjectOnConvert] = useState(true);
  const [activityNote, setActivityNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for creating lead
  const [newLead, setNewLead] = useState({
    title: "",
    name: "",
    company: "",
    email: "",
    phone: "",
    source: "INBOUND",
    status: "NEW",
    estimatedValue: "",
    currency: "INR",
    assignedToId: "",
    notes: "",
    requirements: "",
    nextFollowUp: "",
  });

  const { data, mutate, isLoading } = useSWR<{
    leads: Lead[];
    metrics: {
      totalLeads: number;
      pipelineValue: number;
      wonValue: number;
      wonCount: number;
      winRate: number;
    };
  }>("/api/leads", fetcher, { revalidateOnFocus: true });

  const { data: usersData = [] } = useSWR<any[]>("/api/users", fetcher);

  const leads = useMemo(() => data?.leads || [], [data]);
  const metrics = data?.metrics || {
    totalLeads: 0,
    pipelineValue: 0,
    wonValue: 0,
    wonCount: 0,
    winRate: 0,
  };

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = lead.title?.toLowerCase().includes(q);
        const matchesName = lead.name?.toLowerCase().includes(q);
        const matchesCompany = lead.company?.toLowerCase().includes(q);
        const matchesEmail = lead.email?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesName && !matchesCompany && !matchesEmail) {
          return false;
        }
      }

      if (selectedAssignee !== "ALL") {
        if (String(lead.assignedToId) !== selectedAssignee) {
          return false;
        }
      }

      return true;
    });
  }, [leads, search, selectedAssignee]);

  const formatCurrency = (amount?: number | string | null, currency = "INR") => {
    if (!amount) return "₹0";
    const num = Number(amount);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.title || !newLead.name) {
      toast.error("Lead title and contact name are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLead),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to create lead");

      toast.success("Lead created successfully");
      setIsCreateOpen(false);
      setNewLead({
        title: "",
        name: "",
        company: "",
        email: "",
        phone: "",
        source: "INBOUND",
        status: "NEW",
        estimatedValue: "",
        currency: "INR",
        assignedToId: "",
        notes: "",
        requirements: "",
        nextFollowUp: "",
      });
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to create lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Could not update stage");

      toast.success(`Moved to ${newStatus.replace(/_/g, " ")}`);
      mutate();
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage");
    }
  };

  const handleAddActivityNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !activityNote.trim()) return;

    try {
      const res = await fetch(`/api/leads/${selectedLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newActivityNote: activityNote.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error("Failed to add note");

      toast.success("Activity note added");
      setActivityNote("");
      setSelectedLead(body);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to log note");
    }
  };

  const handleConvertLead = async () => {
    if (!selectedLead) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createProject: createProjectOnConvert,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to convert lead");

      toast.success(`Successfully converted to Client "${body.client.name}"!`);
      setIsConvertOpen(false);
      setSelectedLead(body.lead);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to convert lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete lead");

      toast.success("Lead deleted");
      if (selectedLead?.id === leadId) setSelectedLead(null);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete lead");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <Target className="size-7 text-primary" />
            Leads Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage inquiries, sales pipeline, proposal stages, and deal conversions.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex rounded-lg border border-border bg-muted p-1">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className="gap-1.5"
            >
              <Kanban className="size-3.5" />
              Pipeline
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="gap-1.5"
            >
              <TableIcon className="size-3.5" />
              Table
            </Button>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New Lead
          </Button>
        </div>
      </div>

      {/* KPI Pipeline Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Total Inquiries</p>
            <Target className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {metrics.totalLeads}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Across all stages</p>
        </Card>

        <Card className="p-4 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Pipeline Value</p>
            <TrendingUp className="size-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {formatCurrency(metrics.pipelineValue)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Active deal value</p>
        </Card>

        <Card className="p-4 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Closed Won Deals</p>
            <Award className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {formatCurrency(metrics.wonValue)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{metrics.wonCount} deals closed</p>
        </Card>

        <Card className="p-4 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Win Rate</p>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {metrics.winRate}%
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Conversion effectiveness</p>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search leads by deal, contact, company, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger className="w-[180px] h-9 text-xs">
                  <User className="size-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Assigned Rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Sales Reps</SelectItem>
                  {usersData.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content: Pipeline Kanban vs Table */}
      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 overflow-x-auto pb-4">
          {PIPELINE_COLUMNS.map((col) => {
            const columnLeads = filteredLeads.filter((l) => l.status === col.id);
            const columnTotal = columnLeads.reduce(
              (acc, l) => acc + Number(l.estimatedValue || 0),
              0
            );

            return (
              <div
                key={col.id}
                className="flex flex-col rounded-xl border border-border/80 bg-muted/30 p-2.5 min-w-[240px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {col.title}
                    </span>
                    <Badge variant={col.badgeVariant} className="text-[10px] px-1.5 py-0 tabular-nums">
                      {columnLeads.length}
                    </Badge>
                  </div>
                  {columnTotal > 0 && (
                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                      {formatCurrency(columnTotal)}
                    </span>
                  )}
                </div>

                {/* Column Cards */}
                <div className="space-y-2.5 flex-1 min-h-[200px]">
                  {columnLeads.length === 0 ? (
                    <div className="h-28 flex items-center justify-center rounded-lg border border-dashed border-border/60 text-[11px] text-muted-foreground/60">
                      Empty stage
                    </div>
                  ) : (
                    columnLeads.map((lead) => (
                      <Card
                        key={lead.id}
                        className="p-3 bg-card hover:border-primary/40 transition-shadow cursor-pointer shadow-sm relative group"
                        onClick={() => setSelectedLead(lead)}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                            {lead.title}
                          </h4>
                          <Badge variant="neutral" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
                            {lead.source || "INBOUND"}
                          </Badge>
                        </div>

                        <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <User className="size-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{lead.name}</span>
                          </div>
                          {lead.company && (
                            <div className="flex items-center gap-1.5">
                              <Building className="size-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{lead.company}</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground tabular-nums">
                            {formatCurrency(lead.estimatedValue)}
                          </span>

                          <div className="flex items-center gap-1">
                            {lead.assignedTo?.name ? (
                              <Avatar className="size-5 text-[9px]">
                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                  {lead.assignedTo.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/80">Unassigned</span>
                            )}
                          </div>
                        </div>

                        {/* Quick action button */}
                        {lead.status === "WON" && !lead.convertedToClientId && (
                          <div className="mt-2 pt-1">
                            <Button
                              size="xs"
                              variant="default"
                              className="w-full text-[10px] h-6 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLead(lead);
                                setIsConvertOpen(true);
                              }}
                            >
                              <Sparkles className="size-3" />
                              Convert to Client
                            </Button>
                          </div>
                        )}
                        {lead.convertedToClientId && (
                          <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="size-3" />
                            Client Active
                          </div>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal Title</TableHead>
                <TableHead>Contact / Company</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Assigned Rep</TableHead>
                <TableHead>Next Follow-Up</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <EmptyState
                      icon={Target}
                      title="No leads found"
                      description="No leads match your criteria. Add your first sales lead to get started."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => {
                  const col = PIPELINE_COLUMNS.find((c) => c.id === lead.status);
                  return (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <TableCell className="font-semibold text-xs text-foreground max-w-[200px]">
                        <span className="line-clamp-1">{lead.title}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-foreground">{lead.name}</p>
                          <p className="text-[11px] text-muted-foreground">{lead.company || lead.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={col?.badgeVariant || "neutral"} dot className="text-[10px]">
                          {lead.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums font-semibold text-xs text-foreground">
                        {formatCurrency(lead.estimatedValue)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.source}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.assignedTo?.name || "Unassigned"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-xs">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 text-xs">
                            <DropdownMenuItem onClick={() => setSelectedLead(lead)}>
                              View Details & Activity
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, "QUALIFIED")}>
                              Mark Qualified
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, "PROPOSAL_SENT")}>
                              Proposal Sent
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                handleStatusChange(lead.id, "WON");
                                setSelectedLead(lead);
                                setIsConvertOpen(true);
                              }}
                              className="text-emerald-600"
                            >
                              Close as Won
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, "LOST")} className="text-rose-600">
                              Mark Lost
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteLead(lead.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-3.5 mr-2" />
                              Delete Lead
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Lead Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              Add New Sales Lead
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Capture a new prospective client inquiry or project deal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateLead} className="space-y-3.5 mt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label htmlFor="lead-title" className="text-xs">Deal / Opportunity Title *</Label>
                <Input
                  id="lead-title"
                  placeholder="e.g. Nike Social Media Management Retainer"
                  value={newLead.title}
                  onChange={(e) => setNewLead({ ...newLead, title: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="lead-contact" className="text-xs">Contact Person Name *</Label>
                <Input
                  id="lead-contact"
                  placeholder="e.g. John Doe"
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="lead-company" className="text-xs">Brand / Company Name</Label>
                <Input
                  id="lead-company"
                  placeholder="e.g. Acme Industries"
                  value={newLead.company}
                  onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="lead-email" className="text-xs">Email Address</Label>
                <Input
                  id="lead-email"
                  type="email"
                  placeholder="contact@brand.com"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="lead-phone" className="text-xs">Phone / WhatsApp</Label>
                <Input
                  id="lead-phone"
                  placeholder="+91 98765 43210"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="lead-val" className="text-xs">Estimated Value (INR)</Label>
                <Input
                  id="lead-val"
                  type="number"
                  placeholder="e.g. 75000"
                  value={newLead.estimatedValue}
                  onChange={(e) => setNewLead({ ...newLead, estimatedValue: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="lead-source" className="text-xs">Lead Source</Label>
                <Select
                  value={newLead.source}
                  onValueChange={(val) => setNewLead({ ...newLead, source: val })}
                >
                  <SelectTrigger id="lead-source" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INBOUND">Inbound Inquiry</SelectItem>
                    <SelectItem value="WEBSITE">Website Form</SelectItem>
                    <SelectItem value="INSTAGRAM">Instagram DM</SelectItem>
                    <SelectItem value="LINKEDIN">LinkedIn Outreach</SelectItem>
                    <SelectItem value="REFERRAL">Referral</SelectItem>
                    <SelectItem value="COLD_OUTREACH">Cold Outreach</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="lead-stage" className="text-xs">Initial Pipeline Stage</Label>
                <Select
                  value={newLead.status}
                  onValueChange={(val) => setNewLead({ ...newLead, status: val })}
                >
                  <SelectTrigger id="lead-stage" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New Inquiries</SelectItem>
                    <SelectItem value="CONTACTED">Contacted</SelectItem>
                    <SelectItem value="QUALIFIED">Qualified</SelectItem>
                    <SelectItem value="PROPOSAL_SENT">Proposal Sent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="lead-rep" className="text-xs">Assigned Sales Rep</Label>
                <Select
                  value={newLead.assignedToId}
                  onValueChange={(val) => setNewLead({ ...newLead, assignedToId: val })}
                >
                  <SelectTrigger id="lead-rep" className="mt-1">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersData.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="lead-follow" className="text-xs">Next Follow-Up Date</Label>
                <Input
                  id="lead-follow"
                  type="date"
                  value={newLead.nextFollowUp}
                  onChange={(e) => setNewLead({ ...newLead, nextFollowUp: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="lead-notes" className="text-xs">Requirements & Notes</Label>
                <Textarea
                  id="lead-notes"
                  placeholder="Client requirements, deliverables, budget discussion, remarks..."
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  rows={3}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/70">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={isSubmitting}>
                Create Lead
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lead Details & Activity Drawer */}
      {selectedLead && (
        <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <Target className="size-5 text-primary" />
                    {selectedLead.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Contact: {selectedLead.name} {selectedLead.company ? `(${selectedLead.company})` : ""}
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Select
                    value={selectedLead.status}
                    onValueChange={(val) => handleStatusChange(selectedLead.id, val as LeadStatus)}
                  >
                    <SelectTrigger className="h-8 text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">New Inquiry</SelectItem>
                      <SelectItem value="CONTACTED">Contacted</SelectItem>
                      <SelectItem value="QUALIFIED">Qualified</SelectItem>
                      <SelectItem value="PROPOSAL_SENT">Proposal Sent</SelectItem>
                      <SelectItem value="WON">Closed Won</SelectItem>
                      <SelectItem value="LOST">Closed Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Meta details banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl border border-border p-3 bg-muted/20">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Deal Value</p>
                  <p className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                    {formatCurrency(selectedLead.estimatedValue)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Lead Source</p>
                  <p className="text-xs font-medium text-foreground mt-0.5">{selectedLead.source}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Email</p>
                  <p className="text-xs font-medium text-foreground truncate mt-0.5">
                    {selectedLead.email || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Phone</p>
                  <p className="text-xs font-medium text-foreground truncate mt-0.5">
                    {selectedLead.phone || "—"}
                  </p>
                </div>
              </div>

              {/* Conversion bar if Won */}
              {selectedLead.status === "WON" && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                        {selectedLead.convertedToClientId ? "Client Created" : "Deal is Won!"}
                      </p>
                      <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                        {selectedLead.convertedToClientId
                          ? "This lead is active as an agency client in your CRM."
                          : "Ready to graduate this lead into your Client & Project workspace."}
                      </p>
                    </div>
                  </div>
                  {!selectedLead.convertedToClientId && (
                    <Button
                      size="sm"
                      onClick={() => setIsConvertOpen(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    >
                      <Sparkles className="size-3.5" />
                      Convert to Client
                    </Button>
                  )}
                </div>
              )}

              {/* Notes / Requirements */}
              {selectedLead.notes && (
                <div className="rounded-lg border border-border p-3 bg-card">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Requirements & Notes
                  </h4>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{selectedLead.notes}</p>
                </div>
              )}

              {/* Activity Logger Form */}
              <form onSubmit={handleAddActivityNote} className="space-y-2">
                <Label htmlFor="act-note" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MessageSquare className="size-3.5 text-primary" />
                  Log Call / Meeting / Note
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="act-note"
                    placeholder="e.g. Spoke on phone, sent quotation draft, follow up next Monday..."
                    value={activityNote}
                    onChange={(e) => setActivityNote(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button type="submit" size="sm" className="h-8 text-xs shrink-0" disabled={!activityNote.trim()}>
                    Log Note
                  </Button>
                </div>
              </form>

              {/* Activity Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Activity Timeline
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedLead.activities?.length ? (
                    selectedLead.activities.map((act) => (
                      <div key={act.id} className="flex items-start gap-2 text-xs p-2.5 rounded-lg border border-border/60 bg-muted/20">
                        <Clock className="size-3.5 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-foreground text-xs">{act.content}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(act.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No activities recorded yet.</p>
                  )}
                </div>
              </div>

              {/* Footer action */}
              <div className="flex justify-between items-center pt-2 border-t border-border/70">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteLead(selectedLead.id)}
                  className="gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  Delete Lead
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedLead(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Convert Lead to Client Modal */}
      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="size-5 text-emerald-500" />
              Convert Lead to Active Client
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This will create a new Client record from this lead and transition it into active agency delivery.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="rounded-lg border border-border p-3 bg-muted/20 space-y-1 text-xs">
              <p><strong>Client Name:</strong> {selectedLead?.name}</p>
              <p><strong>Company:</strong> {selectedLead?.company || selectedLead?.title}</p>
              <p><strong>Email:</strong> {selectedLead?.email || "Will be generated"}</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="create-proj"
                checked={createProjectOnConvert}
                onChange={(e) => setCreateProjectOnConvert(e.target.checked)}
                className="size-4 rounded border-border"
              />
              <Label htmlFor="create-proj" className="text-xs cursor-pointer">
                Automatically initialize project workspace for this client
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/70">
            <Button variant="outline" size="sm" onClick={() => setIsConvertOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={isSubmitting}
              onClick={handleConvertLead}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <CheckCircle2 className="size-3.5" />
              Confirm Conversion
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
