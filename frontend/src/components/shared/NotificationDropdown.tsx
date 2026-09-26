import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationPage } from "@/types/notification";
import { formatDistanceToNowStrict } from "date-fns";
import { Bell, CheckCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const POLL_INTERVAL_MS = 60_000;
const PAGE_SIZE = 10;

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const page = await api.get<NotificationPage>(
        `/notifications?limit=${PAGE_SIZE}`
      );
      setNotifications(page.data);
      setUnreadCount(page.meta.unread);
    } catch {
      // A failed poll is not worth interrupting the user over; the next one retries.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const markAllAsRead = async () => {
    const now = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) => ({ ...item, readAt: item.readAt ?? now }))
    );
    setUnreadCount(0);
    try {
      await api.patch("/notifications/read-all");
    } finally {
      void load();
    }
  };

  const openNotification = async (item: AppNotification) => {
    if (!item.readAt) {
      setNotifications((current) =>
        current.map((n) =>
          n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      try {
        await api.patch(`/notifications/${item.id}/read`);
      } catch {
        void load();
      }
    }
    if (item.actionUrl) navigate(item.actionUrl);
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && void load()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            unreadCount > 0
              ? `Open notifications, ${unreadCount} unread`
              : "Open notifications"
          }
          className={cn(
            "relative h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          )}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 end-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 p-0 rounded-xl shadow-lg border border-border overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              Notifications
            </h4>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={() => void markAllAsRead()}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
          {notifications.length === 0 ? (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
                <Sparkles className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                All caught up!
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                You have no pending notifications at this time.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openNotification(item)}
                className={cn(
                  "w-full text-left p-3.5 hover:bg-muted/40 transition-colors flex items-start gap-3",
                  !item.readAt && "bg-primary/5"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {item.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNowStrict(new Date(item.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.body}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
