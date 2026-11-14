"use client";

import { jsonFetcher } from "@/lib/fetcher";
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, AlertCircle, ChevronLeft, ChevronRight, Eye, MoreHorizontal, Download, Edit, Trash2, FileText, SlidersHorizontal, Search, FileCheck2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import DesignerHeadApprovalRejectDialog from '@/components/DesignerHeadApprovalDialog';
import MediaWithFallback from '@/components/MediaWithFallback';
import ImageModal from '@/components/ImageModal';
import AssetsDialog from '@/components/posts/assetsDialog';
import { ProofingApprovalDialog } from "@/components/approvals/proofing-approval-dialog";
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog";
import useSWR, { mutate as globalMutate } from 'swr';
import { getMediaUrl } from '@/lib/utils';
import { STAGE_LABELS, stageOf, type WorkflowStatus } from '@/lib/posts/workflow-rules';
import { projectCompanyName, projectLogo } from "@/lib/client-company";
import { usePermissions } from "@/hooks/use-permissions";
import { useDiscussionUnread } from "@/hooks/use-discussion-unread";
import { UnreadDiscussionBadge } from "@/components/posts/unread-discussion-badge";

interface Asset {
  id: string;
  url: string;
  filename: string;
  type: string;
  contentType?: string;
  isReference: boolean;
  isEdited?: boolean;
}

interface ApprovalFlow {
  reviewedBy: any;
  id: string;
  flowType: "CONTENT" | "DESIGN";
  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "NEEDS_MINOR_CHANGE" | "RESUBMITTED";
  submittedAt: string;
  version: number;
  post: Post;
  submittedBy?: { name: string } | null;
}

interface Post {
  id: string;
  title: string;
  caption?: string | null;
  type: "PHOTO" | "REEL" | "STORY" | "CAROUSEL" | "BLOG" | "VIDEO" | "CUSTOM";
  status: string;
  contentStatus: string;
  scheduledAt: string | null;
  createdAt: string;
  designerHeadApproval: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_MINOR_CHANGE";
  writeUp?: string | null;
  notes?: string | null;
  project: {
    id: string;
    name: string;
    description?: string | null;
    client?: { name: string; company?: string | null; avatar?: string | null } | null;
  };
  createdBy: { name: string } | null;
  assignedTo?: { name: string } | null;
  assets: Asset[];
  approvalFlows: ApprovalFlow[];
}
const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-200/80 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300 ring-yellow-300/50 dark:ring-yellow-800/50",
  SUBMITTED: "bg-blue-200/80 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 ring-blue-300/50 dark:ring-blue-800/50",
  RESUBMITTED: "bg-purple-200/80 dark:bg-purple-900/30 text-purple-900 dark:text-purple-300 ring-purple-300/50 dark:ring-purple-800/50",
  APPROVED: "bg-green-100 dark:bg-green-950/60 text-green-900 dark:text-green-200 ring-green-300/50 dark:ring-green-800/50 font-semibold",
  C_APPROVED: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 ring-emerald-300/50 dark:ring-emerald-800/50 font-semibold",
  SCHEDULED: "bg-green-700 dark:bg-green-800 text-white ring-green-800 dark:ring-green-900 font-bold shadow-sm",
  POSTED: "bg-green-700 dark:bg-green-800 text-white ring-green-800 dark:ring-green-900 font-bold shadow-sm",
  REJECTED: "bg-red-200/80 dark:bg-red-900/30 text-red-900 dark:text-red-300 ring-red-300/50 dark:ring-red-800/50",
  NEEDS_MINOR_CHANGE: "bg-amber-200/80 dark:bg-amber-900/30 text-amber-900 dark:text-amber-300 ring-amber-300/50 dark:ring-amber-800/50",
};

