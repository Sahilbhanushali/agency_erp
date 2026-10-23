"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import {
  CalendarClock,
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Search,
  RefreshCw,
  Upload,
  UserCheck,
  FileText,
  Briefcase,
  AlertTriangle,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }
  return res.json();
};

export default function AttendancePage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "";
  const isHRorAdmin = ["ADMIN", "MANAGER", "HR"].includes(userRole);
  const currentUserId = Number(session?.user?.id);

  const [activeTab, setActiveTab] = useState("team");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Regularization modal states
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [regDate, setRegDate] = useState(new Date().toISOString().split("T")[0]);
  const [regCheckIn, setRegCheckIn] = useState("09:30");
  const [regCheckOut, setRegCheckOut] = useState("18:30");
  const [regReason, setRegReason] = useState("");
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Manual Correction Modal (HR only)
  const [correctingAttendance, setCorrectingAttendance] = useState<any | null>(null);
  const [corStatus, setCorStatus] = useState("PRESENT");
  const [corCheckIn, setCorCheckIn] = useState("");
  const [corCheckOut, setCorCheckOut] = useState("");
  const [corReason, setCorReason] = useState("");
  const [isSubmittingCor, setIsSubmittingCor] = useState(false);

  // Leave application modal
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [leaveStart, setLeaveStart] = useState(new Date().toISOString().split("T")[0]);
  const [leaveEnd, setLeaveEnd] = useState(new Date().toISOString().split("T")[0]);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // SWR Data Fetching
  const {
    data: attendanceList = [],
    isLoading: attendanceLoading,
    mutate: mutateAttendance,
  } = useSWR(
    `/api/attendance?date=${selectedDate}${statusFilter !== "ALL" ? `&status=${statusFilter}` : ""}`,
    fetcher
  );

  const {
    data: regularizations = [],
    mutate: mutateRegularizations,
  } = useSWR(`/api/attendance/regularize`, fetcher);

  const {
    data: leaveBalances = [],
    mutate: mutateBalances,
  } = useSWR(`/api/leaves/balances`, fetcher);

  const {
    data: leaveRequests = [],
    mutate: mutateLeaves,
  } = useSWR(`/api/leaves`, fetcher);

  const { data: leaveTypes = [] } = useSWR(`/api/leaves/types`, fetcher);

  // Safe Arrays
  const safeAttendanceList = Array.isArray(attendanceList) ? attendanceList : [];
  const safeRegularizations = Array.isArray(regularizations) ? regularizations : [];
  const safeLeaveBalances = Array.isArray(leaveBalances) ? leaveBalances : [];
  const safeLeaveRequests = Array.isArray(leaveRequests) ? leaveRequests : [];
  const safeLeaveTypes = Array.isArray(leaveTypes) ? leaveTypes : [];

  // Filtered attendance list
  const filteredAttendance = safeAttendanceList.filter((a: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.user?.name?.toLowerCase().includes(q) ||
      a.user?.email?.toLowerCase().includes(q) ||
      a.user?.designation?.toLowerCase().includes(q)
    );
  });

  // Metrics
  const presentCount = filteredAttendance.filter((a: any) => ["PRESENT", "LATE"].includes(a.status)).length;
  const leaveCount = filteredAttendance.filter((a: any) => a.status === "ON_LEAVE").length;
  const lateCount = filteredAttendance.filter((a: any) => a.status === "LATE").length;
  const pendingRegCount = safeRegularizations.filter((r: any) => r.status === "PENDING").length;

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);

  // Handlers
  const handleSyncAttendance = async (providerType?: string) => {
    try {
      setIsSyncing(true);
      const res = await fetch("/api/attendance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: selectedDate,
          endDate: selectedDate,
          providerType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success(data.message || "Attendance synced successfully!");
      mutateAttendance();
    } catch (err: any) {
      toast.error(err.message || "Attendance sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCsvUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      toast.error("Please select a CSV file to upload.");
      return;
    }
    try {
      setIsUploadingCsv(true);
      const formData = new FormData();
      formData.append("file", csvFile);
      const res = await fetch("/api/attendance/csv-import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to import CSV");
      toast.success(data.message || `Successfully imported ${data.syncedCount} records.`);
      setIsCsvModalOpen(false);
      setCsvFile(null);
      mutateAttendance();
    } catch (err: any) {
      toast.error(err.message || "CSV upload failed");
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const handleManualCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingAttendance || !corReason.trim()) {
      toast.error("Please provide a reason for the manual correction.");
      return;
    }
    try {
      setIsSubmittingCor(true);
      const res = await fetch(`/api/attendance/${correctingAttendance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: corStatus,
          checkIn: corCheckIn ? `${selectedDate}T${corCheckIn}:00.000Z` : null,
          checkOut: corCheckOut ? `${selectedDate}T${corCheckOut}:00.000Z` : null,
          reason: corReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Correction failed");
      toast.success("Attendance record updated with audit trail.");
      setCorrectingAttendance(null);
      mutateAttendance();
    } catch (err: any) {
      toast.error(err.message || "Failed to correct attendance");
    } finally {
      setIsSubmittingCor(false);
    }
  };

  const handleRegularizationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regReason.trim()) {
      toast.error("Please provide a reason for regularization.");
      return;
    }
    try {
      setIsSubmittingReg(true);
      const res = await fetch("/api/attendance/regularize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: regDate,
          requestedCheckIn: `${regDate}T${regCheckIn}:00.000Z`,
          requestedCheckOut: `${regDate}T${regCheckOut}:00.000Z`,
          requestedStatus: "PRESENT",
          reason: regReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regularization request failed");
      toast.success("Regularization request submitted to HR.");
      setIsRegModalOpen(false);
      setRegReason("");
      mutateRegularizations();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const handleReviewRegularization = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      const res = await fetch(`/api/attendance/regularize/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Review failed");
      toast.success(`Regularization ${status.toLowerCase()} successfully.`);
      mutateRegularizations();
      mutateAttendance();
    } catch (err: any) {
      toast.error(err.message || "Review failed");
    }
  };

  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveTypeId || !leaveReason.trim()) {
      toast.error("Please select a leave type and provide a reason.");
      return;
    }
    try {
      setIsSubmittingLeave(true);
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveTypeId,
          startDate: leaveStart,
          endDate: leaveEnd,
          isHalfDay,
          reason: leaveReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Leave application failed");
      toast.success("Leave applied successfully!");
      setIsLeaveModalOpen(false);
      setLeaveReason("");
      mutateLeaves();
      mutateBalances();
    } catch (err: any) {
      toast.error(err.message || "Failed to apply for leave");
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleReviewLeave = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Review failed");
      toast.success(`Leave request ${status.toLowerCase()} and synchronized.`);
      mutateLeaves();
      mutateBalances();
      mutateAttendance();
    } catch (err: any) {
      toast.error(err.message || "Review failed");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PRESENT":
        return <Badge variant="success" className="text-[10px] py-0">Present</Badge>;
      case "LATE":
        return <Badge variant="warning" className="text-[10px] py-0">Late Mark</Badge>;
      case "HALF_DAY":
        return <Badge variant="warning" className="text-[10px] py-0">Half Day</Badge>;
      case "ABSENT":
        return <Badge variant="destructive" className="text-[10px] py-0">Absent</Badge>;
      case "ON_LEAVE":
        return <Badge variant="info" className="text-[10px] py-0">On Leave</Badge>;
      case "HOLIDAY":
        return <Badge variant="purple" className="text-[10px] py-0">Holiday</Badge>;
      case "WEEKLY_OFF":
        return <Badge variant="neutral" className="text-[10px] py-0">Weekly Off</Badge>;
      default:
        return <Badge variant="neutral" className="text-[10px] py-0">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarClock className="size-6 text-primary" />
            Attendance & Leave Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track daily attendance, biometric sync, leave balances, and regularizations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isHRorAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCsvModalOpen(true)}
                className="gap-1.5 text-xs font-medium"
              >
                <Upload className="size-3.5" />
                Upload CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSyncAttendance()}
                loading={isSyncing}
                className="gap-1.5 text-xs font-medium"
              >
                <RefreshCw className="size-3.5" />
                Sync Biometric
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={() => setIsRegModalOpen(true)}
            className="gap-1.5 text-xs font-medium"
          >
            <Clock className="size-3.5" />
            Regularize
          </Button>
          <Button
            size="sm"
            onClick={() => setIsLeaveModalOpen(true)}
            className="gap-1.5 text-xs font-medium"
          >
            <Plus className="size-3.5" />
            Apply Leave
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Present Today
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{presentCount}</h3>
            </div>
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                On Leave
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{leaveCount}</h3>
            </div>
            <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Briefcase className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Late Marks
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{lateCount}</h3>
            </div>
            <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pending Regularizations
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{pendingRegCount}</h3>
            </div>
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <AlertCircle className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 border border-border/60 rounded-lg">
          <TabsTrigger value="team" className="text-xs">
            Team Attendance
          </TabsTrigger>
          <TabsTrigger value="regularizations" className="text-xs">
            Regularizations ({pendingRegCount})
          </TabsTrigger>
          <TabsTrigger value="leaves" className="text-xs">
            Leave Requests ({safeLeaveRequests.length})
          </TabsTrigger>
          <TabsTrigger value="balances" className="text-xs">
            Leave Balances
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Team Daily Attendance */}
        <TabsContent value="team" className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-36 h-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-8 text-xs bg-background">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                  <SelectItem value="PRESENT" className="text-xs">Present</SelectItem>
                  <SelectItem value="LATE" className="text-xs">Late Mark</SelectItem>
                  <SelectItem value="HALF_DAY" className="text-xs">Half Day</SelectItem>
                  <SelectItem value="ABSENT" className="text-xs">Absent</SelectItem>
                  <SelectItem value="ON_LEAVE" className="text-xs">On Leave</SelectItem>
                  <SelectItem value="WEEKLY_OFF" className="text-xs">Weekly Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="shadow-2xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold">Employee</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Check-In</TableHead>
                  <TableHead className="text-xs font-semibold">Check-Out</TableHead>
                  <TableHead className="text-xs font-semibold">Total Hours</TableHead>
                  <TableHead className="text-xs font-semibold">Overtime / Late</TableHead>
                  <TableHead className="text-xs font-semibold">Source</TableHead>
                  {isHRorAdmin && (
                    <TableHead className="text-right text-xs font-semibold">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceLoading ? (
                  [1, 2, 3].map((i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                      {isHRorAdmin && <TableCell><Skeleton className="h-4 w-12" /></TableCell>}
                    </TableRow>
                  ))
                ) : filteredAttendance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isHRorAdmin ? 8 : 7} className="text-center py-8 text-xs text-muted-foreground">
                      No attendance records found for {selectedDate}. Click &quot;Sync Adapter&quot; to populate.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAttendance.map((record: any) => {
                    const inTime = record.checkIn
                      ? new Date(record.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "--:--";
                    const outTime = record.checkOut
                      ? new Date(record.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "--:--";

                    return (
                      <TableRow key={record.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="size-7 border border-border">
                              <AvatarImage src={record.user?.avatar || "/placeholder.svg"} />
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                                {record.user?.name?.charAt(0) || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">
                                {record.user?.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {record.user?.designation || record.user?.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell className="text-xs font-mono">{inTime}</TableCell>
                        <TableCell className="text-xs font-mono">{outTime}</TableCell>
                        <TableCell className="text-xs font-mono font-medium">
                          {record.totalHours > 0 ? `${record.totalHours} hrs` : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {record.lateMinutes > 0 && (
                              <span className="text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.2 rounded font-mono">
                                +{record.lateMinutes}m late
                              </span>
                            )}
                            {record.overtimeHours > 0 && (
                              <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.2 rounded font-mono font-bold">
                                +{record.overtimeHours}h OT
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="neutral" className="text-[9px] uppercase font-mono py-0">
                            {record.source}
                          </Badge>
                          {record.isCorrected && (
                            <span
                              className="ml-1 text-[10px] text-primary underline cursor-help"
                              title={`Corrected by ${record.correctedBy?.name || "HR"}: ${record.correctionReason}`}
                            >
                              [Edited]
                            </span>
                          )}
                        </TableCell>
                        {isHRorAdmin && (
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                setCorrectingAttendance(record);
                                setCorStatus(record.status);
                                setCorCheckIn(
                                  record.checkIn
                                    ? new Date(record.checkIn).toISOString().slice(11, 16)
                                    : "09:30"
                                );
                                setCorCheckOut(
                                  record.checkOut
                                    ? new Date(record.checkOut).toISOString().slice(11, 16)
                                    : "18:30"
                                );
                                setCorReason(record.correctionReason || "");
                              }}
                              className="text-xs"
                            >
                              Correct
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 2: Regularization Requests */}
        <TabsContent value="regularizations" className="space-y-3">
          <Card className="shadow-2xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold">Employee</TableHead>
                  <TableHead className="text-xs font-semibold">Requested Date</TableHead>
                  <TableHead className="text-xs font-semibold">Proposed Punches</TableHead>
                  <TableHead className="text-xs font-semibold">Reason</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  {isHRorAdmin && (
                    <TableHead className="text-right text-xs font-semibold">Review</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeRegularizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isHRorAdmin ? 6 : 5} className="text-center py-8 text-xs text-muted-foreground">
                      No attendance regularization requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  safeRegularizations.map((reg: any) => (
                    <TableRow key={reg.id}>
                      <TableCell className="font-medium text-xs">
                        {reg.user?.name}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {new Date(reg.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {reg.requestedCheckIn
                          ? new Date(reg.requestedCheckIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "--:--"}{" "}
                        to{" "}
                        {reg.requestedCheckOut
                          ? new Date(reg.requestedCheckOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "--:--"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        &ldquo;{reg.reason}&rdquo;
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            reg.status === "APPROVED"
                              ? "success"
                              : reg.status === "REJECTED"
                              ? "destructive"
                              : "warning"
                          }
                          className="text-[10px] py-0"
                        >
                          {reg.status}
                        </Badge>
                      </TableCell>
                      {isHRorAdmin && (
                        <TableCell className="text-right">
                          {reg.status === "PENDING" && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => handleReviewRegularization(reg.id, "APPROVED")}
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                              >
                                Approve
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => handleReviewRegularization(reg.id, "REJECTED")}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 3: Leave Requests */}
        <TabsContent value="leaves" className="space-y-3">
          <Card className="shadow-2xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold">Employee</TableHead>
                  <TableHead className="text-xs font-semibold">Leave Type</TableHead>
                  <TableHead className="text-xs font-semibold">Duration</TableHead>
                  <TableHead className="text-xs font-semibold">Days</TableHead>
                  <TableHead className="text-xs font-semibold">Reason</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  {isHRorAdmin && (
                    <TableHead className="text-right text-xs font-semibold">Review</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeLeaveRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isHRorAdmin ? 7 : 6} className="text-center py-8 text-xs text-muted-foreground">
                      No leave requests submitted yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  safeLeaveRequests.map((leave: any) => (
                    <TableRow key={leave.id}>
                      <TableCell className="font-medium text-xs">
                        {leave.user?.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" className="text-[10px] py-0">
                          {leave.leaveType?.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {new Date(leave.startDate).toLocaleDateString()} to{" "}
                        {new Date(leave.endDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs font-bold">
                        {leave.totalDays} {leave.isHalfDay ? "(Half Day)" : "Days"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        &ldquo;{leave.reason}&rdquo;
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            leave.status === "APPROVED"
                              ? "success"
                              : leave.status === "REJECTED"
                              ? "destructive"
                              : "warning"
                          }
                          className="text-[10px] py-0"
                        >
                          {leave.status}
                        </Badge>
                      </TableCell>
                      {isHRorAdmin && (
                        <TableCell className="text-right">
                          {leave.status === "PENDING" && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => handleReviewLeave(leave.id, "APPROVED")}
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                              >
                                Approve
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => handleReviewLeave(leave.id, "REJECTED")}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 4: Leave Balances */}
        <TabsContent value="balances" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {safeLeaveBalances.map((b: any) => (
              <Card key={b.id} className="shadow-2xs">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>{b.leaveType?.name}</span>
                    <Badge variant={b.leaveType?.isPaid ? "success" : "neutral"} className="text-[9px] py-0">
                      {b.leaveType?.isPaid ? "Paid" : "Unpaid"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-foreground">
                      {b.remainingDays}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Quota: {b.totalQuota} days
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
                    <span>Used: {b.usedDays} days</span>
                    <span>Year: {b.year}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ================= MODAL: MANUAL CORRECTION (HR) ================= */}
      {correctingAttendance && (
        <Dialog open={!!correctingAttendance} onOpenChange={() => setCorrectingAttendance(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <UserCheck className="size-5 text-primary" /> Correct Attendance Record
              </DialogTitle>
              <DialogDescription className="text-xs">
                Modify punch times and status for {correctingAttendance.user?.name}. An audit trail will be preserved.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleManualCorrectionSubmit} className="space-y-3 py-2">
              <div>
                <Label className="text-xs font-medium">Status</Label>
                <Select value={corStatus} onValueChange={setCorStatus}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT" className="text-xs">Present</SelectItem>
                    <SelectItem value="LATE" className="text-xs">Late Mark</SelectItem>
                    <SelectItem value="HALF_DAY" className="text-xs">Half Day</SelectItem>
                    <SelectItem value="ABSENT" className="text-xs">Absent</SelectItem>
                    <SelectItem value="ON_LEAVE" className="text-xs">On Leave</SelectItem>
                    <SelectItem value="HOLIDAY" className="text-xs">Holiday</SelectItem>
                    <SelectItem value="WEEKLY_OFF" className="text-xs">Weekly Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Check-In Time</Label>
                  <Input
                    type="time"
                    value={corCheckIn}
                    onChange={(e) => setCorCheckIn(e.target.value)}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Check-Out Time</Label>
                  <Input
                    type="time"
                    value={corCheckOut}
                    onChange={(e) => setCorCheckOut(e.target.value)}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium">Reason for Correction *</Label>
                <Textarea
                  value={corReason}
                  onChange={(e) => setCorReason(e.target.value)}
                  placeholder="e.g. Biometric reader issue, Approved half-day permission"
                  className="mt-1 text-xs min-h-[60px]"
                  required
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCorrectingAttendance(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={isSubmittingCor}>
                  Save Correction
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= MODAL: REQUEST REGULARIZATION ================= */}
      {isRegModalOpen && (
        <Dialog open={isRegModalOpen} onOpenChange={setIsRegModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Clock className="size-5 text-primary" /> Request Attendance Regularization
              </DialogTitle>
              <DialogDescription className="text-xs">
                Submit missing punch or attendance regularization to HR for approval.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRegularizationSubmit} className="space-y-3 py-2">
              <div>
                <Label className="text-xs font-medium">Date</Label>
                <Input
                  type="date"
                  value={regDate}
                  onChange={(e) => setRegDate(e.target.value)}
                  className="mt-1 h-8 text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Actual Check-In</Label>
                  <Input
                    type="time"
                    value={regCheckIn}
                    onChange={(e) => setRegCheckIn(e.target.value)}
                    className="mt-1 h-8 text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Actual Check-Out</Label>
                  <Input
                    type="time"
                    value={regCheckOut}
                    onChange={(e) => setRegCheckOut(e.target.value)}
                    className="mt-1 h-8 text-xs font-mono"
                    required
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium">Reason *</Label>
                <Textarea
                  value={regReason}
                  onChange={(e) => setRegReason(e.target.value)}
                  placeholder="e.g. Forgot to punch RFID card, Client on-site meeting"
                  className="mt-1 text-xs min-h-[60px]"
                  required
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRegModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={isSubmittingReg}>
                  Submit Request
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= MODAL: APPLY FOR LEAVE ================= */}
      {isLeaveModalOpen && (
        <Dialog open={isLeaveModalOpen} onOpenChange={setIsLeaveModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Plus className="size-5 text-primary" /> Apply for Leave
              </DialogTitle>
              <DialogDescription className="text-xs">
                Submit your leave application for manager and HR approval.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleApplyLeaveSubmit} className="space-y-3 py-2">
              <div>
                <Label className="text-xs font-medium">Leave Type *</Label>
                <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {safeLeaveTypes.map((t: any) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name} ({t.isPaid ? "Paid" : "Unpaid"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Start Date</Label>
                  <Input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="mt-1 h-8 text-xs"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">End Date</Label>
                  <Input
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="mt-1 h-8 text-xs"
                    required
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="half-day"
                  checked={isHalfDay}
                  onChange={(e) => setIsHalfDay(e.target.checked)}
                  className="rounded border-border"
                />
                <Label htmlFor="half-day" className="text-xs font-normal cursor-pointer">
                  This is a Half-Day Leave (0.5 day)
                </Label>
              </div>
              <div>
                <Label className="text-xs font-medium">Reason for Leave *</Label>
                <Textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="State the reason for your leave..."
                  className="mt-1 text-xs min-h-[60px]"
                  required
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLeaveModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={isSubmittingLeave}>
                  Apply Leave
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* CSV Punch Upload Dialog */}
      {isCsvModalOpen && (
        <Dialog open={isCsvModalOpen} onOpenChange={setIsCsvModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Upload className="size-5 text-primary" /> Upload Biometric Attendance CSV
              </DialogTitle>
              <DialogDescription className="text-xs">
                Import punches from biometric machines or hardware punch logs.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCsvUploadSubmit} className="space-y-3 py-2">
              <div className="p-3 bg-muted/30 border border-border rounded-lg text-xs space-y-1">
                <p className="font-semibold text-foreground">Expected CSV Column Format:</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  Email,Date,CheckIn,CheckOut
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Example: <code className="bg-muted px-1 py-0.5 rounded">john@agency.com,2026-10-12,09:30,18:30</code>
                </p>
              </div>

              <div>
                <Label className="text-xs font-medium">Select .CSV File</Label>
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="mt-1 h-9 text-xs cursor-pointer"
                  required
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCsvModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={isUploadingCsv}>
                  Upload & Process
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
