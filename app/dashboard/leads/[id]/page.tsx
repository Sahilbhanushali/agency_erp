"use client";

import { LoadError } from "@/components/load-error";
import { jsonFetcher } from "@/lib/fetcher";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Target,
  ArrowLeft,
  Edit,
  Trash2,
  User,
  Building,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
  FileText,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog";
import { useBreadcrumbTitle } from "@/lib/route-labels";

// Throws on non-2xx, so a failed load is an error state, not an empty list.
const fetcher = (url: string) => jsonFetcher(url);

const PIPELINE_STAGES = [
  { id: "NEW", title: "New Inquiry" },
  { id: "CONTACTED", title: "Contacted" },
  { id: "QUALIFIED", title: "Qualified" },
  { id: "PROPOSAL_SENT", title: "Proposal Sent" },
  { id: "WON", title: "Closed Won" },
  { id: "LOST", title: "Closed Lost" },
];

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const { data: lead, error: leadError, mutate, isLoading } = useSWR<any>(
    leadId ? `/api/leads/${leadId}` : null,
    fetcher
  );

  const [noteContent, setNoteContent] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [createProjectOnConvert, setCreateProjectOnConvert] = useState(true);
  const [isConverting, setIsConverting] = useState(false);

  useBreadcrumbTitle(leadId, lead?.title || "Lead Details");

  const formatCurrency = (val?: number | string | null, currency = "INR") => {
    if (!val) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(val));
  };

  const handleStageChange = async (newStage: string) => {
    if (!lead || lead.status === newStage) return;
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStage }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`Pipeline stage updated to ${newStage}`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage");
    }
  };

  const handleAddActivityNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim() || !lead) return;
    setIsAddingNote(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newActivityNote: noteContent.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add activity note");
      toast.success("Activity logged");
      setNoteContent("");
      mutate();
    } catch (err: any) {
      toast.error(err.message || "Failed to log activity");
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!lead) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete lead");
      toast.success("Lead removed from pipeline");
      router.push("/dashboard/leads");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete lead");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleConvertLead = async () => {
    if (!lead) return;
    setIsConverting(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createProject: createProjectOnConvert }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to convert lead");

      toast.success("Lead converted to client successfully!");
      setIsConvertOpen(false);
      if (data.client?.id) {
        router.push(`/dashboard/clients/${data.client.id}`);
      } else {
        mutate();
      }
    } catch (err: any) {
      toast.error(err.message || "Conversion failed");
    } finally {
      setIsConverting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  // A failed load is not "not found": a 403/500 now arrives as an error (lib/fetcher.ts).
  if (leadError && (leadError as { status?: number }).status !== 404) {
    return (
      <div className="py-12">
        <LoadError what="this lead" error={leadError} onRetry={() => mutate()} />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="py-12">
        <EmptyState
          icon={Target}
          title="Lead Not Found"
          description="The requested sales lead could not be found or has been removed."
          actionLabel="Back to Pipeline"
          onAction={() => router.push("/dashboard/leads")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => router.push("/dashboard/leads")}
            aria-label="Back to leads"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {lead.title}
              </h1>
              <Badge
                variant={
                  lead.status === "WON"
                    ? "success"
                    : lead.status === "LOST"
                    ? "destructive"
                    : lead.status === "PROPOSAL_SENT"
                    ? "purple"
                    : lead.status === "QUALIFIED"
                    ? "warning"
                    : lead.status === "CONTACTED"
                    ? "info"
                    : "neutral"
                }
                className="text-xs"
              >
                {lead.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              <span>{lead.company || lead.name}</span>
              <span>·</span>
              <span>Channel: {lead.source || "INBOUND"}</span>
              <span>·</span>
              <span>Created {format(new Date(lead.createdAt), "MMM d, yyyy")}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lead.status !== "WON" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsConvertOpen(true)}
              className="text-xs gap-1.5"
            >
              <UserPlus className="size-3.5 text-emerald-600" />
              Convert to Client
            </Button>
          )}

          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href={`/dashboard/quotations/new?leadId=${lead.id}&title=${encodeURIComponent(lead.title)}`}>
              <FileText className="size-3.5 mr-1.5" />
              Create Quote
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href={`/dashboard/leads/${lead.id}/edit`}>
              <Edit className="size-3.5 mr-1.5" />
              Edit
            </Link>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Pipeline Progression Stepper */}
      <Card className="shadow-2xs">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
            {PIPELINE_STAGES.map((stg, idx) => {
              const isCurrent = lead.status === stg.id;
              const isPast =
                PIPELINE_STAGES.findIndex((s) => s.id === lead.status) > idx &&
                lead.status !== "LOST";

              return (
                <button
                  key={stg.id}
                  type="button"
                  onClick={() => handleStageChange(stg.id)}
                  className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg text-xs font-semibold transition-all border text-center flex flex-col items-center justify-center gap-1 ${
                    isCurrent
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                      : isPast
                      ? "bg-muted/80 text-foreground border-border hover:bg-muted"
                      : "bg-background text-muted-foreground border-dashed border-border/70 hover:border-border hover:text-foreground"
                  }`}
                >
                  <span className="text-xs uppercase tracking-wider opacity-80">
                    Step {idx + 1}
                  </span>
                  <span>{stg.title}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details, Scope, Activities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Contact & Value Ribbon */}
          <Card className="shadow-2xs">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4 mb-4">
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Estimated Deal Value
                  </span>
                  <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-0.5">
                    {formatCurrency(lead.estimatedValue, lead.currency)}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {lead.phone && (
                    <Button asChild size="sm" variant="outline" className="text-xs h-8 gap-1.5">
                      <a href={`tel:${lead.phone}`}>
                        <Phone className="size-3.5 text-primary" />
                        Call
                      </a>
                    </Button>
                  )}
                  {lead.phone && (
                    <Button asChild size="sm" variant="outline" className="text-xs h-8 gap-1.5">
                      <a
                        href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageSquare className="size-3.5 text-emerald-600" />
                        WhatsApp
                      </a>
                    </Button>
                  )}
                  {lead.email && (
                    <Button asChild size="sm" variant="outline" className="text-xs h-8 gap-1.5">
                      <a href={`mailto:${lead.email}`}>
                        <Mail className="size-3.5 text-sky-600" />
                        Email
                      </a>
                    </Button>
                  )}
                  {lead.website && (
                    <Button asChild size="sm" variant="outline" className="text-xs h-8 gap-1.5">
                      <a
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Globe className="size-3.5 text-purple-600" />
                        Website
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Contact info grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 py-1">
                  <User className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Contact:</span>
                  <span className="font-semibold text-foreground">{lead.name}</span>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <Building className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Company:</span>
                  <span className="font-semibold text-foreground">{lead.company || "—"}</span>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <Mail className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium text-foreground">{lead.email || "—"}</span>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <Phone className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium text-foreground tabular-nums">{lead.phone || "—"}</span>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Location:</span>
                  <span className="font-medium text-foreground">
                    {[lead.city, lead.country].filter(Boolean).join(", ") || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Next Follow-Up:</span>
                  <span className="font-medium text-foreground">
                    {lead.nextFollowUp ? format(new Date(lead.nextFollowUp), "MMM d, yyyy") : "None scheduled"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Requirements & Scope */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Project Scope & Client Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 text-xs leading-relaxed">
              {lead.requirements ? (
                <p className="whitespace-pre-wrap text-foreground">{lead.requirements}</p>
              ) : (
                <p className="text-muted-foreground italic">No requirements or scope notes recorded.</p>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed & Notes Logger */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                Activity Timeline & Sales Log
              </CardTitle>
              <CardDescription className="text-xs">
                Log notes, call summaries, and view stage transition audit logs.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <form onSubmit={handleAddActivityNote} className="space-y-2.5">
                <Textarea aria-label="Log a client interaction, call notes, or follow-up task"
                  placeholder="Log a client interaction, call notes, or follow-up task..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="text-xs min-h-[70px]"
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" loading={isAddingNote} disabled={!noteContent.trim()}>
                    Log Activity Note
                  </Button>
                </div>
              </form>

              {/* Timeline list */}
              <div className="space-y-3 pt-2">
                {!lead.activities || lead.activities.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-4">
                    No activity logs recorded yet.
                  </p>
                ) : (
                  lead.activities.map((act: any) => (
                    <div
                      key={act.id}
                      className="p-3 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-semibold text-foreground uppercase text-xs">
                          {act.type}
                        </span>
                        <span className="text-xs tabular-nums">
                          {format(new Date(act.createdAt), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                      <p className="text-foreground leading-relaxed">{act.content}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar: Ownership, Metadata, Notes */}
        <div className="space-y-6">
          {/* Assigned Owner */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="size-4 text-primary" />
                Sales Ownership
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="flex items-center gap-3">
                <Avatar className="size-9 border border-border">
                  <AvatarFallback className="text-xs font-semibold bg-muted text-foreground">
                    {lead.assignedTo?.name ? lead.assignedTo.name.substring(0, 2).toUpperCase() : "NA"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">
                    {lead.assignedTo?.name || "Unassigned"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {lead.assignedTo?.email || "No sales representative assigned"}
                  </p>
                </div>
              </div>

              {lead.convertedToClientId && (
                <div className="mt-3 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-4" />
                    Converted to Client
                  </div>
                  <Link
                    href={`/dashboard/clients/${lead.convertedToClientId}`}
                    className="text-primary hover:underline font-medium flex items-center gap-1 pt-1"
                  >
                    View Client Account <ExternalLink className="size-3" />
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Internal Notes */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Internal Pitch Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 text-xs leading-relaxed text-foreground">
              {lead.notes ? (
                <p className="whitespace-pre-wrap">{lead.notes}</p>
              ) : (
                <p className="text-muted-foreground italic">No internal pitch notes added.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Sales Opportunity"
        itemName={lead.title}
        entityType="lead"
        isLoading={isDeleting}
      />

      {/* Convert to Client Modal */}
      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-emerald-600" />
              Convert Lead to Agency Client
            </DialogTitle>
            <DialogDescription className="text-xs">
              Converts &quot;{lead.name}&quot; into an official client account for campaigns, approvals, and invoices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1">
              <p className="font-semibold text-foreground">Client Name: {lead.name}</p>
              <p className="text-muted-foreground">Company: {lead.company || "—"}</p>
              <p className="text-muted-foreground">Email: {lead.email || "—"}</p>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={createProjectOnConvert}
                onChange={(e) => setCreateProjectOnConvert(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary size-4"
              />
              <span className="text-xs font-medium text-foreground">
                Automatically initialize a Project Workspace named &quot;{lead.title}&quot;
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              disabled={isConverting}
              onClick={() => setIsConvertOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConvertLead}
              loading={isConverting}
            >
              Confirm Conversion
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
