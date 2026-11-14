"use client";

import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/use-permissions";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { XCircle, Filter, Download } from "lucide-react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import PostFilters from "@/components/posts/postFilters";
import PostTable from "@/components/posts/postTable";
import PostGrid from "@/components/posts/postGrid";
import PostGroupView from "@/components/posts/postGroupView";
import StatusChangeDialog from "@/components/posts/statusChangeDialog";
import ApprovalDialog from "@/components/posts/approvalDialog";
import RejectDialog from "@/components/posts/rejectDialog";
import AssetsDialog from "@/components/posts/assetsDialog";
import VideoPopup from "@/components/posts/videoPopup";
import CommentsDialog from "@/components/posts/commentsDialog";
import ViewModeSelector from "@/components/posts/viewModeSelector";
import BulkActions from "@/components/posts/bulkActions";
import useSWR from "swr";
import { toast } from "react-hot-toast";
import { exportCalendarToExcel } from "@/utils/exportToExcel";
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog";
import { ProjectTimingBadge } from "@/components/posts/postTimingBadge";
import { ExportLinkDialog } from "@/components/projects/export-link-dialog";
import { Share2 } from "lucide-react";
import { projectCompanyName } from "@/lib/client-company";
import { useDiscussionUnread } from "@/hooks/use-discussion-unread";

type PostStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SCHEDULED" | "POSTED";

enum ContentStatus {
  DRAFT = "DRAFT",
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  NEEDS_REVISION = "NEEDS_REVISION",
}

interface Post {
  id: string;
  title: string;
  caption?: string;
  type: string;
  status: PostStatus;
  contentStatus: ContentStatus;
  scheduledAt?: string;
  designDueDate?: string;
  postedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  contentApprovedAt?: string;
  contentRejectedAt?: string;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    name: string;
    client: {
      id: string;
      name: string;
      company: string;
    };
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    name: string;
  };
  assets: Array<{
    id: string;
    filename: string;
    url: string;
    contentType?: string;
    isReference: boolean;
  }>;
  platforms?: Array<{
    id: string;
    platform: string;
  }>;
}

interface Project {
  id: string;
  name: string;
  client: {
    id: string;
    name: string;
    company: string;
  };
  postTypes?: Record<string, number>;
  strategies?: ProjectStrategy[];
}

interface ProjectStrategy {
  id: number;
  month?: number;
  year?: number;
  postTypes?: Record<string, number>;
  total?: number;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}
interface User {
  id: string;
  name: string;
  email: string;
}

const MONTHS = [
  { short: "JAN", full: "January", number: 1 },
  { short: "FEB", full: "February", number: 2 },
  { short: "MAR", full: "March", number: 3 },
  { short: "APR", full: "April", number: 4 },
  { short: "MAY", full: "May", number: 5 },
  { short: "JUN", full: "June", number: 6 },
  { short: "JUL", full: "July", number: 7 },
  { short: "AUG", full: "August", number: 8 },
  { short: "SEP", full: "September", number: 9 },
  { short: "OCT", full: "October", number: 10 },
  { short: "NOV", full: "November", number: 11 },
  { short: "DEC", full: "December", number: 12 },
];

const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.json();
};

