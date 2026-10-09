"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { DateTime } from "luxon"; // Import luxon
import { Eye, Edit, MoreHorizontal, FileText, Check, X, ChevronLeft, ChevronRight, Trash2, AlertCircle, Link as LinkIcon, Instagram, Facebook, Twitter, Linkedin, Youtube, Globe } from "lucide-react";
import MediaRenderer from "@/components/MediaRenderer";
import ImageModal from "@/components/ImageModal";
import { Session } from "next-auth";
import { useState } from "react";
import { getMediaUrl, getGoogleDriveEmbedUrl } from "@/lib/utils";
import MediaWithFallback from "@/components/MediaWithFallback";
import RejectDialog from "./rejectDialog";
import PostTimingBadge from "./postTimingBadge";

type PostStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SCHEDULED" | "POSTED" | "NEEDS_MINOR_CHANGE" | "RESUBMITTED" | "C_APPROVED";

interface Post {
  id: string;
  title: string;
  caption?: string;
  type: string;
  status: PostStatus;
  contentStatus: string;
  createdAt: string;
  project: {
    name: string;
    image?: string | null;
    client: { name: string; company: string; avatar?: string | null };
  };
  createdBy: { name: string };
  assignedTo?: { name: string };
  assets: Array<{ id: string; filename: string; url: string; contentType?: string; isReference: boolean }>;
  scheduledAt: string;
  designDueDate?: string;
  approvalFlows?: Array<{
    reviewedBy?: { name: string };
    submittedBy?: { name: string };
  }>;
  platforms?: Array<{ id?: string; platform: string; isPosted?: boolean }>;
}

interface PostGridProps {
  posts: Post[];
  permissions: string[];
  session: Session | null;
  selectedPosts: string[];
  handleSelectAll: (checked: boolean) => void;
  handleSelectPost: (postId: string, checked: boolean) => void;
  handleDeletePost: (postId: string) => void;
  openApprovalDialog: (postId: string, action: "approve" | "reject") => void;
  openStatusChange: (postId: string, initialStatus?: PostStatus) => void;
  setViewingAssets: (postId: string | null) => void;
  setCommentingPost: (postId: string | null) => void;
  fetchComments: (postId: string) => void;
  getCurrentAsset: (post: Post) => Post["assets"][0] | null;
  prevAsset: (postId: string, totalAssets: number) => void;
  nextAsset: (postId: string, totalAssets: number) => void;
  currentAssetIndex: { [key: string]: number };
  handleVideoPlay: (postId: string, assetId: string) => void;
  openExportLinkForPost?: (postId: string) => void;
}

const statusColors: Record<PostStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SUBMITTED: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300",
  APPROVED: "bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-800",
  C_APPROVED: "bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-800",
  REJECTED: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300",
  SCHEDULED: "bg-green-700 dark:bg-green-800 text-white border border-green-800 dark:border-green-900 font-semibold shadow-sm",
  POSTED: "bg-green-700 dark:bg-green-800 text-white border border-green-800 dark:border-green-900 font-semibold shadow-sm",
  NEEDS_MINOR_CHANGE: "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300",
  RESUBMITTED: "bg-blue-200 dark:bg-blue-900/50 text-blue-900 dark:text-blue-300",
};

const contentStatusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300",
  PENDING_REVIEW: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300",
  APPROVED: "bg-green-200 dark:bg-green-900/50 text-green-900 dark:text-green-300",
  C_APPROVED: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800",
  REJECTED: "bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-300",
  NEEDS_REVISION: "bg-orange-200 dark:bg-orange-900/50 text-orange-900 dark:text-orange-300",
  NEEDS_MINOR_CHANGE: "bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300",
  RESUBMITTED: "bg-blue-200 dark:bg-blue-900/50 text-blue-900 dark:text-blue-300",
};

const typeIcons: Record<string, string> = {
  PHOTO: "📷",
  REEL: "🎬",
  STORY: "📱",
  CAROUSEL: "🎠",
  VIDEO: "🎥",
  CUSTOM: "✨",
  UNKNOWN: "❓",
};

const getPlatformIcon = (platformName: string, isSelected: boolean = false) => {
  if (!isSelected) {
    const GreyWrapper = ({ children }: { children: React.ReactNode }) => (
      <div className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800">{children}</div>
    );
    const className = "h-3.5 w-3.5 text-gray-400 dark:text-gray-500";
    switch (platformName.toLowerCase()) {
      case 'instagram': return <GreyWrapper><Instagram className={className} /></GreyWrapper>;
      case 'facebook': return <GreyWrapper><Facebook className={className} /></GreyWrapper>;
      case 'twitter': return <GreyWrapper><Twitter className={className} /></GreyWrapper>;
      case 'linkedin': return <GreyWrapper><Linkedin className={className} /></GreyWrapper>;
      case 'youtube': return <GreyWrapper><Youtube className={className} /></GreyWrapper>;
      default: return <GreyWrapper><Globe className={className} /></GreyWrapper>;
    }
  }

  switch (platformName.toLowerCase()) {
    case 'instagram': return <div className="p-1.5 rounded-full bg-pink-100 dark:bg-pink-950"><Instagram className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" /></div>;
    case 'facebook': return <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-950"><Facebook className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /></div>;
    case 'twitter': return <div className="p-1.5 rounded-full bg-sky-100 dark:bg-sky-950"><Twitter className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" /></div>;
    case 'linkedin': return <div className="p-1.5 rounded-full bg-indigo-100 dark:bg-indigo-950"><Linkedin className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /></div>;
    case 'youtube': return <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-950"><Youtube className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /></div>;
    default: return <div className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800"><Globe className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" /></div>;
  }
};

