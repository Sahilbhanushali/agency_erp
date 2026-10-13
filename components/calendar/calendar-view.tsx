"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar, Filter, Plus, Clock, Sparkles, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Define types for props
interface User {
  id: string;
  email: string;
  role: "CLIENT" | "DESIGNER" | "ADMIN" | "MANAGER";
  name?: string;
  company?: string;
  showPostingCalendar?: boolean;
}

interface Project {
  id: string;
  name: string;
  isActive: boolean;
  client: { id: string; email: string; name?: string; company?: string } | null;
}

interface Post {
  id: string;
  title: string;
  type: "PHOTO" | "REEL" | "STORY" | "CAROUSEL" | "CUSTOM";
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "C_APPROVED" | "REJECTED" | "SCHEDULED" | "POSTED" | "NEEDS_MINOR_CHANGE" | "RESUBMITTED";
  scheduledAt: string | null;
  designDueDate?: string | null;
  projectId?: string;
  project: { id: string; name: string; client: { id: string; email: string; name?: string; company?: string } | null } | null;
  createdBy: { id: string; email: string; name?: string } | null;
  platforms?: { id: string; platform: string; postId: string }[];
}

// Enhanced status colors with gradients
const statusColors: Record<Post["status"], string> = {
  DRAFT: "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-350 border-slate-200 dark:border-slate-750",
  SUBMITTED: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-350 border-blue-200 dark:border-blue-850",
  APPROVED: "bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-800",
  C_APPROVED: "bg-green-100 dark:bg-green-950/60 text-green-900 dark:text-green-200 border-green-300 dark:border-green-800",
  REJECTED: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-350 border-rose-200 dark:border-rose-850",
  SCHEDULED: "bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-800 shadow-sm font-semibold",
  POSTED: "bg-green-700 dark:bg-green-800 text-white border-green-800 dark:border-green-900 shadow-sm font-semibold",
  NEEDS_MINOR_CHANGE: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-350 border-amber-200 dark:border-amber-850",
  RESUBMITTED: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-350 border-blue-200 dark:border-blue-850",
};

// Modern icons for post types
const typeIcons: Record<Post["type"], string> = {
  PHOTO: "📸",
  REEL: "🎥",
  STORY: "⚡",
  CAROUSEL: "🎨",
  CUSTOM: "✨",
};

export const getStatusLabel = (status: string) => {
  switch (status) {
    case "POSTED":
      return "Posted";
    case "SCHEDULED":
      return "Scheduled";
    case "APPROVED":
      return "I Approve";
    case "C_APPROVED":
      return "C Approve";
    case "SUBMITTED":
      return "Submitted";
    case "RESUBMITTED":
      return "Resubmitted";
    case "REJECTED":
      return "Changes";
    case "NEEDS_MINOR_CHANGE":
      return "Needs Minor Change";
    case "DRAFT":
      return "Draft";
    default:
      return status ? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ") : "Draft";
  }
};

