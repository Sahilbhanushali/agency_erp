"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  UserCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Mail,
  Building,
  Briefcase,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Laptop,
  RotateCcw,
} from "lucide-react";
import { formatCurrencyINR, formatDatePretty } from "@/lib/hrms/placeholder-engine";
import { DEFAULT_ONBOARDING_CHECKLIST } from "@/lib/hrms/types";
import toast from "react-hot-toast";


interface OnboardingTask {
  id: string;
  task: string;
  category: string;
  done: boolean;
}

interface OnboardingRecord {
  id: string;
  candidateId: string;
  joiningDate: string;
  status: string;
  checklistJson?: string | null;
  convertedUserId?: number | null;
  completedAt?: string | null;
  notes?: string | null;
  candidate: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    currentTitle?: string | null;
    city?: string | null;
    address?: string | null;
  };
  jobOpening?: {
    id: string;
    title: string;
    department: string;
  } | null;
  offer?: {
    id: string;
    offerNumber: string;
    jobTitle: string;
    department: string;
    annualCtc: number;
    monthlyGross: number;
  } | null;
  assignedBuddy?: {
    id: number;
    name: string;
    email: string;
  } | null;
  convertedUser?: {
    id: number;
    name: string;
    email: string;
    role?: any;
  } | null;
}

