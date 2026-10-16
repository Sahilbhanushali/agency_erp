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
  Briefcase,
  Plus,
  MapPin,
  Building,
  Users,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  Archive,
  Clock,
} from "lucide-react";
import { formatCurrencyINR, formatDatePretty } from "@/lib/hrms/placeholder-engine";
import toast from "react-hot-toast";

interface JobOpening {
  id: string;
  title: string;
  code: string;
  department: string;
  location: string;
  employmentType: string;
  status: string;
  openingsCount: number;
  experienceMin: number;
  experienceMax?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency: string;
  description?: string | null;
  requirements?: string | null;
  benefits?: string | null;
  targetDate?: string | null;
  createdAt: string;
  hiringManager?: { name: string } | null;
  recruiter?: { name: string } | null;
  _count?: {
    applications: number;
    interviews: number;
    offers: number;
  };
}

interface HrmsJobsTabProps {
  onSelectJobForCandidates?: (jobId: string) => void;
}

export function HrmsJobsTab({ onSelectJobForCandidates }: HrmsJobsTabProps) {
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Create/Edit Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobOpening | null>(null);

  // Delete / Archive Confirmation Dialog
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    id: string;
    title: string;
  }>({
    isOpen: false,
    id: "",
    title: "",
  });

  const [formData, setFormData] = useState({
    title: "",
    code: "",
    department: "Engineering",
    location: "Bengaluru HQ (Hybrid)",
    employmentType: "FULL_TIME",
    status: "ACTIVE",
    openingsCount: 1,
    experienceMin: 2,
    experienceMax: 5,
    salaryMin: 1200000,
    salaryMax: 1800000,
    currency: "INR",
    description: "",
    requirements: "",
    benefits: "",
    hiringManagerId: "",
    recruiterId: "",
    targetDate: "",
  });

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedDept !== "ALL") params.set("department", selectedDept);
      if (selectedStatus !== "ALL") params.set("status", selectedStatus);

      const res = await fetch(`/api/hrms/jobs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      setJobs(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const u = await res.json();
        setUsers(Array.isArray(u) ? u : u.users || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [selectedDept, selectedStatus]);

  const departments = Array.from(new Set(jobs.map((j) => j.department))).filter(Boolean);

  const handleOpenCreate = () => {
    setEditingJob(null);
    setFormData({
      title: "",
      code: `JOB-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      department: "Engineering",
      location: "Bengaluru HQ (Hybrid)",
      employmentType: "FULL_TIME",
      status: "ACTIVE",
      openingsCount: 1,
      experienceMin: 2,
      experienceMax: 5,
      salaryMin: 1200000,
      salaryMax: 1800000,
      currency: "INR",
      description: "",
      requirements: "",
      benefits: "",
      hiringManagerId: users[0]?.id ? String(users[0].id) : "",
      recruiterId: users[0]?.id ? String(users[0].id) : "",
      targetDate: "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (job: JobOpening) => {
    setEditingJob(job);
    setFormData({
      title: job.title,
      code: job.code,
      department: job.department,
      location: job.location,
      employmentType: job.employmentType,
      status: job.status,
      openingsCount: job.openingsCount,
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax || 0,
      salaryMin: job.salaryMin || 0,
      salaryMax: job.salaryMax || 0,
      currency: job.currency || "INR",
      description: job.description || "",
      requirements: job.requirements || "",
      benefits: job.benefits || "",
      hiringManagerId: "",
      recruiterId: "",
      targetDate: job.targetDate ? job.targetDate.split("T")[0] : "",
    });
    setIsDialogOpen(true);
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingJob) {
        const res = await fetch(`/api/hrms/jobs/${editingJob.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Failed to update job");
        toast.success("Job updated successfully");
      } else {
        const res = await fetch("/api/hrms/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Failed to create job");
        toast.success("Job opening created!");
      }
      setIsDialogOpen(false);
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || "Failed to save job opening");
    }
  };

  const triggerDeleteJob = (job: JobOpening) => {
    setDeleteModal({
      isOpen: true,
      id: job.id,
      title: job.title,
    });
  };

  const confirmDeleteJob = async () => {
    if (!deleteModal.id) return;
    try {
      const res = await fetch(`/api/hrms/jobs/${deleteModal.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove job");
      toast.success("Job opening archived");
      setDeleteModal({ isOpen: false, id: "", title: "" });
      fetchJobs();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove job");
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
              placeholder="Search job title, code, dept..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchJobs()}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PAUSED">Paused</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="xs" onClick={fetchJobs} className="text-xs text-muted-foreground">
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <Button size="sm" onClick={handleOpenCreate} className="gap-1.5 text-xs font-semibold">
          <Plus className="size-3.5" />
          <span>Post Job Opening</span>
        </Button>
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-muted-foreground">
            Loading job openings...
          </div>
        ) : jobs.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
            No job openings found. Click "Post Job Opening" to create one.
          </div>
        ) : (
          jobs.map((job) => (
            <Card
              key={job.id}
              className="border-border/70 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between"
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <Badge variant="outline" className="text-[10px] bg-muted/30 font-bold mb-1">
                      {job.code}
                    </Badge>
                    <CardTitle className="text-sm font-bold text-foreground">{job.title}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span>{job.department}</span>
                      <span>•</span>
                      <span>{job.location}</span>
                    </CardDescription>
                  </div>

                  <Badge
                    variant={job.status === "ACTIVE" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {job.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-1 space-y-3">
                <div className="rounded-md bg-muted/30 p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Experience:</span>
                    <span className="font-semibold text-foreground">
                      {job.experienceMin} - {job.experienceMax || "Any"} yrs
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Compensation Range:</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrencyINR(job.salaryMin)} - {formatCurrencyINR(job.salaryMax)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Vacancies:</span>
                    <span className="font-semibold text-foreground">{job.openingsCount} Openings</span>
                  </div>
                </div>

                {job.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {job.description}
                  </p>
                )}

                {/* Pipeline Counts summary */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="size-3 text-primary" />
                    <strong>{job._count?.applications || 0}</strong> Applicants
                  </span>
                  <span className="text-muted-foreground">
                    <strong>{job._count?.interviews || 0}</strong> Interviews
                  </span>
                  <span className="text-muted-foreground">
                    <strong>{job._count?.offers || 0}</strong> Offers
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onSelectJobForCandidates?.(job.id)}
                    className="text-xs text-primary"
                  >
                    View Applicants
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleOpenEdit(job)}
                      title="Edit job opening"
                    >
                      <Edit className="size-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => triggerDeleteJob(job)}
                      title="Archive job"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create / Edit Job Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingJob ? "Edit Job Opening" : "Create New Job Opening"}</DialogTitle>
            <DialogDescription className="text-xs">
              Define the requirements, compensation range, and hiring management for this position.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveJob} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Job Title *</Label>
                <Input
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Senior Full Stack Engineer"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Job Code / ID *</Label>
                <Input
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Department *</Label>
                <Input
                  required
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Engineering / Design / Marketing"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Work Location *</Label>
                <Input
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Bengaluru HQ / Remote"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Employment Type</Label>
                <Select
                  value={formData.employmentType}
                  onValueChange={(val) => setFormData({ ...formData, employmentType: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">Full-Time</SelectItem>
                    <SelectItem value="PART_TIME">Part-Time</SelectItem>
                    <SelectItem value="CONTRACT">Contract</SelectItem>
                    <SelectItem value="INTERN">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Total Openings Count</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.openingsCount}
                  onChange={(e) =>
                    setFormData({ ...formData, openingsCount: Number(e.target.value) })
                  }
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PAUSED">Paused</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Minimum Experience (Years)</Label>
                <Input
                  type="number"
                  value={formData.experienceMin}
                  onChange={(e) =>
                    setFormData({ ...formData, experienceMin: Number(e.target.value) })
                  }
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Maximum Experience (Years)</Label>
                <Input
                  type="number"
                  value={formData.experienceMax}
                  onChange={(e) =>
                    setFormData({ ...formData, experienceMax: Number(e.target.value) })
                  }
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Salary Min (Annual CTC in ₹)</Label>
                <Input
                  type="number"
                  value={formData.salaryMin}
                  onChange={(e) =>
                    setFormData({ ...formData, salaryMin: Number(e.target.value) })
                  }
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Salary Max (Annual CTC in ₹)</Label>
                <Input
                  type="number"
                  value={formData.salaryMax}
                  onChange={(e) =>
                    setFormData({ ...formData, salaryMax: Number(e.target.value) })
                  }
                  className="text-xs"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Job Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Role Requirements</Label>
                <Textarea
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-semibold">
                {editingJob ? "Save Changes" : "Post Job Opening"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete / Archive Confirmation Dialog */}
      <Dialog
        open={deleteModal.isOpen}
        onOpenChange={(open) => !open && setDeleteModal({ isOpen: false, id: "", title: "" })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              <span>Archive Job Opening</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to archive or remove <strong>{deleteModal.title}</strong>? Candidates linked to this opening will remain in their candidate records.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModal({ isOpen: false, id: "", title: "" })}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={confirmDeleteJob}
              className="font-semibold"
            >
              Archive Opening
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
