"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  MessageSquare,
  Maximize2,
  Send,
  Video,
  Image as ImageIcon,
  Layers,
  FileText,
  Hash,
  Share2,
  Pin,
} from "lucide-react"
import { getMediaUrl } from "@/lib/utils"
import { toast } from "sonner"
import ImageModal from "@/components/ImageModal"
import RejectDialog from "@/components/posts/rejectDialog"
import { ProofingApprovalDialog } from "@/components/approvals/proofing-approval-dialog"

export interface Asset {
  id: string
  url: string
  filename: string
  type?: string | null
  size?: number | null
  isReference?: boolean
  isEdited?: boolean
}

export interface Comment {
  id: string
  content: string
  createdAt: string
  authorName?: string | null
  authorRole?: string | null
  type?: string | null
}

export interface PostDetailData {
  id: string
  title: string
  caption?: string | null
  writeUp?: string | null
  keyword?: string | null
  type: string
  status: string
  contentStatus?: string | null
  scheduledAt?: string | null
  notes?: string | null
  approvedAt?: string | null
  rejectedAt?: string | null
  assets: Asset[]
  platforms: string[]
  comments?: Comment[]
}

export interface ProjectMetadata {
  name: string
  description?: string | null
  clientName?: string
  clientCompany?: string | null
  clientAvatar?: string | null
  month?: number | null
  year?: number | null
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

const renderTextWithLinks = (text: string | null | undefined) => {
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

export function CustomerPostDetailView({
  post: initialPost,
  project,
  token,
}: {
  post: PostDetailData
  project: ProjectMetadata
  token: string
}) {
  const router = useRouter()
  const [post, setPost] = useState<PostDetailData>(initialPost)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [imageModal, setImageModal] = useState<{
    src: string
    alt: string
    postId: string
    assetId?: string
  } | null>(null)
  const [proofingOpen, setProofingOpen] = useState(false)
  const [isConfirmApproveOpen, setIsConfirmApproveOpen] = useState(false)
  const [statusRejectDialog, setStatusRejectDialog] = useState<{
    postId: string
    statusType?: "content" | "design"
    targetStatus?: string
  } | null>(null)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [newCommentText, setNewCommentText] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  const [copiedCaption, setCopiedCaption] = useState(false)
  const [copiedWriteUp, setCopiedWriteUp] = useState(false)
  const [copiedHashtags, setCopiedHashtags] = useState(false)

  // Dynamically resolve back path: use '/:token' on subdomain, '/share/:token' or '/confirm/:token' on main domain
  const [backPath, setBackPath] = useState(`/share/${token}`)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = window.location.pathname
      if (p.startsWith("/share")) {
        setBackPath(`/share/${token}`)
      } else if (p.startsWith("/confirm")) {
        setBackPath(`/confirm/${token}`)
      } else {
        setBackPath(`/${token}`)
      }
    }
  }, [token])

  const handleOpenImageModal = (url: string, filename: string, postId: string, assetId?: string) => {
    setImageModal({ src: url, alt: filename, postId, assetId })
  }

  // Prioritize finished deliverables (non-reference assets) if available
  const displayAssets = post.assets.filter((a) => !a.isReference)
  const assetsToUse = displayAssets.length > 0 ? displayAssets : post.assets
  const currentAsset = assetsToUse[currentSlideIndex] || assetsToUse[0]
  const mediaUrl = currentAsset ? getMediaUrl(currentAsset.url) : null

  const isVideo =
    currentAsset &&
    (currentAsset.type?.toLowerCase().includes("video") ||
      currentAsset.filename?.match(/\.(mp4|mov|webm)$/i))

  const isApproved = post.status === "C_APPROVED" || post.contentStatus === "C_APPROVED"
  const isRejected = post.status === "REJECTED"

  const clientDisplayName = project.clientCompany || project.clientName || "Valued Client"
  const monthYearLabel = project.month && project.year ? `${MONTH_NAMES[project.month]} ${project.year}` : null

  const scheduledDateObj = post.scheduledAt ? new Date(post.scheduledAt) : null
  const formattedScheduledDate = scheduledDateObj
    ? scheduledDateObj.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Date pending"

  const formattedScheduledTime = scheduledDateObj
    ? scheduledDateObj.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  // Extract hashtags from caption or writeUp
  const combinedText = `${post.caption || ""} ${post.writeUp || ""}`
  const hashtagMatches = combinedText.match(/#[a-zA-Z0-9_\p{L}]+/gu)
  const uniqueHashtags = hashtagMatches ? Array.from(new Set(hashtagMatches)) : []

  const handleCopy = (text: string, type: "caption" | "writeup" | "hashtags") => {
    navigator.clipboard.writeText(text)
    if (type === "caption") {
      setCopiedCaption(true)
      toast.success("Caption copied to clipboard")
      setTimeout(() => setCopiedCaption(false), 2000)
    } else if (type === "writeup") {
      setCopiedWriteUp(true)
      toast.success("Write-up copied to clipboard")
      setTimeout(() => setCopiedWriteUp(false), 2000)
    } else {
      setCopiedHashtags(true)
      toast.success("Hashtags copied to clipboard")
      setTimeout(() => setCopiedHashtags(false), 2000)
    }
  }

  // ==========================================
  // ACTION: APPROVE POST
  // ==========================================
  const handleApprovePost = async () => {
    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPROVE_POST",
          postId: post.id,
          name: clientDisplayName,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to approve post")

      toast.success("✓ Post Approved Successfully")

      setPost((prev) => ({
        ...prev,
        status: "C_APPROVED",
        contentStatus: "C_APPROVED",
        approvedAt: json.post?.approvedAt || new Date().toISOString(),
      }))

      setIsConfirmApproveOpen(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to approve post")
    } finally {
      setIsActionLoading(false)
    }
  }

  // ==========================================
  // ACTION: REQUEST CHANGES
  // ==========================================
  const handleCustomerRequestChanges = async (
    targetId: string,
    feedbackText: string,
    audioBlob: Blob | null
  ) => {
    setIsActionLoading(true)
    try {
      let res: Response
      if (audioBlob) {
        const formData = new FormData()
        formData.append("action", "REQUEST_CHANGES_POST")
        formData.append("postId", targetId)
        formData.append("feedback", feedbackText)
        formData.append("name", clientDisplayName)
        formData.append("audio", audioBlob, "feedback-audio.webm")

        res = await fetch(`/api/share/${token}`, {
          method: "POST",
          body: formData,
        })
      } else {
        res = await fetch(`/api/share/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "REQUEST_CHANGES_POST",
            postId: targetId,
            feedback: feedbackText,
            name: clientDisplayName,
          }),
        })
      }

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to submit change request")

      toast.success("Changes requested. Our team has received your feedback.")

      setPost((prev) => ({
        ...prev,
        status: "REJECTED",
        rejectedAt: json.post?.rejectedAt || new Date().toISOString(),
        comments: json.comment ? [...(prev.comments || []), json.comment] : prev.comments,
      }))

      setStatusRejectDialog(null)
    } catch (err: any) {
      toast.error(err.message || "Failed to submit change request")
      throw err
    } finally {
      setIsActionLoading(false)
    }
  }

  // ==========================================
  // ACTION: ADD COMMENT
  // ==========================================
  const handleAddComment = async () => {
    if (!newCommentText.trim()) return

    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_COMMENT",
          postId: post.id,
          content: newCommentText.trim(),
          name: clientDisplayName,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to add comment")

      toast.success("Feedback sent to the team")

      setPost((prev) => ({
        ...prev,
        comments: json.comment ? [...(prev.comments || []), json.comment] : prev.comments,
      }))

      setNewCommentText("")
    } catch (err: any) {
      toast.error(err.message || "Failed to add comment")
    } finally {
      setSubmittingComment(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case "REEL":
      case "VIDEO":
        return <Video className="w-3.5 h-3.5 text-purple-600" />
      case "CAROUSEL":
        return <Layers className="w-3.5 h-3.5 text-indigo-600" />
      case "STORY":
        return <Clock className="w-3.5 h-3.5 text-amber-600" />
      case "BLOG":
        return <FileText className="w-3.5 h-3.5 text-cyan-600" />
      default:
        return <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 pb-36 lg:pb-24 font-sans antialiased">
      {/* ========================================================
          1. NAVIGATION & BRANDING HEADER
         ======================================================== */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex items-center justify-between gap-4">
            {/* Back Button to Post Listing */}
            <Link
              href={backPath}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3.5 py-2 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to All Posts</span>
            </Link>

            {/* Client & Month Review Context */}
            <div className="text-right">
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                {clientDisplayName}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {monthYearLabel ? `${monthYearLabel} ` : ""}Content Review
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================
          2. MAIN CONTENT (RESPONSIVE: MOBILE STACK / DESKTOP 2-COL)
         ======================================================== */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        {/* Post Title, Type, Date & Approval Status Bar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="bg-slate-100 text-slate-800 border-slate-200 text-[11px] uppercase font-bold tracking-wide px-2.5 py-0.5"
              >
                <span className="mr-1">{getTypeIcon(post.type)}</span>
                {post.type}
              </Badge>
              <span className="text-slate-300">•</span>
              <span className="text-xs sm:text-sm font-medium text-slate-600 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formattedScheduledDate}
              </span>
              {formattedScheduledTime && (
                <span className="text-xs text-slate-400">at {formattedScheduledTime}</span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
              {post.title}
            </h1>
          </div>

          {/* Current Approval Status Badge */}
          <div className="self-start sm:self-center shrink-0">
            {isApproved ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs sm:text-sm font-semibold px-4 py-1.5 rounded-full shadow-2xs">
                <Check className="w-4 h-4 mr-1.5 text-emerald-600" />
                Approved by You
              </Badge>
            ) : isRejected ? (
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs sm:text-sm font-semibold px-4 py-1.5 rounded-full shadow-2xs">
                <AlertCircle className="w-4 h-4 mr-1.5 text-amber-600" />
                Changes Requested
              </Badge>
            ) : (
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs sm:text-sm font-semibold px-4 py-1.5 rounded-full shadow-2xs">
                <Clock className="w-4 h-4 mr-1.5 text-blue-600" />
                Awaiting Your Approval
              </Badge>
            )}
          </div>
        </div>

        {/* 2-Column Desktop Grid / Vertical Mobile Flow */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ========================================================
              LEFT COLUMN: LARGE MEDIA SHOWCASE (6/12 cols)
             ======================================================== */}
          <div className="lg:col-span-6 bg-slate-950 rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-center space-y-4 border border-slate-900 shadow-sm overflow-hidden">
            {/* Media Container */}
            <div className="relative w-full aspect-square max-h-[520px] flex items-center justify-center rounded-xl overflow-hidden bg-black/40">
              {mediaUrl ? (
                isVideo ? (
                  <video
                    src={mediaUrl}
                    controls
                    playsInline
                    className="max-h-full w-full object-contain"
                  />
                ) : (
                  <div
                    onClick={() =>
                      handleOpenImageModal(
                        mediaUrl,
                        currentAsset?.filename || post.title,
                        post.id,
                        currentAsset?.id
                      )
                    }
                    className="relative cursor-pointer group/media w-full h-full flex items-center justify-center overflow-hidden"
                    title="Click to view full-screen"
                  >
                    <img
                      src={mediaUrl}
                      alt={currentAsset?.filename || post.title}
                      className="max-h-[500px] max-w-full object-contain transition-transform duration-300 group-hover/media:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/25 transition-colors flex items-center justify-center opacity-0 group-hover/media:opacity-100 pointer-events-none">
                      <span className="bg-black/80 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full flex items-center gap-1.5 shadow-lg font-medium">
                        <Maximize2 className="w-3.5 h-3.5" /> Fullscreen Viewer
                      </span>
                    </div>
                  </div>
                )
              ) : (
                <div className="text-slate-500 text-center p-8 flex flex-col items-center gap-2">
                  <ImageIcon className="w-10 h-10 opacity-30" />
                  <span className="text-xs">No media preview available</span>
                </div>
              )}

              {/* Carousel Slide Switcher */}
              {assetsToUse.length > 1 && !isVideo && (
                <>
                  <button
                    onClick={() =>
                      setCurrentSlideIndex((prev) =>
                        prev > 0 ? prev - 1 : assetsToUse.length - 1
                      )
                    }
                    aria-label="Previous slide"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-all shadow-md"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentSlideIndex((prev) =>
                        prev < assetsToUse.length - 1 ? prev + 1 : 0
                      )
                    }
                    aria-label="Next slide"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-all shadow-md"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white text-[11px] px-3.5 py-1 rounded-full font-medium">
                    Slide {currentSlideIndex + 1} of {assetsToUse.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail Strip for Carousels */}
            {assetsToUse.length > 1 && !isVideo && (
              <div className="flex items-center gap-2 max-w-full overflow-x-auto pb-1 px-1">
                {assetsToUse.map((asset, idx) => (
                  <button
                    key={asset.id}
                    onClick={() => setCurrentSlideIndex(idx)}
                    className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                      currentSlideIndex === idx
                        ? "border-blue-500 scale-105"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={getMediaUrl(asset.url)}
                      alt={asset.filename}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Visual Proofing & Fullscreen Buttons */}
            {mediaUrl && !isVideo && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setProofingOpen(true)}
                  className="text-xs bg-white text-slate-900 hover:bg-slate-100 font-semibold rounded-xl"
                >
                  <Pin className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  Visual Proofing & Pin Comments
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleOpenImageModal(
                      mediaUrl,
                      currentAsset?.filename || post.title,
                      post.id,
                      currentAsset?.id
                    )
                  }
                  className="text-xs text-slate-300 hover:text-white hover:bg-white/10 rounded-xl"
                >
                  <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
                  Fullscreen
                </Button>
              </div>
            )}
          </div>

          {/* ========================================================
              RIGHT COLUMN: POST DETAILS & FEEDBACK (6/12 cols)
             ======================================================== */}
          <div className="lg:col-span-6 space-y-6">
            {/* Section A: Publishing & Platform Information */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Publishing Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="text-xs text-slate-500 block">Target Platforms</span>
                  {post.platforms.length > 0 ? (
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {post.platforms.map((p) => (
                        <Badge
                          key={p}
                          variant="secondary"
                          className="bg-slate-100 text-slate-800 text-xs font-semibold capitalize px-2.5 py-0.5"
                        >
                          {p.toLowerCase()}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 mt-1 block">General Social</span>
                  )}
                </div>

                <div>
                  <span className="text-xs text-slate-500 block">Scheduled Publishing Date</span>
                  <div className="text-xs sm:text-sm font-semibold text-slate-800 mt-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formattedScheduledDate}</span>
                    {formattedScheduledTime && (
                      <span className="text-slate-400 font-normal">({formattedScheduledTime})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section B: Post Content / Write-Up (if available) */}
            {post.writeUp && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Post Content / Write-Up
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(post.writeUp!, "writeup")}
                    className="h-7 text-xs text-slate-600 hover:text-slate-900 px-2"
                  >
                    {copiedWriteUp ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copy Write-Up
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                  {renderTextWithLinks(post.writeUp)}
                </div>
              </div>
            )}

            {/* Section: Keyword */}
            {post.keyword && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Keyword
                  </h2>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                  {post.keyword}
                </div>
              </div>
            )}

            {/* Section C: Complete Caption */}
            {post.caption && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Caption
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(post.caption!, "caption")}
                    className="h-7 text-xs text-slate-600 hover:text-slate-900 px-2"
                  >
                    {copiedCaption ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copy Caption
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                  {post.caption}
                </div>
              </div>
            )}

            {/* Section D: Dedicated Hashtags Block */}
            {uniqueHashtags.length > 0 && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-blue-600" />
                    Hashtags ({uniqueHashtags.length})
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(uniqueHashtags.join(" "), "hashtags")}
                    className="h-7 text-xs text-slate-600 hover:text-slate-900 px-2"
                  >
                    {copiedHashtags ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copy All Hashtags
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {uniqueHashtags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-blue-50/80 text-blue-700 border border-blue-200/70 text-xs px-2.5 py-1 rounded-lg font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Section E: WhatsApp-Style Review & Feedback Stream */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                Customer Feedback & Discussion ({post.comments?.length || 0})
              </h2>

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {post.comments && post.comments.length > 0 ? (
                  post.comments.map((comment) => {
                    const isSelf = comment.authorRole === "Client"
                    return (
                      <div
                        key={comment.id}
                        className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`p-3 rounded-2xl text-xs max-w-[88%] border shadow-2xs ${
                            isSelf
                              ? "bg-blue-600 text-white border-blue-500 rounded-br-xs"
                              : "bg-slate-50 text-slate-800 border-slate-200 rounded-bl-xs"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1 justify-between">
                            <span className={`font-semibold text-[11px] ${isSelf ? "text-blue-100" : "text-slate-700"}`}>
                              {isSelf ? "You" : comment.authorName || "Creative Team"}
                            </span>
                            <span className={`text-[10px] ${isSelf ? "text-blue-200" : "text-slate-400"}`}>
                              {new Date(comment.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          {/* Comment Content + Inline Voice Player */}
                          {(() => {
                            const audioRegex = /\[AUDIO:(.*?)\]/
                            const match = comment.content.match(audioRegex)
                            if (match) {
                              const audioUrl = match[1]
                              const text = comment.content.replace(audioRegex, "").trim()
                              return (
                                <div className="space-y-2">
                                  {text && (
                                    <p className={`whitespace-pre-wrap leading-relaxed ${isSelf ? "text-white" : "text-slate-800"}`}>
                                      {text}
                                    </p>
                                  )}
                                  <div className="pt-1">
                                    <audio
                                      controls
                                      src={audioUrl}
                                      className="w-full h-8 rounded-lg"
                                      style={{ maxHeight: "32px" }}
                                    />
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <p className={`whitespace-pre-wrap leading-relaxed ${isSelf ? "text-white" : "text-slate-800"}`}>
                                {comment.content}
                              </p>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">
                    No feedback or comments on this post yet.
                  </p>
                )}
              </div>

              {/* Add Feedback Comment Input */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <textarea
                  placeholder="Add a feedback note for the team..."
                  value={newCommentText}
                  onChange={(e) => {
                    setNewCommentText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = (e.target.scrollHeight) + 'px';
                  }}
                  className="flex-1 text-xs rounded-xl border border-slate-200 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400 resize-none min-h-[36px]"
                  style={{ maxHeight: '120px' }}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      if (!submittingComment && newCommentText.trim()) {
                        handleAddComment()
                      }
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={submittingComment || !newCommentText.trim()}
                  className="h-9 px-3.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Desktop Review Action Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3 hidden sm:block">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Content Review Actions
              </h2>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatusRejectDialog({
                      postId: post.id,
                      statusType: "design",
                      targetStatus: "REJECTED",
                    })
                  }}
                  disabled={isActionLoading}
                  className="flex-1 h-10 text-xs font-semibold border-amber-300 text-amber-900 hover:bg-amber-50 rounded-xl"
                >
                  <MessageSquare className="w-4 h-4 mr-1.5 text-amber-600" />
                  Request Changes
                </Button>

                <Button
                  size="sm"
                  onClick={() => setIsConfirmApproveOpen(true)}
                  disabled={isActionLoading || isApproved}
                  className={`flex-1 h-10 text-xs font-semibold rounded-xl shadow-xs ${
                    isApproved
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 cursor-default"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  {isApproved ? (
                    <>
                      <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> Approved by You
                    </>
                  ) : isActionLoading ? (
                    "Approving..."
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" /> Approve Post
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================
          3. STICKY MOBILE ACTION BAR
         ======================================================== */}
      <div className="fixed bottom-0 left-0 right-0 sm:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 z-40 shadow-lg safe-bottom">
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusRejectDialog({
                postId: post.id,
                statusType: "design",
                targetStatus: "REJECTED",
              })
            }}
            disabled={isActionLoading}
            className="flex-1 h-11 text-xs font-semibold border-amber-300 text-amber-900 hover:bg-amber-50 rounded-xl"
          >
            <MessageSquare className="w-4 h-4 mr-1 text-amber-600" />
            Request Changes
          </Button>

          <Button
            size="sm"
            onClick={() => setIsConfirmApproveOpen(true)}
            disabled={isActionLoading || isApproved}
            className={`flex-1 h-11 text-xs font-semibold rounded-xl ${
              isApproved
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 cursor-default"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            }`}
          >
            {isApproved ? (
              <>
                <Check className="w-4 h-4 mr-1 text-emerald-600" /> Approved
              </>
            ) : isActionLoading ? (
              "Approving..."
            ) : (
              <>
                <Check className="w-4 h-4 mr-1" /> Approve Post
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ========================================================
          4. LIGHTWEIGHT CONFIRM APPROVE MODAL
         ======================================================== */}
      <Dialog open={isConfirmApproveOpen} onOpenChange={setIsConfirmApproveOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 bg-white shadow-2xl">
          <DialogHeader className="text-center sm:text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Approve this post?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 pt-1 leading-relaxed">
              You are confirming that <span className="font-semibold text-slate-900">&quot;{post.title}&quot;</span> is approved and ready for publishing.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-row gap-2 sm:justify-center pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmApproveOpen(false)}
              disabled={isActionLoading}
              className="rounded-xl flex-1 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApprovePost}
              disabled={isActionLoading}
              className="rounded-xl flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isActionLoading ? "Approving..." : "Approve Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          5. REUSE EXISTING REJECT DIALOG WITH AUDIO RECORDER
         ======================================================== */}
      <RejectDialog
        statusRejectDialog={statusRejectDialog}
        setStatusRejectDialog={(val) => setStatusRejectDialog(val)}
        posts={[post]}
        customTitle={`Request Changes: ${post.title}`}
        customButtonText="Submit Change Request"
        customFeedbackPlaceholder="Describe what revisions or updates you need..."
        onSubmitCustom={async (textFeedback: string, audioBlob: Blob | null) => {
          if (!statusRejectDialog) return
          await handleCustomerRequestChanges(post.id, textFeedback, audioBlob)
        }}
      />

      {/* ========================================================
          6. REUSE EXISTING FULLSCREEN MEDIA VIEWER
         ======================================================== */}
      {imageModal && (
        <ImageModal
          isOpen={!!imageModal}
          onClose={() => setImageModal(null)}
          src={imageModal.src}
          alt={imageModal.alt}
          postId={imageModal.postId}
          assetId={imageModal.assetId}
          onCustomerSave={async (annotatedImageData) => {
            if (!imageModal?.postId) return
            const assetId = imageModal.assetId
            const filename = imageModal.alt

            try {
              const saveRes = await fetch(`/api/share/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "SAVE_ANNOTATED_IMAGE",
                  postId: post.id,
                  originalAssetId: assetId,
                  imageData: annotatedImageData,
                  filename,
                  name: clientDisplayName,
                }),
              })
              const saveJson = await saveRes.json()
              if (!saveRes.ok) throw new Error(saveJson.error || "Failed to save annotated image")

              toast.success("Annotated image saved. Please provide instructions below.")
              setImageModal(null)
              setStatusRejectDialog({ postId: post.id, statusType: "design", targetStatus: "REJECTED" })
            } catch (err: any) {
              toast.error(err.message || "Failed to save annotated image")
            }
          }}
        />
      )}

      <ProofingApprovalDialog
        open={proofingOpen}
        onOpenChange={setProofingOpen}
        postId={post.id}
        postTitle={post.title}
        projectName={project.name}
        assets={post.assets}
        isClientView={true}
        onUpdate={() => {
          router.refresh()
        }}
      />
    </div>
  )
}
