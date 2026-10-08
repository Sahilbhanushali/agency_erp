'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CalendarView } from '@/components/calendar/calendar-view';

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

  if (status === 'loading') {
    return <div>Loading session...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">Error: {error}</div>;
  }

  if (!data) {
    return <div>Loading calendar data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* <div>
        <h1 className="text-3xl font-bold text-gray-900">Content Calendar</h1>
        <p className="text-gray-600">Schedule and manage your social media posts</p>
      </div> */}
      <CalendarView
        posts={data.posts}
        projects={data.projects}
        currentUser={data.currentUser}
      />
    </div>
  );
}