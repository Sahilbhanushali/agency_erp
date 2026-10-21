'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CalendarView } from '@/components/calendar/calendar-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

// Define types for clarity and type safety
interface User {
  id: string;
  email: string;
  role: "CLIENT" | "DESIGNER" | "ADMIN" | "MANAGER";
  name?: string;
}

interface Post {
  id: string;
  title: string;
  type: "PHOTO" | "REEL" | "STORY" | "CAROUSEL" | "CUSTOM";
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SCHEDULED" | "POSTED" | "NEEDS_MINOR_CHANGE" | "RESUBMITTED";
  scheduledAt: string | null;
  projectId?: string;
  project: {
    id: string;
    name: string;
    client: { id: string; email: string; name?: string; company?: string } | null;
  } | null;
  createdBy: { id: string; email: string; name?: string } | null;
  platforms?: { id: string; platform: string; postId: string }[];
}

interface Project {
  id: string;
  name: string;
  isActive: boolean;
  client: { id: string; email: string; name?: string; company?: string } | null;
}

interface CalendarData {
  posts: Post[];
  projects: Project[];
  currentUser: User;
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<CalendarData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || !session.user) {
      router.push('/auth/signin');
      return;
    }

    async function fetchCalendarData() {
      try {
        const response = await fetch('/api/calendar');
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/signin');
            return;
          }
          throw new Error('Failed to fetch calendar data');
        }
        const result: CalendarData = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    }

    fetchCalendarData();
  }, [session, status, router]);

  if (error) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-12 text-center shadow-2xs">
        <AlertCircle className="size-10 text-destructive mx-auto mb-3" />
        <h2 className="text-base font-semibold text-foreground mb-1">Could not load the calendar</h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">{error}</p>
        <Button size="sm" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  if (status === 'loading' || !data) {
    return (
      <div className="space-y-5 animate-in fade-in-50 duration-200">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[94px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[108px] rounded-xl" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-[640px] rounded-xl" />
          <Skeleton className="hidden h-[640px] rounded-xl xl:block" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in-50 duration-200">
      <CalendarView
        posts={data.posts}
        projects={data.projects}
        currentUser={data.currentUser}
      />
    </div>
  );
}
