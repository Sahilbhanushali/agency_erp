"use client";

import { contentStatusLabel, statusLabel } from "@/lib/post-status";
import { PostTypeIcon, typeLabel } from "@/components/posts/post-type-icon";
import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { format } from "date-fns";
import {
  Eye,
  Edit,
  MoreHorizontal,
  FileText,
  Check,
  X,
  Upload,
  Trash2,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
} from "lucide-react";
import PostTimingBadge from "./postTimingBadge";

type PostStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SCHEDULED" | "POSTED" | "RESUBMITTED" | "NEEDS_MINOR_CHANGE" | "C_APPROVED";

interface Post {
  id: string;
  title: string;
  caption?: string;
  type: string;
  status: PostStatus;
  contentStatus: string;
  createdAt: string;
  scheduledAt?: string;
  postedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  project: { name: string; client: { name: string } };
  assignedTo?: { name: string };
  assets: Array<{ id: string; isReference?: boolean; createdAt?: string }>;
}

interface PostTableProps {
  posts: Post[];
  permissions: string[];
  selectedPosts: string[];
  handleSelectAll: (checked: boolean) => void;
  handleSelectPost: (postId: string, checked: boolean) => void;
  handleDeletePost: (postId: string) => void;
  openApprovalDialog: (postId: string, action: "approve" | "reject") => void;
  openStatusChange: (postId: string, initialStatus?: PostStatus) => void;
  setViewingAssets: (postId: string | null) => void;
  setCommentingPost: (postId: string | null) => void;
  fetchComments: (postId: string) => void;
  handleFileUpload: (postId: string, files: FileList) => void;
  uploadingFiles: { [key: string]: boolean };
}

const getDesignBadgeVariant = (status: PostStatus) => {
  switch (status) {
    case "APPROVED":
    case "POSTED":
    case "C_APPROVED":
      return "success";
    case "SCHEDULED":
    case "SUBMITTED":
      return "info";
    case "REJECTED":
      return "destructive";
    case "NEEDS_MINOR_CHANGE":
      return "warning";
    case "RESUBMITTED":
      return "purple";
    default:
      return "neutral";
  }
};

const getContentBadgeVariant = (status: string) => {
  switch (status) {
    case "APPROVED":
      return "success";
    case "PENDING_REVIEW":
      return "warning";
    case "REJECTED":
    case "NEEDS_REVISION":
      return "destructive";
    default:
      return "neutral";
  }
};

const getStatusDisplay = (post: Post) => {
  let display = post.status.charAt(0) + post.status.slice(1).toLowerCase();
  let dateStr = "";
  switch (post.status) {
    case "APPROVED":
    case "C_APPROVED":
      if (post.approvedAt) dateStr = `(${format(new Date(post.approvedAt), "MMM dd")})`;
      break;
    case "REJECTED":
    case "NEEDS_MINOR_CHANGE":
      if (post.rejectedAt) dateStr = `(${format(new Date(post.rejectedAt), "MMM dd")})`;
      break;
    case "SCHEDULED":
      if (post.scheduledAt) dateStr = `(${format(new Date(post.scheduledAt), "MMM dd")})`;
      break;
    case "POSTED":
      if (post.postedAt) dateStr = `(${format(new Date(post.postedAt), "MMM dd")})`;
      break;
  }
  return `${display} ${dateStr}`.trim();
};