interface StatusChangeDialogProps {
  statusChangeDialog: { postId: string; statusType?: "content" | "design" | "designerHead" } | null;
  setStatusChangeDialog: (value: { postId: string; statusType?: "content" | "design" | "designerHead" } | null) => void;
  selectedStatus: string;
  setSelectedStatus: (value: string) => void;
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  handleConfirmStatusChange: (statusType: "content" | "design" | "designerHead") => void;
  posts: Post[];
}

const StatusChangeDialog: React.FC<StatusChangeDialogProps> = ({
  statusChangeDialog,
  setStatusChangeDialog,
  selectedStatus,
  setSelectedStatus,
  selectedDate,
  setSelectedDate,
  handleConfirmStatusChange,
  posts,
}) => {
  const post = posts.find((p) => p.id === statusChangeDialog?.postId);

  if (!statusChangeDialog || !post) return null;

  return (
    <Dialog open={!!statusChangeDialog} onOpenChange={() => setStatusChangeDialog(null)}>
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            Change {statusChangeDialog.statusType === "designerHead" ? "Design Approval" : "Status"}: {post.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Select Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-3 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
            >
              {/* Internal decisions only. Client approval is the client's (share link);
                  scheduling lives in the post's Approval workflow panel. */}
              <option value="APPROVED">Approve</option>
              <option value="NEEDS_MINOR_CHANGE">Request changes</option>
              <option value="REJECTED">Reject</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Date & Time</label>
            <input aria-label="Date & Time"
              type="datetime-local"
              value={selectedDate && selectedDate.includes("T") ? selectedDate : format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full p-3 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground text-xs"
            />
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => setStatusChangeDialog(null)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleConfirmStatusChange(statusChangeDialog.statusType!)}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Throws on non-2xx, so a failed load is an error state, not an empty list.
const fetcher = (url: string) => jsonFetcher(url);

type QueueKey = 'mine' | 'pending' | 'client' | 'approved' | 'rejected' | 'changes' | 'scheduled';

interface QueueResponse {
  // The rows feed dialogs typed against slightly different local Post shapes; kept as
  // loosely typed as the untyped array this page consumed before.
  items: any[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<QueueKey, number>;
  canApprove: boolean;
}

/** The queues from the approval workflow, in the order a reviewer works through them. */
const QUEUE_TABS: { key: QueueKey; label: string; hint: string; empty: string }[] = [
  { key: 'mine', label: 'My pending approvals', hint: 'Waiting for your decision on projects you manage or belong to', empty: 'Nothing is waiting for your approval' },
  { key: 'pending', label: 'All pending', hint: 'Every post waiting for internal approval that you can see', empty: 'No posts are waiting for approval' },
  { key: 'client', label: 'Pending client approval', hint: 'Approved internally, waiting for the client', empty: 'Nothing is waiting on a client' },
  { key: 'changes', label: 'Changes requested', hint: 'Sent back to the creator to edit and resubmit', empty: 'No posts have changes requested' },
  { key: 'rejected', label: 'Rejected', hint: 'Rejected posts — they cannot be scheduled', empty: 'No rejected posts' },
  { key: 'approved', label: 'Approved', hint: 'Every required approval is in — ready to schedule', empty: 'No approved posts waiting to be scheduled' },
  { key: 'scheduled', label: 'Scheduled', hint: 'Scheduled for publishing', empty: 'Nothing is scheduled' },
];

const queueFetcher = async (url: string): Promise<QueueResponse> => {
  const res = await fetch(url, { credentials: 'include' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? 'Could not load approvals');
  return body;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const ApprovalTab: React.FC = () => {
  const { can } = usePermissions();
  // Queues, filters and paging all run on the server (/api/design-approvals?queue=…).
  const [queue, setQueue] = useState<QueueKey>('mine');
  const [page, setPage] = useState(1);
  const [filterAssigned, setFilterAssigned] = useState<string>('ALL');
  const [filterProject, setFilterProject] = useState<string>('ALL');
  const [filterClient, setFilterClient] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const queueQuery = new URLSearchParams({ queue, page: String(page), pageSize: '24' });
  if (debouncedSearch.trim()) queueQuery.set('search', debouncedSearch.trim());
  if (filterProject !== 'ALL') queueQuery.set('projectId', filterProject);
  if (filterClient !== 'ALL') queueQuery.set('client', filterClient);
  if (filterAssigned !== 'ALL') queueQuery.set('assignedToId', filterAssigned);

  const { data: approvalsData, error, isLoading, mutate } = useSWR<QueueResponse>(
    `/api/design-approvals?${queueQuery}`,
    queueFetcher,
    { revalidateOnFocus: true, keepPreviousData: true },
  );
  const approvals = useMemo(() => approvalsData?.items ?? [], [approvalsData]);
  const counts = approvalsData?.counts;
  const total = approvalsData?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 24));

  const { data: projectOptions } = useSWR<{ projects?: { id: string; name: string; client: string | null }[] }>(
    '/api/projects?view=options',
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: people } = useSWR<{ id: string; name: string | null; email: string }[] | { error: string }>(
    '/api/users',
    fetcher,
    { revalidateOnFocus: false },
  );
  const peopleList = Array.isArray(people) ? people : [];
  /** Any filter change goes back to the first page. */
  const resetting = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const [imageModal, setImageModal] = useState<{ src: string; alt: string; postId: string; assetId: string } | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [proofingPost, setProofingPost] = useState<Post | null>(null);
  const [viewingAssets, setViewingAssets] = useState<string | null>(null);
  const [statusChangeDialog, setStatusChangeDialog] = useState<{ postId: string; statusType?: "content" | "design" | "designerHead" } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('DRAFT');
  const [actionComment, setActionComment] = useState<string>('');
  const [statusRejectDialog, setStatusRejectDialog] = useState<{ postId: string; statusType: "designerHead" } | null>(null);
  const [currentAssetIndex, setCurrentAssetIndex] = useState<{ [key: string]: number }>({});
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const [postToDelete, setPostToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    setIsDeletingPost(true);
    try {
      const response = await fetch(`/api/posts/${postToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to delete post");
      mutate();
      toast.success(data.message || "Post deleted successfully");
      setPostToDelete(null);
    } catch (err: any) {
      console.error("Error deleting post:", err);
      toast.error(err.message || "Failed to delete post");
    } finally {
      setIsDeletingPost(false);
    }
  };

  const uniqueProjects = projectOptions?.projects ?? [];
  const uniqueClients = useMemo(
    () => Array.from(new Set(uniqueProjects.map((p) => p.client).filter((c): c is string => !!c))).sort(),
    [uniqueProjects],
  );
  // Already filtered, ordered and paged by the server.
  const filteredApprovals = approvals;
  const unreadDiscussions = useDiscussionUnread(approvals.map((a) => a.post.id));

  const handleConfirmStatusChange = async (statusType: "content" | "design" | "designerHead") => {
    if (!statusChangeDialog || !selectedDate) return;
    const postId = statusChangeDialog.postId;
    const dateTime = selectedDate
      ? (selectedDate.includes("T") ? new Date(selectedDate).toISOString() : new Date(selectedDate + "T00:00:00.000Z").toISOString())
      : new Date().toISOString();

    if (statusType === "designerHead" && ["REJECTED", "NEEDS_MINOR_CHANGE"].includes(selectedStatus)) {
      const approval = approvals.find((a: ApprovalFlow) => a.post.id === postId);
      const postStatus = approval?.post?.status;
      if (postStatus === "DRAFT") {
        toast.error("Cannot reject or request minor changes for a design that is in Draft status.");
        return;
      }
    }

    try {
      if (statusType === "designerHead") {
        const body: any = { designerHeadApproval: selectedStatus };
        if (["APPROVED", "C_APPROVED", "REJECTED", "NEEDS_MINOR_CHANGE"].includes(selectedStatus)) {
          if (selectedStatus === "APPROVED" || selectedStatus === "C_APPROVED") body.approvedAt = dateTime;
          if (selectedStatus === "REJECTED" || selectedStatus === "NEEDS_MINOR_CHANGE") {
            setStatusRejectDialog({ postId, statusType });
            setStatusChangeDialog(null);
            setActionComment("");
            return;
          }
        }
        const statusResponse = await fetch(`/api/posts/${postId}/designerHeadStatus`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!statusResponse.ok) throw new Error("Failed to update design approval status");

        mutate();
        // Also invalidate the posts and projects cache so other tabs reflect the change
        globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/posts'), undefined, { revalidate: true });
        globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/projects'), undefined, { revalidate: true });
        setStatusChangeDialog(null);
        setSelectedStatus("APPROVED");
        setSelectedDate("");
        setActionComment("");
        toast.success("Design approval status updated successfully");
      }
      // Handle other status types (content, design) as in the original code
    } catch (err) {
      console.error(`Error updating ${statusType} status:`, err);
      toast.error(`Failed to update ${statusType} status`);
    }
  };

  const handleStatusReject = async (statusType: "content" | "design" | "designerHead") => {
    if (!statusRejectDialog) return;
    const postId = statusRejectDialog.postId;

    if (!actionComment.trim() && !audioBlob) {
      toast.error("Please provide either text feedback or audio feedback");
      return;
    }
    

    try {
      let finalFeedback = actionComment.trim();
      const timestamp = selectedDate
        ? (selectedDate.includes("T") ? new Date(selectedDate).toISOString() : new Date(selectedDate + "T00:00:00.000Z").toISOString())
        : new Date().toISOString();
      // Update post status with feedback
      const body: any = {
        designerHeadApproval: selectedStatus,
        feedback: finalFeedback,
        rejectedAt: timestamp,
      };

      const statusResponse = await fetch(`/api/posts/${postId}/designerHeadStatus`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });


      // Upload audio if present
      if (audioBlob) {
        const formData = new FormData();
        formData.append("audio", audioBlob, "rejection-audio.webm");
        formData.append("postId", postId);
        formData.append("flowType", statusType === "designerHead" ? "DESIGNER_HEAD" : statusType.toUpperCase());

        const uploadResponse = await fetch("/api/approval-attachments", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload audio: ${uploadResponse.statusText}`);
        }

        const uploadData = await uploadResponse.json();

        // Update feedback with audio filename
        if (finalFeedback === "🎙️ Audio feedback recorded") {
          finalFeedback = `🎙️ Audio feedback: ${uploadData.filename}`;
        } else if (finalFeedback.includes("🎙️ Audio feedback recorded")) {
          finalFeedback = finalFeedback.replace(
            "🎙️ Audio feedback recorded",
            `🎙️ Audio feedback: ${uploadData.filename}`
          );
        } else {
          finalFeedback = `${finalFeedback}\n🎙️ Audio feedback: ${uploadData.filename}`;
        }
      }


      if (!statusResponse.ok) {
        throw new Error(`Failed to reject post: ${statusResponse.statusText}`);
      }

      // Revalidate data
      mutate();
      // Also invalidate the posts cache so the Projects tab reflects the change
      globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/posts'), undefined, { revalidate: true });

      // Reset dialog state
      setStatusRejectDialog(null);
      setStatusChangeDialog(null);
      setSelectedStatus("APPROVED");
      setSelectedDate("");
      setActionComment("");
      setAudioBlob(null);

      toast.success(`Post ${statusType} successfully rejected with feedback`);
    } catch (err) {
      console.error("Error rejecting post:", err);
      toast.error("Failed to reject post. Please try again.");
    }
  };

  const getCurrentAsset = (post: Post) => {
    const assets = post.assets.filter((asset: Asset) => !asset.isReference && !asset.isEdited);
    const index = currentAssetIndex[post.id] || 0;
    return assets[index] || null;
  };

  const prevAsset = (postId: string, totalAssets: number) => {
    setCurrentAssetIndex((prev) => ({
      ...prev,
      [postId]: ((prev[postId] || 0) - 1 + totalAssets) % totalAssets,
    }));
  };

  const nextAsset = (postId: string, totalAssets: number) => {
    setCurrentAssetIndex((prev) => ({
      ...prev,
      [postId]: ((prev[postId] || 0) + 1) % totalAssets,
    }));
  };

  const openStatusChange = (approval: ApprovalFlow, status: string, statusType: "content" | "design" | "designerHead") => {
    // Status decisions are posts:approve / publish / status in the workflow engine; posts:update
    // alone (what designers and writers hold) only submits work.
    if (!can("posts", "approve") && !can("posts", "publish") && !can("posts", "status")) {
      toast.error("You do not have permission to change post status");
      return;
    }
    if (statusType === "designerHead" && ["REJECTED", "NEEDS_MINOR_CHANGE"].includes(status)) {
      const postStatus = approval.post.status;
      if (postStatus === "DRAFT") {
        toast.error("Cannot reject or request minor changes for a design that is in Draft status.");
        return;
      }
    }
    setSelectedStatus(status);
    setStatusChangeDialog({ postId: approval.post.id, statusType });
    setSelectedDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setActionComment("");
    setAudioBlob(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in-50 duration-200">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-12 text-center">
        <AlertCircle className="size-10 text-destructive mx-auto mb-3" />
        <h3 className="text-base font-semibold text-foreground mb-1">Error Loading Approvals</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">{error.message}</p>
        <Button size="sm" onClick={() => mutate()}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Approvals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Posts waiting for a decision, and where every post stands in its approval workflow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-medium" aria-live="polite">
            {total} {total === 1 ? "post" : "posts"} in this view
          </Badge>
        </div>
      </div>

      {/* Queues — each one a server-side view with a live count. */}
      <div role="tablist" aria-label="Approval queues" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {QUEUE_TABS.filter((tab) => tab.key !== 'mine' || approvalsData?.canApprove !== false).map((tab) => {
          const active = queue === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              title={tab.hint}
              onClick={() => {
                setQueue(tab.key);
                setPage(1);
              }}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                  active ? 'bg-primary-foreground/20' : 'bg-muted text-foreground'
                }`}
              >
                {counts ? counts[tab.key] : '·'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col items-stretch gap-2.5 rounded-xl border border-border/70 bg-card p-3 shadow-2xs md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => resetting(setSearchTerm)(e.target.value)}
            aria-label="Search approvals"
            placeholder="Search title, project, client, creator..."
            className="h-9 w-full bg-background pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterProject} onValueChange={resetting(setFilterProject)}>
            <SelectTrigger aria-label="Filter by project" className="h-9 w-[150px] bg-background text-xs">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Projects</SelectItem>
              {uniqueProjects.map((project) => (
                <SelectItem key={project.id} value={project.id} className="text-xs">
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterClient} onValueChange={resetting(setFilterClient)}>
            <SelectTrigger aria-label="Filter by client" className="h-9 w-[150px] bg-background text-xs">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Clients</SelectItem>
              {uniqueClients.map((name) => (
                <SelectItem key={name} value={name} className="text-xs">
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterAssigned} onValueChange={resetting(setFilterAssigned)}>
            <SelectTrigger aria-label="Filter by assignee" className="h-9 w-[150px] bg-background text-xs">
              <SelectValue placeholder="Assigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">Anyone assigned</SelectItem>
              {peopleList.map((person) => (
                <SelectItem key={person.id} value={String(person.id)} className="text-xs">
                  {person.name ?? person.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(searchTerm || filterProject !== "ALL" || filterClient !== "ALL" || filterAssigned !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setPage(1);
                setFilterProject("ALL");
                setFilterClient("ALL");
                setFilterAssigned("ALL");
              }}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {filteredApprovals.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card p-12 text-center shadow-2xs">
          <FileCheck2 className="mx-auto mb-3 size-8 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            {searchTerm || filterProject !== "ALL" || filterClient !== "ALL" || filterAssigned !== "ALL"
              ? "No posts match these filters"
              : QUEUE_TABS.find((t) => t.key === queue)?.empty}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {queue === "mine" ? (
              <>
                Nothing is waiting for your decision.{" "}
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => setQueue("pending")}>
                  See all pending approvals
                </button>
                .
              </>
            ) : (
              "Try another queue, or clear the filters."
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApprovals.map((approval: ApprovalFlow) => {
            const nonReferenceAssets = approval.post.assets?.filter((asset: Asset) => !asset.isReference && !asset.isEdited) || [];
            const currentAsset = getCurrentAsset(approval.post);
            const isVideo = currentAsset ? (
              currentAsset.type?.toLowerCase().includes('video') ||
              ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'].some(ext => 
                currentAsset.filename?.toLowerCase().endsWith(ext)
              )
            ) : false;

            return (
              <Card 
                key={approval.id} 
                className="overflow-hidden hover:shadow-xl transition-all duration-300 bg-card border-border rounded-xl group"
              >
                <div className="flex items-center justify-between px-3 pt-3 pb-2">
                  <div className="flex items-center min-w-0">
                    <img
                      src={projectLogo(approval.post.project) || "/placeholder-client-logo.png"}
                      alt={`${projectCompanyName(approval.post.project) || 'Client'} logo`}
                      className="w-8 h-8 rounded-full mr-3 object-cover border border-border"
                      onError={(e) =>
                        (e.currentTarget.src = "/placeholder-client-logo.png")
                      }
                    />
                    <span className="font-semibold text-sm text-foreground truncate">
                      {projectCompanyName(approval.post.project) || approval.post.project.client?.name || 'Unknown Client'}
                    </span>
                  </div>
                  <span className="ml-3 shrink-0 rounded-full px-3 py-1 text-xs font-medium border bg-primary/10 text-primary border-primary/20">
                    {approval.post.type}
                  </span>
                </div>

                <div className="relative aspect-square bg-muted">
                  {nonReferenceAssets.length > 0 && currentAsset ? (
                    <>
                      <MediaWithFallback
                        asset={currentAsset}
                        isVideo={isVideo}
                        // showFitControl={true}
                        className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                        onImageClick={(url, filename) => setImageModal({ 
                          src: url || getMediaUrl(currentAsset.url), 
                          alt: filename || currentAsset.filename, 
                          postId: approval.post.id, 
                          assetId: currentAsset.id 
                        })}
                      />
                      {nonReferenceAssets.length > 1 && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-accent/90 hover:bg-accent text-foreground border-0 rounded-full h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => prevAsset(approval.post.id, nonReferenceAssets.length)}
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-accent/90 hover:bg-accent text-foreground border-0 rounded-full h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => nextAsset(approval.post.id, nonReferenceAssets.length)}
                          >
                            <ChevronRight className="h-5 w-5" />
                          </Button>
                          <div className="absolute bottom-3 right-3 bg-accent/90 text-foreground px-3 py-1 rounded-lg text-xs font-medium">
                            {(currentAssetIndex[approval.post.id] || 0) + 1} / {nonReferenceAssets.length}
                          </div>
                        </>
                      )}
                      <Badge 
                        className={`absolute top-3 left-3 ${statusColors[approval.post.status || approval.post.designerHeadApproval]} text-xs font-semibold px-3 py-1 rounded-full ring-1`}
                      >
                        {STAGE_LABELS[stageOf({ status: approval.post.status as WorkflowStatus, requiresClientApproval: !!(approval.post as { requiresClientApproval?: boolean }).requiresClientApproval })]}
                      </Badge>

                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gradient-to-br from-muted to-muted/50">
                      <span className="text-muted-foreground text-sm font-medium">Design is pending</span>
                    </div>
                  )}
                </div>

                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 font-semibold text-lg text-foreground line-clamp-1">{approval.post.title}</h3>
                      <UnreadDiscussionBadge postId={approval.post.id} count={unreadDiscussions[approval.post.id]} />
                    </div>
                    {approval.post.caption && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{approval.post.caption}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {approval.submittedAt 
                          ? format(new Date(approval.submittedAt), "MMM dd, yyyy")
                          : 'N/A'
                        }
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Assigned to: {approval.post.assignedTo?.name || 'Unassigned'}</p>
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1 truncate">
                      Status Updated By: {approval.reviewedBy?.name || approval.submittedBy?.name || approval.post.createdBy?.name || 'N/A'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-4 gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => setProofingPost(approval.post)}
                        className="text-xs h-8"
                      >
                        <FileCheck2 className="mr-1.5 size-3.5" />
                        Proof & Workflow
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-8"
                        onClick={() => currentAsset && setImageModal({ 
                          src: getMediaUrl(currentAsset.url), 
                          alt: currentAsset.filename, 
                          postId: approval.post.id, 
                          assetId: currentAsset.id 
                        })}
                      >
                        <Eye className="mr-1.5 size-3.5" />
                        Asset
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-8"
                        onClick={() => setSelectedPost(approval.post)}
                      >
                        <Eye className="mr-1.5 size-3.5" />
                        Content
                      </Button>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-10 w-10 p-0 hover:bg-accent rounded-lg">
                          <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-sm rounded-lg w-52">
                        <DropdownMenuItem
                          onClick={() => setProofingPost(approval.post)}
                          className="cursor-pointer font-medium text-primary"
                        >
                          <FileCheck2 className="mr-2 h-4 w-4" />
                          Proof & Workflow Chain
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/projects/posts/${approval.post.id}/edit`} className="flex items-center cursor-pointer">
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => setPostToDelete({ id: approval.post.id, title: approval.post.title })}
                          className="text-red-600 dark:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => setViewingAssets(approval.post.id)}
                          className="cursor-pointer"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Assets ({nonReferenceAssets.length})
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Decisions only for people who can approve, and only while the
                            post is actually waiting for one. The server enforces both. */}
                        {approvalsData?.canApprove && ['SUBMITTED', 'RESUBMITTED'].includes(approval.post.status) && (
                          <>
                            <DropdownMenuItem
                              onClick={() => openStatusChange(approval, 'APPROVED', 'designerHead')}
                              className="text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950 cursor-pointer"
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Approve
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => openStatusChange(approval, 'NEEDS_MINOR_CHANGE', 'designerHead')}
                              className="text-amber-700 dark:text-amber-300 cursor-pointer"
                            >
                              <SlidersHorizontal className="mr-2 h-4 w-4" />
                              Request changes
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => openStatusChange(approval, 'REJECTED', 'designerHead')}
                              className="text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 cursor-pointer"
                            >
                              <X className="mr-2 h-4 w-4" />
                              Reject
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pageCount > 1 && (
        <nav aria-label="Approval pages" className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="size-4" aria-hidden="true" /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
              Next <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}

      <StatusChangeDialog
        statusChangeDialog={statusChangeDialog}
        setStatusChangeDialog={setStatusChangeDialog}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        handleConfirmStatusChange={handleConfirmStatusChange}
        posts={approvals.map((approval: any) => approval.post)}
      />

      <DesignerHeadApprovalRejectDialog
        statusRejectDialog={statusRejectDialog}
        setStatusRejectDialog={setStatusRejectDialog}
        posts={approvals.map((approval: any) => approval.post)}
        actionComment={actionComment}
        setActionComment={setActionComment}
        selectedDate={selectedDate}
        audioBlob={audioBlob}
        setAudioBlob={setAudioBlob}
        handleStatusReject={handleStatusReject}
        targetStatus={selectedStatus}
      />

      <AssetsDialog
        viewingAssets={viewingAssets}
        setViewingAssets={setViewingAssets}
        posts={approvals.map((approval: any) => approval.post)}
        handleVideoPlay={() => {}}
      />

      {imageModal && (
        <ImageModal
          isOpen={true}
          onClose={() => setImageModal(null)}
          src={imageModal.src || ""}
          alt={imageModal.alt || ""}
          postId={imageModal.postId}
          assetId={imageModal.assetId}
          onSaveSuccess={() => {
            if (imageModal.postId) {
              openStatusChange(
                approvals.find((a: ApprovalFlow) => a.post.id === imageModal.postId)!,
                'APPROVED',
                'designerHead'
              );
            }
          }}
        />
      )}

      {/* Post Content Modal */}
      {selectedPost && (
        <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedPost.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <h4 className="font-semibold text-sm text-foreground mb-1">Type</h4>
                <p className="text-foreground">{selectedPost.type}</p>
              </div>
              {selectedPost.caption && (
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-1">Caption</h4>
                  <p className="text-foreground whitespace-pre-wrap">{selectedPost.caption}</p>
                </div>
              )}
              {selectedPost.writeUp && (
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-1">Write Up</h4>
                  <p className="text-foreground">{selectedPost.writeUp}</p>
                </div>
              )}
              {selectedPost.notes && (
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-1">Notes</h4>
                  <p className="text-foreground">{selectedPost.notes}</p>
                </div>
              )}
              <div>
                <h4 className="font-semibold text-sm text-foreground mb-1">Status</h4>
                <p className="text-foreground">{selectedPost.status}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground mb-1">Team Lead Approval</h4>
                <p className="text-foreground">{selectedPost.designerHeadApproval}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground mb-1">Posting Date</h4>
                <p className="text-foreground">
                  {selectedPost.scheduledAt 
                    ? format(new Date(selectedPost.scheduledAt), "PPP ppp") 
                    : 'Not scheduled'
                  }
                </p>
              </div>
              {selectedPost.assets && selectedPost.assets.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-2">Assets</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedPost.assets
                      .filter((asset: Asset) => !asset.isReference && !asset.isEdited)
                      .map((asset: Asset) => (
                        <div key={asset.id} className="border border-border rounded-lg p-2">
                          <MediaWithFallback 
                            asset={asset} 
                            isVideo={asset.type?.toLowerCase().includes('video') || ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'].some(ext => asset.filename?.toLowerCase().endsWith(ext))}
                            className="w-full h-32 rounded object-cover" 
                          />
                          <p className="text-sm text-muted-foreground mt-1 truncate">{asset.filename}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {selectedPost.project && (
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-1">Project</h4>
                  <p className="text-foreground font-medium">{selectedPost.project.name}</p>
                  {selectedPost.project.description && (
                    <p className="text-sm text-muted-foreground mt-1">{selectedPost.project.description}</p>
                  )}
                </div>
              )}
              {selectedPost.assignedTo && (
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-1">Assigned To</h4>
                  <p className="text-foreground">{selectedPost.assignedTo.name}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedPost(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {proofingPost && (
        <ProofingApprovalDialog
          open={!!proofingPost}
          onOpenChange={(open) => {
            if (!open) setProofingPost(null);
          }}
          postId={proofingPost.id}
          postTitle={proofingPost.title}
          projectName={proofingPost.project?.name}
          assets={proofingPost.assets}
          onUpdate={() => {
            mutate();
            globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/posts'), undefined, { revalidate: true });
          }}
        />
      )}

      {/* Delete Confirmation Alert */}
      <DeleteConfirmationDialog
        isOpen={!!postToDelete}
        onClose={() => setPostToDelete(null)}
        onConfirm={confirmDeletePost}
        itemName={postToDelete?.title || "Post"}
        entityType="post"
        isLoading={isDeletingPost}
      />
    </div>
  );
};

export default ApprovalTab;
