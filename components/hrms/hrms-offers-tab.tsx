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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FileCheck2,
  Plus,
  Download,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  History,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Edit,
  Building,
  User,
  DollarSign,
  Sparkles,
} from "lucide-react";
import { formatCurrencyINR, formatDatePretty } from "@/lib/hrms/placeholder-engine";
import toast from "react-hot-toast";

interface Offer {
  id: string;
  offerNumber: string;
  jobTitle: string;
  department: string;
  employmentType: string;
  workLocation: string;
  joiningDate: string;
  probationPeriodMonths: number;
  validityDate: string;
  annualCtc: number;
  monthlyGross: number;
  salaryBreakdown?: string | null;
  benefits?: string | null;
  additionalTerms?: string | null;
  status: string;
  version: number;
  createdAt: string;
  candidate: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
  jobOpening: {
    id: string;
    title: string;
    department: string;
  };
  template?: { id: string; name: string } | null;
  letterhead?: { id: string; name: string; companyName: string } | null;
  revisions?: {
    id: string;
    version: number;
    annualCtc: number;
    monthlyGross: number;
    joiningDate: string;
    changeReason?: string | null;
    createdAt: string;
  }[];
}

interface HrmsOffersTabProps {
  initialCandidateId?: string | null;
  initialJobOpeningId?: string | null;
  onClearInitialOffer?: () => void;
}