export function CalendarView({ posts = [], projects = [], currentUser }: { posts: Post[], projects: Project[], currentUser: User }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedClient, setSelectedClient] = useState<{ id: string; company: string } | null>(null);
  const [showAllClients, setShowAllClients] = useState(false);
  const [allClientsForDay, setAllClientsForDay] = useState<{ [clientId: string]: Post[] }>({});

  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [shootEvents, setShootEvents] = useState<{id: string, name: string, location: string, date: string, time: string, completed?: boolean}[]>([]);
  const [newEvent, setNewEvent] = useState({ name: "", location: "", date: "", time: "" });
  const [editingEvent, setEditingEvent] = useState<{id: string, name: string, location: string, date: string, time: string, completed?: boolean} | null>(null);

  // Determine if user can see Posting Date based on the server-provided flag
  const canSeePosting = currentUser.showPostingCalendar ?? true;
  
  const [activeTab, setActiveTab] = useState<"posting" | "design" | "shoot">(
    canSeePosting ? "posting" : "design"
  );

  useEffect(() => {
    const fetchShootEvents = async () => {
      try {
        const res = await fetch("/api/shoot-events");
        if (res.ok) {
          const data = await res.json();
          setShootEvents(data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchShootEvents();
  }, []);

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    setNewEvent({
      name: "",
      location: "",
      date: dateStr,
      time: "10:00",
    });
    setIsAddEventOpen(true);
  };

  const handleAddEvent = async () => {
    if (!newEvent.name || !newEvent.date) {
      toast.error("Please provide both an event name and date");
      return;
    }
    try {
      const res = await fetch("/api/shoot-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEvent),
      });
      if (res.ok) {
        const created = await res.json();
        setShootEvents(prev => [...prev, created]);
        setNewEvent({ name: "", location: "", date: "", time: "10:00" });
        setIsAddEventOpen(false);
        toast.success("Event created successfully");
        if (activeTab !== "shoot") {
          setActiveTab("shoot");
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to create event");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error creating event");
    }
  };

  const handleUpdateEvent = async () => {
    if (editingEvent && editingEvent.name && editingEvent.date) {
      try {
        const res = await fetch(`/api/shoot-events/${editingEvent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingEvent),
        });
        if (res.ok) {
          const updated = await res.json();
          setShootEvents(shootEvents.map(e => e.id === updated.id ? updated : e));
          setIsEditEventOpen(false);
          setEditingEvent(null);
          toast.success("Event updated");
        } else {
          toast.error("Failed to update event");
        }
      } catch (e) {
        console.error(e);
        toast.error("Error updating event");
      }
    }
  };

  const handleDeleteEvent = async () => {
    if (editingEvent) {
      try {
        const res = await fetch(`/api/shoot-events/${editingEvent.id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setShootEvents(shootEvents.filter(e => e.id !== editingEvent.id));
          setIsEditEventOpen(false);
          setEditingEvent(null);
          toast.success("Event deleted");
        } else {
          toast.error("Failed to delete event");
        }
      } catch (e) {
        console.error(e);
        toast.error("Error deleting event");
      }
    }
  };

  const handleToggleCompleteEvent = async () => {
    if (editingEvent) {
      const updatedEvent = { ...editingEvent, completed: !editingEvent.completed };
      try {
        const res = await fetch(`/api/shoot-events/${editingEvent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedEvent),
        });
        if (res.ok) {
          const updated = await res.json();
          setShootEvents(shootEvents.map(e => e.id === updated.id ? updated : e));
          setIsEditEventOpen(false);
          setEditingEvent(null);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Filter posts based on selected project and status
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const projectMatch = selectedProject === "all" || post.projectId === selectedProject;
      const statusMatch = selectedStatus === "all" || post.status === selectedStatus;
      return projectMatch && statusMatch;
    });
  }, [posts, selectedProject, selectedStatus]);

  // Get calendar days for current month
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group shoot events by date
  const shootsByDate = useMemo(() => {
    const grouped: { [dateKey: string]: typeof shootEvents } = {};
    shootEvents.forEach(event => {
      if (event.date) {
        if (!grouped[event.date]) grouped[event.date] = [];
        grouped[event.date].push(event);
      }
    });
    return grouped;
  }, [shootEvents]);

  // Group posts by date and client
  const postsByDateAndClient = useMemo(() => {
    const grouped: { [dateKey: string]: { [clientId: string]: Post[] } } = {};
    filteredPosts.forEach((post) => {
      const targetDateStr = activeTab === "posting" ? post.scheduledAt : (post.designDueDate || post.scheduledAt);
      if (targetDateStr) {
        const scheduledDate = new Date(targetDateStr);
        const dateKey = format(scheduledDate, "yyyy-MM-dd");
        const clientId = post.project?.client?.id || "no-client";
        if (!grouped[dateKey]) grouped[dateKey] = {};
        if (!grouped[dateKey][clientId]) grouped[dateKey][clientId] = [];
        grouped[dateKey][clientId].push(post);
      }
    });
    return grouped;
  }, [filteredPosts, activeTab]);

  // Navigate to previous or next month
  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)));
  };

  const getPostsForClientOnDay = (day: Date | null, clientId: string): Post[] => {
    if (!day) return [];
    const dateKey = format(day, "yyyy-MM-dd");
    return postsByDateAndClient[dateKey]?.[clientId] || [];
  };

  // Helper to format platforms
  const formatPlatforms = (platforms?: { id: string; platform: string; postId: string }[]) => {
    return platforms?.map((p) => p.platform).join(", ") || "No Platforms";
  };

  // Get stats
  const stats = useMemo(() => {
    const postsInCurrentMonth = filteredPosts.filter(post => {
      const targetDateStr = activeTab === "posting" ? post.scheduledAt : (post.designDueDate || post.scheduledAt);
      if (!targetDateStr) return false;
      return isSameMonth(new Date(targetDateStr), currentDate);
    });
    const posted = postsInCurrentMonth.filter(p => p.status === "POSTED").length;
    const scheduled = postsInCurrentMonth.filter(p => p.status === "SCHEDULED").length;
    const approved = postsInCurrentMonth.filter(p => p.status === "APPROVED").length;
    const c_approved = postsInCurrentMonth.filter(p => p.status === "C_APPROVED").length;
    const review = postsInCurrentMonth.filter(p => p.status === "SUBMITTED" || p.status === "RESUBMITTED" || p.status === "NEEDS_MINOR_CHANGE").length;
    const drafts = postsInCurrentMonth.filter(p => p.status === "DRAFT").length;
    return { posted, scheduled, approved, c_approved, review, drafts };
  }, [filteredPosts, currentDate, activeTab]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 space-y-6">
        {/* Header Section with Glass Effect */}
        <div className="relative overflow-hidden rounded-2xl bg-card/70 backdrop-blur-xl border border-border shadow-xl p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-indigo-600/5 to-violet-600/5"></div>
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground bg-clip-text text-transparent">
                  Content Calendar
                </h1>
              </div>
              <p className="text-muted-foreground text-lg ml-14">Strategic planning for your social media presence</p>
            </div>
            
            {/* Stats Pills */}
            <div className="flex flex-wrap gap-2">
              <div className="px-3 py-1.5 rounded-full bg-green-700 dark:bg-green-800 border border-green-800 dark:border-green-900 shadow-sm">
                <span className="text-xs font-semibold text-white">{stats.posted} Posted</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800">
                <span className="text-xs font-semibold text-purple-900 dark:text-purple-200">{stats.scheduled} Scheduled</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800">
                <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">{stats.approved} I Approve</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-950/60 border border-green-300 dark:border-green-800">
                <span className="text-xs font-semibold text-green-900 dark:text-green-200">{stats.c_approved} C Approve</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700">
                <span className="text-xs font-semibold text-yellow-900 dark:text-yellow-200">{stats.review} Review</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{stats.drafts} Drafts</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "posting" | "design" | "shoot")} className="w-full max-w-2xl">
            <TabsList className={`grid w-full ${canSeePosting ? 'grid-cols-3' : 'grid-cols-2'} p-1 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-slate-200 dark:border-slate-800 h-12`}>
              <TabsTrigger value="design" className="rounded-full h-full text-sm font-bold transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
                Design Date
              </TabsTrigger>
              {canSeePosting && (
                <TabsTrigger value="posting" className="rounded-full h-full text-sm font-bold transition-all data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
                  Posting Date
                </TabsTrigger>
              )}
              <TabsTrigger value="shoot" className="rounded-full h-full text-sm font-bold transition-all data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
                Shoot Date
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Filters & Navigation Bar */}
        <div className="rounded-2xl bg-card border border-border shadow-lg p-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Calendar Navigation */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl border-border hover:bg-muted transition-all duration-200"
                onClick={() => navigateMonth("prev")}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <div className="min-w-[200px] text-center">
                <h2 className="text-2xl font-bold text-foreground">
                  {format(currentDate, "MMMM yyyy")}
                </h2>
              </div>
              
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl border-border hover:bg-muted transition-all duration-200"
                onClick={() => navigateMonth("next")}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              
              <Button
                variant="outline"
                className="rounded-xl border-border hover:bg-muted transition-all duration-200"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => {
                  setNewEvent({ name: "", location: "", date: format(new Date(), "yyyy-MM-dd"), time: "10:00" });
                  setIsAddEventOpen(true);
                }} 
                className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl"
              >
                <Plus className="h-4 w-4" /> Add Event
              </Button>
              <Filter className="h-5 w-5 text-muted-foreground" />
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-[200px] rounded-xl border-border focus:ring-2 focus:ring-blue-500">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name || "Unnamed Project"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[160px] rounded-xl border-border focus:ring-2 focus:ring-blue-500">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="REJECTED">Changes</SelectItem>
                  <SelectItem value="POSTED">Posted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Calendar Grid with Modern Design */}
        <div className="rounded-2xl bg-card border border-border shadow-xl overflow-hidden">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 bg-muted/60 border-b border-border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
              <div 
                key={day} 
                className={`py-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground ${
                  i === 0 || i === 6 ? 'bg-muted/40 text-muted-foreground/80' : ''
                }`}
              >
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7 border-t border-border">
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`padding-${i}`} className="h-[180px] p-3 border-b border-r border-border bg-muted/5"></div>
            ))}
            {calendarDays.map((day, index) => {
              const actualIndex = index + monthStart.getDay();
              const dateKey = format(day, "yyyy-MM-dd");
              const clients = postsByDateAndClient[dateKey] || {};
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const clientCount = Object.keys(clients).length;
              
              const dayShoots = shootsByDate[dateKey] || [];
              const hasShoot = activeTab === "shoot" && dayShoots.length > 0;

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  className={`h-[180px] flex flex-col p-3 border-b border-r border-border transition-all duration-200 hover:bg-muted/20 cursor-pointer relative group
                    ${!isCurrentMonth ? "bg-muted/5 opacity-70" : "bg-card"}
                    ${isWeekend ? "bg-muted/10" : ""}
                    ${isToday ? "bg-gradient-to-br from-blue-950/20 to-indigo-950/20 ring-2 ring-blue-500 ring-inset" : ""}
                    ${actualIndex % 7 === 6 ? "border-r-0" : ""}
                    ${hasShoot ? "bg-teal-50/50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800/50" : ""}
                  `}
                >
                  {/* Date Number and Quick Add Button */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`
                        flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all duration-200
                        ${isToday 
                          ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg scale-110" 
                          : isCurrentMonth 
                            ? "text-foreground group-hover:bg-muted" 
                            : "text-muted-foreground"
                        }
                      `}>
                        {format(day, "d")}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDayClick(day);
                        }}
                        title="Add event on this date"
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {activeTab !== "shoot" && dayShoots.length > 0 && (
                        <div 
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/50 border border-teal-200 dark:border-teal-800 cursor-pointer hover:bg-teal-200 transition-colors z-10"
                          title={`${dayShoots.length} shoot event(s). Click to view in Shoot tab.`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab("shoot");
                          }}
                        >
                          <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300">🎬 {dayShoots.length}</span>
                        </div>
                      )}
                      {clientCount > 0 && (
                        <div 
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-200 transition-colors z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDay(day);
                            setAllClientsForDay(clients);
                            setShowAllClients(true);
                          }}
                        >
                          <Sparkles className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{clientCount}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Client Badges */}
                  <div className="space-y-1.5 flex-1 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {activeTab === "shoot" ? (
                      dayShoots.map(shoot => (
                        <div
                          key={shoot.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEvent(shoot);
                            setIsEditEventOpen(true);
                          }}
                          className={`group/badge cursor-pointer rounded-md border transition-all duration-200 py-1.5 px-2 shadow-sm hover:shadow-md mx-1 
                            ${shoot.completed 
                              ? "bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 opacity-80" 
                              : "bg-teal-100 dark:bg-teal-900/40 border-teal-300 dark:border-teal-800"
                            }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-xs truncate font-bold ${shoot.completed ? "text-slate-700 dark:text-slate-300 line-through" : "text-teal-900 dark:text-teal-100"}`}>
                              {shoot.name}
                            </span>
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] flex items-center gap-1 ${shoot.completed ? "text-slate-600 dark:text-slate-400" : "text-teal-700 dark:text-teal-300"}`}>
                                <Clock className="h-2.5 w-2.5" />
                                {shoot.time}
                              </span>
                              <span className={`text-[10px] truncate max-w-[60px] ${shoot.completed ? "text-slate-600 dark:text-slate-400" : "text-teal-700 dark:text-teal-300"}`}>
                                📍 {shoot.location}
                              </span>
                            </div>
                            {shoot.completed && (
                              <div className="flex items-center justify-center mt-0.5 bg-slate-200/50 dark:bg-slate-700/50 rounded-sm text-[9px] font-bold text-slate-700 dark:text-slate-300 py-0.5 w-full uppercase tracking-wider">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Completed
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                    Object.entries(clients).map(([clientId, clientPosts]) => {
                      const client = clientPosts[0].project?.client;
                      const company = client?.company || client?.email || (clientPosts[0].project?.name ? `Project: ${clientPosts[0].project.name}` : "No Client");
                      const postCount = clientPosts.length;
                      
                      const hasPosted = clientPosts.some(p => p.status === "POSTED");
                      const hasScheduled = clientPosts.some(p => p.status === "SCHEDULED");
                      const hasApproved = clientPosts.some(p => p.status === "APPROVED");
                      const hasCApproved = clientPosts.some(p => p.status === "C_APPROVED");
                      const hasReview = clientPosts.some(p => p.status === "SUBMITTED" || p.status === "RESUBMITTED" || p.status === "NEEDS_MINOR_CHANGE");

                      let badgeStyle = "bg-white dark:bg-slate-900 border-border hover:bg-muted";
                      let badgeTextStyle = "text-muted-foreground group-hover/badge:text-foreground";
                      let badgeCountStyle = "bg-muted text-muted-foreground";

                      if (hasPosted) {
                        badgeStyle = "bg-green-700 dark:bg-green-800 border-green-800 dark:border-green-900 text-white shadow-sm hover:bg-green-800 dark:hover:bg-green-700";
                        badgeTextStyle = "text-white font-semibold";
                        badgeCountStyle = "bg-green-800 dark:bg-green-900 text-white font-bold";
                      } else if (hasScheduled) {
                        badgeStyle = "bg-purple-100 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200 shadow-sm hover:bg-purple-200 dark:hover:bg-purple-900/80";
                        badgeTextStyle = "text-purple-900 dark:text-purple-200 font-semibold";
                        badgeCountStyle = "bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200 font-bold";
                      } else if (hasApproved) {
                        badgeStyle = "bg-blue-100 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 shadow-sm hover:bg-blue-200 dark:hover:bg-blue-900/80";
                        badgeTextStyle = "text-blue-900 dark:text-blue-200 font-semibold";
                        badgeCountStyle = "bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200 font-bold";
                      } else if (hasCApproved) {
                        badgeStyle = "bg-green-100 dark:bg-green-950/60 border-green-300 dark:border-green-800 text-green-900 dark:text-green-200 shadow-sm hover:bg-green-200 dark:hover:bg-green-900/80";
                        badgeTextStyle = "text-green-900 dark:text-green-200 font-semibold";
                        badgeCountStyle = "bg-green-200 dark:bg-green-900 text-green-900 dark:text-green-200 font-bold";
                      } else if (hasReview) {
                        badgeStyle = "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-200 shadow-sm hover:bg-yellow-200 dark:hover:bg-yellow-900/50";
                        badgeTextStyle = "text-yellow-900 dark:text-yellow-200 font-semibold";
                        badgeCountStyle = "bg-yellow-200 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-200 font-bold";
                      }

                      return (
                        <div
                          key={clientId}
                          className={`group/badge cursor-pointer rounded-md border transition-all duration-200 py-1 px-1.5 shadow-sm hover:shadow-md mx-1 ${badgeStyle}`}
                          onClick={() => {
                            setSelectedDay(day);
                            setSelectedClient({ id: clientId, company });
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs truncate ${badgeTextStyle}`}>
                              {company}
                            </span>
                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${badgeCountStyle}`}>
                              <span className="text-xs font-bold">
                                {postCount}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Dialog open={showAllClients} onOpenChange={(open) => {
          setShowAllClients(open);
          if (!open) {
            setSelectedDay(null);
            setAllClientsForDay({});
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden rounded-2xl bg-card border border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-foreground">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div>All Clients</div>
                    <div className="text-sm font-normal text-muted-foreground">
                      {selectedDay ? format(selectedDay, "EEEE, MMMM dd, yyyy") : ""}
                    </div>
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="mt-4 space-y-3 max-h-[calc(80vh-180px)] overflow-y-auto pr-2">
              {Object.entries(allClientsForDay).map(([clientId, clientPosts]) => {
                const client = clientPosts[0].project?.client;
                const company = client?.company || client?.email || (clientPosts[0].project?.name ? `Project: ${clientPosts[0].project.name}` : "No Client");
                const postCount = clientPosts.length;
                
                const getClientStatusSummary = () => {
                  if (postCount === 1) {
                    return `1 post • ${getStatusLabel(clientPosts[0].status)}`;
                  }
                  const counts: Record<string, number> = {};
                  clientPosts.forEach((p) => {
                    counts[p.status] = (counts[p.status] || 0) + 1;
                  });
                  const parts = Object.entries(counts).map(
                    ([st, cnt]) => `${cnt} ${getStatusLabel(st)}`
                  );
                  return `${postCount} posts (${parts.join(", ")})`;
                };

                // Content for the client header
                const ClientHeader = () => (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground group-hover:text-blue-600 transition-colors">
                        {company}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getClientStatusSummary()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-100 border border-blue-200">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-bold text-blue-700">{postCount}</span>
                      </div>
                      {postCount === 1 && (
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                      )}
                    </div>
                  </div>
                );

                if (postCount === 1) {
                  return (
                    <Link
                      href={`projects/posts/${clientPosts[0].id}`}
                      key={clientId}
                      className="block p-4 rounded-xl border border-border bg-gradient-to-br from-card to-muted/20 hover:shadow-lg transition-all duration-200 hover:border-blue-300 group cursor-pointer"
                      onClick={() => setShowAllClients(false)}
                    >
                      <ClientHeader />
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border">
                          <span className="text-sm">{typeIcons[clientPosts[0].type]}</span>
                          <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
                            {clientPosts[0].title || "Untitled Post"}
                          </span>
                        </div>
                        <Badge variant="outline" className={`${statusColors[clientPosts[0].status]} text-xs font-semibold px-2.5 py-0.5 rounded-md`}>
                          {getStatusLabel(clientPosts[0].status)}
                        </Badge>
                        {clientPosts[0].scheduledAt && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(clientPosts[0].scheduledAt), "HH:mm")}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                }

                // If multiple posts, show the header and a list of posts directly below
                return (
                  <div
                    key={clientId}
                    className="p-4 rounded-xl border border-border bg-gradient-to-br from-card to-muted/20 shadow-sm"
                  >
                    <ClientHeader />
                    
                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      {clientPosts.map((post) => (
                        <Link 
                          key={post.id}
                          href={`projects/posts/${post.id}`}
                          onClick={() => setShowAllClients(false)}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:border-blue-300 hover:shadow-md transition-all group"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="text-lg shrink-0">{typeIcons[post.type]}</span>
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground group-hover:text-blue-600 transition-colors truncate">
                                {post.title || "Untitled Post"}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className={`${statusColors[post.status]} text-xs font-semibold px-2 py-0.5 rounded-md`}>
                                  {getStatusLabel(post.status)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {post.scheduledAt ? format(new Date(post.scheduledAt), "HH:mm") : ""}
                                </span>
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 shrink-0 ml-2" />
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={selectedDay !== null && selectedClient !== null} onOpenChange={() => {
          setSelectedDay(null);
          setSelectedClient(null);
        }}>
          <DialogContent className="max-w-2xl rounded-2xl bg-card border border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-foreground">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div>{selectedClient?.company}</div>
                    <div className="text-sm font-normal text-muted-foreground">
                      {selectedDay ? format(selectedDay, "EEEE, MMMM dd, yyyy") : ""}
                    </div>
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue="posts" className="mt-4">
              <TabsList className="grid w-full grid-cols-2 bg-muted rounded-xl p-1">
                <TabsTrigger value="posts" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  Posts
                </TabsTrigger>
                <TabsTrigger value="summary" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  Summary
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="posts" className="mt-4">
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {getPostsForClientOnDay(selectedDay, selectedClient?.id || "").map((post) => (
                    <div 
                      key={post.id} 
                      className="p-4 rounded-xl border border-border bg-gradient-to-br from-card to-muted/20 hover:shadow-lg transition-all duration-200 hover:border-blue-300 group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{typeIcons[post.type]}</span>
                            <Link 
                              href={`projects/posts/${post.id}`} 
                              className="font-semibold text-foreground hover:text-blue-500 transition-colors group-hover:underline"
                            >
                              {post.title || "Untitled Post"}
                            </Link>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`${statusColors[post.status]} text-xs font-semibold px-3 py-1`}>
                              {getStatusLabel(post.status)}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {post.scheduledAt ? format(new Date(post.scheduledAt), "HH:mm") : "No time"}
                            </div>
                          </div>
                          
                          <p className="text-xs text-muted-foreground font-medium">
                            📱 {formatPlatforms(post.platforms)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {getPostsForClientOnDay(selectedDay, selectedClient?.id || "").length === 0 && (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <Calendar className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground font-medium">No posts found</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="summary" className="mt-4">
                <div className="p-8 text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl">
                    <span className="text-3xl font-bold text-white">
                      {getPostsForClientOnDay(selectedDay, selectedClient?.id || "").length}
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    Total Posts
                  </p>
                  <p className="text-sm text-muted-foreground">
                    for {selectedClient?.company} on this day
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Upcoming Posts Section */}
        <div className="rounded-2xl bg-card border border-border shadow-xl overflow-hidden">
          <div className="bg-muted/40 border-b border-border px-6 py-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Upcoming Posts
            </h3>
          </div>
          
          <div className="p-6">
            <div className="space-y-3">
              {filteredPosts
                .filter((post) => post.scheduledAt && new Date(post.scheduledAt) >= new Date())
                .slice(0, 8)
                .map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border bg-gradient-to-br from-card to-muted/20 hover:shadow-lg hover:border-blue-300 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-2xl">{typeIcons[post.type]}</div>
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`projects/posts/${post.id}`} 
                          className="font-semibold text-foreground hover:text-blue-500 transition-colors block truncate group-hover:underline"
                        >
                          {post.title || "Untitled Post"}
                        </Link>
                        <p className="text-sm text-muted-foreground truncate">
                          {post.project?.client?.company || "No Company"} • {formatPlatforms(post.platforms)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">
                          {post.scheduledAt ? format(new Date(post.scheduledAt), "MMM dd") : "No Date"}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3" />
                          {post.scheduledAt ? format(new Date(post.scheduledAt), "HH:mm") : "No Time"}
                        </p>
                      </div>
                      <Badge className={`${statusColors[post.status]} font-medium px-3 py-1`}>
                        {post.status.charAt(0) + post.status.slice(1).toLowerCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              {filteredPosts.filter((post) => post.scheduledAt && new Date(post.scheduledAt) >= new Date())
                .length === 0 && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No upcoming posts scheduled</p>
                  <p className="text-sm text-muted-foreground/85 mt-2">Schedule your first post to see it here</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Calendar Event</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Event Name</Label>
                <Input id="name" value={newEvent.name} onChange={(e) => setNewEvent({...newEvent, name: e.target.value})} placeholder="e.g. Summer Collection Shoot" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={newEvent.location} onChange={(e) => setNewEvent({...newEvent, location: e.target.value})} placeholder="e.g. Central Park" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="time">Time</Label>
                  <Input id="time" type="time" value={newEvent.time} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setIsAddEventOpen(false)}>Cancel</Button>
              <Button onClick={handleAddEvent} className="bg-teal-600 hover:bg-teal-700 text-white">Save Event</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Shoot Event Dialog */}
        <Dialog open={isEditEventOpen} onOpenChange={setIsEditEventOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Shoot Event</DialogTitle>
            </DialogHeader>
            {editingEvent && (
              <>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Event Name</Label>
                    <Input id="edit-name" value={editingEvent.name} onChange={(e) => setEditingEvent({...editingEvent, name: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-location">Location</Label>
                    <Input id="edit-location" value={editingEvent.location} onChange={(e) => setEditingEvent({...editingEvent, location: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-date">Date</Label>
                      <Input id="edit-date" type="date" value={editingEvent.date} onChange={(e) => setEditingEvent({...editingEvent, date: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-time">Time</Label>
                      <Input id="edit-time" type="time" value={editingEvent.time} onChange={(e) => setEditingEvent({...editingEvent, time: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-between mt-4">
                  <Button variant="destructive" onClick={handleDeleteEvent}>Delete</Button>
                  <div className="flex gap-2">
                    <Button 
                      variant={editingEvent.completed ? "outline" : "default"} 
                      className={!editingEvent.completed ? "bg-slate-600 hover:bg-slate-700 text-white" : "border-slate-600 text-slate-600 hover:bg-slate-50"}
                      onClick={handleToggleCompleteEvent}
                    >
                      {editingEvent.completed ? "Mark Incomplete" : "Mark Complete"}
                    </Button>
                    <Button onClick={handleUpdateEvent} className="bg-teal-600 hover:bg-teal-700 text-white">Save</Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}