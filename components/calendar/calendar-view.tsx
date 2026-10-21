"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  CalendarPlus,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileEdit,
  MessageSquareWarning,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { statusLabel, statusStyle, typeIcon, typeLabel } from "@/lib/post-status";
import { getMediaUrl } from "@/lib/utils";
import { useCan } from "@/hooks/use-can";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Re-exported for callers that imported it from here before it moved. */
export { statusLabel as getStatusLabel } from "@/lib/post-status";

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

interface Asset {
  id: string;
  url: string;
  type?: string | null;
  filename?: string;
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
  assets?: Asset[];
  assetCount?: number;
}

interface ShootEvent {
  id: string;
  name: string;
  location: string;
  date: string;
  time: string;
  completed?: boolean;
}

type ViewMode = "month" | "week" | "list";
type DateMode = "posting" | "design" | "shoot";

/**
 * "In review" covers three raw statuses, and "Drafts & changes" two. Expanding them
 * here keeps the summary cards and the status dropdown driving one piece of state.
 */
const STATUS_GROUPS: Record<string, string[]> = {
  review: ["SUBMITTED", "RESUBMITTED", "NEEDS_MINOR_CHANGE"],
  production: ["DRAFT", "REJECTED"],
};

const PLATFORM_STYLE: Record<string, string> = {
  INSTAGRAM: "bg-pink-100 text-pink-900 border-pink-200 dark:bg-pink-950 dark:text-pink-200 dark:border-pink-900",
  FACEBOOK: "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900",
  TWITTER: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-900",
  LINKEDIN: "bg-indigo-100 text-indigo-900 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-900",
  THREADS: "bg-zinc-100 text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800",
  YOUTUBE: "bg-red-100 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900",
  IGTV: "bg-purple-100 text-purple-900 border-purple-200 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-900",
  GMB: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900",
  PINTEREST: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900",
};

const platformLabel = (p: string) => p.charAt(0) + p.slice(1).toLowerCase();

/**
 * ShootEvent.time is a free-text column and the table holds both "06:30 AM" and
 * "17:30". <input type="time"> only accepts 24-hour HH:mm, so a 12-hour value
 * rendered as an empty field — and saving the form then wrote that blank back,
 * silently losing the time. Everything goes through here on the way in.
 */
function toTimeInput(time?: string | null): string {
  if (!time) return "";
  const t = time.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!m) return "";
  let hours = parseInt(m[1], 10);
  const minutes = m[2];
  const meridiem = m[3]?.toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  if (hours > 23 || parseInt(minutes, 10) > 59) return "";
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

/** Shoot times read the same as post times on the calendar: 24-hour, or a dash. */
const displayTime = (time?: string | null) => toTimeInput(time) || "--:--";

const clientLabel = (post: Post) =>
  post.project?.client?.company ||
  post.project?.client?.name ||
  post.project?.name ||
  "No client";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i;

/**
 * A 32px preview. Deliberately a plain <img> rather than MediaRenderer, which also
 * handles video playback and Drive embeds — none of which a thumbnail needs — and
 * rather than next/image, which is a no-op here because images.unoptimized is set.
 */
function Thumb({ post, className = "h-9 w-9" }: { post: Post; className?: string }) {
  const asset = post.assets?.[0];
  const isImage = !!asset && (asset.type?.startsWith("image") || IMAGE_EXT.test(asset.url));
  const Icon = typeIcon(post.type);

  if (asset && isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={getMediaUrl(asset.url)}
        alt=""
        loading="lazy"
        className={`${className} shrink-0 rounded-md border border-border/60 bg-muted object-cover`}
      />
    );
  }
  return (
    <span
      className={`${className} grid shrink-0 place-items-center rounded-md border border-border/60 bg-muted`}
      title={typeLabel(post.type)}
    >
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
    </span>
  );
}

