"use client"

import { CLIENT_REVIEW_LABELS, clientReviewState, isClientDone } from "@/lib/posts/client-review"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  CheckCircle2,
  Clock,
  Calendar,
  Check,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  MessageSquare,
  Sparkles,
  FileText,
  Video,
  Image as ImageIcon,
  Layers,
  Building,
  Maximize2,
} from "lucide-react"
import { getMediaUrl } from "@/lib/utils"
import { toast } from "sonner"
import ImageModal from "@/components/ImageModal"
import RejectDialog from "@/components/posts/rejectDialog"

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

export interface Post {
  id: string
  title: string
  caption?: string | null
  writeUp?: string | null
  type: string
  status: string
  contentStatus?: string | null
  /** Approval is only possible while the post is internally approved AND this is on. */
  requiresClientApproval?: boolean
  scheduledAt?: string | null
  notes?: string | null
  approvedAt?: string | null
  rejectedAt?: string | null
  assets: Asset[]
  platforms: string[]
  comments?: Comment[]
}

export interface ConfirmationData {
  project: {
    name: string
    description?: string | null
    clientName?: string
    clientCompany?: string | null
    clientAvatar?: string | null
  }
  link: {
    status: string
    confirmedAt?: string | null
    confirmedByName?: string | null
    expiresAt?: string | null
    month?: number | null
    year?: number | null
    feedback?: string | null
  }
  posts: Post[]
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

export function CustomerConfirmationView({
  initialData,
  token,
}: {
  initialData: ConfirmationData
  token: string
}) {
  const [data, setData] = useState<ConfirmationData>(initialData)
  const [selectedType, setSelectedType] = useState<string>("ALL")
  const [confirmApprovePost, setConfirmApprovePost] = useState<Post | null>(null)
  const [statusRejectDialog, setStatusRejectDialog] = useState<{
    postId: string
    statusType?: "content" | "design"
    targetStatus?: string
  } | null>(null)
  const [actionLoadingPostId, setActionLoadingPostId] = useState<string | null>(null)
  const [imageModal, setImageModal] = useState<{
    src: string
    alt: string
    postId: string
    assetId?: string
  } | null>(null)

  // Batch actions
  const [isBatchApproveOpen, setIsBatchApproveOpen] = useState(false)
  const [isBatchChangesOpen, setIsBatchChangesOpen] = useState(false)
  const [approverName, setApproverName] = useState(data.project.clientName || "")
  const [approverEmail, setApproverEmail] = useState("")
  const [batchFeedback, setBatchFeedback] = useState("")
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false)

