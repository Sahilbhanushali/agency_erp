import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { Eye, Edit, MoreHorizontal, FileText, MessageSquare, Check, X, Upload, Trash2 } from "lucide-react";
import { Session } from "next-auth";
import PostTimingBadge from "./postTimingBadge";

type PostStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SCHEDULED" | "POSTED" | "RESUBMITTED" | "NEEDS_MINOR_CHANGE" | "C_APPROVED";

interface Post {
  id: string;
  title: string;
  caption?: string;
  type: string;
  status: PostStatus; // Design Status
  contentStatus: string; // Content Status
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
  handleFileUpload: (postId: string, files: FileList) => void;
  uploadingFiles: { [key: string]: boolean };
}

const statusColors: Record<PostStatus, string> = {
  DRAFT: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
  SUBMITTED: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  APPROVED: "bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-800",
  REJECTED: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
  SCHEDULED: "bg-green-700 dark:bg-green-800 text-white border border-green-800 dark:border-green-900 font-semibold shadow-sm",
  POSTED: "bg-green-700 dark:bg-green-800 text-white border border-green-800 dark:border-green-900 font-semibold shadow-sm",
  RESUBMITTED: "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
  NEEDS_MINOR_CHANGE: "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200",
  C_APPROVED: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800",
};

const contentStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100",
  PENDING_REVIEW: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
  APPROVED: "bg-green-200 dark:bg-green-900 text-green-900 dark:text-green-200",
  NEEDS_REVISION: "bg-orange-200 dark:bg-orange-900 text-orange-900 dark:text-orange-200",
  REJECTED: "bg-red-200 dark:bg-red-900 text-red-900 dark:text-red-200",
  NEEDS_MINOR_CHANGE: "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200",
};

const typeIcons: Record<string, string> = {
  PHOTO: "📷",
  REEL: "🎬",
  STORY: "📱",
  CAROUSEL: "🎠",
  VIDEO: "🎥",
  CUSTOM: "✨",
};

const getStatusDisplay = (post: Post) => {
  let display = post.status.charAt(0) + post.status.slice(1).toLowerCase();
  if (post.status === "NEEDS_MINOR_CHANGE") display = "Needs Minor Change";
  if (post.status === "REJECTED") display = "Changes";
  let dateStr = "";
  switch (post.status) {
    case "APPROVED":
      if (post.approvedAt) dateStr = `(${format(new Date(post.approvedAt), "MMM dd, yyyy")})`;
      break;
    case "REJECTED":
    case "NEEDS_MINOR_CHANGE":
      if (post.rejectedAt) dateStr = `(${format(new Date(post.rejectedAt), "MMM dd, yyyy")})`;
      break;
    case "SCHEDULED":
      if (post.scheduledAt) dateStr = `(${format(new Date(post.scheduledAt), "MMM dd, yyyy")})`;
      break;
    case "POSTED":
      if (post.postedAt) dateStr = `(${format(new Date(post.postedAt), "MMM dd, yyyy")})`;
      break;
  }
  return `${display} ${dateStr}`.trim();
};

export default function PostTable({
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
  handleFileUpload,
  uploadingFiles,
}: PostTableProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              {permissions.includes("Manage-post") && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedPosts.length === posts.length && posts.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Design Status</TableHead>
              <TableHead>Content Status</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={permissions.includes("Manage-post") ? 9 : 8} className="text-center py-12 text-muted-foreground">
                  No posts found matching your filters
                </TableCell>
              </TableRow> 
            ) : (
              posts.map((post, index) => (
                <TableRow key={post.id}>
                  {permissions.includes("Manage-post") && (
                    <TableCell>
                      <Checkbox
                        checked={selectedPosts.includes(post.id)}
                        onCheckedChange={(checked) => handleSelectPost(post.id, checked as boolean)}
                      />
                    </TableCell>
                  )}
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{post.title}</span>
                        <PostTimingBadge post={post} />
                      </div>
                      {post.caption && (
                        <div className="text-sm text-muted-foreground max-w-xs truncate">{post.caption}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{typeIcons[post.type] || "📄"}</span>
                      <span className="text-sm">{post.type.charAt(0) + post.type.slice(1).toLowerCase()}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[post.status]}>{getStatusDisplay(post)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={contentStatusColors[post.contentStatus] || "bg-gray-100 text-gray-800"}>
                      {post.contentStatus === "REJECTED" ? "Changes" : post.contentStatus.charAt(0) + post.contentStatus.slice(1).toLowerCase().replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{post.project?.name}</div>
                      <div className="text-xs text-muted-foreground">{post.project?.client?.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(post.createdAt), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell className="text-sm">{post.assignedTo?.name || "Unassigned"}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/projects/posts/${post.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {["ADMIN", "Manager", "Content Writer"].includes(session?.user?.role || "") && (
                          <>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/projects/posts/${post.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeletePost(post.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setViewingAssets(post.id);
                          }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          View Assets ({post.assets?.length || 0})
                        </DropdownMenuItem>
                        {/* <DropdownMenuItem
                          onClick={() => {
                            setCommentingPost(post.id);
                            fetchComments(post.id);
                          }}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Comments
                        </DropdownMenuItem> */}
                        {["ADMIN", "Manager", "Team Lead"].includes(session?.user?.role || "") && (
                          <>
                            <DropdownMenuSeparator />
                            {(post.status === "SUBMITTED" || post.status === "RESUBMITTED") && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => openApprovalDialog(post.id, "approve")}
                                  className="text-green-600"
                                >
                                  <Check className="mr-2 h-4 w-4" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openApprovalDialog(post.id, "reject")}
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  Changes
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onClick={() => openStatusChange(post.id)}>
                              Change Status
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <label className="flex items-center cursor-pointer w-full">
                                <Upload className="mr-2 h-4 w-4" />
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
                            {uploadingFiles[post.id] && (
                              <DropdownMenuItem disabled>Uploading...</DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
