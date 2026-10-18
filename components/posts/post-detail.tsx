"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { QuickScheduleModal } from "./quick-schedule-modal";
import { ExportLinkDialog } from "@/components/projects/export-link-dialog";
import { PlatformIntegration } from "../platform/platform-integration";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, FileImage, User, Type, Link as LinkIcon, History, Play, Pause, ChevronLeft, ChevronRight, X, Image as ImageIcon, Video, FileText, Settings, Upload, CheckCircle, Clock, Check, MoreVertical, Search, Filter, RefreshCw, Maximize2, Trash2, ArrowLeft, Send, Download, Phone, Mail, Building2, Copy, PlayCircle, Plus, Edit2, CheckCircle2, RotateCcw, AlertCircle, Eye, EyeOff, Loader2, UserCheck, MessageSquare, Mic, XCircle } from "lucide-react";
import Link from "next/link";
import { format, isLastDayOfMonth, lastDayOfMonth } from "date-fns";
import toast from "react-hot-toast";
import MediaPopup from "@/components/mediaPopup";
import useSWR, { mutate as globalMutate } from "swr";
import { getMediaUrl } from "@/lib/utils";
import PostTimingBadge from "./postTimingBadge";

// Placeholder image as a data URL to avoid network requests
const FALLBACK_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e5e7eb'/%3E%3Ctext x='50' y='50' font-family='Arial' font-size='12' fill='%236b7280' text-anchor='middle' dominant-baseline='middle'%3EImage Not Found%3C/text%3E%3C/svg%3E";
const VIDEO_THUMBNAIL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e5e7eb'/%3E%3Cpath d='M30 20v60l50-30z' fill='%236b7280'/%3E%3Ctext x='50' y='90' font-family='Arial' font-size='10' fill='%236b7280' text-anchor='middle'%3EVideo Asset%3C/text%3E%3C/svg%3E";

type PostStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SCHEDULED" | "POSTED" | "NEEDS_MINOR_CHANGE" | "RESUBMITTED";
type ContentStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_REVISION" | "NEEDS_MINOR_CHANGE" | "RESUBMITTED" | "DRAFT";

const statusColors: Record<PostStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-800",
  REJECTED: "bg-red-100 text-red-800",
  SCHEDULED: "bg-green-700 dark:bg-green-800 text-white border border-green-800 dark:border-green-900 font-semibold shadow-sm",
  POSTED: "bg-green-700 dark:bg-green-800 text-white border border-green-800 dark:border-green-900 font-semibold shadow-sm",
  NEEDS_MINOR_CHANGE: "bg-amber-100 text-amber-800",
  RESUBMITTED: "bg-blue-200 text-blue-900",
};

const contentStatusColors: Record<ContentStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  NEEDS_REVISION: "bg-orange-200 text-orange-900",
  NEEDS_MINOR_CHANGE: "bg-amber-100 text-amber-800",
  RESUBMITTED: "bg-blue-200 text-blue-900",
};

const typeIcons: Record<string, string> = {
  PHOTO: "📷",
  REEL: "🎬",
  STORY: "📱",
  CAROUSEL: "🎠",
  VIDEO: "🎥",
  CUSTOM: "✨",
};