export default function PostGrid({
  posts,
  permissions,
  session,
  selectedPosts,
  handleSelectAll,
  handleSelectPost,
  handleDeletePost,
  openApprovalDialog,
  openStatusChange,
  setViewingAssets,
  setCommentingPost,
  fetchComments,
  getCurrentAsset,
  prevAsset,
  nextAsset,
  currentAssetIndex,
  handleVideoPlay,
  openExportLinkForPost,
}: PostGridProps) {
  const [imageModal, setImageModal] = useState<{
    src: string;
    alt: string;
    postId: string;
    assetId: string;
  } | null>(null);

  const handleImageClick = (
    url: string,
    filename: string,
    postId: string,
    assetId: string
  ) => {
    setImageModal({ src: url, alt: filename, postId, assetId });
  };

  // Convert UTC to IST using luxon
  const convertToIST = (utcDate: string) => {
    const dateTime = DateTime.fromISO(utcDate, { zone: 'utc' }).setZone('Asia/Kolkata');
    return dateTime.toFormat('MMM dd');
  };

  return (
    <>
      {permissions.includes("Manage-post") && (
        <div className="flex items-center mb-4">
          <Checkbox
            checked={posts.length > 0 && selectedPosts.length === posts.length}
            onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
            className="mr-2"
          />
          <span className="text-sm font-medium text-foreground">
            Select All ({selectedPosts.length}/{posts.length} selected)
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-2 md:gap-3 lg:gap-4">
        {posts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No posts found matching your filters
          </div>
        ) : (
          posts.map((post) => {
            const nonReferenceAssets = post.assets?.filter((asset) => !asset.isReference) || [];
            const currentAsset = nonReferenceAssets.length > 0 ? getCurrentAsset(post) : null;

            const isVideo = currentAsset ? (
              currentAsset.contentType?.toLowerCase().includes('video') ||
              currentAsset.contentType?.toLowerCase().startsWith('video/') ||
              ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'].some(ext =>
                currentAsset.filename?.toLowerCase().endsWith(ext)
              )
            ) : false;

            return (
              <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-300 bg-card border-border">
                <div className="flex items-center justify-between px-3 pt-3 pb-2">
                  <div className="flex items-center min-w-0">
                    <img
                      src={
                        (post.project.image ? getMediaUrl(post.project.image) : null) || 
                        (post.project.client.avatar ? getMediaUrl(post.project.client.avatar) : null) || 
                        "/placeholder-client-logo.png"
                      }
                      alt={`${post.project.name} logo`}
                      className="w-8 h-8 rounded-full mr-3 object-cover border border-border"
                      onError={(e) =>
                        (e.currentTarget.src = "/placeholder-client-logo.png")
                      }
                    />

                    <span className="font-semibold text-sm text-foreground truncate">
                      {post.project.name}
                    </span>
                  </div>

                  <span className={`ml-3 shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${post.type === 'UNKNOWN' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                    {post.type === 'UNKNOWN' ? 'UNKNOWN TYPE' : post.type}
                  </span>
                </div>
                <div className="relative aspect-square">
                  {nonReferenceAssets.length > 0 && currentAsset ? (
                    <>
                      <MediaWithFallback
                        asset={currentAsset}
                        isVideo={isVideo}
                        onPlay={() => handleVideoPlay(post.id, currentAsset.id)}
                        onImageClick={(url: string, filename: string) =>
                          handleImageClick(url, filename, post.id, currentAsset.id)
                        }
                        className="w-full h-full object-cover"
                      />
                      {nonReferenceAssets.length > 1 && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-accent/90 hover:bg-accent text-foreground border-0 rounded-full"
                            onClick={() => prevAsset(post.id, nonReferenceAssets.length)}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-accent/90 hover:bg-accent text-foreground border-0 rounded-full"
                            onClick={() => nextAsset(post.id, nonReferenceAssets.length)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <div className="absolute bottom-2 right-2 bg-accent/90 text-foreground px-2 py-1 rounded text-xs font-medium">
                            {(currentAssetIndex[post.id] || 0) + 1} / {nonReferenceAssets.length}
                          </div>
                        </>
                      )}
                      <Badge className={`absolute top-2 left-2 ${statusColors[post.status]} text-xs font-medium`}>
                        Design Status: {post.status === "REJECTED" ? "Changes" : post.status === "NEEDS_MINOR_CHANGE" ? "Needs Minor Change" : post.status === "APPROVED" ? "I Approve" : post.status === "C_APPROVED" ? "C Approve" : post.status.charAt(0) + post.status.slice(1).toLowerCase()}
                      </Badge>
                      <div className="absolute top-2 right-2 bg-card/90 dark:bg-card rounded-full p-1 shadow-sm">
                        <span className="text-lg">{typeIcons[post.type] || "📄"}</span>
                      </div>
                      {permissions.includes("Manage-post") && (
                        <div className="absolute bottom-2 left-2">
                          <Checkbox
                            checked={selectedPosts.includes(post.id)}
                            onCheckedChange={(checked) => handleSelectPost(post.id, checked as boolean)}
                            className="bg-card/90 border-border shadow-sm"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gradient-to-br from-muted to-muted/50 border border-border rounded">
                      <span className="text-muted-foreground text-sm font-medium">Design is pending</span>
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-sm line-clamp-1 text-foreground flex-1 min-w-0" title={post.title}>
                        {post.title}
                      </h3>
                      <PostTimingBadge post={post} />
                    </div>
                    {post.caption && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{post.caption}</p>
                    )}
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground mt-2">
                      <div className="flex items-center justify-between">
                        <span>Created By: {post.createdBy?.name}</span>
                        <span>Design Due: {post.designDueDate ? convertToIST(post.designDueDate) : "N/A"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        {post.assignedTo ? (
                          <span className="truncate max-w-[120px]">Assigned To: {post.assignedTo.name}</span>
                        ) : (
                          <span>Unassigned</span>
                        )}
                        <span>Posting: {post.scheduledAt ? convertToIST(post.scheduledAt) : "N/A"}</span>
                      </div>
                      <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                        Status Updated By: {post.approvalFlows?.[0]?.reviewedBy?.name || post.approvalFlows?.[0]?.submittedBy?.name || post.createdBy?.name || "N/A"}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-between">
                      <Badge className={contentStatusColors[post.contentStatus] || "bg-muted text-muted-foreground"}>
                        Content Status: {post.contentStatus === "REJECTED" ? "Changes" : post.contentStatus === "APPROVED" ? "I Approve" : post.contentStatus === "C_APPROVED" ? "C Approve" : post.contentStatus.charAt(0) + post.contentStatus.slice(1).toLowerCase().replace(/_/g, " ")}
                      </Badge>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-[10px] bg-blue-50/50">Ref: {post.assets?.filter(a => a.isReference).length || 0}</Badge>
                        <Badge variant="outline" className="text-[10px] bg-green-50/50">Des: {post.assets?.filter(a => !a.isReference).length || 0}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                    {post.platforms && post.platforms.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {post.platforms.map((p) => {
                          const Icon = getPlatformIcon(p.platform, p.isPosted);
                          return Icon ? <div key={p.platform} title={p.platform}>{Icon}</div> : null;
                        })}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/projects/posts/${post.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2">
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Button>
                        </Link>
                        {openExportLinkForPost && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={() => openExportLinkForPost(post.id)}
                            title="Share Post"
                          >
                            <LinkIcon className="mr-1 h-3 w-3" />
                            Share
                          </Button>
                        )}
                      </div>
                      {(permissions.includes("Manage-content") || permissions.includes("Manage-design")) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 p-1">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs">
                          {permissions.includes("Manage-post") && (
                            <>
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/projects/posts/${post.id}/edit`}>
                                  <Edit className="mr-2 h-3 w-3" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeletePost(post.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-3 w-3" />
                                Delete
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openApprovalDialog(post.id, "reject")}
                              >
                                <X className="mr-2 h-4 w-4" />
                                Changes
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setViewingAssets(post.id)}
                              >
                                <FileText className="mr-2 h-3 w-3" />
                                Assets ({post.assets?.length || 0})
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {(() => {
                            const userRole = session?.user?.role?.toUpperCase() || "";
                            const isAdminOrManager = userRole === "ADMIN" || userRole === "MANAGER" || userRole === "ADMINISTRATOR";
                            return (permissions.includes("Manage-content") ||
                              permissions.includes("Manage-design") ||
                              isAdminOrManager) ? (
                              <DropdownMenuItem onClick={() => openStatusChange(post.id)}>
                                Change Status
                              </DropdownMenuItem>
                            ) : null;
                          })()}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <ImageModal
        isOpen={!!imageModal}
        onClose={() => setImageModal(null)}
        src={imageModal?.src || ""}
        alt={imageModal?.alt || ""}
        postId={imageModal?.postId}
        assetId={imageModal?.assetId}
        onSaveSuccess={() => {
          if (imageModal?.postId) {
            openStatusChange(imageModal.postId);
          }
        }}
      />
    </>
  );
}