function PlatformBadges({ platforms }: { platforms?: Post["platforms"] }) {
  if (!platforms?.length) return null;
  return (
    <>
      {platforms.map((p) => (
        <span
          key={p.id}
          className={`inline-flex items-center rounded border px-1.5 py-px text-[10px] font-medium ${
            PLATFORM_STYLE[p.platform] ?? "bg-muted text-muted-foreground border-border"
          }`}
        >
          {platformLabel(p.platform)}
        </span>
      ))}
    </>
  );
}

export function CalendarView({ posts = [], projects = [], currentUser }: { posts: Post[]; projects: Project[]; currentUser: User }) {
  const { can, ready } = useCan();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");

  const [dayDetail, setDayDetail] = useState<Date | null>(null);

  const [shootEvents, setShootEvents] = useState<ShootEvent[]>([]);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: "", location: "", date: "", time: "10:00" });
  const [editingEvent, setEditingEvent] = useState<ShootEvent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ShootEvent | null>(null);

  // Determine if user can see Posting Date based on the server-provided flag
  const canSeePosting = currentUser.showPostingCalendar ?? true;
  const [dateMode, setDateMode] = useState<DateMode>(canSeePosting ? "posting" : "design");

  useEffect(() => {
    const fetchShootEvents = async () => {
      try {
        const res = await fetch("/api/shoot-events");
        if (res.ok) setShootEvents(await res.json());
      } catch (e) {
        console.error(e);
      }
    };
    fetchShootEvents();
  }, []);

  const editShoot = (shoot: ShootEvent) => {
    setEditingEvent({ ...shoot, time: toTimeInput(shoot.time) });
    setIsEditEventOpen(true);
  };

  const openAddEvent = (day: Date) => {
    setNewEvent({ name: "", location: "", date: format(day, "yyyy-MM-dd"), time: "10:00" });
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
        setShootEvents((prev) => [...prev, created]);
        setNewEvent({ name: "", location: "", date: "", time: "10:00" });
        setIsAddEventOpen(false);
        toast.success("Event created successfully");
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
    if (!editingEvent?.name || !editingEvent?.date) return;
    try {
      const res = await fetch(`/api/shoot-events/${editingEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingEvent),
      });
      if (res.ok) {
        const updated = await res.json();
        setShootEvents(shootEvents.map((e) => (e.id === updated.id ? updated : e)));
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
  };

  const handleDeleteEvent = async (event: ShootEvent) => {
    try {
      const res = await fetch(`/api/shoot-events/${event.id}`, { method: "DELETE" });
      if (res.ok) {
        setShootEvents((prev) => prev.filter((e) => e.id !== event.id));
        setConfirmDelete(null);
        setIsEditEventOpen(false);
        setEditingEvent(null);
        toast.success(`Deleted "${event.name}"`);
      } else {
        toast.error("Failed to delete event");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error deleting event");
    }
  };

  const handleToggleCompleteEvent = async () => {
    if (!editingEvent) return;
    const updatedEvent = { ...editingEvent, completed: !editingEvent.completed };
    try {
      const res = await fetch(`/api/shoot-events/${editingEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedEvent),
      });
      if (res.ok) {
        const updated = await res.json();
        setShootEvents(shootEvents.map((e) => (e.id === updated.id ? updated : e)));
        setIsEditEventOpen(false);
        setEditingEvent(null);
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not update the event");
    }
  };

  /** The date a post sits on depends on which calendar is being read. */
  const dateOf = (post: Post) =>
    dateMode === "posting" ? post.scheduledAt : post.designDueDate || post.scheduledAt;

  /** Everything except the status filter — the summary cards need these counts intact. */
  const scopedPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((post) => {
      if (selectedProject !== "all" && post.projectId !== selectedProject) return false;
      if (selectedPlatform !== "all" && !post.platforms?.some((p) => p.platform === selectedPlatform)) return false;
      if (q) {
        const haystack = `${post.title} ${clientLabel(post)} ${post.project?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [posts, selectedProject, selectedPlatform, search]);

  const filteredPosts = useMemo(
    () =>
      scopedPosts.filter(
        (post) =>
          selectedStatus === "all" ||
          (STATUS_GROUPS[selectedStatus] ?? [selectedStatus]).includes(post.status)
      ),
    [scopedPosts, selectedStatus]
  );

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const visibleDays = useMemo(() => {
    if (view === "week") {
      return eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) });
    }
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentDate]);

  const postsByDate = useMemo(() => {
    const grouped: Record<string, Post[]> = {};
    filteredPosts.forEach((post) => {
      const d = dateOf(post);
      if (!d) return;
      const key = format(new Date(d), "yyyy-MM-dd");
      (grouped[key] ||= []).push(post);
    });
    Object.values(grouped).forEach((list) =>
      list.sort((a, b) => (dateOf(a) ?? "").localeCompare(dateOf(b) ?? ""))
    );
    return grouped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPosts, dateMode]);

  const shootsByDate = useMemo(() => {
    const grouped: Record<string, ShootEvent[]> = {};
    shootEvents.forEach((event) => {
      if (event.date) (grouped[event.date] ||= []).push(event);
    });
    return grouped;
  }, [shootEvents]);

  /** Counts for the summary cards, over whatever period the current view shows. */
  const summary = useMemo(() => {
    const inView = scopedPosts.filter((post) => {
      const d = dateOf(post);
      if (!d) return false;
      const date = new Date(d);
      return view === "week"
        ? date >= startOfWeek(currentDate) && date <= endOfWeek(currentDate)
        : isSameMonth(date, currentDate);
    });
    const countOf = (statuses: string[]) => inView.filter((p) => statuses.includes(p.status)).length;
    return {
      total: inView.length,
      scheduled: countOf(["SCHEDULED"]),
      review: countOf(STATUS_GROUPS.review),
      published: countOf(["POSTED"]),
      production: countOf(STATUS_GROUPS.production),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedPosts, currentDate, dateMode, view]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return filteredPosts
      .filter((post) => post.scheduledAt && new Date(post.scheduledAt) >= now)
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  }, [filteredPosts]);

  const navigate = (direction: -1 | 1) => {
    setCurrentDate((prev) =>
      view === "week"
        ? direction === -1
          ? subWeeks(prev, 1)
          : addWeeks(prev, 1)
        : direction === -1
          ? subMonths(prev, 1)
          : addMonths(prev, 1)
    );
  };

  const periodLabel =
    view === "week"
      ? `${format(startOfWeek(currentDate), "MMM d")} – ${format(endOfWeek(currentDate), "MMM d, yyyy")}`
      : format(currentDate, "MMMM yyyy");

  const platformsInUse = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.platforms?.forEach((pl) => set.add(pl.platform)));
    return [...set].sort();
  }, [posts]);

  const hasFilters =
    search.trim() !== "" || selectedProject !== "all" || selectedStatus !== "all" || selectedPlatform !== "all";

  const clearFilters = () => {
    setSearch("");
    setSelectedProject("all");
    setSelectedStatus("all");
    setSelectedPlatform("all");
  };

  const summaryCards = [
    { key: "SCHEDULED", label: "Scheduled", hint: "ready to publish", value: summary.scheduled, Icon: Clock, tone: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
    { key: "review", label: "Awaiting approval", hint: "needs review", value: summary.review, Icon: MessageSquareWarning, tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
    { key: "POSTED", label: "Published", hint: "live posts", value: summary.published, Icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
    { key: "production", label: "Drafts & changes", hint: "in production", value: summary.production, Icon: FileEdit, tone: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  ];

  const leadingBlanks = view === "month" ? monthStart.getDay() : 0;
  const trailingBlanks =
    view === "month" ? (7 - ((leadingBlanks + visibleDays.length) % 7)) % 7 : 0;

  const dayDetailPosts = dayDetail ? postsByDate[format(dayDetail, "yyyy-MM-dd")] ?? [] : [];
  const dayDetailShoots = dayDetail ? shootsByDate[format(dayDetail, "yyyy-MM-dd")] ?? [] : [];

  const listDays = visibleDays.filter(
    (day) =>
      (postsByDate[format(day, "yyyy-MM-dd")]?.length ?? 0) > 0 ||
      (shootsByDate[format(day, "yyyy-MM-dd")]?.length ?? 0) > 0
  );

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Content Calendar</h1>
            <Badge variant="secondary" className="rounded-full tabular-nums">
              {summary.total} {summary.total === 1 ? "post" : "posts"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule, manage, and monitor social media publishing across all client campaigns.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => openAddEvent(new Date())} className="gap-2">
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Add shoot event
          </Button>
          {ready && can("posts", "create") && (
            <Button size="sm" asChild className="gap-2">
              <Link href="/dashboard/projects/posts/new">
                <Plus className="h-4 w-4" aria-hidden />
                Create post
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards — each one filters the calendar to what it counts. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ key, label, hint, value, Icon, tone }) => {
          const active = selectedStatus === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedStatus(active ? "all" : key)}
              aria-pressed={active}
              className={`rounded-xl border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">{label}</span>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tone}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-foreground">{value}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} aria-label={view === "week" ? "Previous week" : "Previous month"}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)} aria-label={view === "week" ? "Next week" : "Next month"}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <h2 className="ml-1 text-base font-semibold text-foreground">{periodLabel}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="month" className="h-6 px-3 text-xs">Month</TabsTrigger>
                <TabsTrigger value="week" className="h-6 px-3 text-xs">Week</TabsTrigger>
                <TabsTrigger value="list" className="h-6 px-3 text-xs">List</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={dateMode} onValueChange={(v) => setDateMode(v as DateMode)}>
              <TabsList className="h-8">
                {canSeePosting && (
                  <TabsTrigger value="posting" className="h-6 px-3 text-xs">Posting date</TabsTrigger>
                )}
                <TabsTrigger value="design" className="h-6 px-3 text-xs">Design due</TabsTrigger>
                <TabsTrigger value="shoot" className="h-6 px-3 text-xs">Shoots</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Label htmlFor="calendar-search" className="sr-only">
              Search posts and clients
            </Label>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="calendar-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts, clients..."
              className="h-9 pl-8"
            />
          </div>

          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="h-9 w-full sm:w-[210px]" aria-label="Filter by project or client">
              <SelectValue placeholder="All projects & clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects &amp; clients</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.client?.company ? `${project.client.company} — ` : ""}
                  {project.name || "Unnamed project"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-9 w-full sm:w-[170px]" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="POSTED">Published</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="C_APPROVED">Client approved</SelectItem>
              <SelectItem value="APPROVED">Internally approved</SelectItem>
              <SelectItem value="review">In review</SelectItem>
              <SelectItem value="REJECTED">Changes requested</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="h-9 w-full sm:w-[160px]" aria-label="Filter by platform">
              <SelectValue placeholder="All platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {platformsInUse.map((p) => (
                <SelectItem key={p} value={p}>
                  {platformLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Calendar + upcoming rail */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 rounded-xl border border-border bg-card">
          {view === "list" ? (
            <div className="divide-y divide-border">
              {listDays.length === 0 ? (
                <EmptyCalendar hasFilters={hasFilters} onClear={clearFilters} />
              ) : (
                listDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  return (
                    <div key={key} className="p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          {format(day, "EEEE, d MMMM")}
                        </h3>
                        {isSameDay(day, new Date()) && (
                          <Badge variant="secondary" className="rounded-full text-[10px]">Today</Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        {(shootsByDate[key] ?? []).map((shoot) => (
                          <ShootEntry key={shoot.id} shoot={shoot} onEdit={editShoot} />
                        ))}
                        {(dateMode === "shoot" ? [] : postsByDate[key] ?? []).map((post) => (
                          <PostRow key={post.id} post={post} dateOf={dateOf} />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-7 border-b border-border bg-muted/40">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div
                      key={d}
                      className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
                  {Array.from({ length: leadingBlanks }).map((_, i) => (
                    <div key={`lead-${i}`} className="h-[150px] border-b border-r border-border bg-muted/10" />
                  ))}
                  {visibleDays.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    return (
                      <DayCell
                        key={key}
                        day={day}
                        height={view === "week" ? "h-[420px]" : "h-[150px]"}
                        limit={view === "week" ? 8 : 3}
                        posts={dateMode === "shoot" ? [] : postsByDate[key] ?? []}
                        shoots={shootsByDate[key] ?? []}
                        dateOf={dateOf}
                        onAddEvent={openAddEvent}
                        onEditShoot={editShoot}
                        onOverflow={setDayDetail}
                      />
                    );
                  })}
                  {Array.from({ length: trailingBlanks }).map((_, i) => (
                    <div key={`trail-${i}`} className="h-[150px] border-b border-r border-border bg-muted/10" />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upcoming posts */}
        <aside className="min-w-0 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
              Upcoming posts
            </h2>
            <Badge variant="secondary" className="rounded-full tabular-nums">
              {upcoming.length}
            </Badge>
          </div>
          <div className="max-h-[640px] space-y-2 overflow-y-auto p-3">
            {upcoming.length === 0 ? (
              <div className="px-2 py-10 text-center">
                <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground" aria-hidden />
                </span>
                <p className="text-sm font-medium text-foreground">Nothing scheduled yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hasFilters
                    ? "No upcoming post matches the current filters."
                    : "Give a post a posting date and it will appear here."}
                </p>
              </div>
            ) : (
              upcoming.map((post) => (
                <Link
                  key={post.id}
                  href={`/dashboard/projects/posts/${post.id}`}
                  className="flex gap-3 rounded-lg border border-border bg-card p-2.5 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Thumb post={post} className="h-11 w-11" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {post.title || "Untitled post"}
                      </p>
                      <span className="shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                        {post.scheduledAt && (
                          <>
                            <span className="block font-medium text-foreground">
                              {format(new Date(post.scheduledAt), "MMM d")}
                            </span>
                            {format(new Date(post.scheduledAt), "HH:mm")}
                          </>
                        )}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{clientLabel(post)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <PlatformBadges platforms={post.platforms} />
                      <Badge
                        variant="outline"
                        className={`${statusStyle(post.status).badge} rounded px-1.5 py-px text-[10px] font-medium`}
                      >
                        {statusLabel(post.status)}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Everything on one day */}
      <Dialog open={dayDetail !== null} onOpenChange={(open) => !open && setDayDetail(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Calendar className="h-4 w-4" aria-hidden />
              </span>
              <span>
                <span className="block text-base font-semibold">
                  {dayDetail ? format(dayDetail, "EEEE, d MMMM yyyy") : ""}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {dayDetailPosts.length} {dayDetailPosts.length === 1 ? "post" : "posts"}
                  {dayDetailShoots.length > 0 && ` · ${dayDetailShoots.length} shoot`}
                </span>
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(80vh-9rem)] space-y-2 overflow-y-auto pr-1">
            {dayDetailShoots.map((shoot) => (
              <ShootEntry key={shoot.id} shoot={shoot} onEdit={editShoot} />
            ))}
            {dayDetailPosts.map((post) => (
              <PostRow key={post.id} post={post} dateOf={dateOf} onNavigate={() => setDayDetail(null)} />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add shoot event */}
      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add shoot event</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="event-name">Event name</Label>
              <Input id="event-name" value={newEvent.name} onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })} placeholder="e.g. Summer collection shoot" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-location">Location</Label>
              <Input id="event-location" value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} placeholder="e.g. Central Park" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="event-date">Date</Label>
                <Input id="event-date" type="date" value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-time">Time</Label>
                <Input id="event-time" type="time" value={newEvent.time} onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAddEventOpen(false)}>Cancel</Button>
            <Button onClick={handleAddEvent}>Save event</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit shoot event */}
      <Dialog open={isEditEventOpen} onOpenChange={setIsEditEventOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit shoot event</DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Event name</Label>
                  <Input id="edit-name" value={editingEvent.name} onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-location">Location</Label>
                  <Input id="edit-location" value={editingEvent.location} onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-date">Date</Label>
                    <Input id="edit-date" type="date" value={editingEvent.date} onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-time">Time</Label>
                    <Input id="edit-time" type="time" value={editingEvent.time} onChange={(e) => setEditingEvent({ ...editingEvent, time: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Button variant="destructive" onClick={() => setConfirmDelete(editingEvent)}>
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleToggleCompleteEvent}>
                    {editingEvent.completed ? "Mark incomplete" : "Mark complete"}
                  </Button>
                  <Button onClick={handleUpdateEvent}>Save</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => (confirmDelete ? handleDeleteEvent(confirmDelete) : Promise.resolve())}
        itemName={confirmDelete?.name ?? ""}
        entityType="shoot event"
      />
    </div>
  );
}

/**
 * One calendar entry for a post. Module scope on purpose: defined inside CalendarView
 * it would be a fresh component type on every render, remounting every day cell.
 */
function PostEntry({ post, date }: { post: Post; date?: string | null }) {
  const style = statusStyle(post.status);
  return (
    <Link
      href={`/dashboard/projects/posts/${post.id}`}
      title={`${post.title || "Untitled post"} — ${statusLabel(post.status)}`}
      className="group/entry flex items-center gap-2 rounded-md border border-border/70 bg-card px-1.5 py-1 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Thumb post={post} className="h-7 w-7" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium leading-tight text-foreground">
          {post.title || "Untitled post"}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.rail}`} aria-hidden />
          <span className="tabular-nums">{date ? format(new Date(date), "HH:mm") : "--:--"}</span>
          <span className="sr-only">{statusLabel(post.status)}</span>
        </span>
      </span>
      {(post.assetCount ?? 0) > 1 && (
        <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-medium tabular-nums text-muted-foreground">
          {post.assetCount}
        </span>
      )}
    </Link>
  );
}

function ShootEntry({ shoot, onEdit }: { shoot: ShootEvent; onEdit: (shoot: ShootEvent) => void }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(shoot)}
      title={shoot.location ? `${shoot.name} — ${shoot.location}` : shoot.name}
      className="flex w-full items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-1.5 py-1 text-left transition-colors hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-teal-900 dark:bg-teal-950/50 dark:hover:bg-teal-950"
    >
      <Camera className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-300" aria-hidden />
      <span
        className={`min-w-0 flex-1 truncate text-[11px] font-medium text-teal-900 dark:text-teal-100 ${
          shoot.completed ? "line-through opacity-70" : ""
        }`}
      >
        {shoot.name}
      </span>
      <span className="shrink-0 text-[10px] tabular-nums text-teal-700 dark:text-teal-300">
        {displayTime(shoot.time)}
      </span>
    </button>
  );
}

/** A single day cell, shared by the month and week grids. */
function DayCell({
  day,
  height,
  limit,
  posts,
  shoots,
  dateOf,
  onAddEvent,
  onEditShoot,
  onOverflow,
}: {
  day: Date;
  height: string;
  limit: number;
  posts: Post[];
  shoots: ShootEvent[];
  dateOf: (post: Post) => string | null | undefined;
  onAddEvent: (day: Date) => void;
  onEditShoot: (shoot: ShootEvent) => void;
  onOverflow: (day: Date) => void;
}) {
  const isToday = isSameDay(day, new Date());
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

  const entries = [
    ...shoots.map((s) => ({ kind: "shoot" as const, key: `s-${s.id}`, shoot: s })),
    ...posts.map((p) => ({ kind: "post" as const, key: `p-${p.id}`, post: p })),
  ];
  const shown = entries.slice(0, limit);
  const overflow = entries.length - shown.length;

  return (
    <div
      className={`${height} group/day flex flex-col gap-1 border-b border-r border-border p-1.5 ${
        isWeekend ? "bg-muted/20" : "bg-card"
      } ${isToday ? "bg-accent/40 ring-1 ring-inset ring-primary" : ""}`}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-0.5">
          <span
            className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-semibold tabular-nums ${
              isToday ? "bg-primary text-primary-foreground" : "text-foreground"
            }`}
          >
            {format(day, "d")}
          </span>
          <button
            type="button"
            onClick={() => onAddEvent(day)}
            aria-label={`Add a shoot event on ${format(day, "EEEE d MMMM yyyy")}`}
            className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/day:opacity-100"
          >
            <Plus className="h-3 w-3" aria-hidden />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {shoots.length > 0 && (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-teal-100 px-1 text-[10px] font-semibold tabular-nums text-teal-800 dark:bg-teal-950 dark:text-teal-300"
              title={`${shoots.length} shoot event${shoots.length === 1 ? "" : "s"}`}
            >
              <Camera className="h-2.5 w-2.5" aria-hidden />
              {shoots.length}
            </span>
          )}
          {posts.length > 0 && (
            <span className="rounded bg-muted px-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {posts.length}
            </span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {shown.map((entry) =>
          entry.kind === "shoot" ? (
            <ShootEntry key={entry.key} shoot={entry.shoot} onEdit={onEditShoot} />
          ) : (
            <PostEntry key={entry.key} post={entry.post} date={dateOf(entry.post)} />
          )
        )}
        {overflow > 0 && (
          <button
            type="button"
            onClick={() => onOverflow(day)}
            className="rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            +{overflow} more
          </button>
        )}
        {/*
          The leftover space in the cell creates an event on that date. It is a real
          button rather than an onClick on the cell <div>, so it is reachable by
          keyboard and cannot swallow a click meant for an entry above it.
        */}
        <button
          type="button"
          onClick={() => onAddEvent(day)}
          tabIndex={-1}
          aria-hidden
          className="min-h-[18px] flex-1 rounded text-left text-[11px] text-transparent transition-colors hover:bg-muted/60 hover:text-muted-foreground"
        >
          + Add event
        </button>
      </div>
    </div>
  );
}

/** A full-width post row, used by the list view and the day dialog. */
function PostRow({
  post,
  dateOf,
  onNavigate,
}: {
  post: Post;
  dateOf: (post: Post) => string | null | undefined;
  onNavigate?: () => void;
}) {
  const d = dateOf(post);
  return (
    <Link
      href={`/dashboard/projects/posts/${post.id}`}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Thumb post={post} className="h-11 w-11" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{post.title || "Untitled post"}</p>
        <p className="truncate text-xs text-muted-foreground">{clientLabel(post)}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <PlatformBadges platforms={post.platforms} />
          <Badge
            variant="outline"
            className={`${statusStyle(post.status).badge} rounded px-1.5 py-px text-[10px] font-medium`}
          >
            {statusLabel(post.status)}
          </Badge>
        </div>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {d ? format(new Date(d), "HH:mm") : "--:--"}
      </span>
    </Link>
  );
}

function EmptyCalendar({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="px-6 py-16 text-center">
      <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-muted">
        <Calendar className="h-6 w-6 text-muted-foreground" aria-hidden />
      </span>
      <h3 className="text-base font-semibold text-foreground">
        {hasFilters ? "No posts match these filters" : "Nothing planned for this period"}
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {hasFilters
          ? "Try a different status, platform or search term."
          : "Create a post and give it a posting date to see it on the calendar."}
      </p>
      {hasFilters ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
          Clear filters
        </Button>
      ) : (
        <Button size="sm" asChild className="mt-4">
          <Link href="/dashboard/projects/posts/new">Create a post</Link>
        </Button>
      )}
    </div>
  );
}
