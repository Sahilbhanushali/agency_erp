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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  Star,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  Clock,
  FileCheck,
  UserCheck,
  RefreshCw,
  Building,
  DollarSign,
  History,
  LayoutGrid,
  Table as TableIcon,
  MessageSquarePlus,
  Send,
  AlertTriangle,
  Tag,
  ChevronRight,
  Globe,
  Linkedin,
} from "lucide-react";
import { STAGE_CONFIG, HrmsStage, HRMS_STAGES } from "@/lib/hrms/types";
import { formatCurrencyINR, formatDatePretty } from "@/lib/hrms/placeholder-engine";
import toast from "react-hot-toast";

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  currentCompany?: string | null;
  currentTitle?: string | null;
  experienceYears?: number | null;
  currentSalary?: number | null;
  expectedSalary?: number | null;
  noticePeriodDays?: number | null;
  resumeUrl?: string | null;
  portfolioUrl?: string | null;
  linkedinUrl?: string | null;
  source: string;
  address?: string | null;
  city?: string | null;
  rating?: number | null;
  tags?: string | null;
  notes?: string | null;
  createdAt: string;
  applications?: any[];
  interviews?: any[];
  offers?: any[];
}

interface HrmsCandidatesTabProps {
  selectedCandidateId?: string | null;
  onCloseSelectedCandidate?: () => void;
  onScheduleInterview: (candidateId: string, jobOpeningId: string, applicationId?: string) => void;
  onPrepareOffer: (candidateId: string, jobOpeningId: string, applicationId?: string) => void;
}

const COMMON_REJECTION_REASONS = [
  "Technical evaluation score below threshold",
  "Compensation expectations outside budgeted range",
  "Experience level does not match senior role requirement",
  "Culture alignment & communication assessment",
  "Selected stronger candidate in final round",
];

const COMMON_WITHDRAWAL_REASONS = [
  "Candidate accepted competitive offer elsewhere",
  "Relocation / commute distance incompatibility",
  "Personal / family reasons preventing role transition",
  "Notice period buyout rejected by current employer",
  "Candidate withdrew application proactively",
];