export default function PostTable({
  posts,
  permissions,
  selectedPosts,
  handleSelectAll,
  handleSelectPost,
  handleDeletePost,
  openApprovalDialog,
  openStatusChange,
  setViewingAssets,
  setCommentingPost,
  fetchComments,
  handleFileUpload,
  uploadingFiles,
}: PostTableProps) {
  // Canonical names only (see /api/me/permissions); the old "Manage-post" is posts:update.
  // Each flag is the permission the matching API route enforces, not a role name.
  const canSelectPosts = permissions.includes("posts:update");
  const canEditPost = canSelectPosts;
  const canDeletePost = permissions.includes("posts:delete");
  const canApprovePost = permissions.includes("posts:approve");
  const canChangeStatus = canApprovePost || permissions.includes("posts:publish") || permissions.includes("posts:status");
  const canUploadFiles = permissions.includes("assets:create");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isCompact, setIsCompact] = useState(false);

  const totalPosts = posts.length;
  const totalPages = Math.max(1, Math.ceil(totalPosts / pageSize));

  // Keep currentPage within bounds if filtered
  const safePage = Math.min(currentPage, totalPages);

  const paginatedPosts = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return posts.slice(start, start + pageSize);
  }, [posts, safePage, pageSize]);

  const startIndex = totalPosts > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(safePage * pageSize, totalPosts);

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No posts found"
        description="No posts match your filters or search criteria."
        className="my-4"
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Table Density & Count Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <div>
          Showing <span className="font-semibold text-foreground tabular-nums">{startIndex}–{endIndex}</span> of{" "}
          <span className="font-semibold text-foreground tabular-nums">{totalPosts}</span> posts
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCompact(!isCompact)}
            className="h-7 text-xs gap-1.5"
            title="Toggle row density"
          >
            <SlidersHorizontal className="size-3" />
            <span>{isCompact ? "Normal view" : "Compact density"}</span>
          </Button>
          <div className="flex items-center gap-1.5">
            <span className="text-xs">Rows:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger aria-label="Rows per page" className="h-7 w-16 text-xs tabular-nums">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-sm">
            <TableRow>
              {canSelectPosts && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedPosts.length === posts.length && posts.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead className="w-10 text-center font-mono">#</TableHead>
              <TableHead>Title & Overview</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Design Status</TableHead>
              <TableHead>Content Status</TableHead>
              <TableHead>Project / Client</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPosts.map((post, index) => {
              const rowIndex = (safePage - 1) * pageSize + index + 1;
              return (
                <TableRow
                  key={post.id}
                  className={`transition-colors hover:bg-muted/50 ${
                    isCompact ? "py-1" : "py-2.5"
                  }`}
                >
                  {canSelectPosts && (
                    <TableCell className={isCompact ? "py-1.5" : "py-3"}>
                      <Checkbox
                        checked={selectedPosts.includes(post.id)}
                        onCheckedChange={(checked) => handleSelectPost(post.id, checked as boolean)}
                      />
                    </TableCell>
                  )}
                  <TableCell className={`text-center font-mono text-muted-foreground text-xs ${isCompact ? "py-1.5" : "py-3"}`}>
                    {rowIndex}
                  </TableCell>
                  <TableCell className={`font-medium max-w-[280px] ${isCompact ? "py-1.5" : "py-3"}`}>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-xs sm:text-sm line-clamp-1">
                          {post.title}
                        </span>
                        <PostTimingBadge post={post} />
                      </div>
                      {post.caption && !isCompact && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{post.caption}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={isCompact ? "py-1.5" : "py-3"}>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <PostTypeIcon type={post.type} className="size-3.5" />
                      <span className="font-medium">{typeLabel(post.type)}</span>
                    </div>
                  </TableCell>
                  <TableCell className={isCompact ? "py-1.5" : "py-3"}>
                    <Badge variant={getDesignBadgeVariant(post.status)} dot className="text-xs">
                      {getStatusDisplay(post)}
                    </Badge>
                  </TableCell>
                  <TableCell className={isCompact ? "py-1.5" : "py-3"}>
                    <Badge variant={getContentBadgeVariant(post.contentStatus)} className="text-xs">
                      {contentStatusLabel(post.contentStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className={isCompact ? "py-1.5" : "py-3"}>
                    <div className="space-y-0.5">
                      <p className="font-medium text-xs text-foreground line-clamp-1">{post.project?.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{post.project?.client?.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className={`text-xs text-muted-foreground tabular-nums ${isCompact ? "py-1.5" : "py-3"}`}>
                    {format(new Date(post.createdAt), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell className={`text-xs text-muted-foreground ${isCompact ? "py-1.5" : "py-3"}`}>
                    {post.assignedTo?.name || "Unassigned"}
                  </TableCell>
                  <TableCell className={`text-right ${isCompact ? "py-1.5" : "py-3"}`}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-label="More actions for this post" variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 text-xs">
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href={`/dashboard/projects/posts/${post.id}`}>
                            <Eye className="mr-2 size-3.5" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {(canEditPost || canDeletePost) && (
                          <>
                            {canEditPost && (
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link href={`/dashboard/projects/posts/${post.id}/edit`}>
                                  <Edit className="mr-2 size-3.5" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {canDeletePost && (
                              <DropdownMenuItem
                                onClick={() => handleDeletePost(post.id)}
                                className="text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Trash2 className="mr-2 size-3.5" />
                                Delete
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => setViewingAssets(post.id)}
                          className="cursor-pointer"
                        >
                          <FileText className="mr-2 size-3.5" />
                          View Assets ({post.assets?.length || 0})
                        </DropdownMenuItem>
                        {(canApprovePost || canChangeStatus || canUploadFiles) && (
                          <>
                            <DropdownMenuSeparator />
                            {canApprovePost && (post.status === "SUBMITTED" || post.status === "RESUBMITTED") && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => openApprovalDialog(post.id, "approve")}
                                  className="text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                >
                                  <Check className="mr-2 size-3.5" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openApprovalDialog(post.id, "reject")}
                                  className="cursor-pointer"
                                >
                                  <X className="mr-2 size-3.5" />
                                  Changes
                                </DropdownMenuItem>
                              </>
                            )}
                            {canChangeStatus && (
                              <DropdownMenuItem onClick={() => openStatusChange(post.id)} className="cursor-pointer">
                                Change Status
                              </DropdownMenuItem>
                            )}
                            {canUploadFiles && (
                            <DropdownMenuItem className="cursor-pointer">
                              <label className="flex items-center cursor-pointer w-full">
                                <Upload className="mr-2 size-3.5" />
                                Upload Files
                                <input
                                  type="file"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => e.target.files && handleFileUpload(post.id, e.target.files)}
                                  accept="image/*,video/*"
                                />
                              </label>
                            </DropdownMenuItem>
                            )}
                            {uploadingFiles[post.id] && (
                              <DropdownMenuItem disabled className="text-muted-foreground">Uploading...</DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer Controls */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Page <span className="font-semibold text-foreground tabular-nums">{safePage}</span> of{" "}
            <span className="font-semibold text-foreground tabular-nums">{totalPages}</span>
          </p>

          <div className="flex items-center gap-1.5">
            <Button aria-label="First page"
              variant="outline"
              size="icon-xs"
              onClick={() => setCurrentPage(1)}
              disabled={safePage <= 1}
              title="First page"
            >
              <ChevronsLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="h-8 gap-1 text-xs px-2.5"
            >
              <ChevronLeft className="size-3.5" />
              <span>Previous</span>
            </Button>

            <span className="px-2 text-xs font-mono font-medium text-foreground">
              {safePage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="h-8 gap-1 text-xs px-2.5"
            >
              <span>Next</span>
              <ChevronRight className="size-3.5" />
            </Button>
            <Button aria-label="Last page"
              variant="outline"
              size="icon-xs"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage >= totalPages}
              title="Last page"
            >
              <ChevronsRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