export function HrmsOnboardingTab() {
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active candidate checklist modal
  const [activeRecord, setActiveRecord] = useState<OnboardingRecord | null>(null);
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [savingTasks, setSavingTasks] = useState(false);

  // Conversion confirmation modal
  const [convertModal, setConvertModal] = useState<{
    isOpen: boolean;
    record: OnboardingRecord | null;
    isConverting: boolean;
    roleName: string;
    temporaryPassword: string;
  }>({
    isOpen: false,
    record: null,
    isConverting: false,
    roleName: "STAFF",
    temporaryPassword: "",
  });

  const fetchOnboarding = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hrms/onboarding");
      if (!res.ok) throw new Error("Failed to fetch onboarding");
      const data = await res.json();
      setRecords(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load onboarding");
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
    fetchOnboarding();
  }, []);

  const openChecklistModal = (record: OnboardingRecord) => {
    setActiveRecord(record);
    try {
      const parsed = record.checklistJson ? JSON.parse(record.checklistJson) : [];
      if (parsed && parsed.length > 0) {
        setTasks(parsed);
      } else {
        setTasks(
          DEFAULT_ONBOARDING_CHECKLIST.map((t) => ({
            id: t.id,
            task: t.task,
            category: t.category,
            done: false,
          }))
        );
      }
    } catch {
      setTasks(
        DEFAULT_ONBOARDING_CHECKLIST.map((t) => ({
          id: t.id,
          task: t.task,
          category: t.category,
          done: false,
        }))
      );
    }
  };


  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
    );
  };

  const handleSaveChecklist = async () => {
    if (!activeRecord) return;
    setSavingTasks(true);
    try {
      const allDone = tasks.length > 0 && tasks.every((t) => t.done);
      const res = await fetch(`/api/hrms/onboarding/${activeRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistJson: JSON.stringify(tasks),
          status: allDone ? "COMPLETED" : "IN_PROGRESS",
        }),
      });

      if (!res.ok) throw new Error("Failed to update checklist");
      toast.success("Checklist progress saved");
      setActiveRecord(null);
      fetchOnboarding();
    } catch (e: any) {
      toast.error(e.message || "Failed to save checklist");
    } finally {
      setSavingTasks(false);
    }
  };

  const handleAssignBuddy = async (onboardingId: string, buddyUserId: string) => {
    try {
      const res = await fetch(`/api/hrms/onboarding/${onboardingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedBuddyId: buddyUserId ? Number(buddyUserId) : null }),
      });
      if (!res.ok) throw new Error("Failed to assign buddy");
      toast.success("Onboarding buddy assigned");
      fetchOnboarding();
    } catch (e: any) {
      toast.error(e.message || "Failed to assign buddy");
    }
  };

  const handleConvertEmployee = async () => {
    const record = convertModal.record;
    if (!record) return;

    setConvertModal((prev) => ({ ...prev, isConverting: true }));
    try {
      const res = await fetch(`/api/hrms/onboarding/${record.id}/convert-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleName: convertModal.roleName,
          temporaryPassword: convertModal.temporaryPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to convert candidate");

      toast.success(data.message || "Employee account created!");
      setConvertModal({
        isOpen: false,
        record: null,
        isConverting: false,
        roleName: "STAFF",
        temporaryPassword: "",
      });
      fetchOnboarding();
    } catch (err: any) {
      toast.error(err.message || "Failed to convert candidate to user account");
      setConvertModal((prev) => ({ ...prev, isConverting: false }));
    }
  };


  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 p-3 rounded-lg border border-border/60">
        <div>
          <h3 className="text-sm font-bold text-foreground">Employee Onboarding Workflows</h3>
          <p className="text-xs text-muted-foreground">
            Track pre-boarding documents, IT provisioning, team introduction checklists, and convert hired candidates into active employee User accounts.
          </p>
        </div>

        <Button variant="outline" size="xs" onClick={fetchOnboarding} className="gap-1 text-xs">
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Onboarding Candidates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-muted-foreground">
            Loading onboarding queue...
          </div>
        ) : records.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
            No candidates in the onboarding pipeline. Candidates move here once their offer is accepted.
          </div>
        ) : (
          records.map((item) => {
            let taskList: OnboardingTask[] = [];
            try {
              taskList = item.checklistJson ? JSON.parse(item.checklistJson) : [];
            } catch {}

            const completedTasks = taskList.filter((t) => t.done).length;
            const totalTasks = taskList.length;
            const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const isAlreadyConverted = !!item.convertedUserId;

            return (
              <Card
                key={item.id}
                className="border-border/70 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-10">
                        <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                          {item.candidate.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          {item.candidate.name}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                          {item.offer?.jobTitle || item.jobOpening?.title || "New Hire"} (
                          {item.offer?.department || item.jobOpening?.department || "General"})
                        </CardDescription>
                      </div>
                    </div>

                    <Badge
                      variant={isAlreadyConverted ? "default" : "outline"}
                      className={`text-[10px] ${isAlreadyConverted ? "bg-emerald-600" : ""}`}
                    >
                      {isAlreadyConverted ? "Active Employee" : item.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3">
                  {/* Joining & Compensation Details */}
                  <div className="rounded-lg bg-muted/30 p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Date of Joining:</span>
                      <strong className="text-foreground">{formatDatePretty(item.joiningDate)}</strong>
                    </div>
                    {item.offer && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Agreed Compensation:</span>
                        <strong className="text-foreground">{formatCurrencyINR(item.offer.annualCtc)}</strong>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Work Contact:</span>
                      <span className="text-foreground">{item.candidate.email}</span>
                    </div>
                  </div>

                  {/* Checklist Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Onboarding Checklist</span>
                      <span className="font-bold text-foreground">
                        {completedTasks} / {totalTasks} Tasks ({percent}%)
                      </span>
                    </div>
                    <Progress
                      value={percent}
                      className={`h-2 ${
                        percent === 100
                          ? "[&>div]:bg-emerald-600"
                          : percent >= 50
                          ? "[&>div]:bg-blue-600"
                          : "[&>div]:bg-amber-500"
                      }`}
                    />
                  </div>

                  {/* Onboarding Buddy Selector */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">Onboarding Buddy:</span>
                    <Select
                      value={item.assignedBuddy?.id ? String(item.assignedBuddy.id) : "NONE"}
                      onValueChange={(val) => handleAssignBuddy(item.id, val === "NONE" ? "" : val)}
                    >
                      <SelectTrigger className="h-7 text-xs w-[160px]">
                        <SelectValue placeholder="Assign buddy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">No Buddy Assigned</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => openChecklistModal(item)}
                      className="text-xs"
                    >
                      Manage Checklist
                    </Button>

                    {!isAlreadyConverted ? (
                      <Button
                        size="xs"
                        onClick={() =>
                          setConvertModal({
                            isOpen: true,
                            record: item,
                            isConverting: false,
                            roleName: "STAFF",
                            temporaryPassword: "",
                          })
                        }
                        className="gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <UserCheck className="size-3.5" />
                        <span>Convert to Employee User</span>
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <CheckCircle2 className="size-3.5" />
                        <span>Employee Account #{item.convertedUserId}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Checklist Tasks Management Modal */}
      <Dialog open={!!activeRecord} onOpenChange={(open) => !open && setActiveRecord(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Onboarding Checklist ({activeRecord?.candidate.name})</DialogTitle>
            <DialogDescription className="text-xs">
              Check off tasks as completed across documentation, IT setup, orientation, and training.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                  task.done ? "bg-emerald-500/10 border-emerald-500/30" : "bg-card border-border/60 hover:bg-muted/30"
                }`}
              >
                <Checkbox
                  checked={task.done}
                  onCheckedChange={() => toggleTask(task.id)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className={`text-xs font-semibold ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {task.task}
                  </div>
                  <Badge variant="outline" className="text-[9px] mt-1 font-normal">
                    {task.category}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setTasks(
                  DEFAULT_ONBOARDING_CHECKLIST.map((t) => ({
                    id: t.id,
                    task: t.task,
                    category: t.category,
                    done: false,
                  }))
                )
              }
              className="text-xs text-muted-foreground gap-1"
            >
              <RotateCcw className="size-3" />
              <span>Reset 11 Steps</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveRecord(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveChecklist}
                disabled={savingTasks}
                className="font-semibold"
              >
                {savingTasks ? "Saving..." : "Save Progress"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Employee User Account Confirmation Modal */}
      <Dialog
        open={convertModal.isOpen}
        onOpenChange={(open) =>
          !open && setConvertModal((prev) => ({ ...prev, isOpen: false }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-600">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <DialogTitle>Convert Candidate to Employee User</DialogTitle>
                <DialogDescription className="text-xs">
                  Create an active staff User account in the ERP system.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-foreground">
              Are you ready to convert{" "}
              <strong className="text-primary">{convertModal.record?.candidate.name}</strong> into an
              active employee account?
            </p>
            <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-muted-foreground">
              <div>Email: <strong className="text-foreground">{convertModal.record?.candidate.email}</strong></div>
              <div>Designation: <strong className="text-foreground">{convertModal.record?.offer?.jobTitle || convertModal.record?.jobOpening?.title}</strong></div>
              <div>Department: <strong className="text-foreground">{convertModal.record?.offer?.department || convertModal.record?.jobOpening?.department}</strong></div>
              <div>Compensation: <strong className="text-foreground">{formatCurrencyINR(convertModal.record?.offer?.annualCtc)}</strong></div>
            </div>

            {/* Role & Access Selection */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold">ERP System Role</Label>
              <Select
                value={convertModal.roleName}
                onValueChange={(val) => setConvertModal((prev) => ({ ...prev, roleName: val }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Standard Staff / Employee</SelectItem>
                  <SelectItem value="MANAGER">Manager / Team Lead</SelectItem>
                  <SelectItem value="ADMIN">System Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Temporary Password (Optional)</Label>
              <Input
                type="text"
                placeholder="Leave blank to generate temporary password automatically"
                value={convertModal.temporaryPassword}
                onChange={(e) => setConvertModal((prev) => ({ ...prev, temporaryPassword: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>

            <p className="text-[11px] text-muted-foreground">
              This action will populate their staff record in User Management, link the candidate's ID, and complete the onboarding status.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConvertModal({ isOpen: false, record: null, isConverting: false, roleName: "STAFF", temporaryPassword: "" })}
              disabled={convertModal.isConverting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConvertEmployee}
              disabled={convertModal.isConverting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {convertModal.isConverting ? "Creating Account..." : "Confirm Employee Account Creation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