export function HrmsCandidatesTab({
  selectedCandidateId,
  onCloseSelectedCandidate,
  onScheduleInterview,
  onPrepareOffer,
}: HrmsCandidatesTabProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Filters
  const [search, setSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState("ALL");
  const [selectedStage, setSelectedStage] = useState("ALL");
  const [selectedSource, setSelectedSource] = useState("ALL");

  // Create / Edit modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    currentCompany: "",
    currentTitle: "",
    experienceYears: "",
    currentSalary: "",
    expectedSalary: "",
    noticePeriodDays: "",
    resumeUrl: "",
    portfolioUrl: "",
    linkedinUrl: "",
    source: "DIRECT",
    address: "",
    city: "",
    rating: 3,
    tags: "",
    notes: "",
    jobOpeningId: "",
  });

  // Profile Drawer state
  const [activeProfile, setActiveProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [timelineData, setTimelineData] = useState<{ activities: any[]; interviews: any[]; offers: any[] }>({
    activities: [],
    interviews: [],
    offers: [],
  });

  // Timeline Note Form State
  const [newNoteText, setNewNoteText] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    candidateId: string;
    candidateName: string;
  }>({
    isOpen: false,
    candidateId: "",
    candidateName: "",
  });

  // Reason Modal for Rejection / Withdrawal from Profile
  const [reasonModal, setReasonModal] = useState<{
    isOpen: boolean;
    applicationId: string;
    candidateName: string;
    targetStage: HrmsStage | "";
    type: "REJECT" | "WITHDRAW";
    reason: string;
    notes: string;
  }>({
    isOpen: false,
    applicationId: "",
    candidateName: "",
    targetStage: "",
    type: "REJECT",
    reason: "",
    notes: "",
  });

  const fetchCandidates = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedJob !== "ALL") params.set("jobOpeningId", selectedJob);
      if (selectedStage !== "ALL") params.set("stage", selectedStage);
      if (selectedSource !== "ALL") params.set("source", selectedSource);

      const res = await fetch(`/api/hrms/candidates?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch candidates");
      const data = await res.json();
      setCandidates(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  };
  // Live: re-read when someone else changes what this shows.
  useLiveRefresh(() => fetchCandidates({ silent: true }), ["HrmsCandidate", "HrmsApplication", "HrmsCandidateActivity"])

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/hrms/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCandidateProfile = async (id: string) => {
    setProfileLoading(true);
    try {
      const [candRes, timelineRes] = await Promise.all([
        fetch(`/api/hrms/candidates/${id}`),
        fetch(`/api/hrms/candidates/${id}/timeline`),
      ]);

      if (candRes.ok) {
        const data = await candRes.json();
        setActiveProfile(data);
      }
      if (timelineRes.ok) {
        const timeline = await timelineRes.json();
        setTimelineData(timeline);
      }
    } catch (e) {
      console.error("Profile fetch error:", e);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [selectedJob, selectedStage, selectedSource]);

  useEffect(() => {
    if (selectedCandidateId) {
      fetchCandidateProfile(selectedCandidateId);
    }
  }, [selectedCandidateId]);

  const handleOpenCreate = () => {
    setEditingCandidate(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      currentCompany: "",
      currentTitle: "",
      experienceYears: "",
      currentSalary: "",
      expectedSalary: "",
      noticePeriodDays: "",
      resumeUrl: "",
      portfolioUrl: "",
      linkedinUrl: "",
      source: "DIRECT",
      address: "",
      city: "",
      rating: 4,
      tags: "",
      notes: "",
      jobOpeningId: jobs[0]?.id || "",
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cand: Candidate) => {
    setEditingCandidate(cand);
    setFormData({
      name: cand.name,
      email: cand.email,
      phone: cand.phone || "",
      currentCompany: cand.currentCompany || "",
      currentTitle: cand.currentTitle || "",
      experienceYears: cand.experienceYears ? String(cand.experienceYears) : "",
      currentSalary: cand.currentSalary ? String(cand.currentSalary) : "",
      expectedSalary: cand.expectedSalary ? String(cand.expectedSalary) : "",
      noticePeriodDays: cand.noticePeriodDays ? String(cand.noticePeriodDays) : "",
      resumeUrl: cand.resumeUrl || "",
      portfolioUrl: cand.portfolioUrl || "",
      linkedinUrl: cand.linkedinUrl || "",
      source: cand.source || "DIRECT",
      address: cand.address || "",
      city: cand.city || "",
      rating: cand.rating || 3,
      tags: cand.tags || "",
      notes: cand.notes || "",
      jobOpeningId: cand.applications?.[0]?.jobOpeningId || "",
    });
    setIsFormOpen(true);
  };

  const handleSaveCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCandidate) {
        const res = await fetch(`/api/hrms/candidates/${editingCandidate.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Failed to update candidate");
        toast.success("Candidate updated successfully");
      } else {
        const res = await fetch("/api/hrms/candidates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Failed to create candidate");
        toast.success("Candidate created successfully");
      }
      setIsFormOpen(false);
      fetchCandidates();
      if (activeProfile?.id) fetchCandidateProfile(activeProfile.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to save candidate");
    }
  };

  const triggerDeleteConfirm = (cand: Candidate) => {
    setDeleteModal({
      isOpen: true,
      candidateId: cand.id,
      candidateName: cand.name,
    });
  };

  const confirmDeleteCandidate = async () => {
    if (!deleteModal.candidateId) return;
    try {
      const res = await fetch(`/api/hrms/candidates/${deleteModal.candidateId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete candidate");
      toast.success("Candidate record deleted");
      if (activeProfile?.id === deleteModal.candidateId) {
        setActiveProfile(null);
      }
      setDeleteModal({ isOpen: false, candidateId: "", candidateName: "" });
      fetchCandidates();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete candidate");
    }
  };

  // Quick Stage Changer from Profile Dossier
  const handleStageChangeRequest = async (applicationId: string, targetStage: HrmsStage) => {
    if (targetStage === "Rejected" || targetStage === "Offer Rejected") {
      setReasonModal({
        isOpen: true,
        applicationId,
        candidateName: activeProfile?.name || "Candidate",
        targetStage,
        type: "REJECT",
        reason: "",
        notes: "",
      });
      return;
    }

    if (targetStage === "Withdrawn") {
      setReasonModal({
        isOpen: true,
        applicationId,
        candidateName: activeProfile?.name || "Candidate",
        targetStage,
        type: "WITHDRAW",
        reason: "",
        notes: "",
      });
      return;
    }

    await executeStageTransition(applicationId, targetStage);
  };

  const executeStageTransition = async (
    applicationId: string,
    targetStage: HrmsStage,
    notes?: string,
    rejectionReason?: string,
    withdrawalReason?: string
  ) => {
    try {
      const res = await fetch(`/api/hrms/applications/${applicationId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStage,
          notes,
          rejectionReason,
          withdrawalReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update hiring stage");

      toast.success(`Hiring stage advanced to ${targetStage}`);
      if (activeProfile?.id) {
        fetchCandidateProfile(activeProfile.id);
      }
      fetchCandidates();
    } catch (err: any) {
      toast.error(err.message || "Failed to advance stage");
    }
  };

  const handleConfirmReasonModal = async () => {
    if (!reasonModal.applicationId || !reasonModal.targetStage) return;
    await executeStageTransition(
      reasonModal.applicationId,
      reasonModal.targetStage as HrmsStage,
      reasonModal.notes,
      reasonModal.type === "REJECT" ? reasonModal.reason || "Candidate rejected" : undefined,
      reasonModal.type === "WITHDRAW" ? reasonModal.reason || "Candidate withdrawn" : undefined
    );
    setReasonModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleAddTimelineNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !activeProfile?.id) return;

    setIsAddingNote(true);
    try {
      const res = await fetch(`/api/hrms/candidates/${activeProfile.id}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Recruiter Note",
          notes: newNoteText.trim(),
          type: "NOTE",
        }),
      });

      if (!res.ok) throw new Error("Failed to add note");
      toast.success("Recruiter note logged to candidate timeline");
      setNewNoteText("");
      fetchCandidateProfile(activeProfile.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to save note");
    } finally {
      setIsAddingNote(false);
    }
  };


  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 p-3 rounded-lg border border-border/60">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search candidate name, email, tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchCandidates()}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="h-8 text-xs w-[170px]">
              <SelectValue placeholder="All Jobs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Job Openings</SelectItem>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStage} onValueChange={setSelectedStage}>
            <SelectTrigger className="h-8 text-xs w-[150px]">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Stages</SelectItem>
              {HRMS_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Sources</SelectItem>
              <SelectItem value="DIRECT">Direct</SelectItem>
              <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
              <SelectItem value="REFERRAL">Referral</SelectItem>
              <SelectItem value="JOB_BOARD">Job Board</SelectItem>
              <SelectItem value="CAREER_SITE">Career Site</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="xs"
            onClick={() => fetchCandidates()}
            className="text-xs text-muted-foreground"
            title="Refresh candidate list"
          >
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Table vs Cards View Switcher */}
          <div className="flex rounded-md border border-border/60 p-0.5 bg-muted/30">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setViewMode("table")}
              className="text-xs h-7 px-2.5 font-medium gap-1"
            >
              <TableIcon className="size-3" />
              <span>Table</span>
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setViewMode("grid")}
              className="text-xs h-7 px-2.5 font-medium gap-1"
            >
              <LayoutGrid className="size-3" />
              <span>Cards</span>
            </Button>
          </div>

          <Button size="sm" onClick={handleOpenCreate} className="gap-1.5 text-xs font-semibold">
            <Plus className="size-3.5" />
            <span>Add Candidate</span>
          </Button>
        </div>
      </div>

      {/* Main Candidates View */}
      {viewMode === "table" ? (
        /* Candidates Table */
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Candidate</TableHead>
                    <TableHead className="text-xs font-semibold">Applied Position</TableHead>
                    <TableHead className="text-xs font-semibold">Hiring Stage</TableHead>
                    <TableHead className="text-xs font-semibold">Experience</TableHead>
                    <TableHead className="text-xs font-semibold">Current / Expected CTC</TableHead>
                    <TableHead className="text-xs font-semibold">Rating</TableHead>
                    <TableHead className="text-xs font-semibold">Notice Period</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                        Loading candidate directory...
                      </TableCell>
                    </TableRow>
                  ) : candidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                        No candidates found. Click "Add Candidate" to create a new profile.
                      </TableCell>
                    </TableRow>
                  ) : (
                    candidates.map((cand) => {
                      const latestApp = cand.applications?.[0];
                      const stageConfig = latestApp ? STAGE_CONFIG[latestApp.stage as HrmsStage] : null;

                      return (
                        <TableRow
                          key={cand.id}
                          className="cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => fetchCandidateProfile(cand.id)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-8">
                                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                                  {cand.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="text-xs font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                                  <span>{cand.name}</span>
                                  {cand.city && <span className="text-[10px] text-muted-foreground font-normal">({cand.city})</span>}
                                </div>
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                  <span>{cand.email}</span>
                                  {cand.phone && <span>• {cand.phone}</span>}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="text-xs font-medium text-foreground">
                              {latestApp?.jobOpening?.title || cand.currentTitle || "—"}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {latestApp?.jobOpening?.department || cand.currentCompany || ""}
                            </div>
                          </TableCell>

                          <TableCell>
                            {stageConfig ? (
                              <Badge variant={stageConfig.badgeVariant} className="text-[10px]">
                                {latestApp.stage}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                Applied
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-foreground">
                            {cand.experienceYears ? `${Number(cand.experienceYears)} Years` : "—"}
                          </TableCell>

                          <TableCell className="text-xs text-foreground">
                            <div className="font-medium">
                              Exp: {cand.expectedSalary ? formatCurrencyINR(cand.expectedSalary) : "—"}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Cur: {cand.currentSalary ? formatCurrencyINR(cand.currentSalary) : "—"}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`size-2.5 ${
                                    s <= (cand.rating || 0)
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-muted-foreground/30"
                                  }`}
                                />
                              ))}
                            </div>
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground">
                            {cand.noticePeriodDays !== null && cand.noticePeriodDays !== undefined
                              ? `${cand.noticePeriodDays} days`
                              : "—"}
                          </TableCell>

                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleOpenEdit(cand)}
                                title="Edit candidate profile"
                              >
                                <Edit className="size-3.5 text-muted-foreground hover:text-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => triggerDeleteConfirm(cand)}
                                title="Delete candidate"
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Candidates Grid / Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground">
              Loading candidates...
            </div>
          ) : candidates.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              No candidates found matching filters.
            </div>
          ) : (
            candidates.map((cand) => {
              const latestApp = cand.applications?.[0];
              const stageConfig = latestApp ? STAGE_CONFIG[latestApp.stage as HrmsStage] : null;
              const tags = cand.tags ? cand.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];

              return (
                <Card
                  key={cand.id}
                  className="border-border/70 shadow-xs hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                  onClick={() => fetchCandidateProfile(cand.id)}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-10">
                          <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                            {cand.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                            {cand.name}
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {cand.currentTitle || "Candidate"}
                            {cand.currentCompany && ` @ ${cand.currentCompany}`}
                          </CardDescription>
                        </div>
                      </div>

                      {stageConfig ? (
                        <Badge variant={stageConfig.badgeVariant} className="text-[10px] shrink-0">
                          {latestApp.stage}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          Applied
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-1 space-y-3">
                    {/* Applied Position Banner */}
                    <div className="rounded-md bg-muted/40 p-2 text-xs flex items-center justify-between">
                      <span className="text-muted-foreground text-[11px]">Applied For:</span>
                      <strong className="text-foreground text-[11px] truncate max-w-[170px]">
                        {latestApp?.jobOpening?.title || "Direct Sourcing"}
                      </strong>
                    </div>

                    {/* Key Metrics Chips */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/50">
                      <div>
                        Exp: <strong className="text-foreground">{cand.experienceYears ? `${cand.experienceYears}y` : "—"}</strong>
                      </div>
                      <div>
                        Notice: <strong className="text-foreground">{cand.noticePeriodDays ? `${cand.noticePeriodDays}d` : "—"}</strong>
                      </div>
                      <div>
                        Exp CTC: <strong className="text-foreground">{cand.expectedSalary ? formatCurrencyINR(cand.expectedSalary) : "—"}</strong>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <span className="mr-1">Rating:</span>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`size-2.5 ${
                              s <= (cand.rating || 0)
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Skills Tags */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {tags.slice(0, 4).map((t, i) => (
                          <Badge key={i} variant="outline" className="text-[9px] bg-background">
                            {t}
                          </Badge>
                        ))}
                        {tags.length > 4 && (
                          <Badge variant="outline" className="text-[9px] text-muted-foreground">
                            +{tags.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div
                      className="flex items-center justify-between border-t border-border/40 pt-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5">
                        {cand.resumeUrl && (
                          <a
                            href={cand.resumeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-muted/50"
                            title="View Resume"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                        {cand.linkedinUrl && (
                          <a
                            href={cand.linkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-muted/50"
                            title="LinkedIn"
                          >
                            <Linkedin className="size-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleOpenEdit(cand)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="size-3 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => triggerDeleteConfirm(cand)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Candidate Profile Drawer Dialog */}
      <Dialog
        open={!!activeProfile}
        onOpenChange={(open) => !open && setActiveProfile(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {activeProfile && (
            <div className="space-y-4">
              {/* Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-border/60 pb-3 gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="size-12">
                    <AvatarFallback className="text-base font-bold bg-primary/10 text-primary">
                      {activeProfile.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                      <span>{activeProfile.name}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`size-3 ${
                              s <= (activeProfile.rating || 0)
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                    </h2>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{activeProfile.currentTitle || "Candidate"}</span>
                      {activeProfile.currentCompany && <span>@ {activeProfile.currentCompany}</span>}
                      {activeProfile.city && <span>• {activeProfile.city}</span>}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Mail className="size-3 text-primary" /> {activeProfile.email}
                      </span>
                      {activeProfile.phone && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Phone className="size-3 text-emerald-500" /> {activeProfile.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const app = activeProfile.applications?.[0];
                      if (app) onScheduleInterview(activeProfile.id, app.jobOpeningId, app.id);
                      else toast.error("Candidate has no job application");
                    }}
                    className="gap-1 text-xs"
                  >
                    <Calendar className="size-3.5 text-primary" />
                    <span>Schedule Interview</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const app = activeProfile.applications?.[0];
                      if (app) onPrepareOffer(activeProfile.id, app.jobOpeningId, app.id);
                      else toast.error("Candidate has no job application");
                    }}
                    className="gap-1 text-xs"
                  >
                    <FileCheck className="size-3.5" />
                    <span>Make Offer</span>
                  </Button>
                </div>
              </div>

              {/* Dedicated Quick Stage Advancement Ribbon */}
              {activeProfile.applications?.[0] && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 p-2.5 rounded-lg border border-border/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Hiring Stage:</span>
                    <Badge
                      variant={
                        STAGE_CONFIG[activeProfile.applications[0].stage as HrmsStage]?.badgeVariant ||
                        "outline"
                      }
                      className="text-xs px-2"
                    >
                      {activeProfile.applications[0].stage}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      for{" "}
                      <strong className="text-foreground">
                        {activeProfile.applications[0].jobOpening?.title || "Application"}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground font-medium">Advance to:</span>
                    <Select
                      value={activeProfile.applications[0].stage}
                      onValueChange={(val) =>
                        handleStageChangeRequest(activeProfile.applications[0].id, val as HrmsStage)
                      }
                    >
                      <SelectTrigger className="h-7 text-xs w-[170px] bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HRMS_STAGES.map((st) => (
                          <SelectItem key={st} value={st}>
                            {st}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Profile Tabs */}
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-8 text-xs">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
                  <TabsTrigger value="interviews">Interviews ({timelineData.interviews?.length || 0})</TabsTrigger>
                  <TabsTrigger value="offers">Offers ({timelineData.offers?.length || 0})</TabsTrigger>
                </TabsList>

                {/* Tab: Overview */}
                <TabsContent value="overview" className="space-y-4 pt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                      <h4 className="font-bold text-foreground">Compensation & Terms</h4>
                      <div className="space-y-1.5 text-muted-foreground">
                        <div>
                          Experience:{" "}
                          <strong className="text-foreground">
                            {activeProfile.experienceYears ? `${Number(activeProfile.experienceYears)} Years` : "N/A"}
                          </strong>
                        </div>
                        <div>
                          Current CTC:{" "}
                          <strong className="text-foreground">{formatCurrencyINR(activeProfile.currentSalary)}</strong>
                        </div>
                        <div>
                          Expected CTC:{" "}
                          <strong className="text-foreground">{formatCurrencyINR(activeProfile.expectedSalary)}</strong>
                        </div>
                        <div>
                          Notice Period:{" "}
                          <strong className="text-foreground">{activeProfile.noticePeriodDays ?? "N/A"} Days</strong>
                        </div>
                        <div>
                          Sourcing Channel:{" "}
                          <Badge variant="outline" className="text-[10px]">
                            {activeProfile.source}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                      <h4 className="font-bold text-foreground">Portfolio & Resumes</h4>
                      <div className="space-y-1.5 text-muted-foreground">
                        {activeProfile.resumeUrl ? (
                          <div>
                            <a
                              href={activeProfile.resumeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 font-semibold"
                            >
                              <span>View Candidate Resume</span> <ExternalLink className="size-3" />
                            </a>
                          </div>
                        ) : (
                          <div>Resume: Not attached</div>
                        )}
                        {activeProfile.portfolioUrl && (
                          <div>
                            <a
                              href={activeProfile.portfolioUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <span>Portfolio / Website</span> <ExternalLink className="size-3" />
                            </a>
                          </div>
                        )}
                        {activeProfile.linkedinUrl && (
                          <div>
                            <a
                              href={activeProfile.linkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <span>LinkedIn Profile</span> <ExternalLink className="size-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {activeProfile.tags && (
                    <div className="rounded-lg border p-3 bg-muted/20 text-xs">
                      <h4 className="font-bold text-foreground mb-1.5">Candidate Skills & Tags</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {activeProfile.tags.split(",").map((t: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-[10px]">
                            {t.trim()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeProfile.notes && (
                    <div className="rounded-lg border p-3 bg-muted/20 text-xs">
                      <h4 className="font-bold text-foreground mb-1">Recruiter Notes</h4>
                      <p className="text-muted-foreground">{activeProfile.notes}</p>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Timeline with Interactive Add Note */}
                <TabsContent value="timeline" className="space-y-3 pt-3">
                  {/* Add Recruiter Note Box */}
                  <form onSubmit={handleAddTimelineNote} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20">
                    <Input
                      placeholder="Add recruiter note or screening insight to candidate timeline..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                    <Button
                      type="submit"
                      size="xs"
                      disabled={!newNoteText.trim() || isAddingNote}
                      className="gap-1 text-xs shrink-0 font-semibold"
                    >
                      <Send className="size-3" />
                      <span>{isAddingNote ? "Saving..." : "Log Note"}</span>
                    </Button>
                  </form>

                  {timelineData.activities?.length > 0 ? (
                    <div className="space-y-3 border-l-2 border-primary/30 pl-4 ml-2 pt-2">
                      {timelineData.activities.map((act) => (
                        <div key={act.id} className="relative text-xs">
                          <div className="absolute -left-[21px] top-1 size-2 rounded-full bg-primary" />
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground">{act.title}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDatePretty(act.createdAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{act.notes}</p>
                          {act.performedBy && (
                            <span className="text-[10px] text-muted-foreground italic">
                              By {act.performedBy.name}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No activity history recorded for this candidate yet.
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Interviews */}
                <TabsContent value="interviews" className="space-y-3 pt-3">
                  {timelineData.interviews?.length > 0 ? (
                    timelineData.interviews.map((iv) => (
                      <div key={iv.id} className="rounded-lg border p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">{iv.title}</span>
                          <Badge variant="outline">{iv.status}</Badge>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-3">
                          <span>{formatDatePretty(iv.scheduledDate)} at {iv.startTime}</span>
                          <span>Type: {iv.type}</span>
                        </div>
                        {iv.feedback && (
                          <div className="mt-2 bg-muted/40 p-2 rounded-xs">
                            <p className="font-semibold text-foreground">Scorecard / Feedback:</p>
                            <p className="text-muted-foreground">{iv.feedback}</p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No interviews scheduled yet.
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Offers */}
                <TabsContent value="offers" className="space-y-3 pt-3">
                  {timelineData.offers?.length > 0 ? (
                    timelineData.offers.map((off) => (
                      <div key={off.id} className="rounded-lg border p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">
                            Offer #{off.offerNumber} (v{off.version})
                          </span>
                          <Badge variant="outline">{off.status}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                          <div>Position: <strong className="text-foreground">{off.jobTitle}</strong></div>
                          <div>Annual CTC: <strong className="text-foreground">{formatCurrencyINR(off.annualCtc)}</strong></div>
                          <div>Joining Date: <strong className="text-foreground">{formatDatePretty(off.joiningDate)}</strong></div>
                          <div>Valid Until: <strong className="text-foreground">{formatDatePretty(off.validityDate)}</strong></div>
                        </div>
                        <div className="pt-2 flex justify-end">
                          <a
                            href={`/api/hrms/offers/${off.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                          >
                            <span>Download Official Offer PDF</span> <ExternalLink className="size-3" />
                          </a>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No offers issued yet for this candidate.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Reject / Withdraw Reason */}
      <Dialog
        open={reasonModal.isOpen}
        onOpenChange={(open) => !open && setReasonModal((prev) => ({ ...prev, isOpen: false }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              <span>
                {reasonModal.type === "REJECT" ? "Confirm Candidate Rejection" : "Confirm Application Withdrawal"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Please specify the decision reason and internal feedback for {reasonModal.candidateName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Pre-defined Reason</Label>
              <Select
                value={reasonModal.reason}
                onValueChange={(val) => setReasonModal((prev) => ({ ...prev, reason: val }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {(reasonModal.type === "REJECT"
                    ? COMMON_REJECTION_REASONS
                    : COMMON_WITHDRAWAL_REASONS
                  ).map((r, i) => (
                    <SelectItem key={i} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Additional Notes / Remarks</Label>
              <Textarea
                placeholder="Optional feedback details for candidate profile..."
                value={reasonModal.notes}
                onChange={(e) => setReasonModal((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReasonModal((prev) => ({ ...prev, isOpen: false }))}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmReasonModal}
              className="font-semibold"
            >
              Confirm Stage Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteModal.isOpen}
        onOpenChange={(open) => !open && setDeleteModal({ isOpen: false, candidateId: "", candidateName: "" })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              <span>Delete Candidate Record</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to permanently delete candidate record for{" "}
              <strong>{deleteModal.candidateName}</strong>? All their applications and history will be removed.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModal({ isOpen: false, candidateId: "", candidateName: "" })}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={confirmDeleteCandidate}
              className="font-semibold"
            >
              Delete Candidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Candidate Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCandidate ? "Edit Candidate Dossier" : "Add New Candidate"}</DialogTitle>
            <DialogDescription className="text-xs">
              Fill in candidate contact coordinates, experience, current and expected CTC, and portfolio links.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCandidate} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <Label className="text-xs">Full Name *</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Priya Sharma"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Email Address *</Label>
                <Input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="priya.sharma@example.com"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Phone Number</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Current City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Bengaluru"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Current Designation</Label>
                <Input
                  value={formData.currentTitle}
                  onChange={(e) => setFormData({ ...formData, currentTitle: e.target.value })}
                  placeholder="Senior Software Engineer"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Current Organization</Label>
                <Input
                  value={formData.currentCompany}
                  onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
                  placeholder="Acme Corp"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Experience (Years)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.experienceYears}
                  onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                  placeholder="5.5"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Current Salary (Annual CTC in ₹)</Label>
                <Input
                  type="number"
                  value={formData.currentSalary}
                  onChange={(e) => setFormData({ ...formData, currentSalary: e.target.value })}
                  placeholder="1200000"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Expected Salary (Annual CTC in ₹)</Label>
                <Input
                  type="number"
                  value={formData.expectedSalary}
                  onChange={(e) => setFormData({ ...formData, expectedSalary: e.target.value })}
                  placeholder="1800000"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notice Period (Days)</Label>
                <Input
                  type="number"
                  value={formData.noticePeriodDays}
                  onChange={(e) => setFormData({ ...formData, noticePeriodDays: e.target.value })}
                  placeholder="30"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Application Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(val) => setFormData({ ...formData, source: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECT">Direct</SelectItem>
                    <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                    <SelectItem value="REFERRAL">Referral</SelectItem>
                    <SelectItem value="JOB_BOARD">Job Board</SelectItem>
                    <SelectItem value="CAREER_SITE">Career Site</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Interactive 5-star Rating Picker */}
              <div className="space-y-1">
                <Label className="text-xs">Candidate Rating</Label>
                <div className="flex items-center gap-1.5 h-8">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setFormData({ ...formData, rating: s })}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`size-4 ${
                          s <= (formData.rating || 0)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({formData.rating || 0}/5)
                  </span>
                </div>
              </div>

              {!editingCandidate && (
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Job Position to Apply For</Label>
                  <Select
                    value={formData.jobOpeningId}
                    onValueChange={(val) => setFormData({ ...formData, jobOpeningId: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select target opening" />
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
              )}

              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Resume URL / Document Link</Label>
                <Input
                  value={formData.resumeUrl}
                  onChange={(e) => setFormData({ ...formData, resumeUrl: e.target.value })}
                  placeholder="https://drive.google.com/resume.pdf"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="text-xs">LinkedIn Profile URL</Label>
                <Input
                  value={formData.linkedinUrl}
                  onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Skills & Tags (Comma separated)</Label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="Next.js, TypeScript, PostgreSQL, Figma"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Internal Notes / Interview Feedback</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Candidate notes..."
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-semibold">
                {editingCandidate ? "Save Changes" : "Create Candidate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
