import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, type Paginated } from "@/lib/api";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { humanizeEnum } from "@/types/campaign";
import type { Client } from "@/types/client";
import { POST_STATUSES, type Post, type PostStatus } from "@/types/post";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import PostDetailSheet from "./components/PostDetailSheet";
import { CALENDAR_LEGEND, STATUS_CHIP } from "./content-styles";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** A month view never holds more than a few dozen posts; one page covers it. */
const CALENDAR_LIMIT = 200;

export default function ContentCalendar() {
  const { user: actor } = useAuth();
  const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";
  const canEdit = isSuperAdmin || can(actor, "posts:update");
  const canPublish = isSuperAdmin || can(actor, "posts:publish");

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [posts, setPosts] = useState<Post[]>([]);
  const [backlog, setBacklog] = useState<Post[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("ALL");
  const [status, setStatus] = useState<PostStatus | "ALL">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);

  // The grid shows whole weeks, so the fetch must cover the spill-over days too.
  const gridStart = useMemo(
    () => startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    [month]
  );
  const gridEnd = useMemo(
    () => endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    [month]
  );
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    const shared = new URLSearchParams({ limit: String(CALENDAR_LIMIT) });
    if (clientId !== "ALL") shared.set("clientId", clientId);
    if (status !== "ALL") shared.set("status", status);

    const scheduled = new URLSearchParams(shared);
    scheduled.set("scheduledFrom", format(gridStart, "yyyy-MM-dd"));
    scheduled.set("scheduledTo", format(gridEnd, "yyyy-MM-dd"));

    const unscheduled = new URLSearchParams(shared);
    unscheduled.set("unscheduled", "true");

    try {
      const [inRange, withoutDate] = await Promise.all([
        api.get<Paginated<Post>>(`/posts?${scheduled}`),
        api.get<Paginated<Post>>(`/posts?${unscheduled}`),
      ]);
      setPosts(inRange.data);
      setBacklog(withoutDate.data);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to load calendar."
      );
    } finally {
      setIsLoading(false);
    }
  }, [gridStart, gridEnd, clientId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api.list<Client>("/clients").then(setClients).catch(() => undefined);
  }, []);

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      if (!post.scheduledDate) continue;
      const key = format(new Date(post.scheduledDate), "yyyy-MM-dd");
      const bucket = map.get(key);
      if (bucket) bucket.push(post);
      else map.set(key, [post]);
    }
    return map;
  }, [posts]);

  const reschedule = async (postId: string, day: Date) => {
    const post =
      posts.find((p) => p.id === postId) ?? backlog.find((p) => p.id === postId);
    if (!post) return;

    // Keep the time of day the content was planned for; only the date moves.
    const next = new Date(day);
    if (post.scheduledDate) {
      const previous = new Date(post.scheduledDate);
      next.setHours(
        previous.getHours(),
        previous.getMinutes(),
        previous.getSeconds(),
        0
      );
    } else {
      next.setHours(9, 0, 0, 0);
    }

    try {
      await api.patch(`/posts/${postId}`, {
        scheduledDate: next.toISOString(),
      });
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not reschedule that content."
      );
    }
  };

  const chip = (post: Post, draggable: boolean) => {
    const style = STATUS_CHIP[post.status];
    return (
      <button
        key={post.id}
        type="button"
        draggable={draggable}
        onDragStart={(event) => {
          setDraggedId(post.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", post.id);
        }}
        onDragEnd={() => {
          setDraggedId(null);
          setDropDay(null);
        }}
        onClick={() => setSelectedId(post.id)}
        title={`${post.title} — ${humanizeEnum(post.status)}`}
        className={cn(
          "w-full text-left px-1.5 py-1 rounded border bg-card hover:bg-muted/60 transition-colors flex items-center gap-1.5 min-w-0",
          style.chip,
          draggable && "cursor-grab active:cursor-grabbing",
          draggedId === post.id && "opacity-40"
        )}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
        <span className="text-[10px] text-foreground/90 truncate">
          {post.title}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Calendar"
        description="What goes out when, across every client. Drag a card to move its date."
        breadcrumbs={[{ label: "Content", href: "/content" }, { label: "Calendar" }]}
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0"
              aria-label="Previous month"
              onClick={() => setMonth(addMonths(month, -1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => setMonth(startOfMonth(new Date()))}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0"
              aria-label="Next month"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground min-w-[9rem]">
          {format(month, "MMMM yyyy")}
        </span>

        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="w-48 h-9 text-xs bg-background">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">
              All Clients
            </SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id} className="text-xs">
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(value) => setStatus(value as PostStatus | "ALL")}
        >
          <SelectTrigger className="w-40 h-9 text-xs bg-background">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">
              All Statuses
            </SelectItem>
            {POST_STATUSES.map((option) => (
              <SelectItem key={option} value={option} className="text-xs">
                {humanizeEnum(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2.5 ms-auto flex-wrap">
          {CALENDAR_LEGEND.map((option) => (
            <span
              key={option}
              className="flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  STATUS_CHIP[option].dot
                )}
              />
              {humanizeEnum(option)}
            </span>
          ))}
        </div>
      </div>

      <Card className="p-0 overflow-hidden border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center"
            >
              {weekday}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, index) => (
              <div
                key={index}
                className="min-h-[104px] border-b border-e border-border/60 p-2"
              >
                <Skeleton className="h-3 w-5 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayPosts = postsByDay.get(key) ?? [];
              const outside = !isSameMonth(day, month);

              return (
                <div
                  key={key}
                  onDragOver={(event) => {
                    if (!draggedId || !canEdit) return;
                    event.preventDefault();
                    setDropDay(key);
                  }}
                  onDragLeave={() =>
                    setDropDay((current) => (current === key ? null : current))
                  }
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!draggedId || !canEdit) return;
                    const id = draggedId;
                    setDraggedId(null);
                    setDropDay(null);
                    void reschedule(id, day);
                  }}
                  className={cn(
                    "min-h-[104px] border-b border-e border-border/60 p-1.5 space-y-1 transition-colors",
                    outside && "bg-muted/20",
                    dropDay === key && "bg-primary/5 ring-1 ring-inset ring-primary/30"
                  )}
                >
                  <div className="flex items-center justify-between px-0.5">
                    <span
                      className={cn(
                        "text-[11px] font-mono",
                        outside
                          ? "text-muted-foreground/50"
                          : "text-muted-foreground",
                        isToday(day) &&
                          "bg-primary text-primary-foreground rounded px-1 font-semibold"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayPosts.length > 2 && (
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {dayPosts.length}
                      </span>
                    )}
                  </div>
                  {dayPosts.map((post) => chip(post, canEdit))}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Unscheduled
          </h3>
          <span className="text-[11px] font-mono text-muted-foreground px-1.5 rounded bg-muted border border-border/60">
            {backlog.length}
          </span>
        </div>
        {backlog.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Everything has a date. New ideas land here until you place them on
            the calendar.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2.5">
              {canEdit
                ? "Drag any of these onto a day to schedule it."
                : "Content waiting for a date."}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
              {backlog.map((post) => chip(post, canEdit))}
            </div>
          </>
        )}
      </Card>

      {!isLoading && posts.length === 0 && backlog.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-10">
          <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
            <CalendarDays className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Nothing planned for {format(month, "MMMM")}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Content you create gets a place here once it has a scheduled date.
          </p>
        </div>
      )}

      <PostDetailSheet
        postId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onChanged={load}
        canEdit={canEdit}
        canPublish={canPublish}
      />
    </div>
  );
}