export function HrmsOffersTab({
  initialCandidateId,
  initialJobOpeningId,
  onClearInitialOffer,
}: HrmsOffersTabProps) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [letterheads, setLetterheads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  // Prepare Offer Dialog
  const [isPrepareOpen, setIsPrepareOpen] = useState(false);
  const [formData, setFormData] = useState({
    candidateId: "",
    jobOpeningId: "",
    templateId: "",
    letterheadId: "",
    jobTitle: "",
    department: "Engineering",
    reportingManagerId: "",
    employmentType: "FULL_TIME",
    workLocation: "Bengaluru HQ (Hybrid)",
    joiningDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    probationPeriodMonths: 3,
    validityDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    annualCtc: 1800000,
    monthlyGross: 150000,
    benefits: "Group Medical Insurance up to ₹5,00,000 for self and dependents. Annual learning stipend.",
    additionalTerms: "",
    status: "READY_TO_SEND",
  });

  // Revision Dialog (Never silently overwrite!)
  const [revisionModal, setRevisionModal] = useState<{
    isOpen: boolean;
    offer: Offer | null;
    annualCtc: number;
    monthlyGross: number;
    joiningDate: string;
    changeReason: string;
  }>({
    isOpen: false,
    offer: null,
    annualCtc: 0,
    monthlyGross: 0,
    joiningDate: "",
    changeReason: "",
  });

  // Revision History View Modal
  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    offer: Offer | null;
  }>({
    isOpen: false,
    offer: null,
  });

  // Status Confirmation Modal
  const [statusConfirmModal, setStatusConfirmModal] = useState<{
    isOpen: boolean;
    offerId: string;
    offerNumber: string;
    candidateName: string;
    status: string;
  }>({
    isOpen: false,
    offerId: "",
    offerNumber: "",
    candidateName: "",
    status: "",
  });


  const fetchOffers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedStatus !== "ALL") params.set("status", selectedStatus);

      const res = await fetch(`/api/hrms/offers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch offers");
      const data = await res.json();
      setOffers(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load offers");
    } finally {
      setLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const [candRes, jobRes, tmplRes, lhRes, userRes] = await Promise.all([
        fetch("/api/hrms/candidates"),
        fetch("/api/hrms/jobs"),
        fetch("/api/hrms/templates"),
        fetch("/api/hrms/letterheads"),
        fetch("/api/users"),
      ]);
      if (candRes.ok) setCandidates(await candRes.json());
      if (jobRes.ok) setJobs(await jobRes.json());
      if (tmplRes.ok) setTemplates(await tmplRes.json());
      if (lhRes.ok) setLetterheads(await lhRes.json());
      if (userRes.ok) {
        const u = await userRes.json();
        setUsers(Array.isArray(u) ? u : u.users || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchReferenceData();
  }, []);

  useEffect(() => {
    fetchOffers();
  }, [selectedStatus]);

  // Handle external open (e.g. from Pipeline or Candidate card)
  useEffect(() => {
    if (initialCandidateId) {
      setFormData((prev) => ({
        ...prev,
        candidateId: initialCandidateId,
        jobOpeningId: initialJobOpeningId || prev.jobOpeningId,
      }));
      setIsPrepareOpen(true);
      onClearInitialOffer?.();
    }
  }, [initialCandidateId, initialJobOpeningId]);

  // Auto calculate monthly gross when annual CTC changes
  const handleAnnualCtcChange = (value: number) => {
    setFormData((prev) => ({
      ...prev,
      annualCtc: value,
      monthlyGross: Math.round(value / 12),
    }));
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.candidateId || !formData.jobOpeningId) {
      toast.error("Please select a candidate and job opening");
      return;
    }

    try {
      const res = await fetch("/api/hrms/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create offer");

      toast.success(`Offer ${data.offerNumber} prepared successfully!`);
      setIsPrepareOpen(false);
      fetchOffers();
    } catch (err: any) {
      toast.error(err.message || "Failed to prepare offer");
    }
  };

  const handleStatusChange = async (offerId: string, status: string) => {
    try {
      const res = await fetch(`/api/hrms/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error("Failed to update offer status");
      toast.success(`Offer marked as ${status}`);
      fetchOffers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update offer status");
    }
  };

  const handleRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionModal.offer) return;

    try {
      const res = await fetch(`/api/hrms/offers/${revisionModal.offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annualCtc: revisionModal.annualCtc,
          monthlyGross: revisionModal.monthlyGross,
          joiningDate: revisionModal.joiningDate,
          changeReason: revisionModal.changeReason || "Compensation revision",
        }),
      });

      if (!res.ok) throw new Error("Failed to revise offer");
      toast.success("Offer terms revised and previous version archived!");
      setRevisionModal({ isOpen: false, offer: null, annualCtc: 0, monthlyGross: 0, joiningDate: "", changeReason: "" });
      fetchOffers();
    } catch (err: any) {
      toast.error(err.message || "Failed to revise offer");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return <Badge variant="default" className="bg-emerald-600">Accepted</Badge>;
      case "SENT":
        return <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">Sent</Badge>;
      case "READY_TO_SEND":
        return <Badge variant="outline" className="text-teal-600 border-teal-500/30">Ready to Send</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">Declined</Badge>;
      case "WITHDRAWN":
        return <Badge variant="secondary">Withdrawn</Badge>;
      case "ARCHIVED":
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 p-3 rounded-lg border border-border/60">
        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue placeholder="All Offer Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="READY_TO_SEND">Ready to Send</SelectItem>
              <SelectItem value="SENT">Sent to Candidate</SelectItem>
              <SelectItem value="ACCEPTED">Accepted</SelectItem>
              <SelectItem value="REJECTED">Declined / Rejected</SelectItem>
              <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="xs" onClick={fetchOffers} className="text-xs text-muted-foreground">
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <Button size="sm" onClick={() => setIsPrepareOpen(true)} className="gap-1.5 text-xs font-semibold">
          <Plus className="size-3.5" />
          <span>Prepare New Offer</span>
        </Button>
      </div>

      {/* Offers Table */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold">Offer Ref</TableHead>
                  <TableHead className="text-xs font-semibold">Candidate</TableHead>
                  <TableHead className="text-xs font-semibold">Role & Department</TableHead>
                  <TableHead className="text-xs font-semibold">Annual CTC / Monthly</TableHead>
                  <TableHead className="text-xs font-semibold">Joining Date</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Version</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                      Loading offers...
                    </TableCell>
                  </TableRow>
                ) : offers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                      No offers found. Click "Prepare New Offer" to draft employment terms.
                    </TableCell>
                  </TableRow>
                ) : (
                  offers.map((offer) => (
                    <TableRow key={offer.id}>
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {offer.offerNumber}
                      </TableCell>

                      <TableCell>
                        <div className="text-xs font-bold text-foreground">{offer.candidate.name}</div>
                        <div className="text-[11px] text-muted-foreground">{offer.candidate.email}</div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs font-medium text-foreground">{offer.jobTitle}</div>
                        <div className="text-[10px] text-muted-foreground">{offer.department}</div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs font-bold text-foreground">
                          {formatCurrencyINR(offer.annualCtc)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatCurrencyINR(offer.monthlyGross)}/mo
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-foreground">
                        {formatDatePretty(offer.joiningDate)}
                      </TableCell>

                      <TableCell>{getStatusBadge(offer.status)}</TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            v{offer.version}
                          </Badge>
                          {offer.revisions && offer.revisions.length > 0 && (
                            <button
                              onClick={() => setHistoryModal({ isOpen: true, offer })}
                              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                              title="View version audit history"
                            >
                              <History className="size-3" />
                            </button>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* PDF Download Button */}
                          <a
                            href={`/api/hrms/offers/${offer.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold px-2 py-1 rounded-md border border-border/60 hover:bg-muted/40 transition-colors"
                            title="Download Official Offer Letter PDF"
                          >
                            <Download className="size-3" />
                            <span>PDF</span>
                          </a>

                          {/* Quick Actions depending on status */}
                          {offer.status === "READY_TO_SEND" && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleStatusChange(offer.id, "SENT")}
                              className="text-xs gap-1 text-cyan-700 dark:text-cyan-300"
                            >
                              <Send className="size-3" />
                              <span>Send</span>
                            </Button>
                          )}

                          {offer.status === "SENT" && (
                            <>
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => handleStatusChange(offer.id, "ACCEPTED")}
                                className="text-xs gap-1 text-emerald-600"
                              >
                                <CheckCircle className="size-3" />
                                <span>Accepted</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() =>
                                  setStatusConfirmModal({
                                    isOpen: true,
                                    offerId: offer.id,
                                    offerNumber: offer.offerNumber,
                                    candidateName: offer.candidate.name,
                                    status: "REJECTED",
                                  })
                                }
                                className="text-xs gap-1 text-rose-600 hover:text-rose-700"
                              >
                                <XCircle className="size-3" />
                                <span>Declined</span>
                              </Button>
                            </>
                          )}

                          {/* Revision Button */}
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() =>
                              setRevisionModal({
                                isOpen: true,
                                offer,
                                annualCtc: Number(offer.annualCtc),
                                monthlyGross: Number(offer.monthlyGross),
                                joiningDate: offer.joiningDate.split("T")[0],
                                changeReason: "",
                              })
                            }
                            className="text-xs text-muted-foreground hover:text-foreground"
                            title="Revise offer terms with audit retention"
                          >
                            <Edit className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Prepare Offer Dialog */}
      <Dialog open={isPrepareOpen} onOpenChange={setIsPrepareOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prepare Employment Offer Letter</DialogTitle>
            <DialogDescription className="text-xs">
              Configure compensation structure, joining date, template, and letterhead for candidate.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateOffer} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <Label className="text-xs">Candidate *</Label>
                <Select
                  value={formData.candidateId}
                  onValueChange={(val) => setFormData({ ...formData, candidateId: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select candidate" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Target Job Position *</Label>
                <Select
                  value={formData.jobOpeningId}
                  onValueChange={(val) => {
                    const j = jobs.find((job) => job.id === val);
                    setFormData({
                      ...formData,
                      jobOpeningId: val,
                      jobTitle: j?.title || formData.jobTitle,
                      department: j?.department || formData.department,
                    });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title} ({j.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Offer Letter Template</Label>
                <Select
                  value={formData.templateId}
                  onValueChange={(val) => setFormData({ ...formData, templateId: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Branded Letterhead</Label>
                <Select
                  value={formData.letterheadId}
                  onValueChange={(val) => setFormData({ ...formData, letterheadId: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select letterhead" />
                  </SelectTrigger>
                  <SelectContent>
                    {letterheads.map((lh) => (
                      <SelectItem key={lh.id} value={lh.id}>
                        {lh.name} ({lh.companyName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Annual CTC (₹ INR) *</Label>
                <Input
                  type="number"
                  required
                  value={formData.annualCtc}
                  onChange={(e) => handleAnnualCtcChange(Number(e.target.value))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Monthly Gross (₹ INR) *</Label>
                <Input
                  type="number"
                  required
                  value={formData.monthlyGross}
                  onChange={(e) =>
                    setFormData({ ...formData, monthlyGross: Number(e.target.value) })
                  }
                  className="text-xs"
                />
              </div>

              {/* Live Salary Breakdown Preview */}
              <div className="col-span-2 rounded-lg border border-border/70 p-3 bg-muted/20 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>Salary Structure Breakdown (Auto-Calculated)</span>
                  <span className="text-primary font-bold">{formatCurrencyINR(formData.annualCtc)} / yr</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <div className="rounded border bg-background p-1.5">
                    <span className="text-muted-foreground block text-[10px]">Basic (50%)</span>
                    <strong className="text-foreground">{formatCurrencyINR(Math.round(formData.annualCtc * 0.5 / 12))}/mo</strong>
                  </div>
                  <div className="rounded border bg-background p-1.5">
                    <span className="text-muted-foreground block text-[10px]">HRA (25%)</span>
                    <strong className="text-foreground">{formatCurrencyINR(Math.round(formData.annualCtc * 0.25 / 12))}/mo</strong>
                  </div>
                  <div className="rounded border bg-background p-1.5">
                    <span className="text-muted-foreground block text-[10px]">Special (19%)</span>
                    <strong className="text-foreground">{formatCurrencyINR(Math.round(formData.annualCtc * 0.19 / 12))}/mo</strong>
                  </div>
                  <div className="rounded border bg-background p-1.5">
                    <span className="text-muted-foreground block text-[10px]">PF Employer</span>
                    <strong className="text-foreground">{formatCurrencyINR(Math.min(1800, Math.round(formData.annualCtc * 0.5 * 0.12 / 12)))}/mo</strong>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Proposed Date of Joining *</Label>
                <Input
                  type="date"
                  required
                  value={formData.joiningDate}
                  onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Offer Expiry Deadline *</Label>
                <Input
                  type="date"
                  required
                  value={formData.validityDate}
                  onChange={(e) => setFormData({ ...formData, validityDate: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Probation Period (Months)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.probationPeriodMonths}
                  onChange={(e) =>
                    setFormData({ ...formData, probationPeriodMonths: Number(e.target.value) })
                  }
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Reporting Manager</Label>
                <Select
                  value={formData.reportingManagerId}
                  onValueChange={(val) => setFormData({ ...formData, reportingManagerId: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Work Location / Branch</Label>
                <Input
                  value={formData.workLocation}
                  onChange={(e) => setFormData({ ...formData, workLocation: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Benefits & Additional Terms</Label>
                <Textarea
                  value={formData.benefits}
                  onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsPrepareOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-semibold">
                Generate & Save Offer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revise Offer Modal (Audit Preserved) */}
      <Dialog
        open={revisionModal.isOpen}
        onOpenChange={(open) => !open && setRevisionModal((prev) => ({ ...prev, isOpen: false }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revise Offer Terms</DialogTitle>
            <DialogDescription className="text-xs">
              Updating compensation increments the offer version. The previous version will be preserved in the audit history.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRevisionSubmit} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Revised Annual CTC (₹)</Label>
              <Input
                type="number"
                value={revisionModal.annualCtc}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setRevisionModal({
                    ...revisionModal,
                    annualCtc: val,
                    monthlyGross: Math.round(val / 12),
                  });
                }}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Revised Monthly Gross (₹)</Label>
              <Input
                type="number"
                value={revisionModal.monthlyGross}
                onChange={(e) =>
                  setRevisionModal({ ...revisionModal, monthlyGross: Number(e.target.value) })
                }
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Revised Joining Date</Label>
              <Input
                type="date"
                value={revisionModal.joiningDate}
                onChange={(e) =>
                  setRevisionModal({ ...revisionModal, joiningDate: e.target.value })
                }
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Reason for Revision *</Label>
              <Input
                value={revisionModal.changeReason}
                onChange={(e) =>
                  setRevisionModal({ ...revisionModal, changeReason: e.target.value })
                }
                placeholder="e.g. Counter-offer negotiation, updated joining date"
                className="text-xs"
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRevisionModal((prev) => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-semibold">
                Save Revision & Snapshot
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revision History Audit Modal */}
      <Dialog
        open={historyModal.isOpen}
        onOpenChange={(open) => !open && setHistoryModal({ isOpen: false, offer: null })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Offer Revision History ({historyModal.offer?.offerNumber})</DialogTitle>
            <DialogDescription className="text-xs">
              Complete audit trail of past offer terms and adjustments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-80 overflow-y-auto">
            {historyModal.offer?.revisions && historyModal.offer.revisions.length > 0 ? (
              historyModal.offer.revisions.map((rev) => (
                <div key={rev.id} className="rounded-lg border p-3 text-xs space-y-1 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Version {rev.version}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDatePretty(rev.createdAt)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>Annual CTC: <strong className="text-foreground">{formatCurrencyINR(rev.annualCtc)}</strong></div>
                    <div>Monthly Gross: <strong className="text-foreground">{formatCurrencyINR(rev.monthlyGross)}</strong></div>
                    <div>Joining Date: <strong className="text-foreground">{formatDatePretty(rev.joiningDate)}</strong></div>
                  </div>
                  {rev.changeReason && (
                    <div className="text-[11px] text-muted-foreground italic pt-1">
                      Reason: "{rev.changeReason}"
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No past revisions recorded.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryModal({ isOpen: false, offer: null })}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offer Status Confirmation Dialog */}
      <Dialog
        open={statusConfirmModal.isOpen}
        onOpenChange={(open) =>
          !open &&
          setStatusConfirmModal({
            isOpen: false,
            offerId: "",
            offerNumber: "",
            candidateName: "",
            status: "",
          })
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              <span>Confirm Offer Status Update</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to mark Offer <strong>#{statusConfirmModal.offerNumber}</strong> for{" "}
              <strong>{statusConfirmModal.candidateName}</strong> as{" "}
              <strong>
                {statusConfirmModal.status === "REJECTED"
                  ? "Declined / Rejected"
                  : statusConfirmModal.status}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setStatusConfirmModal({
                  isOpen: false,
                  offerId: "",
                  offerNumber: "",
                  candidateName: "",
                  status: "",
                })
              }
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant={statusConfirmModal.status === "REJECTED" ? "destructive" : "default"}
              onClick={() => {
                handleStatusChange(statusConfirmModal.offerId, statusConfirmModal.status);
                setStatusConfirmModal({
                  isOpen: false,
                  offerId: "",
                  offerNumber: "",
                  candidateName: "",
                  status: "",
                });
              }}
              className="font-semibold"
            >
              Confirm Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