  // Dynamically resolve base path: use '/:token' on subdomain, '/share/:token' or '/confirm/:token' on main domain
  const [baseConfirmPath, setBaseConfirmPath] = useState(`/share/${token}`)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = window.location.pathname
      if (p.startsWith("/share")) {
        setBaseConfirmPath(`/share/${token}`)
      } else if (p.startsWith("/confirm")) {
        setBaseConfirmPath(`/confirm/${token}`)
      } else {
        setBaseConfirmPath(`/${token}`)
      }
    }
  }, [token])

  const { project, link, posts } = data
  const isConfirmed = link.status === "CONFIRMED"
  const isChangesRequested = link.status === "CHANGES_REQUESTED"

  const postTypes = Array.from(new Set(posts.map((p) => p.type)))

  const filteredPosts = posts.filter((post) => {
    if (selectedType === "ALL") return true
    return post.type === selectedType
  })

  // Accurate counts based on live Post records
  const totalCount = posts.length
  // Counted from the same rule the server enforces (lib/posts/client-review.ts).
  const states = posts.map((p) => clientReviewState(p))
  const approvedCount = states.filter(isClientDone).length
  const changesRequestedCount = states.filter((s) => s === "CHANGES_REQUESTED").length
  const awaitingApprovalCount = states.filter((s) => s === "AWAITING_CLIENT").length

  const progressPercentage = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0

  // ==========================================
  // SINGLE POST ACTION: APPROVE
  // ==========================================
  const handleApprovePost = async (postId: string) => {
    setActionLoadingPostId(postId)
    try {
      const res = await fetch(`/api/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPROVE_POST",
          postId,
          name: approverName.trim(),
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to approve post")

      toast.success("✓ Post Approved Successfully")

      // The status the server actually set — never an optimistic guess.
      const nowIso = new Date().toISOString()
      setData((prev) => ({
        ...prev,
        posts: prev.posts.map((p) =>
          p.id === postId ? { ...p, status: json.post?.status ?? p.status, approvedAt: nowIso } : p
        ),
      }))

      setConfirmApprovePost(null)
    } catch (err: any) {
      toast.error(err.message || "Failed to approve post")
    } finally {
      setActionLoadingPostId(null)
    }
  }

  // ==========================================
  // SINGLE POST ACTION: REQUEST CHANGES
  // ==========================================
  const handleCustomerRequestChanges = async (
    targetId: string,
    feedbackText: string,
    audioBlob: Blob | null
  ) => {
    setActionLoadingPostId(targetId)
    try {
      let res: Response
      if (audioBlob) {
        const formData = new FormData()
        formData.append("action", "REQUEST_CHANGES_POST")
        formData.append("postId", targetId)
        formData.append("feedback", feedbackText)
        formData.append("name", approverName.trim())
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
            name: approverName.trim(),
          }),
        })
      }

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to submit change request")

      toast.success("Changes requested. Our team has received your feedback.")

      setData((prev) => ({
        ...prev,
        posts: prev.posts.map((p) => {
          if (p.id === targetId) {
            const currentComments = p.comments || []
            return {
              ...p,
              // Only a post that was awaiting the client changes status; on any other
              // post the request is recorded as feedback for the team.
              status: json.post?.status ?? p.status,
              rejectedAt: json.post?.rejectedAt ?? p.rejectedAt,
              comments: json.comment ? [...currentComments, json.comment] : currentComments,
            }
          }
          return p
        }),
      }))

      setStatusRejectDialog(null)
    } catch (err: any) {
      toast.error(err.message || "Failed to submit change request")
      throw err
    } finally {
      setActionLoadingPostId(null)
    }
  }

  // ==========================================
  // BATCH ACTION: APPROVE ALL
  // ==========================================
  const handleConfirmBatchApproval = async () => {
    if (!approverName.trim()) {
      toast.error("Please enter your name")
      return
    }

    setIsSubmittingBatch(true)
    try {
      const res = await fetch(`/api/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONFIRM",
          name: approverName.trim(),
          email: approverEmail.trim(),
          feedback: batchFeedback.trim(),
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Confirmation failed")

      const nowIso = json.confirmedAt || new Date().toISOString()
      setData((prev) => ({
        ...prev,
        link: {
          ...prev.link,
          status: "CONFIRMED",
          confirmedAt: nowIso,
          confirmedByName: json.confirmedByName || approverName.trim(),
          feedback: batchFeedback.trim() || prev.link.feedback,
        },
        // Only the posts that were waiting for the client were approved by the server.
        posts: prev.posts.map((p) =>
          clientReviewState(p) === "AWAITING_CLIENT" ? { ...p, status: "C_APPROVED", approvedAt: nowIso } : p
        ),
      }))

      setIsBatchApproveOpen(false)
      toast.success(json.message || "Thank you — your approval has been recorded.")
    } catch (err: any) {
      toast.error(err.message || "Something went wrong")
    } finally {
      setIsSubmittingBatch(false)
    }
  }

  // ==========================================
  // BATCH ACTION: REQUEST CHANGES
  // ==========================================
  const handleRequestBatchChanges = async () => {
    if (!batchFeedback.trim()) {
      toast.error("Please describe what changes are needed")
      return
    }

    setIsSubmittingBatch(true)
    try {
      const res = await fetch(`/api/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_CHANGES",
          name: approverName.trim(),
          email: approverEmail.trim(),
          feedback: batchFeedback.trim(),
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to submit request")

      setData((prev) => ({
        ...prev,
        link: {
          ...prev.link,
          status: "CHANGES_REQUESTED",
          feedback: batchFeedback.trim(),
          confirmedByName: approverName.trim(),
        },
      }))

      setIsBatchChangesOpen(false)
      toast.success("Feedback sent! Our team will review the requested changes.")
    } catch (err: any) {
      toast.error(err.message || "Something went wrong")
    } finally {
      setIsSubmittingBatch(false)
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

  const clientDisplayName = project.clientCompany || project.clientName || "Valued Client"
  const monthYearLabel = link.month && link.year ? `${MONTH_NAMES[link.month]} ${link.year}` : null

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 pb-32 font-sans antialiased">
      {/* ========================================================
          1. PROFESSIONAL CLIENT PRESENTATION HEADER
         ======================================================== */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Client Branding Block */}
            <div className="flex items-center gap-3.5">
              {project.clientAvatar ? (
                <img
                  src={getMediaUrl(project.clientAvatar)}
                  alt={clientDisplayName}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white font-bold text-lg flex items-center justify-center shadow-xs shrink-0 tracking-wider">
                  {clientDisplayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                    {clientDisplayName}
                  </h1>
                  {project.name && project.name !== clientDisplayName && (
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {project.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  {monthYearLabel && (
                    <span className="font-semibold text-slate-700">{monthYearLabel}</span>
                  )}
                  <span>•</span>
                  <span className="text-slate-500 font-medium">Content Review</span>
                </div>
              </div>
            </div>

            {/* Approval Progress / Status Pill */}
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-900">
                  {approvedCount} of {totalCount} Approved
                </div>
                <div className="w-32 h-2 bg-slate-100 rounded-full mt-1 overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              {isConfirmed || (approvedCount === totalCount && totalCount > 0) ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1 font-semibold text-xs rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  All Approved
                </Badge>
              ) : isChangesRequested ? (
                <Badge className="bg-amber-50 text-amber-700 border-amber-200 px-3 py-1 font-semibold text-xs rounded-full">
                  <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                  Changes Requested
                </Badge>
              ) : (
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1 font-semibold text-xs rounded-full">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  Review in Progress
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================
          2. APPROVAL SUMMARY & CLEAR ACTION BANNER
         ======================================================== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Prominent Action Required Indicator */}
        {awaitingApprovalCount > 0 ? (
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white border border-blue-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {awaitingApprovalCount} {awaitingApprovalCount === 1 ? "post is" : "posts are"} waiting for your approval
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  Click &quot;View Details&quot; to review the full content, media, and captions, or use the quick actions below.
                </p>
              </div>
            </div>
            {totalCount > 1 && (
              <Button
                onClick={() => setIsBatchApproveOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm h-10 px-5 rounded-xl shadow-xs self-start sm:self-auto shrink-0"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Approve All ({totalCount})
              </Button>
            )}
          </div>
        ) : changesRequestedCount > 0 ? (
          <div className="bg-gradient-to-r from-amber-50 via-orange-50/40 to-white border border-amber-200/80 rounded-2xl p-5 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {changesRequestedCount} {changesRequestedCount === 1 ? "post has" : "posts have"} changes requested
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Our creative team has received your feedback notes and is working on the revisions.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white border border-emerald-200/80 rounded-2xl p-5 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                ✓ All posts have been approved
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                All {monthYearLabel ? `${monthYearLabel} ` : ""}content has been reviewed and approved for publication.
              </p>
            </div>
          </div>
        )}

        {/* 4 Clean Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block">Total Content</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</div>
            <span className="text-xs text-slate-400 mt-0.5 block">Posts in this schedule</span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <span className="text-xs font-medium text-emerald-700 block">Approved</span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{approvedCount}</div>
            <span className="text-xs text-emerald-600/80 mt-0.5 block">Ready for publishing</span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <span className="text-xs font-medium text-amber-700 block">Changes Requested</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">{changesRequestedCount}</div>
            <span className="text-xs text-amber-600/80 mt-0.5 block">Revisions in progress</span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <span className="text-xs font-medium text-blue-700 block">Awaiting Action</span>
            <div className="text-2xl font-bold text-blue-600 mt-1">{awaitingApprovalCount}</div>
            <span className="text-xs text-blue-600/80 mt-0.5 block">Requires your review</span>
          </div>
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2 pb-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={selectedType === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType("ALL")}
              className={`rounded-full text-xs h-8 px-3.5 transition-all ${
                selectedType === "ALL"
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              All Posts ({posts.length})
            </Button>
            {postTypes.map((type) => {
              const count = posts.filter((p) => p.type === type).length
              return (
                <Button
                  key={type}
                  variant={selectedType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType(type)}
                  className={`rounded-full text-xs h-8 px-3.5 capitalize transition-all ${
                    selectedType === type
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="mr-1.5">{getTypeIcon(type)}</span>
                  {type.toLowerCase()}s ({count})
                </Button>
              )
            })}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <span className="font-semibold text-slate-800">{filteredPosts.length}</span> of {posts.length} posts
          </div>
        </div>

        {/* ========================================================
            3. POST LIST DESIGN — CLEAN CARD GRID
           ======================================================== */}
        {filteredPosts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-3">
              <ImageIcon className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">No posts in this category</h3>
            <p className="text-xs text-slate-500 mt-1">Select &quot;All Posts&quot; to view the complete content schedule.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                token={token}
                baseConfirmPath={baseConfirmPath}
                getTypeIcon={getTypeIcon}
                onImageClick={(url, filename, postId, assetId) =>
                  setImageModal({ src: url, alt: filename, postId, assetId })
                }
                onApprove={() => setConfirmApprovePost(post)}
                onRequestChanges={() => {
                  setStatusRejectDialog({ postId: post.id, statusType: "design", targetStatus: "REJECTED" })
                }}
                isActionLoading={actionLoadingPostId === post.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* ========================================================
          4. FLOATING MOBILE / BATCH ACTION DOCK
         ======================================================== */}
      {awaitingApprovalCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md border border-slate-300/80 rounded-2xl shadow-xl px-5 py-3 flex items-center justify-between gap-4 max-w-lg w-[92%] sm:w-auto">
          <div className="text-xs text-slate-700 hidden sm:block">
            <span className="font-bold text-slate-900">{awaitingApprovalCount}</span> of {totalCount} posts waiting for your review
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBatchChangesOpen(true)}
              className="text-xs h-9 px-3.5 border-amber-300 text-amber-900 hover:bg-amber-50 rounded-xl"
            >
              Request Changes
            </Button>
            <Button
              size="sm"
              onClick={() => setIsBatchApproveOpen(true)}
              className="text-xs h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs rounded-xl"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Approve All ({totalCount})
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================
          5. LIGHTWEIGHT APPROVAL CONFIRMATION DIALOG
         ======================================================== */}
      <Dialog open={!!confirmApprovePost} onOpenChange={() => setConfirmApprovePost(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6 bg-white shadow-2xl">
          <DialogHeader className="text-center sm:text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Approve this post?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 pt-1 leading-relaxed">
              You are confirming that <span className="font-semibold text-slate-900">&quot;{confirmApprovePost?.title}&quot;</span> is approved and ready for publishing.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-row gap-2 sm:justify-center pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmApprovePost(null)}
              disabled={actionLoadingPostId === confirmApprovePost?.id}
              className="rounded-xl flex-1 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => confirmApprovePost && handleApprovePost(confirmApprovePost.id)}
              disabled={actionLoadingPostId === confirmApprovePost?.id}
              className="rounded-xl flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {actionLoadingPostId === confirmApprovePost?.id ? "Approving..." : "Approve Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          6. REUSE EXISTING REJECT DIALOG (WITH VOICE NOTE AUDIO)
         ======================================================== */}
      <RejectDialog
        statusRejectDialog={statusRejectDialog}
        setStatusRejectDialog={(val) => {
          setStatusRejectDialog(val)
        }}
        posts={posts}
        customTitle={
          statusRejectDialog
            ? `Request Changes: ${posts.find((p) => p.id === statusRejectDialog.postId)?.title}`
            : undefined
        }
        customButtonText="Submit Change Request"
        customFeedbackPlaceholder="Describe what revisions or updates you need..."
        onSubmitCustom={async (textFeedback: string, audioBlob: Blob | null) => {
          if (!statusRejectDialog) return
          await handleCustomerRequestChanges(statusRejectDialog.postId, textFeedback, audioBlob)
        }}
      />

      {/* ========================================================
          7. REUSE EXISTING FULLSCREEN MEDIA VIEWER
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
            const postId = imageModal.postId
            const assetId = imageModal.assetId
            const filename = imageModal.alt

            try {
              const saveRes = await fetch(`/api/share/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "SAVE_ANNOTATED_IMAGE",
                  postId,
                  originalAssetId: assetId,
                  imageData: annotatedImageData,
                  filename,
                  name: approverName.trim(),
                }),
              })
              const saveJson = await saveRes.json()
              if (!saveRes.ok) throw new Error(saveJson.error || "Failed to save annotated image")

              toast.success("Annotated image saved. Please provide instructions below.")

              setImageModal(null)
              const post = data.posts.find((p) => p.id === postId)
              if (post) {
                setStatusRejectDialog({ postId, statusType: "design", targetStatus: "REJECTED" })
              }
            } catch (err: any) {
              toast.error(err.message || "Failed to save annotated image")
            }
          }}
        />
      )}

      {/* ========================================================
          8. BATCH APPROVE MODAL
         ======================================================== */}
      <Dialog open={isBatchApproveOpen} onOpenChange={setIsBatchApproveOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-slate-900">
              Approve All Posts
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-600">
              You are confirming approval for all <span className="font-semibold text-slate-800">{totalCount} posts</span> for{" "}
              <span className="font-semibold text-slate-800">{clientDisplayName}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Your Name <span className="text-red-500">*</span>
              </label>
              <Input aria-label="Your Name"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                placeholder="e.g. Rohan Sawant"
                className="text-sm rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Your Email (optional)
              </label>
              <Input aria-label="Your Email (optional)"
                type="email"
                value={approverEmail}
                onChange={(e) => setApproverEmail(e.target.value)}
                placeholder="e.g. rohan@example.com"
                className="text-sm rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Comments or Notes (optional)
              </label>
              <Textarea aria-label="Comments or Notes (optional)"
                value={batchFeedback}
                onChange={(e) => setBatchFeedback(e.target.value)}
                placeholder="Any special notes for the publishing team..."
                rows={3}
                className="text-sm rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBatchApproveOpen(false)}
              disabled={isSubmittingBatch}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmBatchApproval}
              disabled={isSubmittingBatch || !approverName.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
            >
              {isSubmittingBatch ? "Submitting..." : "Yes, Approve All Posts"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          9. BATCH REQUEST CHANGES MODAL
         ======================================================== */}
      <Dialog open={isBatchChangesOpen} onOpenChange={setIsBatchChangesOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-2 mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-slate-900">
              Request Changes Across Schedule
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-600">
              Let the creative team know what overall revisions you need.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Your Name <span className="text-red-500">*</span>
              </label>
              <Input aria-label="Your Name"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                placeholder="e.g. Rohan Sawant"
                className="text-sm rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Requested Changes / Instructions <span className="text-red-500">*</span>
              </label>
              <Textarea aria-label="Requested Changes / Instructions"
                value={batchFeedback}
                onChange={(e) => setBatchFeedback(e.target.value)}
                placeholder="Please describe what revisions are needed..."
                rows={4}
                className="text-sm rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBatchChangesOpen(false)}
              disabled={isSubmittingBatch}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRequestBatchChanges}
              disabled={isSubmittingBatch || !batchFeedback.trim() || !approverName.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl"
            >
              {isSubmittingBatch ? "Submitting..." : "Submit Revision Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ========================================================
// POST CARD COMPONENT
// ========================================================
function PostCard({
  post,
  token,
  baseConfirmPath,
  getTypeIcon,
  onImageClick,
  onApprove,
  onRequestChanges,
  isActionLoading,
}: {
  post: Post
  token: string
  baseConfirmPath: string
  getTypeIcon: (type: string) => React.ReactNode
  onImageClick: (url: string, filename: string, postId: string, assetId?: string) => void
  onApprove: () => void
  onRequestChanges: () => void
  isActionLoading: boolean
}) {
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0)

  // Prioritize finished deliverables (non-reference assets) if available
  const displayAssets = post.assets.filter((a) => !a.isReference)
  const assetsToUse = displayAssets.length > 0 ? displayAssets : post.assets

  const hasMultipleAssets = assetsToUse.length > 1
  const activeAsset = assetsToUse[currentAssetIndex] || assetsToUse[0]
  const mediaUrl = activeAsset ? getMediaUrl(activeAsset.url) : null

  const isVideo =
    activeAsset &&
    (activeAsset.type?.toLowerCase().includes("video") ||
      activeAsset.filename?.match(/\.(mp4|mov|webm)$/i))

  const reviewState = clientReviewState(post)
  const canApprove = reviewState === "AWAITING_CLIENT"
  const isApproved = isClientDone(reviewState)
  const isRejected = reviewState === "CHANGES_REQUESTED"

  const formattedDate = post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : "Date pending"

  return (
    <Card className="overflow-hidden border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all bg-white rounded-2xl flex flex-col h-full group">
      {/* Large Media Preview Container */}
      <div className="relative aspect-square bg-slate-950 flex items-center justify-center overflow-hidden">
        {mediaUrl ? (
          isVideo ? (
            <video
              src={mediaUrl}
              className="w-full h-full object-cover"
              controls
              playsInline
            />
          ) : (
            <div
              className="relative w-full h-full cursor-pointer group/media overflow-hidden"
              onClick={() => onImageClick(mediaUrl, activeAsset?.filename || post.title, post.id, activeAsset?.id)}
              title="Click to view full-screen"
            >
              <img
                src={mediaUrl}
                alt={post.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover/media:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover/media:opacity-100 pointer-events-none">
                <span className="bg-black/75 backdrop-blur-md text-white text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg font-medium">
                  <Maximize2 className="w-3.5 h-3.5" /> Fullscreen Preview
                </span>
              </div>
            </div>
          )
        ) : (
          <div className="text-slate-400 text-center p-6 flex flex-col items-center gap-2">
            <ImageIcon className="w-8 h-8 opacity-30" />
            <span className="text-xs">No media preview available</span>
          </div>
        )}

        {/* Carousel Prev/Next Buttons */}
        {hasMultipleAssets && !isVideo && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setCurrentAssetIndex((prev) => (prev > 0 ? prev - 1 : assetsToUse.length - 1))
              }}
              aria-label="Previous slide"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 shadow-md"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setCurrentAssetIndex((prev) => (prev < assetsToUse.length - 1 ? prev + 1 : 0))
              }}
              aria-label="Next slide"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 shadow-md"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-xs text-white font-medium">
              {currentAssetIndex + 1} / {assetsToUse.length}
            </div>
          </>
        )}

        {/* Post Type Badge */}
        <div className="absolute top-3 left-3">
          <Badge
            variant="outline"
            className="bg-white/90 backdrop-blur-md text-slate-800 border-white/60 font-semibold text-xs px-2.5 py-0.5 uppercase tracking-wide shadow-xs"
          >
            <span className="mr-1">{getTypeIcon(post.type)}</span>
            {post.type}
          </Badge>
        </div>

        {/* Customer Status Badge */}
        <div className="absolute top-3 right-3">
          {isApproved ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs font-medium shadow-xs px-2.5 py-0.5">
              <Check className="w-3 h-3 mr-1" aria-hidden="true" /> {CLIENT_REVIEW_LABELS[reviewState]}
            </Badge>
          ) : isRejected ? (
            <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-xs font-medium shadow-xs px-2.5 py-0.5">
              <AlertCircle className="w-3 h-3 mr-1" /> Changes Requested
            </Badge>
          ) : (
            <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-xs font-medium shadow-xs px-2.5 py-0.5">
              <Clock className="w-3 h-3 mr-1" aria-hidden="true" /> {CLIENT_REVIEW_LABELS[reviewState]}
            </Badge>
          )}
        </div>
      </div>

      {/* Card Content & Details */}
      <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          {/* Date & Platforms */}
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formattedDate}
            </span>
            {post.platforms.length > 0 && (
              <div className="flex items-center gap-1">
                {post.platforms.map((p) => (
                  <span
                    key={p}
                    className="text-xs font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded capitalize"
                  >
                    {p.toLowerCase()}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Post Title - Clicking navigates to dedicated page */}
          <Link href={`${baseConfirmPath}/posts/${post.id}`}>
            <h3 className="text-base font-bold text-slate-900 line-clamp-1 hover:text-blue-600 transition-colors cursor-pointer" title={post.title}>
              {post.title}
            </h3>
          </Link>

          {/* Caption Teaser */}
          {post.caption ? (
            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-sans">
              {post.caption}
            </p>
          ) : post.writeUp ? (
            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-sans">
              {post.writeUp}
            </p>
          ) : null}
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
          {/* Primary View Details Button - Direct Navigation to Dedicated Full Page */}
          <Link href={`${baseConfirmPath}/posts/${post.id}`} className="w-full">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs font-semibold h-9 rounded-xl border-slate-200 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              View Details
            </Button>
          </Link>

          {/* Customer Quick Review Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onRequestChanges}
              disabled={isActionLoading}
              className="h-8 text-xs font-medium border-amber-200 text-amber-900 hover:bg-amber-50 rounded-xl"
            >
              <MessageSquare className="w-3 h-3 mr-1 text-amber-600" />
              Request Changes
            </Button>

            <Button
              size="sm"
              onClick={onApprove}
              disabled={isActionLoading || !canApprove}
              title={canApprove ? undefined : CLIENT_REVIEW_LABELS[reviewState]}
              className={`h-8 text-xs font-semibold rounded-xl ${
                isApproved
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 cursor-default"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              }`}
            >
              {isApproved ? (
                <>
                  <Check className="w-3 h-3 mr-1 text-emerald-600" /> Approved
                </>
              ) : !canApprove ? (
                CLIENT_REVIEW_LABELS[reviewState]
              ) : isActionLoading ? (
                "Approving..."
              ) : (
                <>
                  <Check className="w-3 h-3 mr-1" /> Approve
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