export default function PostsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("projectId");

  // SWR for fetching posts and project details
  const postsUrl = urlProjectId ? `/api/posts?projectId=${urlProjectId}` : "/api/posts";
  const { data: postsData, error: postsError, mutate: mutatePosts } = useSWR<Post[]>(postsUrl, fetcher);
  const { data: projectData, error: projectError } = useSWR<Project | null>(
    urlProjectId ? `/api/projects/${urlProjectId}` : null,
    fetcher
  );

  /**
   * Permissions come from `/api/me/permissions` via usePermissions().
   *
   * This used to chain `/api/users/role?id=...` into
   * `/api/role-permission/role/<roleName>`. Both are administrative endpoints —
   * `users:update` and `roles:read` — so a role holding only posts:read got 403 and
   * this page failed outright rather than simply showing fewer controls.
   */
  const { can, has, role: userRole, permissions: permissionsData } = usePermissions();

  const { data: designersData } = useSWR<User[]>("/api/users?role=Designer", fetcher);
  const { data: clientsData } = useSWR<{ id: string; name: string; company: string }[]>(
    "/api/clients",
    fetcher
  );

  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState<1 | 2 | 3>(1);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = currentDate.getMonth() + 1;
  const [yearFilter, setYearFilter] = useState(currentYear);
  const [monthFilter, setMonthFilter] = useState<number | "all">(currentMonth);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  // In PostsPage
  const [viewMode, setViewMode] = useState<"table" | "date" | "project" | "grid">("grid"); // Changed from "table" to "grid"
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: boolean }>({});
  const [viewingAssets, setViewingAssets] = useState<string | null>(null);
  const [commentingPost, setCommentingPost] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<{ [key: string]: any[] }>({});
  const [statusChangeDialog, setStatusChangeDialog] = useState<{ postId: string } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<PostStatus>("APPROVED" as PostStatus);
  const [selectedContentStatus, setSelectedContentStatus] = useState<ContentStatus>("DRAFT" as ContentStatus);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [currentAssetIndex, setCurrentAssetIndex] = useState<{ [key: string]: number }>({});
  const [approvalDialog, setApprovalDialog] = useState<{ postId: string; action: "approve" | "reject" } | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [actionComment, setActionComment] = useState("");
  const [videoPopup, setVideoPopup] = useState<{ postId: string; assetId: string } | null>(null);
  const [showMonthFilters, setShowMonthFilters] = useState(true);
  const [statusRejectDialog, setStatusRejectDialog] = useState<{ postId: string; statusType: "content" | "design"; targetStatus: string } | null>(null);
  const [isDownloadingCatalog, setIsDownloadingCatalog] = useState(false);
  const [downloadCatalogOpen, setDownloadCatalogOpen] = useState(false);
  const [catalogYear, setCatalogYear] = useState<string>("");
  const [catalogMonth, setCatalogMonth] = useState<string>("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0); // Optional, if you want to track recording time in PostsPage
  const [isDownloadingSample, setIsDownloadingSample] = useState(false);
  const [postToDelete, setPostToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [exportLinkOpen, setExportLinkOpen] = useState(false);
  const [exportLinkPostIds, setExportLinkPostIds] = useState<string[] | undefined>(undefined);

  const openExportLinkForPost = (postId: string) => {
    setExportLinkPostIds([postId]);
    setExportLinkOpen(true);
  };

  const handleBulkExport = () => {
    setExportLinkPostIds(selectedPosts);
    setExportLinkOpen(true);
  };

  useEffect(() => {
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    if (projectId) setProjectFilter(projectId);
    if (status) setStatusFilter(status.toLowerCase());
  }, [searchParams]);

  useEffect(() => {
    if (statusChangeDialog) {
      const post = postsData?.find((p) => p.id === statusChangeDialog.postId);
      if (post) {
        setSelectedStatus(post.status);
        setSelectedContentStatus(post.contentStatus);
        setSelectedDate(post.scheduledAt ? format(new Date(post.scheduledAt), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      }
    }
  }, [statusChangeDialog, postsData]);

  useEffect(() => {
    let isMounted = false;
    if (!isMounted) {
      isMounted = true;
      return;
    }
    setMonthFilter("all");
    setShowMonthFilters(true);
  }, [yearFilter]);

  const isMonthFiltered = yearFilter !== "all" || monthFilter !== "all";



  const postsMadeByType = useMemo(() => {
    const counts: Record<string, number> = {};
    let postTypesToUse: Record<string, number> = {};

    if (projectData) {
      if (yearFilter !== "all" && monthFilter !== "all") {
        const selectedStrategy = projectData.strategies?.find(
          (strategy) =>
            strategy.year === parseInt(yearFilter) &&
            strategy.month === monthFilter
        );
        postTypesToUse = selectedStrategy?.postTypes || projectData.postTypes || {};
      } else {
        postTypesToUse = projectData.postTypes || {};
      }
    }

    Object.keys(postTypesToUse).forEach((type) => {
      counts[type] = 0;
    });

    postsData?.forEach((post) => {
      const postDate = new Date(post.scheduledAt || post.createdAt);
      if (yearFilter !== "all" && postDate.getUTCFullYear().toString() !== yearFilter) {
        return;
      }

      if (monthFilter !== "all" && postDate.getUTCMonth() + 1 !== monthFilter) {
        return;
      }

      if (urlProjectId && post.project.id !== urlProjectId) {
        return;
      }

      counts[post.type] = (counts[post.type] || 0) + 1;
    });

    return counts;
  }, [postsData, projectData, yearFilter, monthFilter, urlProjectId]);

  const postTypesToUse = useMemo(() => {
    if (!projectData) return {};
    if (yearFilter !== "all" && monthFilter !== "all") {
      const selectedStrategy = projectData.strategies?.find(
        (strategy) =>
          strategy.year === parseInt(yearFilter) &&
          strategy.month === monthFilter
      );
      return selectedStrategy?.postTypes || projectData.postTypes || {};
    }
    return projectData.postTypes || {};
  }, [projectData, yearFilter, monthFilter]);

  const { totalPlannedPosts, postsMade } = useMemo(() => {
    let totalPlanned = 0;
    let made = 0;

    if (urlProjectId) {
      const filteredPostsForCount = postsData?.filter((post) => {
        if (post.project.id !== urlProjectId) return false;

        const postDate = new Date(post.scheduledAt || post.createdAt);
        if (yearFilter !== "all" && postDate.getUTCFullYear().toString() !== yearFilter) {
          return false;
        }

        if (monthFilter !== "all" && postDate.getUTCMonth() + 1 !== monthFilter) {
          return false;
        }

        return true;
      }) || [];

      made = filteredPostsForCount.length;

      if (projectData) {
        if (yearFilter !== "all" && monthFilter !== "all") {
          const selectedStrategy = projectData.strategies?.find(
            (strategy) =>
              strategy.year === parseInt(yearFilter) &&
              strategy.month === monthFilter
          );

          if (selectedStrategy?.total) {
            totalPlanned = selectedStrategy.total;
          } else if (selectedStrategy?.postTypes) {
            totalPlanned = Object.values(selectedStrategy.postTypes).reduce(
              (sum, count) => sum + count,
              0
            );
          } else if (projectData.postTypes) {
            totalPlanned = Object.values(projectData.postTypes).reduce(
              (sum, count) => sum + count,
              0
            );
          }
        } else if (yearFilter !== "all") {
          const yearStrategies = projectData.strategies?.filter(
            (strategy) => strategy.year === parseInt(yearFilter)
          ) || [];

          totalPlanned = yearStrategies.reduce((sum, strategy) => {
            return sum + (strategy.total || Object.values(strategy.postTypes || {}).reduce((s, c) => s + c, 0));
          }, 0);
        } else {
          if (projectData.strategies?.length) {
            totalPlanned = projectData.strategies.reduce((sum, strategy) => {
              return sum + (strategy.total || Object.values(strategy.postTypes || {}).reduce((s, c) => s + c, 0));
            }, 0);
          } else if (projectData.postTypes) {
            totalPlanned = Object.values(projectData.postTypes).reduce(
              (sum, count) => sum + count,
              0
            );
          }
        }
      }
    } else {
      const filteredPostsForCount = postsData?.filter((post) => {

        const postDate = new Date(post.scheduledAt || post.createdAt);
        if (yearFilter !== "all" && postDate.getUTCFullYear().toString() !== yearFilter) {
          return false;
        }

        if (monthFilter !== "all" && postDate.getUTCMonth() + 1 !== monthFilter) {
          return false;
        }

        return true;
      }) || [];

      made = filteredPostsForCount.length;
    }

    return { totalPlannedPosts: totalPlanned, postsMade: made };
  }, [postsData, projectData, urlProjectId, yearFilter, monthFilter]);

  const monthlyPostCounts = useMemo(() => {
    if (!projectData?.strategies) return [];
    return projectData.strategies.map((strategy) => {
      const monthName = MONTHS.find((m) => m.number === strategy.month)?.full || "Unknown";
      const totalPlanned = strategy.total || 0;
      const postsInMonth = postsData?.filter((post) => {
        const postDate = new Date(post.scheduledAt || post.createdAt);
        return (
          post.project.id === urlProjectId &&
          postDate.getUTCFullYear() === strategy.year &&
          postDate.getUTCMonth() + 1 === strategy.month
        );
      }).length || 0;
      return {
        month: monthName,
        year: strategy.year,
        postsMade: postsInMonth,
        totalPlanned,
      };
    });
  }, [postsData, projectData, urlProjectId]);



  const uniqueYears = useMemo(() => {
    const years = new Set<string>();
    postsData?.forEach((post) => {
      const year = new Date(post.scheduledAt || post.createdAt).getFullYear().toString();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [postsData]);

  const monthPostCounts = useMemo(() => {
    const counts: { [key: number]: number } = {};
    let filteredByYear = postsData;
    if (yearFilter !== "all") {
      filteredByYear = postsData?.filter((post) => new Date(post.scheduledAt || post.createdAt).getUTCFullYear().toString() === yearFilter);
    }
    MONTHS.forEach((month) => {
      counts[month.number] = filteredByYear?.filter((post) => {
        const postDate = new Date(post.scheduledAt || post.createdAt);
        return postDate.getUTCMonth() + 1 === month.number;
      }).length || 0;
    });
    return counts;
  }, [postsData, yearFilter]);

  const filteredPosts = useMemo(() => {
    if (!postsData || !Array.isArray(postsData)) return [];
    const permissions = Array.isArray(permissionsData) ? permissionsData : [];
    const filtered = postsData.filter((post) => {
      const isAssignedToCurrentUser = post?.assignedTo?.name === session?.user?.name;
      if (!can("posts", "update") && !isAssignedToCurrentUser) return false;

      const matchesSearch =
        post?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post?.caption?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post?.project?.client?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const hasUploadedDesign = post?.assets?.some(asset => !asset.isReference) || false;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && ["DRAFT", "SUBMITTED", "REJECTED", "SCHEDULED"].includes(post?.status) && hasUploadedDesign) ||
        post?.status === statusFilter.toUpperCase();

      const matchesType = typeFilter === "all" || post?.type === typeFilter.toUpperCase();

      const matchesProject = !urlProjectId && (projectFilter === "all" || post?.project?.id === projectFilter);

      const postDate = new Date(post.scheduledAt || post.createdAt);
      const matchesYear = yearFilter === "all" || postDate.getUTCFullYear().toString() === yearFilter;
      const matchesMonth = monthFilter === "all" || postDate.getUTCMonth() + 1 === monthFilter;

      if (urlProjectId) {
        return matchesSearch && matchesStatus && matchesType && matchesYear && matchesMonth;
      }

      return matchesSearch && matchesStatus && matchesType && matchesProject && matchesYear && matchesMonth;
    });

    // Sort by scheduled date in ascending order (earliest first)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.scheduledAt || a.createdAt).getTime();
      const dateB = new Date(b.scheduledAt || b.createdAt).getTime();
      return dateA - dateB;
    });
  }, [postsData, searchTerm, statusFilter, typeFilter, projectFilter, yearFilter, monthFilter, permissionsData, session?.user?.name, urlProjectId]);
  const unreadDiscussions = useDiscussionUnread(filteredPosts.map((p) => p.id));
  const groupedPosts = useMemo(() => {
    if (viewMode === "date") {
      const groups: { [key: string]: Post[] } = {};
      filteredPosts.forEach((post) => {
        const postDate = new Date(post.scheduledAt || post.createdAt);
        const date = format(
          new Date(
            Date.UTC(
              postDate.getUTCFullYear(),
              postDate.getUTCMonth(),
              postDate.getUTCDate()
            )
          ),
          "yyyy-MM-dd"
        );
        if (!groups[date]) groups[date] = [];
        groups[date].push(post);
      });
      return groups;
    } else if (viewMode === "project") {
      const groups: { [key: string]: Post[] } = {};
      filteredPosts.forEach((post) => {
        const projectName = post.project?.name || "Unknown Project";
        if (!groups[projectName]) groups[projectName] = [];
        groups[projectName].push(post);
      });
      return groups;
    }
    return { "All Posts": filteredPosts };
  }, [filteredPosts, viewMode]);
  const uniqueProjects = useMemo(() => {
    const projects = postsData?.map((post) => post.project).filter(Boolean);
    return Array.from(new Set(projects?.map((p) => p.id)))
      .map((id) => projects?.find((p) => p.id === id))
      .filter(Boolean);
  }, [postsData]);

  const fetchComments = async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/comments`);
      if (response.ok) {
        const comments = await response.json();
        setPostComments((prev) => ({ ...prev, [postId]: comments }));
      }
    } catch (err) {
      console.error("Error fetching comments:", err);
    }
  };
  const handleDeletePost = async (postId: string) => {
    if (!can("posts", "delete")) {
      toast.error("You do not have permission to delete posts");
      return;
    }
    const targetPost = postsData?.find((p) => p.id === postId);
    setPostToDelete({ id: postId, title: targetPost?.title || "Post" });
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    setIsDeletingPost(true);
    try {
      const response = await fetch(`/api/posts/${postToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete post");
      mutatePosts(); // Revalidate posts data
      toast.success("Post deleted successfully");
      setPostToDelete(null);
    } catch (err) {
      console.error("Error deleting post:", err);
      toast.error("Failed to delete post");
    } finally {
      setIsDeletingPost(false);
    }
  };
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const confirmBulkDelete = async () => {
    if (selectedPosts.length === 0) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all(
        selectedPosts.map(async (postId) => {
          const response = await fetch(`/api/posts/${postId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          if (!response.ok) throw new Error(`Failed to delete post ${postId}`);
        })
      );
      mutatePosts();
      toast.success(`${selectedPosts.length} post(s) deleted successfully`);
      setSelectedPosts([]);
      setShowBulkDeleteConfirm(false);
    } catch (err) {
      console.error("Error deleting posts:", err);
      toast.error("Failed to delete one or more posts");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!can("posts", "delete")) {
      toast.error("You do not have permission to delete posts");
      return;
    }
    if (selectedPosts.length === 0) return;
    setShowBulkDeleteConfirm(true);
  };
  const handleFileUpload = async (postId: string, files: FileList) => {
    if (!can("assets", "create")) {
      toast.error("You do not have permission to upload files");
      return;
    }
    if (!files.length) return;
    setUploadingFiles((prev) => ({ ...prev, [postId]: true }));
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });
      const response = await fetch(`/api/posts/${postId}/assets`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload files");
      mutatePosts(); // Revalidate posts data
    } catch (err) {
      console.error("Error uploading files:", err);
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedPosts.length === 0) return;
    // Each post goes through the workflow engine, which checks permission, scope and
    // whether that post can make the move. Nothing is forced: refusals are counted and
    // reported instead of being silently ignored as before.
    const action = newStatus.toUpperCase() === "APPROVED" ? "APPROVE" : "SUBMIT";
    const results = await Promise.all(
      selectedPosts.map(async (postId) => {
        try {
          const res = await fetch(`/api/posts/${postId}/workflow`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          });
          const body = await res.json().catch(() => ({}));
          return { ok: res.ok, error: body.error as string | undefined };
        } catch {
          return { ok: false, error: "Network error" };
        }
      })
    );
    const moved = results.filter((r) => r.ok).length;
    const refused = results.length - moved;
    if (moved > 0) toast.success(`${moved} post${moved === 1 ? "" : "s"} ${action === "APPROVE" ? "approved" : "submitted"}`);
    if (refused > 0) {
      const reason = results.find((r) => !r.ok)?.error;
      toast.error(`${refused} post${refused === 1 ? "" : "s"} could not be ${action === "APPROVE" ? "approved" : "submitted"}${reason ? `: ${reason}` : ""}`);
    }
    mutatePosts();
    setSelectedPosts([]);
  };
  const handleBulkContentStatusChange = async (newContentStatus: string) => {
    if (!can("posts", "update")) {
      toast.error("You do not have permission to update content status");
      return;
    }
    if (selectedPosts.length === 0) return;
    if (newContentStatus.toUpperCase() === ContentStatus.REJECTED || newContentStatus.toUpperCase() === ContentStatus.NEEDS_REVISION) {
      toast.error("Bulk changes request or needs revision requires feedback. Please use individual post updates for comments.");
      return;
    }
    try {
      await Promise.all(
        selectedPosts.map(async (postId) => {
          const body: any = { contentStatus: newContentStatus.toUpperCase() };
          const now = new Date().toISOString();
          switch (newContentStatus.toUpperCase()) {
            case ContentStatus.APPROVED:
              body.contentApprovedAt = now;
              break;
            case ContentStatus.REJECTED:
              body.contentRejectedAt = now;
              break;
            case ContentStatus.NEEDS_REVISION:
              body.contentRejectedAt = now; // Assuming NEEDS_REVISION uses the same timestamp field
              break;
          }
          await fetch(`/api/posts/${postId}/contentStatus`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        })
      );
      mutatePosts();
      setSelectedPosts([]);
    } catch (err) {
      console.error("Error updating content statuses:", err);
      toast.error("Failed to update content statuses");
    }
  }

  const handleOpenDownloadCatalog = () => {
    setCatalogYear(yearFilter !== "all" ? yearFilter : currentYear);
    setCatalogMonth(monthFilter !== "all" ? monthFilter.toString() : currentMonth.toString());
    setDownloadCatalogOpen(true);
  };

  const handleDownloadCatalog = async () => {
    if (!urlProjectId || !catalogYear || !catalogMonth) {
      toast.error("Please select a valid project, year, and month to download the catalog.");
      return;
    }
    setIsDownloadingCatalog(true);
    setDownloadCatalogOpen(false);
    try {
      const response = await fetch(`/api/projects/${urlProjectId}/catalog/${catalogYear}/${catalogMonth}`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch catalog: ${response.statusText}`);
      }
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+?)"/);
      const filename = filenameMatch ? filenameMatch[1] : `catalog-${urlProjectId}-${yearFilter}-${monthFilter}.pdf`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading catalog:", err);
      toast.error("Failed to download catalog. Please try again.");
    } finally {
      setIsDownloadingCatalog(false);
    }
  };

  const handleDownloadSample = async () => {
    if (!urlProjectId) {
      toast.error("Please select a valid project.");
      return;
    }
    setIsDownloadingSample(true);
    try {
      const response = await fetch(`/api/posts/bulk/sample`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch sample: ${response.statusText}`);
      }
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+?)"/);
      const filename = filenameMatch ? filenameMatch[1] : `sample-${urlProjectId}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading sample:", err);
      toast.error("Failed to download sample. Please try again.");
    } finally {
      setIsDownloadingSample(false);
    }
  };

  const openStatusChange = (postId: string, initialStatus?: any) => {
    // Status decisions are posts:approve / publish / status in the workflow engine; posts:update
    // alone (what designers and writers hold) only submits work.
    if (!can("posts", "approve") && !can("posts", "publish") && !can("posts", "status")) {
      toast.error("You do not have permission to change post status");
      return;
    }
    const post = postsData?.find((p) => p.id === postId);
    if (post) {
      setStatusChangeDialog({ postId });
      setSelectedStatus(post.status || initialStatus);
      setSelectedContentStatus(post.contentStatus || "DRAFT");
    }
  };

  const openApprovalDialog = (postId: string, action: "approve" | "reject") => {
    if (!can("posts", "approve")) {
      toast.error("You do not have permission to change post status");
      return;
    }
    const post = postsData?.find((p) => p.id === postId);
    if (action === "reject" && post && post.status === "DRAFT") {
      toast.error("Cannot reject a design that is in Draft status.");
      return;
    }
    setApprovalDialog({ postId, action });
    setActionComment("");
    if (action === "approve" && post && post.assets.length > 1) {
      setSelectedAssets(post.assets.map((asset) => asset.id));
    } else {
      setSelectedAssets([]);
    }
  };

  const handleApprovalAction = async () => {
    if (!approvalDialog) return;
    const { postId, action } = approvalDialog;
    const body: any = {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      feedback: actionComment,
    };
    if (action === "approve") {
      body.approvedAt = new Date().toISOString();
      if (selectedAssets.length > 0) {
        body.approvedAssets = selectedAssets;
      }
    } else {
      body.rejectedAt = new Date().toISOString();
    }
    try {
      await fetch(`/api/posts/${postId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (actionComment.trim()) {
        await fetch(`/api/posts/${postId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `${action === "approve" ? "Approved" : "Changes requested"}: ${actionComment}`,
          }),
        });
      }
      mutatePosts(); // Revalidate posts data
      setApprovalDialog(null);
      setActionComment("");
      setSelectedAssets([]);
    } catch (err) {
      console.error(`Error ${action}ing post:`, err);
    }
  };

  const handleConfirmStatusChange = async (statusType: "content" | "design", postedPlatforms?: string[]) => {
    if (!statusChangeDialog || !selectedDate) return;

    const postId = statusChangeDialog.postId;
    const targetStatus = statusType === "design" ? selectedStatus : selectedContentStatus;

    if (statusType === "design" && ["REJECTED", "NEEDS_MINOR_CHANGE"].includes(targetStatus)) {
      const post = postsData?.find((p) => p.id === postId);
      if (post && post.status === "DRAFT") {
        toast.error("Cannot reject or request minor changes for a design that is in Draft status.");
        return;
      }
    }

    if (["REJECTED", "NEEDS_MINOR_CHANGE"].includes(targetStatus)) {
      setStatusRejectDialog({ postId, statusType, targetStatus });
      setStatusChangeDialog(null);
    } else {
      try {
        const timestamp = selectedDate
          ? (selectedDate.includes("T") ? new Date(selectedDate).toISOString() : new Date(selectedDate + "T00:00:00.000Z").toISOString())
          : new Date().toISOString();
        const body: any = {};

        if (statusType === "content") {
          body.contentStatus = targetStatus;
          if (targetStatus === "APPROVED") {
            body.contentApprovedAt = timestamp;
          }
        } else {
          body.status = targetStatus;
          if (["APPROVED", "SCHEDULED", "POSTED"].includes(targetStatus)) {
            body.contentStatus = "APPROVED";
            body.contentApprovedAt = timestamp;
          }
          if (targetStatus === "APPROVED") body.approvedAt = timestamp;
          if (targetStatus === "SCHEDULED") body.scheduledAt = timestamp;
          if (targetStatus === "POSTED") {
            body.postedAt = timestamp;
            if (postedPlatforms) {
              body.postedPlatforms = postedPlatforms;
            }
          }
        }

        const endpoint =
          statusType === "content"
            ? `/api/posts/${postId}/contentStatus`
            : `/api/posts/${postId}/status`;

        const response = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to update ${statusType} status to ${targetStatus}`);
        }

        mutatePosts();
        setStatusChangeDialog(null);
        toast.success(`Post ${statusType} status successfully updated to ${targetStatus}`);
      } catch (err: any) {
        console.error("Error updating post status:", err);
        toast.error(err.message || "Failed to update status. Please try again.");
      }
    }
  };


  const handleStatusReject = async (statusType: "content" | "design", customAudioBlob: Blob | null) => {
    if (!statusRejectDialog) return;
    const postId = statusRejectDialog.postId;
    const targetStatus = statusRejectDialog.targetStatus || "REJECTED";

    // Check if we have either text or audio feedback
    if (!actionComment.trim() && !customAudioBlob) {
      toast.error("Please provide either text feedback or audio feedback");
      return;
    }

    try {
      let finalFeedback = actionComment.trim();

      // Use a single timestamp for consistency
      const timestamp = selectedDate
        ? (selectedDate.includes("T") ? new Date(selectedDate).toISOString() : new Date(selectedDate + "T00:00:00.000Z").toISOString())
        : new Date().toISOString();

      // Prepare request body
      const body: any = {
        feedback: finalFeedback,
      };

      if (statusType === "content") {
        body.contentStatus = targetStatus;
        if (targetStatus === "APPROVED") {
          body.contentApprovedAt = timestamp;
        } else if (targetStatus === "REJECTED" || targetStatus === "NEEDS_REVISION") {
          body.contentRejectedAt = timestamp;
        }
      } else {
        body.status = targetStatus;
        if (targetStatus === "APPROVED") body.approvedAt = timestamp;
        if (targetStatus === "REJECTED") body.rejectedAt = timestamp;
        if (targetStatus === "SCHEDULED") body.scheduledAt = timestamp;
        if (targetStatus === "POSTED") body.postedAt = timestamp;
      }

      // 1. First update status/contentStatus
      const endpoint =
        statusType === "content"
          ? `/api/posts/${postId}/contentStatus`
          : `/api/posts/${postId}/status`;

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update ${statusType} status to ${targetStatus}`);
      }

      // 2. Then upload audio (if exists)
      if (customAudioBlob) {
        const formData = new FormData();
        formData.append("audio", customAudioBlob, "rejection-audio.webm");
        formData.append("postId", postId);
        formData.append("flowType", statusType);

        const uploadResponse = await fetch("/api/approval-attachments", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to upload audio");
        }

        const uploadData = await uploadResponse.json();

        // If no text feedback (other than audio placeholder), use audio filename
        if (finalFeedback === "🎙️ Audio feedback recorded") {
          finalFeedback = `🎙️ Audio feedback: ${uploadData.filename}`;
        } else {
          finalFeedback = finalFeedback.replace(
            "🎙️ Audio feedback recorded",
            `🎙️ Audio feedback: ${uploadData.filename}`
          );
        }

        // Optionally PATCH again just to update feedback with audio info
        const patchResponse = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feedback: finalFeedback,
            ...(statusType === "content"
              ? { contentStatus: targetStatus }
              : { status: targetStatus }),
          }),
        });

        if (!patchResponse.ok) {
          const errorData = await patchResponse.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || "Failed to update feedback with audio info");
        }
      }

      // Revalidate posts data
      mutatePosts();

      // Reset dialog state
      setStatusRejectDialog(null);
      setStatusChangeDialog(null);
      setAudioBlob(null);
      setActionComment("");
      setRecordingTime(0);

      // Show success message
      const isRevision = targetStatus === "NEEDS_REVISION";
      const isRejection = targetStatus === "REJECTED";
      let successMessage = `Post ${statusType} status successfully updated to ${targetStatus}`;
      if (isRevision) {
        successMessage = `Revision request submitted successfully`;
      } else if (isRejection) {
        successMessage = `Post ${statusType} successfully rejected with feedback`;
      }
      toast.success(successMessage);
    } catch (err: any) {
      console.error("Error updating post status:", err);
      toast.error(err.message || "Failed to update status. Please try again.");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPosts(filteredPosts.map((post) => post.id));
    } else {
      setSelectedPosts([]);
    }
  };

  const handleSelectPost = (postId: string, checked: boolean) => {
    if (checked) {
      setSelectedPosts((prev) => [...prev, postId]);
    } else {
      setSelectedPosts((prev) => prev.filter((id) => id !== postId));
    }
  };

  const nextAsset = (postId: string, totalAssets: number) => {
    setCurrentAssetIndex((prev) => ({
      ...prev,
      [postId]: ((prev[postId] || 0) + 1) % totalAssets,
    }));
  };

  const prevAsset = (postId: string, totalAssets: number) => {
    setCurrentAssetIndex((prev) => ({
      ...prev,
      [postId]: ((prev[postId] || 0) - 1 + totalAssets) % totalAssets,
    }));
  };

  const getCurrentAsset = (post: Post) => {
    const nonReferenceAssets = post.assets.filter((asset) => !asset.isReference);
    const currentIndex = currentAssetIndex[post.id] || 0;
    return nonReferenceAssets[currentIndex] || nonReferenceAssets[0] || null;
  };

  const handleVideoPlay = (postId: string, assetId: string) => {
    const videoElement = document.querySelector(`[data-video-id="${postId}-${assetId}"]`) as HTMLVideoElement;
    if (videoElement) {
      if (videoElement.paused) {
        videoElement.play().catch(console.error);
      } else {
        setVideoPopup({ postId, assetId });
      }
    }
  };

  const resetFilters = () => {
    setYearFilter("all");
    setMonthFilter("all");
    setShowMonthFilters(true);
    setStatusFilter("all");
    setTypeFilter("all");
    setProjectFilter("all");
    setSearchTerm("");
  };

  const currentProject = useMemo(() => {
    if (urlProjectId && projectData) {
      return projectData;
    }
    return null;
  }, [urlProjectId, projectData]);

  if (!postsData || !permissionsData || !Array.isArray(permissionsData)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (postsError || projectError) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-medium text-foreground mb-2">Error Loading Posts</h3>
            <p className="text-muted-foreground text-center mb-4">{postsError?.message || projectError?.message || "An error occurred"}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="rounded-xl border border-border/70 bg-card shadow-2xs overflow-hidden">
        {/* Row 1: Title & Post Type Progress */}
        <div className="px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {currentProject ? `${projectCompanyName(currentProject) || currentProject.name} Posts` : "All Posts"}
                </h1>
                <ProjectTimingBadge posts={filteredPosts as any} />
              </div>
              {currentProject && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Project: {currentProject.name}
                </p>
              )}
            </div>
            <div className="h-8 w-px bg-border hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Total</span>
              <span className="text-lg font-bold text-foreground tabular-nums">
                {urlProjectId && postTypesToUse ? `${postsMade}/${totalPlannedPosts}` : postsMade}
              </span>
            </div>
          </div>

          {urlProjectId && postTypesToUse && (
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(postTypesToUse).map(([type, total]) => {
                const made = postsMadeByType[type] || 0;
                const percent = (total as number) > 0 ? Math.round((made / (total as number)) * 100) : 0;
                const isComplete = made >= (total as number);
                return (
                  <div
                    key={type}
                    className={`flex flex-col items-center px-3 py-1.5 rounded-lg border min-w-[70px] ${
                      isComplete
                        ? "bg-primary/10 border-primary/30"
                        : "bg-muted/40 border-border/60"
                    }`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{type}</span>
                    <span className={`text-sm font-bold tabular-nums ${isComplete ? "text-primary" : "text-foreground"}`}>
                      {made}<span className="text-muted-foreground font-normal">/{total as number}</span>
                    </span>
                    <div className="w-full h-1 bg-muted rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isComplete ? "bg-primary" : "bg-muted-foreground/60"}`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Row 2: Action Buttons */}
        {has("Manage-post") && (
          <div className="px-5 py-2.5 bg-muted/30 border-t border-border/60 flex items-center gap-2 flex-wrap">
            <Link href={urlProjectId ? `/dashboard/projects/posts/new?projectId=${urlProjectId}` : "/dashboard/posts/new"}>
              <Button size="sm" className="gap-1.5 shadow-2xs">
                <Plus className="size-3.5" />
                Create Post
              </Button>
            </Link>
            <div className="h-5 w-px bg-border mx-1" />
            {urlProjectId && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenDownloadCatalog}
                  disabled={isDownloadingCatalog}
                  className="text-xs"
                >
                  <Download className="mr-1.5 size-3.5" />
                  {isDownloadingCatalog ? "Downloading..." : "Strategy"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadSample}
                  disabled={isDownloadingSample || yearFilter === "all" || monthFilter === "all"}
                  className="text-xs"
                >
                  <Download className="mr-1.5 size-3.5" />
                  {isDownloadingSample ? "Downloading..." : "Sample"}
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                  setBulkImportOpen(true);
                  if (projectData?.client?.id) {
                    setSelectedClientId(projectData.client.id);
                    setBulkStep(2);
                  }
                }}>
                  <Download className="mr-1.5 size-3.5" />
                  Bulk Import
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" className="text-xs" onClick={() => {
              const monthText = monthFilter !== "all" 
                ? MONTHS.find(m => m.number.toString() === monthFilter.toString())?.short 
                : "";
              const yearText = yearFilter !== "all" ? yearFilter : "";
              const monthYearText = monthText || yearText ? `${monthText} - ${yearText}` : "Content Calendar";
              const projectText = projectData?.name || "All Projects";
              exportCalendarToExcel(filteredPosts, monthYearText, projectText);
            }}>
              <Download className="mr-1.5 size-3.5" />
              Export Calendar
            </Button>
            {urlProjectId && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setExportLinkOpen(true)}
              >
                <Share2 className="mr-1.5 size-3.5" />
                Export Link
              </Button>
            )}
          </div>
        )}
      </div>

      <PostFilters
        {...({
          searchTerm,
          setSearchTerm,
          statusFilter,
          setStatusFilter,
          typeFilter,
          setTypeFilter,
          projectFilter,
          setProjectFilter,
          yearFilter,
          setYearFilter,
          monthFilter,
          setMonthFilter,
          showMonthFilters,
          setShowMonthFilters,
          uniqueProjects: uniqueProjects as any[],
          uniqueYears,
          monthPostCounts,
          projectStrategies: projectData?.strategies || [],
          hideProjectFilter: !!urlProjectId,
          defaultProjectTotal: projectData?.postTypes ? Object.values(projectData.postTypes).reduce((sum, count) => sum + count, 0) : 0
        } as any)}
      />

      <ViewModeSelector viewMode={viewMode} setViewMode={setViewMode} />

      {has("Manage-post") && selectedPosts.length > 0 && (
        <BulkActions
          selectedPosts={selectedPosts}
          handleBulkStatusChange={handleBulkStatusChange}
          handleBulkContentStatusChange={handleBulkContentStatusChange}
          handleBulkDelete={handleBulkDelete}
          setSelectedPosts={setSelectedPosts}
          onBulkExport={handleBulkExport}
        />
      )}

      {viewMode === "table" ? (
        <PostTable
          posts={filteredPosts as any[]}
          permissions={permissionsData}
          unreadDiscussions={unreadDiscussions}
          selectedPosts={selectedPosts}
          handleSelectAll={handleSelectAll}
          handleSelectPost={handleSelectPost}
          handleDeletePost={handleDeletePost}
          openApprovalDialog={openApprovalDialog}
          openStatusChange={openStatusChange}
          setViewingAssets={setViewingAssets}
          setCommentingPost={setCommentingPost}
          fetchComments={fetchComments}
          handleFileUpload={handleFileUpload}
          uploadingFiles={uploadingFiles}
        />
      ) : viewMode === "grid" ? (
        <PostGrid
          posts={filteredPosts as any[]}
          permissions={permissionsData}
          unreadDiscussions={unreadDiscussions}
          selectedPosts={selectedPosts}
          handleSelectPost={handleSelectPost}
          handleSelectAll={handleSelectAll}
          handleDeletePost={handleDeletePost}
          openApprovalDialog={openApprovalDialog}
          openStatusChange={openStatusChange}
          setViewingAssets={setViewingAssets}
          setCommentingPost={setCommentingPost}
          fetchComments={fetchComments}
          getCurrentAsset={getCurrentAsset as any}
          prevAsset={prevAsset}
          nextAsset={nextAsset}
          currentAssetIndex={currentAssetIndex}
          handleVideoPlay={handleVideoPlay}
          openExportLinkForPost={openExportLinkForPost}
        />
      ) : (
        <PostGroupView posts={groupedPosts} viewMode={viewMode} handleVideoPlay={handleVideoPlay} />
      )}

      <StatusChangeDialog
        statusChangeDialog={statusChangeDialog}
        setStatusChangeDialog={setStatusChangeDialog}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus as any}
        selectedContentStatus={selectedContentStatus}
        setSelectedContentStatus={setSelectedContentStatus as any}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        handleConfirmStatusChange={handleConfirmStatusChange}
        permissions={permissionsData}
        currentPostStatus={postsData?.find((p) => p.id === statusChangeDialog?.postId)?.status as any}
        postTitle={postsData?.find((p) => p.id === statusChangeDialog?.postId)?.title}
        currentPostPlatforms={postsData?.find((p) => p.id === statusChangeDialog?.postId)?.platforms as any}
      />
      <ApprovalDialog
        approvalDialog={approvalDialog}
        setApprovalDialog={setApprovalDialog}
        actionComment={actionComment}
        setActionComment={setActionComment}
        selectedAssets={selectedAssets}
        setSelectedAssets={setSelectedAssets}
        handleApprovalAction={handleApprovalAction}
        posts={postsData}
        {...({ handleVideoPlay } as any)}
      />

      <RejectDialog
        statusRejectDialog={statusRejectDialog}
        setStatusRejectDialog={setStatusRejectDialog}
        posts={postsData}
        actionComment={actionComment}
        setActionComment={setActionComment}
        selectedDate={selectedDate}
        audioBlob={audioBlob}
        setAudioBlob={setAudioBlob}
        handleStatusReject={handleStatusReject}
      />

      <AssetsDialog
        viewingAssets={viewingAssets}
        setViewingAssets={setViewingAssets}
        posts={postsData}
        {...({ handleFileUpload, uploadingFiles } as any)}
      />

      <VideoPopup
        videoPopup={videoPopup}
        setVideoPopup={setVideoPopup}
        posts={postsData}
      />

      <CommentsDialog
        commentingPost={commentingPost}
        setCommentingPost={setCommentingPost}
        postComments={postComments}
        posts={postsData}
        onRefreshComments={fetchComments}
      />
      <Dialog open={downloadCatalogOpen} onOpenChange={setDownloadCatalogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Download Catalog</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Year</Label>
              <Select value={catalogYear} onValueChange={setCatalogYear}>
                <SelectTrigger aria-label="Select Year">
                  <SelectValue placeholder="Choose a year" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueYears.map((yr) => (
                    <SelectItem key={yr} value={yr}>
                      {yr}
                    </SelectItem>
                  ))}
                  {!uniqueYears.includes(currentYear) && (
                    <SelectItem value={currentYear}>{currentYear}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Month</Label>
              <Select value={catalogMonth} onValueChange={setCatalogMonth}>
                <SelectTrigger aria-label="Select Month">
                  <SelectValue placeholder="Choose a month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.number} value={m.number.toString()}>
                      {m.full}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setDownloadCatalogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!catalogYear || !catalogMonth || isDownloadingCatalog}
              onClick={handleDownloadCatalog}
            >
              {isDownloadingCatalog ? "Downloading..." : "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK IMPORT MODAL */}
      <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Import Strategy</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Step 1: Select Client */}
            {bulkStep === 1 && (
              <div className="space-y-4">
                <Label>Select Client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger aria-label="Select Client">
                    <SelectValue placeholder="Choose a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsData?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company} ({client.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}



            {/* Step 2: Upload File */}
            {bulkStep === 2 && (
              <div className="space-y-4">
                <Label>Upload Excel File</Label>
                <div className="grid w-full items-center gap-1.5">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                  {importFile && (
                    <p className="text-sm text-muted-foreground">Selected: {importFile.name}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (bulkStep > 1) {
                  if (bulkStep === 2 && urlProjectId) {
                    setBulkImportOpen(false);
                    setImportFile(null);
                  } else {
                    setBulkStep((prev) => (prev - 1) as 1 | 2);
                  }
                } else {
                  setBulkImportOpen(false);
                  // Reset
                  setSelectedClientId("");
                  setImportFile(null);
                  setBulkStep(1);
                }
              }}
            >
              {(bulkStep === 1 || (bulkStep === 2 && urlProjectId)) ? "Cancel" : "Back"}
            </Button>

            <Button
              disabled={
                (bulkStep === 1 && !selectedClientId) ||
                (bulkStep === 2 && !importFile) ||
                importing
              }
              onClick={async () => {
                if (bulkStep < 2) {
                  setBulkStep((prev) => (prev + 1) as 1 | 2);
                  return;
                }

                // Step 2: Submit
                if (!importFile || !selectedClientId) return;

                setImporting(true);
                const formData = new FormData();
                formData.append("file", importFile);
                formData.append("clientId", selectedClientId);
                formData.append("projectId", urlProjectId || "");

                try {
                  const res = await fetch("/api/posts/bulk", {
                    method: "POST",
                    body: formData,
                  });

                  const data = await res.json();

                  if (!res.ok) throw new Error(data.error || "Import failed");

                  toast.success(`Imported ${data.count} posts successfully!`);
                  mutatePosts(); // Refresh posts
                  setBulkImportOpen(false);

                  // Reset
                  setSelectedClientId("");
                  setImportFile(null);
                  setBulkStep(1);
                } catch (err: any) {
                  toast.error(err.message || "Failed to import");
                } finally {
                  setImporting(false);
                }
              }}
            >
              {importing ? "Importing..." : bulkStep === 2 ? "Import" : "Next"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={!!postToDelete}
        onClose={() => setPostToDelete(null)}
        onConfirm={confirmDeletePost}
        itemName={postToDelete?.title || "Post"}
        entityType="post"
        isLoading={isDeletingPost}
      />

      <DeleteConfirmationDialog
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={confirmBulkDelete}
        itemName={`${selectedPosts.length} selected post(s)`}
        entityType="post"
        isLoading={isBulkDeleting}
      />

      {urlProjectId && (
        <ExportLinkDialog
          isOpen={exportLinkOpen}
          onClose={() => setExportLinkOpen(false)}
          projectId={urlProjectId}
          projectName={projectData?.name || "Project"}
          monthFilter={monthFilter.toString()}
          yearFilter={yearFilter}
          postIds={exportLinkPostIds}
        />
      )}
    </div>
  );
}