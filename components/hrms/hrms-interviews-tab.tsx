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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
  UserCheck,
  Star,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  RefreshCw,
  ExternalLink,
  Users,
  CalendarDays,
  Filter,
} from "lucide-react";
import { formatDatePretty } from "@/lib/hrms/placeholder-engine";
import toast from "react-hot-toast";

interface Interview {
  id: string;
  title: string;
  roundNumber: number;
  type: string;
  status: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  meetingLink?: string | null;
  location?: string | null;
  instructions?: string | null;
  feedback?: string | null;
  rating?: number | null;
  recommendation?: string | null;
  cancellationReason?: string | null;
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
  interviewers: {
    id: string;
    userId: number;
    isLead: boolean;
    user: {
      id: number;
      name: string;
      email: string;
      avatar?: string | null;
    };
  }[];
}

interface HrmsInterviewsTabProps {
  initialScheduleCandidateId?: string | null;
  initialJobOpeningId?: string | null;
  onClearInitialSchedule?: () => void;
}

export function HrmsInterviewsTab({
  initialScheduleCandidateId,
  initialJobOpeningId,
  onClearInitialSchedule,
}: HrmsInterviewsTabProps) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedJob, setSelectedJob] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedInterviewer, setSelectedInterviewer] = useState("ALL");
  const [viewMode, setViewMode] = useState<"agenda" | "calendar">("agenda");

  // Scheduling Dialog
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    candidateId: "",
    jobOpeningId: "",
    title: "Round 1: Technical & Cultural Assessment",
    roundNumber: 1,
    type: "ONLINE",
    scheduledDate: new Date().toISOString().split("T")[0],
    startTime: "14:00",
    endTime: "15:00",
    timeZone: "Asia/Kolkata",
    meetingLink: "https://meet.google.com/agency-interview",
    location: "",
    instructions: "Please be ready 5 minutes before scheduled start time with your camera enabled.",
    interviewerIds: [] as number[],
  });

  // Conflict state
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictsList, setConflictsList] = useState<any[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  // Feedback & Scorecard Dialog
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    interview: Interview | null;
    rating: number;
    recommendation: string;
    feedback: string;
  }>({
    isOpen: false,
    interview: null,
    rating: 4,
    recommendation: "HIRE",
    feedback: "",
  });

  // Cancel Dialog
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    interviewId: string;
    reason: string;
  }>({
    isOpen: false,
    interviewId: "",
    reason: "",
  });

  const fetchInterviews = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedJob !== "ALL") params.set("jobOpeningId", selectedJob);
      if (selectedStatus !== "ALL") params.set("status", selectedStatus);
      if (selectedInterviewer !== "ALL") params.set("interviewerId", selectedInterviewer);

      const res = await fetch(`/api/hrms/interviews?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch interviews");
      const data = await res.json();
      setInterviews(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load interviews");
    } finally {
      setLoading(false);
    }
  };
  // Live: re-read when someone else changes what this shows.
  useLiveRefresh(() => fetchInterviews({ silent: true }), ["HrmsInterview", "HrmsInterviewInterviewer"])

  const fetchReferenceData = async () => {
    try {
      const [candRes, jobRes, userRes] = await Promise.all([
        fetch("/api/hrms/candidates"),
        fetch("/api/hrms/jobs"),
        fetch("/api/users"),
      ]);
      if (candRes.ok) setCandidates(await candRes.json());
      if (jobRes.ok) setJobs(await jobRes.json());
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
    fetchInterviews();
  }, [selectedJob, selectedStatus, selectedInterviewer]);

  // Open scheduling modal if triggered with initial candidate
  useEffect(() => {
    if (initialScheduleCandidateId) {
      setScheduleData((prev) => ({
        ...prev,
        candidateId: initialScheduleCandidateId,
        jobOpeningId: initialJobOpeningId || prev.jobOpeningId,
      }));
      setIsScheduleOpen(true);
      onClearInitialSchedule?.();
    }
  }, [initialScheduleCandidateId, initialJobOpeningId]);

  // Live conflict detection check
  useEffect(() => {
    const checkConflicts = async () => {
      if (
        !scheduleData.scheduledDate ||
        !scheduleData.startTime ||
        !scheduleData.endTime ||
        scheduleData.interviewerIds.length === 0
      ) {
        setHasConflict(false);
        setConflictsList([]);
        return;
      }

      setIsCheckingConflicts(true);
      try {
        const params = new URLSearchParams({
          date: scheduleData.scheduledDate,
          startTime: scheduleData.startTime,
          endTime: scheduleData.endTime,
          interviewerIds: scheduleData.interviewerIds.join(","),
        });
        const res = await fetch(`/api/hrms/interviews/conflicts?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setHasConflict(data.hasConflict);
          setConflictsList(data.conflicts || []);
        }
      } catch (e) {
        console.error("Conflict check failed:", e);
      } finally {
        setIsCheckingConflicts(false);
      }
    };

    const timer = setTimeout(checkConflicts, 300);
    return () => clearTimeout(timer);
  }, [
    scheduleData.scheduledDate,
    scheduleData.startTime,
    scheduleData.endTime,
    scheduleData.interviewerIds,
  ]);

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleData.candidateId || !scheduleData.jobOpeningId) {
      toast.error("Please select a candidate and job opening");
      return;
    }

    try {
      const res = await fetch("/api/hrms/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule interview");

      toast.success("Interview scheduled successfully!");
      setIsScheduleOpen(false);
      fetchInterviews();
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule interview");
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackModal.interview) return;

    try {
      const res = await fetch(`/api/hrms/interviews/${feedbackModal.interview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          rating: feedbackModal.rating,
          recommendation: feedbackModal.recommendation,
          feedback: feedbackModal.feedback,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit feedback");
      toast.success("Interview feedback & ratings recorded!");
      setFeedbackModal({ isOpen: false, interview: null, rating: 4, recommendation: "HIRE", feedback: "" });
      fetchInterviews();
    } catch (err: any) {
      toast.error(err.message || "Failed to record feedback");
    }
  };

  const handleCancelInterview = async () => {
    if (!cancelModal.interviewId) return;
    try {
      const res = await fetch(`/api/hrms/interviews/${cancelModal.interviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELLED",
          cancellationReason: cancelModal.reason || "Cancelled by interviewer",
        }),
      });

      if (!res.ok) throw new Error("Failed to cancel interview");
      toast.success("Interview cancelled");
      setCancelModal({ isOpen: false, interviewId: "", reason: "" });
      fetchInterviews();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel interview");
    }
  };

  const toggleInterviewer = (userId: number) => {
    setScheduleData((prev) => {
      const exists = prev.interviewerIds.includes(userId);
      return {
        ...prev,
        interviewerIds: exists
          ? prev.interviewerIds.filter((id) => id !== userId)
          : [...prev.interviewerIds, userId],
      };
    });
  };


  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 p-3 rounded-lg border border-border/60">
        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger aria-label="All Jobs" className="h-8 text-xs w-[170px]">
              <SelectValue placeholder="All Jobs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Jobs</SelectItem>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger aria-label="All Statuses" className="h-8 text-xs w-[140px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedInterviewer} onValueChange={setSelectedInterviewer}>
            <SelectTrigger aria-label="All Panellists" className="h-8 text-xs w-[160px]">
              <SelectValue placeholder="All Panellists" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Panellists</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="xs"
            onClick={() => fetchInterviews()}
            className="text-xs text-muted-foreground"
          >
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border/60 p-0.5 bg-muted/30">
            <Button
              variant={viewMode === "agenda" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setViewMode("agenda")}
              className="text-xs h-7 px-2.5"
            >
              Agenda List
            </Button>
            <Button
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setViewMode("calendar")}
              className="text-xs h-7 px-2.5"
            >
              Calendar
            </Button>
          </div>

          <Button
            size="sm"
            onClick={() => setIsScheduleOpen(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-3.5" />
            <span>Schedule Interview</span>
          </Button>
        </div>
      </div>

      {/* Main Interviews List / Calendar */}
      {viewMode === "agenda" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground">
              Loading scheduled interviews...
            </div>
          ) : interviews.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              No interviews scheduled. Click "Schedule Interview" to assign candidate rounds.
            </div>
          ) : (
            interviews.map((item) => {
              const isCompleted = item.status === "COMPLETED";
              const isCancelled = item.status === "CANCELLED";

              return (
                <Card
                  key={item.id}
                  className={`border-border/70 shadow-xs hover:border-primary/40 transition-all ${
                    isCancelled ? "opacity-60 bg-muted/20" : ""
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge variant="outline" className="text-xs uppercase font-bold">
                          Round {item.roundNumber} • {item.type}
                        </Badge>
                        <CardTitle className="text-sm font-bold mt-1 text-foreground">
                          {item.title}
                        </CardTitle>
                        <CardDescription className="text-xs font-medium text-foreground">
                          Candidate: <strong className="text-primary">{item.candidate.name}</strong>
                        </CardDescription>
                      </div>

                      <Badge
                        variant={
                          isCompleted
                            ? "default"
                            : isCancelled
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-1 space-y-3">
                    <div className="rounded-md bg-muted/40 p-2.5 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-foreground font-semibold">
                        <Calendar className="size-3.5 text-primary" />
                        <span>{formatDatePretty(item.scheduledDate)}</span>
                        <span>•</span>
                        <Clock className="size-3.5 text-amber-500" />
                        <span>{item.startTime} - {item.endTime}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Position: {item.jobOpening.title} ({item.jobOpening.department})
                      </div>
                    </div>

                    {/* Interview Link / Location */}
                    {item.meetingLink && (
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="flex items-center gap-1 text-muted-foreground text-xs">
                          <Video className="size-3 text-blue-500" /> Online Meeting
                        </span>
                        <a
                          href={item.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline flex items-center gap-0.5 text-xs font-semibold"
                        >
                          Join Call <ExternalLink className="size-3" />
                        </a>
                      </div>
                    )}

                    {/* Panellists Assigned */}
                    <div className="border-t border-border/40 pt-2.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">
                        Assigned Interviewers
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.interviewers.length > 0 ? (
                          item.interviewers.map((iv) => (
                            <Badge
                              key={iv.id}
                              variant="outline"
                              className="text-xs bg-background gap-1 py-0.5"
                            >
                              <Avatar className="size-3.5">
                                <AvatarFallback className="text-xs">
                                  {iv.user.name.slice(0, 1)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{iv.user.name}</span>
                              {iv.isLead && <span className="text-xs text-primary font-bold">(Lead)</span>}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">No panellist assigned</span>
                        )}
                      </div>
                    </div>

                    {/* Feedback if completed */}
                    {isCompleted && item.feedback && (
                      <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                            Recommendation: {item.recommendation?.replace(/_/g, " ")}
                          </span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`size-2.5 ${
                                  s <= (item.rating || 0)
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-emerald-900/80 dark:text-emerald-200 mt-1">
                          {item.feedback}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isCompleted && !isCancelled && (
                      <div className="flex items-center justify-between border-t border-border/40 pt-2.5">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            setCancelModal({
                              isOpen: true,
                              interviewId: item.id,
                              reason: "",
                            })
                          }
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="xs"
                          onClick={() =>
                            setFeedbackModal({
                              isOpen: true,
                              interview: item,
                              rating: 4,
                              recommendation: "HIRE",
                              feedback: "",
                            })
                          }
                          className="text-xs font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle className="size-3" />
                          <span>Complete & Score</span>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        /* Calendar Schedule Day View */
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              Interview Calendar Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {interviews.map((iv) => (
              <div
                key={iv.id}
                className="flex items-start gap-4 p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="w-24 shrink-0 text-center rounded-md bg-primary/10 p-2 text-primary font-bold">
                  <div className="text-xs uppercase">
                    {new Date(iv.scheduledDate).toLocaleString("default", { month: "short" })}
                  </div>
                  <div className="text-lg">{new Date(iv.scheduledDate).getDate()}</div>
                  <div className="text-xs font-normal text-muted-foreground">{iv.startTime}</div>
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-foreground">
                      {iv.candidate.name} — {iv.title}
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {iv.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Role: {iv.jobOpening.title} ({iv.type})
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <span>
                      Panellists: {iv.interviewers.map((i) => i.user.name).join(", ") || "None"}
                    </span>
                    {iv.meetingLink && (
                      <a
                        href={iv.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline font-semibold"
                      >
                        Join Meeting
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Schedule Interview Dialog */}
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Candidate Interview</DialogTitle>
            <DialogDescription className="text-xs">
              Assign interview round, date, start & end time, and assign panellists with automated conflict detection.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleScheduleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3.5">
              {/* Candidate */}
              <div className="space-y-1">
                <Label className="text-xs">Candidate *</Label>
                <Select
                  value={scheduleData.candidateId}
                  onValueChange={(val) => setScheduleData({ ...scheduleData, candidateId: val })}
                >
                  <SelectTrigger aria-label="Candidate" className="h-8 text-xs">
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

              {/* Job Opening */}
              <div className="space-y-1">
                <Label className="text-xs">Job Opening *</Label>
                <Select
                  value={scheduleData.jobOpeningId}
                  onValueChange={(val) => setScheduleData({ ...scheduleData, jobOpeningId: val })}
                >
                  <SelectTrigger aria-label="Job Opening" className="h-8 text-xs">
                    <SelectValue placeholder="Select opening" />
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

              {/* Title */}
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Interview Title *</Label>
                <Input aria-label="Interview Title"
                  required
                  value={scheduleData.title}
                  onChange={(e) => setScheduleData({ ...scheduleData, title: e.target.value })}
                  placeholder="e.g. Technical Round 1: React & Architecture"
                  className="text-xs"
                />
              </div>

              {/* Round Number */}
              <div className="space-y-1">
                <Label className="text-xs">Round Number</Label>
                <Input aria-label="Round Number"
                  type="number"
                  min="1"
                  value={scheduleData.roundNumber}
                  onChange={(e) =>
                    setScheduleData({ ...scheduleData, roundNumber: Number(e.target.value) })
                  }
                  className="text-xs"
                />
              </div>

              {/* Type */}
              <div className="space-y-1">
                <Label className="text-xs">Interview Type</Label>
                <Select
                  value={scheduleData.type}
                  onValueChange={(val) => setScheduleData({ ...scheduleData, type: val })}
                >
                  <SelectTrigger aria-label="Interview Type" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONLINE">Online Video (Google Meet / Zoom)</SelectItem>
                    <SelectItem value="TELEPHONE">Telephone Call</SelectItem>
                    <SelectItem value="IN_PERSON">In-Person (HQ Office)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <Label className="text-xs">Date *</Label>
                <Input aria-label="Date"
                  type="date"
                  required
                  value={scheduleData.scheduledDate}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduledDate: e.target.value })}
                  className="text-xs"
                />
              </div>

              {/* Time Slots */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Start Time *</Label>
                  <Input aria-label="Start Time"
                    type="time"
                    required
                    value={scheduleData.startTime}
                    onChange={(e) => setScheduleData({ ...scheduleData, startTime: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Time *</Label>
                  <Input aria-label="End Time"
                    type="time"
                    required
                    value={scheduleData.endTime}
                    onChange={(e) => setScheduleData({ ...scheduleData, endTime: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Panellists Multi-Selector */}
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Assign Interviewers / Panellists</Label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 border rounded-md bg-muted/20">
                  {users.map((u) => {
                    const isSelected = scheduleData.interviewerIds.includes(u.id);
                    return (
                      <Badge
                        key={u.id}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer text-xs select-none"
                        onClick={() => toggleInterviewer(u.id)}
                      >
                        {u.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* CONFLICT DETECTION WARNING ALERT */}
              {hasConflict && (
                <div className="col-span-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <AlertTriangle className="size-4 text-amber-600" />
                    <span>Scheduling Conflict Detected!</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {conflictsList.map((c, idx) => (
                      <div key={idx}>
                        • Panellist <strong>{c.conflictingInterviewers.join(", ")}</strong> has an
                        overlapping interview "{c.title}" at {c.time} with {c.candidateName}.
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meeting Link / Location */}
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">
                  {scheduleData.type === "ONLINE" ? "Meeting Link" : "Office Location / Instructions"}
                </Label>
                <Input aria-label="https://meet.google.com/"
                  value={scheduleData.meetingLink}
                  onChange={(e) => setScheduleData({ ...scheduleData, meetingLink: e.target.value })}
                  placeholder="https://meet.google.com/..."
                  className="text-xs"
                />
              </div>

              {/* Instructions */}
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Candidate Instructions</Label>
                <Textarea aria-label="Candidate Instructions"
                  value={scheduleData.instructions}
                  onChange={(e) => setScheduleData({ ...scheduleData, instructions: e.target.value })}
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsScheduleOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-semibold">
                Confirm & Schedule Interview
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Complete Interview & Record Feedback Modal */}
      <Dialog
        open={feedbackModal.isOpen}
        onOpenChange={(open) => !open && setFeedbackModal((prev) => ({ ...prev, isOpen: false }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Interview Scorecard & Feedback</DialogTitle>
            <DialogDescription className="text-xs">
              Record interview rating, recommendation, and feedback notes for candidate {feedbackModal.interview?.candidate?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFeedbackSubmit} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Overall Recommendation *</Label>
              <Select
                value={feedbackModal.recommendation}
                onValueChange={(val) => setFeedbackModal({ ...feedbackModal, recommendation: val })}
              >
                <SelectTrigger aria-label="Overall Recommendation" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STRONG_HIRE">Strong Hire</SelectItem>
                  <SelectItem value="HIRE">Hire</SelectItem>
                  <SelectItem value="MAYBE">Maybe / Borderline</SelectItem>
                  <SelectItem value="NO_HIRE">No Hire</SelectItem>
                  <SelectItem value="STRONG_NO_HIRE">Strong No Hire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Rating (1 to 5 Stars)</Label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button aria-label={`Rate ${star} out of 5`}
                    key={star}
                    type="button"
                    onClick={() => setFeedbackModal({ ...feedbackModal, rating: star })}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`size-5 ${
                        star <= feedbackModal.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Detailed Evaluation Feedback *</Label>
              <Textarea aria-label="Detailed Evaluation Feedback"
                required
                value={feedbackModal.feedback}
                onChange={(e) => setFeedbackModal({ ...feedbackModal, feedback: e.target.value })}
                rows={4}
                placeholder="Technical depth, problem solving, communication skills, culture fit..."
                className="text-xs"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFeedbackModal((prev) => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                Submit Scorecard
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Interview Modal */}
      <Dialog
        open={cancelModal.isOpen}
        onOpenChange={(open) => !open && setCancelModal((prev) => ({ ...prev, isOpen: false }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Interview</DialogTitle>
            <DialogDescription className="text-xs">
              State the reason for cancellation. This will be preserved in the candidate timeline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs">Cancellation Reason</Label>
            <Input aria-label="Cancellation Reason"
              value={cancelModal.reason}
              onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
              placeholder="e.g. Candidate rescheduled, interviewer unavailable"
              className="text-xs"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelModal({ ...cancelModal, isOpen: false })}
            >
              Keep Scheduled
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancelInterview}
              className="font-semibold"
            >
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