const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /((?:https?:\/\/|www\.)[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a 
          key={i} 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

interface PostDetailProps {
  post: {
    id: string;
    title: string;
    caption?: string;
    writeUp?: string | null;
    keyword?: string | null;
    type: string;
    status: PostStatus;
    contentStatus: ContentStatus;
    scheduledAt?: string;
    designDueDate?: string;
    postedAt?: string;
    approvedAt?: string;
    rejectedAt?: string;
    createdAt: string;
    createdById: string | null;
    createdBy: { name: string } | null;
    assignedTo?: { id: string; name: string; email: string } | null;
    assignedUsers?: { id: number; name: string; email: string; role?: { name: string } }[];
    project: { client?: { name: string; company: string; avatar?: string | null } | null; name: string; id: string };
    platforms?: { platform: string }[];
    assets: {
      id: string;
      url: string;
      filename: string;
      isReference: boolean;
      uploadedById: string;
      createdAt: string;
      isEdited: boolean;
    }[];
    comments: {
      id: string;
      user?: { name: string; email?: string } | null;
      authorName?: string | null;
      authorRole?: string | null;
      content: string;
      createdAt: string;
      type?: "DESIGN" | "CONTENT";
    }[];
    approvalFlows: {
      id: string;
      flowType: "DESIGN" | "CONTENT";
      status: string;
      submittedAt: string | null;
      reviewedAt: string | null;
      feedback: string | null;
      submissionCount: number;
      version: number;
      createdAt: string;
      updatedAt: string;
      postId: string;
      submittedById: number | null;
      reviewedById: number | null;
      assignedToId: number | null;
      rejectionReason: string | null;
      attachments: {
        id: string;
        type: string;
        url: string;
        filename: string;
        size: number;
        duration: number | null;
        mimeType: string;
        uploadedAt: string;
        approvalFlowId: string;
        uploadedById: number;
      }[];
      history: {
        id: string;
        action: string;
        fromStatus: string;
        toStatus: string;
        feedback: string | null;
        version: number;
        metadata: any;
        createdAt: string;
        approvalFlowId: string;
        performedById: number;
      }[];
      submittedBy: {
        id: number;
        email: string;
        name: string;
        roleId: number;
      } | null;
      reviewedBy: {
        id: number;
        email: string;
        name: string;
        roleId: number;
      } | null;
      assignedTo: {
        id: number;
        email: string;
        name: string;
        roleId: number;
      } | null;
      assignedUsers?: {
        id: number;
        email: string;
        name: string;
        role?: { name: string };
      }[];
    }[];
    customData?: { referenceUrl?: string };
    referenceUrl?: string; // Added to interface for top-level referenceUrl
    notes?: string | null;
  };
  isPublicView?: boolean;
}

// SWR Fetcher
const fetcher = async ([url, token]: [string, string | undefined]) => {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to fetch post");
  }
  return res.json();
};

export function PostDetail({ post: initialPost, isPublicView = false }: PostDetailProps) {
  const { data: session } = useSession();
  const { can } = usePermissions();
  const router = useRouter();

  // SWR: Fetch latest post data
  const { data: post, mutate: mutatePost } = useSWR(
    (session as any)?.accessToken ? [`/api/posts/${initialPost.id}`, (session as any).accessToken] : null,
    fetcher,
    {
      fallbackData: initialPost,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  const additionalNotes = (post?.notes && post.notes !== "false" && post.notes !== "true")
    ? post.notes
    : (post?.customData?.notes && post.customData.notes !== "false" && post.customData.notes !== "true")
      ? post.customData.notes
      : null;

  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isDraggingRef, setIsDraggingRef] = useState(false);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [isDraggingDes, setIsDraggingDes] = useState(false);
  const [isUploadingDes, setIsUploadingDes] = useState(false);
  
  const [exportLinkOpen, setExportLinkOpen] = useState(false);

  const [replacingAssetId, setReplacingAssetId] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  
  const [linkRef, setLinkRef] = useState("");
  const [linkDes, setLinkDes] = useState("");

  const processLinkUpload = async (link: string, type: "reference" | "designer") => {
    if (!link.trim()) return;

    const formData = new FormData();
    formData.append("linkUrl", link);

    if (type === "reference") {
      setIsUploadingRef(true);
      try {
        const res = await fetch(`/api/posts/${post.id}`, {
          method: "PUT",
          body: formData,
        });
        if (!res.ok) throw new Error("Failed to upload reference link");
        const updatedPost = await res.json();
        toast.success("Reference link added successfully");
        setLinkRef("");
        
        await mutatePost(updatedPost, false);
        await mutatePost();
        router.refresh();
      } catch (error) {
        toast.error("Error adding reference link");
      } finally {
        setIsUploadingRef(false);
      }
    } else {
      setIsUploadingDes(true);
      try {
        const res = await fetch(`/api/posts/${post.id}/assets`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Failed to upload designer link");
        const data = await res.json();
        toast.success("Designer link added successfully");
        setLinkDes("");
        
        if (data.assets) {
          const optimisticPost = {
            ...post,
            assets: [...post.assets, ...data.assets],
          };
          if (data.updatedPost && data.updatedPost.status) {
            optimisticPost.status = data.updatedPost.status;
          }
          await mutatePost(optimisticPost, false);
        }
        
        await mutatePost();
        router.refresh();
      } catch (error) {
        toast.error("Error adding designer link");
      } finally {
        setIsUploadingDes(false);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent, type: "reference" | "designer") => {
    e.preventDefault();
    if (type === "reference") setIsDraggingRef(true);
    else setIsDraggingDes(true);
  };

  const handleDragLeave = (e: React.DragEvent, type: "reference" | "designer") => {
    e.preventDefault();
    if (type === "reference") setIsDraggingRef(false);
    else setIsDraggingDes(false);
  };

  const processFilesUpload = async (files: FileList | File[], type: "reference" | "designer") => {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    const fieldName = type === "reference" ? "assets" : "files";
    Array.from(files).forEach((file) => formData.append(fieldName, file));

    if (type === "reference") {
      setIsUploadingRef(true);
      try {
        const res = await fetch(`/api/posts/${post.id}`, {
          method: "PUT",
          body: formData,
        });
        if (!res.ok) throw new Error("Failed to upload reference assets");
        const updatedPost = await res.json();
        toast.success("Reference assets uploaded successfully");
        
        // Optimistic update
        await mutatePost(updatedPost, false);
        await mutatePost(); // Revalidate from server
        router.refresh();
      } catch (error) {
        toast.error("Error uploading reference assets");
      } finally {
        setIsUploadingRef(false);
      }
    } else {
      setIsUploadingDes(true);
      try {
        const res = await fetch(`/api/posts/${post.id}/assets`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Failed to upload designer assets");
        const data = await res.json();
        toast.success("Designer assets uploaded successfully");
        
        // Optimistic update for Designer assets
        if (data.assets) {
          const optimisticPost = {
            ...post,
            assets: [...post.assets, ...data.assets],
          };
          if (data.updatedPost && data.updatedPost.status) {
            optimisticPost.status = data.updatedPost.status;
          }
          await mutatePost(optimisticPost, false);
        }
        
        await mutatePost(); // Revalidate from server
        router.refresh();
      } catch (error) {
        toast.error("Error uploading designer assets");
      } finally {
        setIsUploadingDes(false);
      }
    }
  };

  const handleAssetDrop = async (e: React.DragEvent, type: "reference" | "designer") => {
    e.preventDefault();
    if (type === "reference") setIsDraggingRef(false);
    else setIsDraggingDes(false);

    if (e.dataTransfer?.files) {
      await processFilesUpload(e.dataTransfer.files, type);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: "reference" | "designer") => {
    if (e.target.files) {
      await processFilesUpload(e.target.files, type);
    }
    e.target.value = '';
  };

  // Comments Audio Recording States
  const [isRecordingComment, setIsRecordingComment] = useState(false);
  const [recordingCommentTime, setRecordingCommentTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [post.comments]);

  const startRecordingComment = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        await handleSendAudioComment(blob);
      };

      mediaRecorderRef.current.start();
      setIsRecordingComment(true);
      setRecordingCommentTime(0);

      timerRef.current = setInterval(() => {
        setRecordingCommentTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting comment recording:", error);
      toast.error("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecordingComment = (shouldSend = true) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      if (!shouldSend) {
        mediaRecorderRef.current.onstop = () => {
          // Do nothing on stop
        };
      }
      mediaRecorderRef.current.stop();
      setIsRecordingComment(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingCommentTime(0);
    }
  };

  const handleSendAudioComment = async (audioBlob: Blob) => {
    setIsLoading(true);
    const tempId = Date.now().toString();
    const newComment = {
      id: tempId,
      user: { 
        name: currentUser.name || "You",
        email: currentUser.email || undefined
      },
      content: "🎙️ Audio feedback comment uploading...",
      createdAt: new Date().toISOString(),
    };

    const optimisticPost = {
      ...post,
      comments: [newComment, ...post.comments],
    };

    await mutatePost(optimisticPost, false);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "comment-audio.webm");
      formData.append("postId", post.id);

      const uploadResponse = await fetch("/api/comments/audio", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload comment audio");
      }

      const uploadData = await uploadResponse.json();
      const audioUrl = uploadData.url;
      const commentContent = `🎙️ Audio comment: [AUDIO:${audioUrl}]`;

      const response = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
        body: JSON.stringify({ content: commentContent }),
      });

      if (!response.ok) {
        throw new Error("Failed to create audio comment");
      }

      const { notifiedUsersList, ...addedComment } = await response.json();
      
      if (notifiedUsersList && notifiedUsersList.length > 0) {
        toast.success(`Audio comment added & mail sent to: ${notifiedUsersList.join(", ")}`, { duration: 5000 });
      } else {
        toast.success("Audio comment added successfully");
      }

      const finalPost = {
        ...post,
        comments: [addedComment, ...post.comments],
      };
      await mutatePost(finalPost, false);
      await globalMutate(`/api/posts/${post.id}`, finalPost, false);
      
      router.refresh();
    } catch (err: any) {
      console.error(err);
      toast.error("Error sending audio comment");
      await mutatePost();
    } finally {
      setIsLoading(false);
    }
  };

  const formatCommentTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderCommentContent = (content: string, isSelf: boolean) => {
    const audioRegex = /\[AUDIO:(.*?)\]/;
    const match = content.match(audioRegex);
    if (match) {
      const audioUrl = match[1];
      const text = content.replace(audioRegex, "").trim();
      return (
        <div className="space-y-1.5">
          {text && <p className={`text-xs ${isSelf ? 'text-indigo-50' : 'text-gray-800 dark:text-gray-200'}`}>{text}</p>}
          <div className="max-w-xs mt-1">
            <audio
              controls
              src={audioUrl}
              className="w-full h-7 rounded-lg"
              style={{ maxHeight: "28px" }}
            />
          </div>
        </div>
      );
    }
    return <p className={`text-xs leading-relaxed break-words whitespace-pre-wrap ${
      isSelf ? 'text-indigo-50' : 'text-gray-800 dark:text-gray-200'
    }`}>{content}</p>;
  };
  const [statusChangeDialog, setStatusChangeDialog] = useState<{
    type: "post" | "content";
    status: PostStatus | ContentStatus;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{ url: string; filename: string; type: string } | null>(null);
  // const router = useRouter();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // NEW: Delete state
  const [deleteDialog, setDeleteDialog] = useState<{ assetId: string; filename: string; isReference: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Comment Edit & Delete states
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>("");
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);

  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const handleStartEditComment = (comment: { id: string; content: string }) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!editingCommentText.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    setIsUpdatingComment(true);
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
        body: JSON.stringify({ content: editingCommentText.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update comment");
      }

      const updatedComment = await response.json();

      const updatedComments = post.comments.map((c: any) =>
        c.id === commentId ? { ...c, content: updatedComment.content } : c
      );

      const updatedPost = { ...post, comments: updatedComments };
      await mutatePost(updatedPost, false);
      await globalMutate(`/api/posts/${post.id}`, updatedPost, false);
      mutatePost(); // trigger SWR revalidation

      toast.success("Comment updated successfully");
      setEditingCommentId(null);
      setEditingCommentText("");
    } catch (err: any) {
      console.error("Error editing comment:", err);
      toast.error(err.message || "Failed to update comment");
    } finally {
      setIsUpdatingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setIsDeletingComment(true);
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete comment");
      }

      const updatedComments = post.comments.filter((c: any) => c.id !== commentId);
      const updatedPost = { ...post, comments: updatedComments };

      await mutatePost(updatedPost, false);
      await globalMutate(`/api/posts/${post.id}`, updatedPost, false);
      mutatePost(); // trigger SWR revalidation

      toast.success("Comment deleted successfully");
      setDeletingCommentId(null);
    } catch (err: any) {
      console.error("Error deleting comment:", err);
      toast.error(err.message || "Failed to delete comment");
    } finally {
      setIsDeletingComment(false);
    }
  };

  const currentUser = session?.user || { id: "", role: "", name: "" };
  const canSubmit = post.createdById === currentUser.id && post.status === "DRAFT";
  const canEdit = post.createdById === currentUser.id && ["DRAFT", "REJECTED"].includes(post.status);
  /**
   * Driven by permissions, not role names.
   *
   * These were lists of role names ("Manager", "Team Lead", "Designer"), so a role
   * created in the permission matrix could hold posts:publish and still see none of
   * these controls — the same reason a new role appears to have no access anywhere.
   */
  const canSchedule = can("posts", "publish") && post.status === "APPROVED";
  const canManageStatus = can("posts", "status") || can("posts", "approve");
  const canManageContentStatus = can("posts", "approve");
  const canDeleteAssets = can("assets", "delete");

  // Separate assets by type
  const referenceAssets = post.assets.filter((asset: any) => asset.isReference);
  const designerAssets = post.assets.filter((asset: any) => !asset.isReference && !asset.isEdited);

  // Compute latest edited asset
  const latestEditedAsset = useMemo(() => {
    return post.assets
      .filter((a: any) => a.isEdited)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [post.assets]);

  // Compute latest rejection comment
  const latestRejectionComment = useMemo(() => {
    return post.comments
      .filter((c: any) => c.type === "DESIGN" || (c.type === "DESIGNER_HEAD" && c.content.includes("Audio feedback")))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [post.comments]);

  // Compute latest audio attachment
  const latestAudioAttachment = useMemo(() => {
    const allAttachments = post.approvalFlows.flatMap((flow: any) =>
      flow.attachments
        .filter((attachment: any) => attachment.mimeType.startsWith("audio/"))
        .map((attachment: any) => ({ ...attachment, flowId: flow.id }))
    );
    return allAttachments.sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
  }, [post.approvalFlows]);

  // Sort comments ascending (earliest first)
  const sortedComments = useMemo(() => {
    return [...post.comments].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [post.comments]);

  useEffect(() => {
    console.log("[PostDetail] Session:", { id: session?.user.id, role: session?.user.role, accessToken: (session as any)?.accessToken });
  }, [post.id, session]);

  useEffect(() => {
    if (statusChangeDialog) {
      const today = new Date();
      if (isLastDayOfMonth(today)) {
        setSelectedDate(format(lastDayOfMonth(today), "yyyy-MM-dd'T'HH:mm"));
      } else {
        setSelectedDate(format(today, "yyyy-MM-dd'T'HH:mm"));
      }
      setFeedback("");
    }
  }, [statusChangeDialog]);

  // NEW: Delete handler with optimistic update
  const handleDeleteAsset = async () => {
    if (!deleteDialog) return;
    setDeleting(true);

    const optimisticPost = {
      ...post,
      assets: post.assets.filter((a: any) => a.id !== deleteDialog.assetId),
    };

    await mutatePost(optimisticPost, false); // Optimistic update

    try {
      const response = await fetch(`/api/assets/${deleteDialog.assetId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete asset");
      }

      const typeName = deleteDialog.isReference ? "Reference" : "Designer";
      toast.success(`${typeName} asset deleted successfully`);
      await mutatePost(); // Revalidate from server
      router.refresh();
    } catch (error: any) {
      console.error("[PostDetail] Delete error:", error);
      toast.error(error.message || "Failed to delete asset");
      await mutatePost(); // Rollback
    } finally {
      setDeleting(false);
      setDeleteDialog(null);
    }
  };

  const handleStatusChange = async () => {
    if (!statusChangeDialog) return;

    setIsLoading(true);

    const isContent = statusChangeDialog.type === "content";
    const newStatus = statusChangeDialog.status;

    const optimisticPost = {
      ...post,
      [isContent ? "contentStatus" : "status"]: newStatus,
      ...((!isContent && ["APPROVED", "SCHEDULED", "POSTED"].includes(newStatus)) ? { contentStatus: "APPROVED" } : {}),
    };

    await mutatePost(optimisticPost, false); // Optimistic update

    try {
      const body: any = {
        feedback: feedback.trim() || undefined,
      };

      let endpoint = `/api/posts/${post.id}/status`;
      if (statusChangeDialog.type === "post") {
        body.status = statusChangeDialog.status;
        body.action = statusChangeDialog.status;
      } else {
        body.contentStatus = statusChangeDialog.status;
        body.action = `CONTENT_${statusChangeDialog.status}`;
        endpoint = `/api/posts/${post.id}/contentStatus`;
      }

      const dateTime = selectedDate
        ? (selectedDate.includes("T") ? new Date(selectedDate).toISOString() : new Date(selectedDate + "T00:00:00.000Z").toISOString())
        : new Date().toISOString();
      body.updatedAt = dateTime;

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const statusType = statusChangeDialog.type === "post" ? "Post" : "Content";
        toast.success(`${statusType} status updated to ${statusChangeDialog.status}`);

        setStatusChangeDialog(null);
        setSelectedDate("");
        setFeedback("");
        await mutatePost(); // Revalidate
      } else {
        const errorData = await response.json();
        toast.error(`Error updating status: ${errorData.message || "Unknown error"}`);
        await mutatePost(); // Rollback
      }
    } catch (error) {
      console.error("[PostDetail] Error updating status:", error);
      toast.error("Error updating status");
      await mutatePost(); // Rollback
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setIsLoading(true);

    const tempId = Date.now().toString();
    const newComment = {
      id: tempId,
      user: { 
        name: currentUser.name || "You",
        email: currentUser.email || undefined
      },
      content: comment,
      createdAt: new Date().toISOString(),
    };

    const optimisticPost = {
      ...post,
      comments: [newComment, ...post.comments],
    };

    await mutatePost(optimisticPost, false); // Optimistic update

    try {
      const response = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
        body: JSON.stringify({ content: comment }),
      });

      if (response.ok) {
        const { notifiedUsersList, ...addedComment } = await response.json();
        setComment("");
        
        if (notifiedUsersList && notifiedUsersList.length > 0) {
          toast.success(`Comment added & mail sent to: ${notifiedUsersList.join(", ")}`, { duration: 5000 });
        } else {
          toast.success("Comment added successfully");
        }
        
        // Update both local component SWR and global page SWR
        const finalPost = {
          ...post,
          comments: [addedComment, ...post.comments],
        };
        await mutatePost(finalPost, false);
        await globalMutate(`/api/posts/${post.id}`, finalPost, false);
        
        // Force refresh for server
        router.refresh();
      } else {
        const errorData = await response.json();
        toast.error(`Error adding comment: ${errorData.message || "Unknown error"}`);
        await mutatePost(); // Rollback
      }
    } catch (error) {
      console.error("[PostDetail] Error adding comment:", error);
      toast.error("Error adding comment");
      await mutatePost(); // Rollback
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduleUpdate = () => {
    mutatePost(); // Revalidate after schedule
  };

  const getStatusDisplay = (status: string) => {
    if (status === "REJECTED") return "Changes";
    return status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ");
  };

  const getPlatformsDisplay = () => {
    if (!post.platforms) {
      console.warn("[PostDetail] Warning: post.platforms is undefined or null");
      return "No platforms available";
    }
    if (post.platforms.length === 0) {
      console.warn("[PostDetail] Warning: post.platforms is an empty array");
      return "No platforms specified";
    }
    const formattedPlatforms = post.platforms
      .filter((p: any) => p.platform && typeof p.platform === "string")
      .map((p: any) => p.platform.charAt(0).toUpperCase() + p.platform.slice(1).toLowerCase())
      .join(", ");
    if (!formattedPlatforms) {
      console.warn("[PostDetail] Warning: No valid platform names found after filtering");
      return "No valid platforms";
    }
    return formattedPlatforms;
  };

  const approvalFlows = useMemo(
    () => [...post.approvalFlows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [post.approvalFlows]
  );

  const actionCount = useMemo(() => approvalFlows.length, [approvalFlows]);

  const handleAssetClick = (asset: { url: string; filename: string }) => {
    const fileExtension = asset.filename.toLowerCase().split(".").pop() || "";
    setSelectedAsset({
      url: getMediaUrl(asset.url),
      filename: asset.filename,
      type: fileExtension,
    });
  };

  const handleBack = () => {
    if (session?.user?.role === "Designer" || session?.user?.role === "Video Editor") {
      console.log("[PostDetail] Redirecting to /dashboard/tasks for role:", session?.user?.role);
      router.push("/dashboard/tasks");
    } else {
      console.log("[PostDetail] Navigating back or to fallback URL");
      router.back();
      setTimeout(() => {
        if (window.history.state === null) {
          console.log("[PostDetail] No history found, redirecting to fallback URL");
          router.push(`/dashboard/projects/posts?projectId=${post.project.id}`);
        }
      }, 0);
    }
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success(`${label} copied to clipboard`);
    }).catch(() => {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    });
  };

  const handleReplaceFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !replacingAssetId) return;
    
    const file = e.target.files[0];
    const maxFileSize = 500 * 1024 * 1024; // 100MB
    if (file.size > maxFileSize) {
      toast.error("File exceeds 100MB limit");
      return;
    }

    setIsReplacing(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/assets/${replacingAssetId}`, {
        method: "PUT",
        body: formData,
      });
      
      if (!res.ok) throw new Error("Failed to replace asset");
      
      toast.success("Asset replaced successfully");
      
      await mutatePost();
      router.refresh();
    } catch (error) {
      toast.error("Error replacing asset");
    } finally {
      setIsReplacing(false);
      setReplacingAssetId(null);
      if (replaceFileInputRef.current) {
        replaceFileInputRef.current.value = "";
      }
    }
  };

  const renderAssetSection = (assets: typeof post.assets, title: string, icon: React.ReactNode, emptyMessage: string) => {
    if (assets.length === 0) {
      return (
        <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
          {icon}
          <p className="text-sm text-muted-foreground mt-2">{emptyMessage}</p>
        </div>
      );
    }

    const videoExtensions = ["mp4", "mov", "webm", "avi", "mkv"];

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <input
          type="file"
          ref={replaceFileInputRef}
          onChange={handleReplaceFileSelect}
          className="hidden"
          accept="image/*,video/*"
        />
        {assets.map((asset: any) => {
          console.log(`[renderAssetSection] Loading asset: ${asset.url}, Filename: ${asset.filename}`);
          const fileExtension = asset.filename.toLowerCase().split(".").pop() || "";
          const isVideo = videoExtensions.includes(fileExtension);

          return (
            <div
              key={asset.id}
              className="relative group aspect-square bg-muted rounded-lg overflow-hidden border border-border"
            >
              {asset.type === "link" ? (
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 w-full h-full flex flex-col items-center justify-center hover:bg-muted/80 transition-colors p-4"
                >
                  <LinkIcon className="h-10 w-10 text-blue-500 mb-2" />
                  <span className="text-xs text-center font-medium text-blue-600 break-words line-clamp-3">
                    {asset.filename}
                  </span>
                </a>
              ) : (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleAssetClick(asset);
                  }}
                  className="absolute inset-0 w-full h-full flex items-center justify-center"
                >
                  {asset.url && asset.url.trim() ? (
                    <>
                      <img
                        src={isVideo ? VIDEO_THUMBNAIL : `${getMediaUrl(asset.url)}?t=${asset.createdAt ? new Date(asset.createdAt).getTime() : Date.now()}`}
                        alt={asset.filename}
                        className="w-full h-full object-cover rounded-lg"
                        loading="eager"
                        onError={(e) => {
                          e.currentTarget.src = isVideo ? VIDEO_THUMBNAIL : FALLBACK_IMAGE;
                          e.currentTarget.onerror = null;
                        }}
                      />
                      <div className="absolute inset-0 bg-transparent group-hover:bg-black group-hover:bg-opacity-70 transition-opacity rounded-lg flex flex-col items-center justify-center p-2">
                        <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity text-center line-clamp-2 mb-1">
                          {asset.filename}
                        </span>
                        {asset.createdAt && (
                          <span className="text-white/80 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-center">
                            {new Date(asset.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })} {new Date(asset.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <img
                      src={isVideo ? VIDEO_THUMBNAIL : FALLBACK_IMAGE}
                      alt={asset.filename}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  )}
                </button>
              )}

              {/* Overlay Actions */}
              <div className="absolute top-2 right-2 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                <a
                  href={getMediaUrl(asset.url)}
                  download={asset.filename}
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg"
                  title="Download asset"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                {(canDeleteAssets || String(asset.uploadedById) === String(currentUser.id)) && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setReplacingAssetId(asset.id);
                      replaceFileInputRef.current?.click();
                    }}
                    disabled={isReplacing && replacingAssetId === asset.id}
                    className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg"
                    title="Replace asset"
                  >
                    {isReplacing && replacingAssetId === asset.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </button>
                )}
                {(canDeleteAssets || String(asset.uploadedById) === String(currentUser.id)) && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteDialog({ assetId: asset.id, filename: asset.filename, isReference: asset.isReference });
                    }}
                    className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg"
                    title="Delete asset"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add More Tile */}
        <div className="relative group aspect-square bg-muted/50 rounded-lg overflow-hidden border-2 border-dashed border-border hover:bg-muted hover:border-primary/50 transition-colors flex flex-col items-center justify-center cursor-pointer">
          <Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
          <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">Add More</span>
        </div>
      </div>
    );
  };

  const adjustedScheduledAt = post.scheduledAt ? new Date(post.scheduledAt) : null;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-foreground">{post.title}</h1>
              <PostTimingBadge post={post} />
            </div>
            <p className="text-muted-foreground mt-0.5">
              {(post.project.client?.company || "No Client")} • {post.project.name}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex flex-col space-y-1">
            <Badge className={statusColors[post.status as keyof typeof statusColors]}>
              Design: {getStatusDisplay(post.status)}
            </Badge>
            <Badge className={contentStatusColors[post.contentStatus as keyof typeof contentStatusColors]}>
              Content: {getStatusDisplay(post.contentStatus)}
            </Badge>
          </div>
          {canSchedule && (
            <QuickScheduleModal
              postId={post.id}
              currentSchedule={post.scheduledAt ? format(new Date(post.scheduledAt), "yyyy-MM-dd'T'HH:mm") : undefined}
              onScheduleUpdate={handleScheduleUpdate}
            />
          )}
          {canEdit && (
            <Link href={`/dashboard/projects/posts/${post.id}/edit`}>
              <Button variant="outline">Edit Post</Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportLinkOpen(true)}
            className="hidden sm:flex"
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            Share Post
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className={showHistory ? "bg-blue-950/20 text-blue-400 border-blue-900/60" : ""}
            disabled={!session || !can("posts", "read")}
          >
            <History className="h-4 w-4 mr-2" />
            {showHistory ? "Hide" : "Show"} History
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-indigo-100 text-indigo-700 font-bold text-lg flex-shrink-0 border border-border shadow-sm">
                  {post.project.client?.avatar ? (
                    <img 
                      src={post.project.client.avatar} 
                      alt={post.project.client.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    post.project.client?.name ? post.project.client.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase() : "NC"
                  )}
                </div>
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <span>{post.type} Post</span>
                  </CardTitle>
                  <CardDescription>
                    Platforms: {getPlatformsDisplay()}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {post.writeUp && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">Write-Up</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(post.writeUp || "", "Write-Up")}
                      className="h-7 px-2 text-muted-foreground hover:text-foreground transition-all duration-300"
                      title="Copy Write-Up"
                    >
                      {copiedField === "Write-Up" ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1 text-green-500" />
                          <span className="text-xs text-green-500 font-medium">Copied</span>
                        </>
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <div className="mt-1 p-3 bg-muted/50 rounded-md">
                    <div className="text-sm whitespace-pre-wrap">{renderTextWithLinks(post.writeUp)}</div>
                    {(post.referenceUrl || post.customData?.referenceUrl) && (
                      <div className="mt-2">
                        <Label className="text-sm font-medium text-foreground">Reference URL</Label>
                        <a
                          href={(() => {
                            const v1 = post.customData?.referenceUrl;
                            const v2 = post.referenceUrl;
                            let url = [v1, v2].find(v => typeof v === 'string' && (v.startsWith('http') || v.includes('www.')));
                            if (!url) url = [v1, v2].find(v => typeof v === 'string' && !v.includes(' '));
                            url = url || v1 || v2;
                            return url?.match(/^https?:\/\//) ? url : `https://${url}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-500 hover:underline break-all"
                        >
                          {post.customData?.referenceUrl || post.referenceUrl}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Keyword Section */}
              {post.keyword && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">Keyword</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(post.keyword || "", "Keyword")}
                      className="h-7 px-2 text-muted-foreground hover:text-foreground transition-all duration-300"
                      title="Copy Keyword"
                    >
                      {copiedField === "Keyword" ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1 text-green-500" />
                          <span className="text-xs text-green-500 font-medium">Copied</span>
                        </>
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <div className="mt-1 p-3 bg-muted/50 rounded-md">
                    <div className="text-sm whitespace-pre-wrap">{post.keyword}</div>
                  </div>
                </div>
              )}
              {post.caption && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">Caption</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(post.caption || "", "Caption")}
                      className="h-7 px-2 text-muted-foreground hover:text-foreground transition-all duration-300"
                      title="Copy Caption"
                    >
                      {copiedField === "Caption" ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1 text-green-500" />
                          <span className="text-xs text-green-500 font-medium">Copied</span>
                        </>
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <div className="mt-1 p-3 bg-muted/50 rounded-md">
                    <div className="text-sm whitespace-pre-wrap">{renderTextWithLinks(post.caption)}</div>
                  </div>
                </div>
              )}

              {adjustedScheduledAt && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 h-4 w-4" />
                  Posting Date: {format(adjustedScheduledAt, "MMM dd, yyyy")}
                </div>
              )}
              <div className="relative border border-border rounded-lg p-3">
                <input
                  type="file"
                  id="reference-upload"
                  multiple
                  onChange={(e) => handleFileSelect(e, "reference")}
                  className="hidden"
                />
                <label
                  htmlFor="reference-upload"
                  onDragOver={(e) => handleDragOver(e, "reference")}
                  onDragLeave={(e) => handleDragLeave(e, "reference")}
                  onDrop={(e) => handleAssetDrop(e, "reference")}
                  className={`block transition-colors rounded-lg p-3 cursor-pointer mb-3 ${isDraggingRef ? "bg-blue-50 border-2 border-dashed border-blue-400" : ""}`}
                >
                  <div className="flex items-center space-x-2 mb-3">
                    <FileImage className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-foreground">
                      Reference Assets ({referenceAssets.length})
                    </span>
                    <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                      Reference
                    </Badge>
                    {isUploadingRef && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
                  </div>
                  <div>
                    {renderAssetSection(
                      referenceAssets,
                      "Reference Assets",
                      <FileImage className="h-8 w-8 text-muted-foreground mx-auto" />,
                      "No reference assets provided"
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center pointer-events-none">Click or drag & drop files here to upload</p>
                </label>
                
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <Input 
                    placeholder="Or paste an external link (e.g. Google Drive URL)" 
                    value={linkRef}
                    onChange={(e) => setLinkRef(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={() => processLinkUpload(linkRef, "reference")}
                    disabled={!linkRef.trim() || isUploadingRef}
                  >
                    Add Link
                  </Button>
                </div>
              </div>
              <div className="relative border border-border rounded-lg p-3">
                <input
                  type="file"
                  id="designer-upload"
                  multiple
                  onChange={(e) => handleFileSelect(e, "designer")}
                  className="hidden"
                />
                <label
                  htmlFor="designer-upload"
                  onDragOver={(e) => handleDragOver(e, "designer")}
                  onDragLeave={(e) => handleDragLeave(e, "designer")}
                  onDrop={(e) => handleAssetDrop(e, "designer")}
                  className={`block transition-colors rounded-lg p-3 cursor-pointer mb-3 ${isDraggingDes ? "bg-green-50 border-2 border-dashed border-green-400" : ""}`}
                >
                  <div className="flex items-center space-x-2 mb-3 flex-wrap gap-y-1">
                    <Upload className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-foreground">
                      Designer Assets ({designerAssets.length})
                    </span>
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                      Designer Upload
                    </Badge>
                    <PostTimingBadge post={post} />
                    {isUploadingDes && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
                  </div>
                  <div>
                    {renderAssetSection(
                      designerAssets,
                      "Designer Assets",
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto" />,
                      "No assets uploaded by designer yet"
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center pointer-events-none">Click or drag & drop files here to upload</p>
                </label>
                
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <Input 
                    placeholder="Or paste an external link (e.g. Google Drive URL)" 
                    value={linkDes}
                    onChange={(e) => setLinkDes(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={() => processLinkUpload(linkDes, "designer")}
                    disabled={!linkDes.trim() || isUploadingDes}
                  >
                    Add Link
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* {["APPROVED", "SCHEDULED", "POSTED"].includes(post.status) && (
            <PlatformIntegration
              postId={post.id}
              platforms={post.platforms?.map((p: any) => p.platform) || []}
              status={post.status}
            />
          )} */}
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border border-border">
            <CardHeader className="py-2.5 px-4 bg-muted/30 border-b border-border">
              <CardTitle className="text-sm font-semibold text-foreground">Post Information</CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                <div className="flex items-center space-x-2 min-w-0">
                  <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">Created by</p>
                    <p className="font-medium text-foreground/90 truncate">{post.createdBy?.name || "Deleted User"}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 min-w-0">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">Client</p>
                    <p className="font-medium text-foreground/90 truncate">{post.project.client?.company || "No Client"}</p>
                  </div>
                </div>

                {(post.assignedUsers && post.assignedUsers.length > 0) ? (
                  <div className="flex flex-col space-y-2 min-w-0">
                    <div className="flex items-center space-x-2">
                      <UserCheck className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">Assigned to</p>
                    </div>
                    <div className="pl-5 flex flex-wrap gap-1">
                      {post.assignedUsers.map((user: any) => (
                        <span key={user.id} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded border border-blue-200">
                          {user.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : post.assignedTo && (
                  <div className="flex items-center space-x-2 min-w-0">
                    <UserCheck className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">Assigned to</p>
                      <p className="font-medium text-foreground/90 truncate">{post.assignedTo.name}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2 min-w-0">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">Created</p>
                    <p className="font-medium text-foreground/90">{format(new Date(post.createdAt), "MMM dd, yyyy")}</p>
                  </div>
                </div>

                {post.designDueDate && (
                  <div className="flex items-center space-x-2 min-w-0">
                    <Calendar className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-indigo-500 uppercase tracking-wider font-bold">Due Design Date</p>
                      <p className="font-semibold text-indigo-600">{format(new Date(post.designDueDate), "MMM dd, yyyy")}</p>
                    </div>
                  </div>
                )}

                {post.scheduledAt && (
                  <div className="flex items-center space-x-2 min-w-0">
                    <Calendar className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-bold">Posting Date</p>
                      <p className="font-semibold text-emerald-700">{format(new Date(post.scheduledAt), "MMM dd, yyyy")}</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator className="my-1.5" />

              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Asset Summary</p>
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <FileImage className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                    <span className="text-muted-foreground font-medium">Reference: <strong className="text-foreground">{referenceAssets.length}</strong></span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Upload className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    <span className="text-muted-foreground font-medium">Designer: <strong className="text-foreground">{designerAssets.length}</strong></span>
                  </div>
                </div>
              </div>

              {additionalNotes && (
                <>
                  <Separator className="my-1.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Additional Notes</p>
                    <div className="p-2 bg-muted/40 rounded border border-border/50 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-[150px] overflow-y-auto">
                      {renderTextWithLinks(additionalNotes)}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col h-[600px]">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border flex-shrink-0">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center">
                <MessageSquare className="mr-2 h-4 w-4 text-indigo-500" />
                Comments ({post.comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 min-h-0 p-3">
              {/* Comments list takes up flex-1 and scrolls */}
              <div className="flex-1 space-y-3.5 overflow-y-auto pr-1 mb-3">
                {sortedComments.map((comment) => {
                  const isSelf = 
                    (currentUser.email && comment.user?.email === currentUser.email) || 
                    (comment.user?.name === currentUser.name) ||
                    (comment.user?.name === "You");

                  const canModifyComment = isSelf || currentUser.role === "ADMIN" || currentUser.role === "Manager";

                  return (
                    <div 
                      key={comment.id} 
                      className={`flex items-start space-x-2.5 ${isSelf ? 'flex-row-reverse space-x-reverse' : ''}`}
                    >
                      <Avatar className="h-7 w-7 border border-border shadow-sm flex-shrink-0">
                        <AvatarFallback className={`text-[10px] font-bold ${
                          isSelf 
                            ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white' 
                            : comment.authorRole === 'Client'
                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                            : 'bg-gradient-to-br from-gray-500 to-gray-600 text-white'
                        }`}>
                          {comment.authorName ? comment.authorName.charAt(0).toUpperCase() : comment.user?.name ? comment.user.name.charAt(0).toUpperCase() : 'C'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className={`flex flex-col max-w-[85%] ${isSelf ? 'items-end' : 'items-start'}`}>
                        {/* Bubble */}
                        <div className={`rounded-2xl px-3 py-2 shadow-sm border ${
                          isSelf 
                            ? 'bg-indigo-600 border-indigo-700 text-white rounded-tr-none' 
                            : 'bg-muted border-border text-foreground rounded-tl-none'
                        }`}>
                          {/* Header info */}
                          <div className={`flex items-center space-x-1.5 mb-1.5 flex-wrap gap-y-0.5 ${
                            isSelf ? 'flex-row-reverse space-x-reverse' : ''
                          }`}>
                            <span className={`text-[11px] font-semibold ${isSelf ? 'text-indigo-50' : 'text-foreground'}`}>
                              {isSelf ? 'You' : (comment.authorName || comment.user?.name || 'Client')}
                            </span>
                            {comment.authorRole && (
                              <Badge 
                                variant="outline" 
                                className="text-[8px] px-1 py-0.1 rounded-full font-bold bg-emerald-100 text-emerald-800 border-emerald-300"
                              >
                                {comment.authorRole}
                              </Badge>
                            )}
                            {comment.type && (
                              <Badge 
                                variant="outline" 
                                className={`text-[8px] px-1 py-0.1 rounded-full font-medium ${
                                  isSelf
                                    ? 'bg-indigo-500/40 text-indigo-100 border-indigo-400/50'
                                    : comment.type === 'DESIGN' 
                                    ? 'bg-blue-95/30 text-blue-400 border-blue-900/60' 
                                    : comment.type === 'CONTENT'
                                    ? 'bg-purple-95/30 text-purple-400 border-purple-900/60'
                                    : 'bg-amber-95/30 text-amber-400 border-amber-900/60'
                                }`}
                              >
                                {comment.type}
                              </Badge>
                            )}

                            {canModifyComment && editingCommentId !== comment.id && (
                              <div className={`flex items-center space-x-1 ${isSelf ? 'mr-auto' : 'ml-auto'}`}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEditComment(comment);
                                  }}
                                  className={`p-0.5 rounded hover:bg-black/10 transition-colors ${
                                    isSelf ? 'text-indigo-100 hover:text-white' : 'text-muted-foreground hover:text-foreground'
                                  }`}
                                  title="Edit comment"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingCommentId(comment.id);
                                  }}
                                  className={`p-0.5 rounded hover:bg-black/10 transition-colors ${
                                    isSelf ? 'text-indigo-200 hover:text-red-200' : 'text-muted-foreground hover:text-red-600'
                                  }`}
                                  title="Delete comment"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {comment.id === latestRejectionComment?.id && latestEditedAsset && (
                            <div className="mt-1.5 mb-1.5 max-w-[200px] relative group">
                              <button
                                onClick={() => handleAssetClick(latestEditedAsset)}
                                className="relative rounded-lg overflow-hidden border border-border shadow-sm hover:opacity-95 transition-all w-full"
                              >
                                <img
                                  src={getMediaUrl(latestEditedAsset.url)}
                                  alt={latestEditedAsset.filename}
                                  className="w-full h-auto max-h-[140px] object-cover rounded-lg"
                                  onError={(e) => {
                                    e.currentTarget.src = FALLBACK_IMAGE;
                                  }}
                                />
                                <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">
                                  View Image
                                </div>
                              </button>
                              
                              {canDeleteAssets && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteDialog({ assetId: latestEditedAsset.id, filename: latestEditedAsset.filename, isReference: false });
                                  }}
                                  className="absolute top-1 right-1 p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Delete marked image"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                          
                          {comment.id === latestRejectionComment?.id && latestAudioAttachment && (
                            <div className="mt-1.5 mb-1.5 max-w-xs">
                              <audio
                                controls
                                src={getMediaUrl(latestAudioAttachment.url)}
                                className="w-full h-7 rounded-lg"
                                style={{ maxHeight: "28px" }}
                              />
                            </div>
                          )}
                          
                          {editingCommentId === comment.id ? (
                            <div className="mt-1 space-y-1.5 min-w-[200px]">
                              <Textarea
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                className="text-xs min-h-[50px] bg-background text-foreground border border-input rounded-md p-1.5"
                                placeholder="Edit comment..."
                                autoFocus
                              />
                              <div className="flex items-center space-x-1 justify-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEditComment}
                                  className="h-5 px-1.5 text-[10px]"
                                  disabled={isUpdatingComment}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleSaveEditComment(comment.id)}
                                  className="h-5 px-2 text-[10px] bg-indigo-500 hover:bg-indigo-600 text-white"
                                  disabled={isUpdatingComment || !editingCommentText.trim()}
                                >
                                  {isUpdatingComment ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            renderCommentContent(comment.content, isSelf)
                          )}
                        </div>
                        
                        <span className="text-[9px] text-muted-foreground font-medium mt-1 px-1">
                          {format(new Date(comment.createdAt), "MMM dd, HH:mm")}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {post.comments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No comments yet. Be the first to add feedback!
                  </p>
                )}
                <div ref={commentsEndRef} />
              </div>

              <Separator className="mb-3 flex-shrink-0" />

              {/* WhatsApp style Comment Input Box */}
              <form onSubmit={handleAddComment} className="flex items-center space-x-2 bg-muted p-2 rounded-xl border border-border shadow-sm flex-shrink-0">
                {isRecordingComment ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-2 text-red-600 animate-pulse text-xs font-semibold">
                      <div className="h-2 w-2 rounded-full bg-red-600"></div>
                      <span>Recording ({formatCommentTime(recordingCommentTime)})</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => stopRecordingComment(false)}
                        className="h-8 w-8 text-red-500 hover:text-red-650 hover:bg-red-950/20 rounded-full"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="icon"
                        onClick={() => stopRecordingComment(true)}
                        className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white rounded-full"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={startRecordingComment}
                      disabled={isLoading}
                      className="h-9 w-9 text-muted-foreground hover:text-indigo-400 hover:bg-muted rounded-full flex-shrink-0"
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                    
                    <textarea
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = (e.target.scrollHeight) + 'px';
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (comment.trim() && !isLoading) {
                            handleAddComment(e as any);
                          }
                        }
                      }}
                      placeholder="Add a comment..."
                      disabled={isLoading}
                      rows={1}
                      className="flex-1 bg-transparent border-0 outline-none text-xs text-foreground placeholder-muted-foreground focus:ring-0 focus:outline-none min-w-0 resize-none py-1.5"
                      style={{ maxHeight: '120px' }}
                    />
                    
                    <Button 
                      type="submit" 
                      size="icon" 
                      disabled={isLoading || !comment.trim()}
                      className="h-9 w-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex-shrink-0 transition-all shadow-sm flex items-center justify-center"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {showHistory && (
        <Card className="border border-blue-900/60 bg-gradient-to-br from-blue-950/20 to-indigo-950/20">
          <CardHeader className="bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border-b border-blue-900/60">
            <CardTitle className="text-lg flex items-center text-blue-400">
              <History className="mr-2 h-5 w-5" />
              Approval Flow Timeline
            </CardTitle>
            <CardDescription className="text-blue-300/80">
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="bg-card/70">
                  {actionCount} {actionCount === 1 ? "Event" : "Events"}
                </Badge>
                <span className="text-xs">Complete workflow history</span>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {approvalFlows.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-card/60 rounded-full p-4 inline-block mb-3">
                    <History className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No approval flows recorded yet</p>
                  <p className="text-xs text-muted-foreground/80 mt-1">
                    History will appear here as the post progresses through workflow stages
                  </p>
                </div>
              ) : (
                <>
                  {approvalFlows.map((flow, index) => {
                    const historyEntry = flow.history[0] || {};
                    const user = flow.reviewedBy || flow.submittedBy || { name: "System", roleId: 0 };
                    const sortedAudioAttachments = flow.attachments
                      .filter((attachment: any) => attachment.mimeType.startsWith("audio/"))
                      .sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

                    const getStatusIcon = () => {
                      switch (flow.status) {
                        case "APPROVED":
                          return <CheckCircle className="h-5 w-5 text-green-600" />;
                        case "REJECTED":
                          return <XCircle className="h-5 w-5 text-red-600" />;
                        case "SUBMITTED":
                          return <Send className="h-5 w-5 text-blue-600" />;
                        case "RESUBMITTED":
                          return <Send className="h-5 w-5 text-orange-600" />;
                        default:
                          return <Clock className="h-5 w-5 text-gray-600" />;
                      }
                    };

                    const getCardStyle = () => {
                      if (flow.flowType === "CONTENT") {
                        return "border-l-4 border-purple-500 bg-card hover:bg-muted shadow-sm border border-border";
                      }
                      switch (flow.status) {
                        case "SUBMITTED":
                        case "RESUBMITTED":
                          return "border-l-4 border-blue-500 bg-card hover:bg-muted shadow-sm border border-border";
                        case "APPROVED":
                          return "border-l-4 border-green-500 bg-card hover:bg-muted shadow-sm border border-border";
                        case "REJECTED":
                          return "border-l-4 border-red-500 bg-card hover:bg-muted shadow-sm border border-border";
                        default:
                          return "border-l-4 border-gray-500 bg-card hover:bg-muted shadow-sm border border-border";
                      }
                    };

                    const getStatusBadge = () => {
                      const baseClass = "text-xs font-medium px-2 py-0.5 rounded-full";
                      if (flow.flowType === "CONTENT") {
                        return (
                          <Badge className={`${baseClass} bg-purple-100 text-purple-700 border-purple-300`}>Content</Badge>
                        );
                      }
                      switch (flow.status) {
                        case "APPROVED":
                          return (
                            <Badge className={`${baseClass} bg-green-100 text-green-700 border-green-300`}>I Approve</Badge>
                          );
                        case "C_APPROVED":
                          return (
                            <Badge className={`${baseClass} bg-emerald-100 text-emerald-700 border-emerald-300`}>C Approve</Badge>
                          );
                        case "REJECTED":
                          return (
                            <Badge className={`${baseClass} bg-red-100 text-red-700 border-red-300`}>Changes</Badge>
                          );
                        case "SUBMITTED":
                          return (
                            <Badge className={`${baseClass} bg-blue-100 text-blue-700 border-blue-300`}>Submitted</Badge>
                          );
                        case "RESUBMITTED":
                          return (
                            <Badge className={`${baseClass} bg-orange-100 text-orange-700 border-orange-300`}>
                              Resubmitted
                            </Badge>
                          );
                        default:
                          return (
                            <Badge className={`${baseClass} bg-gray-100 text-gray-700 border-gray-300`}>{flow.status}</Badge>
                          );
                      }
                    };

                    return (
                      <div key={flow.id} className="relative">
                        {index < approvalFlows.length - 1 && (
                          <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 to-transparent -mb-3" />
                        )}
                        <div className={`${getCardStyle()} rounded-lg p-4 transition-all duration-200`}>
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">{getStatusIcon()}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Avatar className="h-7 w-7">
                                    <AvatarFallback className="text-xs bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
                                      {user.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-semibold text-foreground">{user.name}</span>
                                  {getStatusBadge()}
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(flow.createdAt), "MMM dd, HH:mm")}
                                </span>
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm text-foreground">
                                  <span className="font-medium">{flow.flowType}</span>
                                  {historyEntry.fromStatus && (
                                    <>
                                      : <span className="text-muted-foreground">{historyEntry.fromStatus}</span>
                                      <span className="mx-1 text-muted-foreground/80">→</span>
                                      <span className="font-medium text-foreground">{historyEntry.toStatus || flow.status}</span>
                                    </>
                                  )}
                                </p>
                                {(flow.feedback || flow.rejectionReason || latestEditedAsset || sortedAudioAttachments.length > 0) && (
                                  <div className="bg-muted/50 rounded p-2 border border-border">
                                    {index === 0 && (flow.status === "REJECTED" || flow.status === "APPROVED") && latestEditedAsset && (
                                      <div className="mb-2">
                                        <button
                                          onClick={() => handleAssetClick(latestEditedAsset)}
                                          className="w-full rounded-lg shadow-md object-cover"
                                        >
                                          <img
                                            src={getMediaUrl(latestEditedAsset.url)}
                                            alt={latestEditedAsset.filename}
                                            className="w-full h-auto rounded-lg"
                                            onError={(e) => {
                                              e.currentTarget.src = FALLBACK_IMAGE;
                                            }}
                                          />
                                        </button>
                                      </div>
                                    )}
                                    {(flow.feedback || flow.rejectionReason) && (
                                      <p className="text-xs text-muted-foreground italic">"{flow.feedback || flow.rejectionReason}"</p>
                                    )}
                                    {sortedAudioAttachments.length > 0 && (
                                      <div className="mt-2 space-y-3">
                                        <div className="flex items-center gap-1 text-xs font-medium text-foreground mb-1">
                                          <MessageSquare className="h-3 w-3" />
                                          <span>Audio Feedbacks ({sortedAudioAttachments.length})</span>
                                        </div>
                                        {sortedAudioAttachments.map((attachment: any) => (
                                          <div key={attachment.id} className="bg-gradient-to-r from-blue-95/20 to-indigo-95/20 rounded-lg p-3 border border-blue-900/60">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-xs font-medium text-foreground">{attachment.filename}</span>
                                              <span className="text-xs text-muted-foreground">{(attachment.size / 1024).toFixed(1)} KB</span>
                                            </div>
                                            <audio
                                              controls
                                              src={attachment.url}
                                              className="w-full h-8"
                                              style={{ maxHeight: "32px" }}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {flow.submissionCount > 1 && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>Submission #{flow.submissionCount} · Version {flow.version}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Are you sure you want to delete <strong>{deleteDialog?.filename}</strong>?<br />
            This action <strong>cannot be undone</strong>.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAsset} 
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STATUS CHANGE DIALOG */}
      <Dialog open={!!statusChangeDialog} onOpenChange={() => setStatusChangeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{statusChangeDialog?.type === "post" ? "Change Post Status" : "Change Content Status"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="status-date">Date & Time</Label>
              <Input
                id="status-date"
                type="datetime-local"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="feedback">
                {statusChangeDialog?.type === "post" ? "Change Design Status" : "Change Content Status"}
              </Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Why and what changes are done"
                className="mt-1"
                rows={3}
                required
              />
            </div>
            <div className="bg-blue-95/30 p-3 rounded-lg border border-blue-900/60">
              <p className="text-sm text-blue-400">
                <strong>Status will be changed to:</strong> {statusChangeDialog?.status}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusChangeDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleStatusChange} disabled={isLoading || !selectedDate || !feedback.trim()}>
              {isLoading ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE COMMENT CONFIRMATION DIALOG */}
      <Dialog open={deletingCommentId !== null} onOpenChange={() => setDeletingCommentId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Delete Comment</DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-xs text-muted-foreground">
            Are you sure you want to delete this comment? This action <strong>cannot be undone</strong>.
          </DialogDescription>
          <DialogFooter className="mt-4 flex space-x-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setDeletingCommentId(null)} disabled={isDeletingComment}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deletingCommentId && handleDeleteComment(deletingCommentId)}
              disabled={isDeletingComment}
            >
              {isDeletingComment ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPopup
        isOpen={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
        asset={selectedAsset}
      />

      {post.project && (
        <ExportLinkDialog
          isOpen={exportLinkOpen}
          onClose={() => setExportLinkOpen(false)}
          projectId={post.project.id}
          projectName={post.project.name}
          postIds={[post.id]}
        />
      )}
    </div>
  );
}
