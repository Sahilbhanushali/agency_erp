"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Edit2, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/use-permissions";
import toast from "react-hot-toast";

interface Post {
  id: string;
  title: string;
}

interface Comment {
  id: string;
  content: string;
  createdBy?: { name: string; email?: string };
  user?: { name: string; email?: string };
  createdAt: string;
  userId?: number;
}

interface CommentsDialogProps {
  commentingPost: string | null;
  setCommentingPost: (postId: string | null) => void;
  posts: Post[];
  postComments: { [key: string]: Comment[] };
  onRefreshComments?: (postId: string) => void;
}

export default function CommentsDialog({
  commentingPost,
  setCommentingPost,
  posts,
  postComments,
  onRefreshComments,
}: CommentsDialogProps) {
  const { data: session } = useSession();
  const { can } = usePermissions();
  const post = posts.find((p) => p.id === commentingPost);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentComments = commentingPost ? postComments[commentingPost] || [] : [];

  const handleStartEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editingCommentText.trim()) {
      toast.error("Comment text cannot be empty");
      return;
    }

    setIsUpdating(true);
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

      toast.success("Comment updated");
      setEditingCommentId(null);
      setEditingCommentText("");
      if (commentingPost && onRefreshComments) {
        onRefreshComments(commentingPost);
      }
    } catch (err: any) {
      console.error("Error updating comment:", err);
      toast.error(err.message || "Failed to update comment");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    setIsDeleting(true);
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

      toast.success("Comment deleted");
      setDeletingCommentId(null);
      if (commentingPost && onRefreshComments) {
        onRefreshComments(commentingPost);
      }
    } catch (err: any) {
      console.error("Error deleting comment:", err);
      toast.error(err.message || "Failed to delete comment");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={commentingPost !== null} onOpenChange={() => setCommentingPost(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comments for: {post?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-80 overflow-y-auto space-y-4 pr-1">
              {currentComments.length ? (
                currentComments.map((comment) => {
                  const authorName = comment.createdBy?.name || comment.user?.name || "Unknown";
                  const authorEmail = comment.createdBy?.email || comment.user?.email;
                  const isAuthor =
                    (session?.user?.email && authorEmail === session.user.email) ||
                    (session?.user?.name && authorName === session.user.name);
                  // Mirrors app/api/comments/[commentId]: authors, or posts:update / posts:delete.
                  const canEdit = isAuthor || can("posts", "update");
                  const canDelete = isAuthor || can("posts", "delete");

                  return (
                    <div key={comment.id} className="border-b pb-3 group">
                      {editingCommentId === comment.id ? (
                        <div className="space-y-2 my-1">
                          <Textarea aria-label="Edit comment"
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            className="text-xs min-h-[60px]"
                            autoFocus
                          />
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              className="h-7 text-xs"
                              disabled={isUpdating}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleSaveEdit(comment.id)}
                              className="h-7 text-xs"
                              disabled={isUpdating || !editingCommentText.trim()}
                            >
                              {isUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground font-medium">
                              {authorName} - {format(new Date(comment.createdAt), "MMM dd, yyyy HH:mm")}
                            </p>
                            {(canEdit || canDelete) && (
                              <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                {canEdit && (
                                <button aria-label="Edit comment"
                                  type="button"
                                  onClick={() => handleStartEdit(comment)}
                                  className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                  title="Edit comment"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                )}
                                {canDelete && (
                                <button aria-label="Delete comment"
                                  type="button"
                                  onClick={() => setDeletingCommentId(comment.id)}
                                  className="p-1 text-muted-foreground hover:text-red-600"
                                  title="Delete comment"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                )}
                              </div>
                            )}
                          </div>
                          <p className="text-sm mt-1 text-foreground/90 whitespace-pre-wrap">{comment.content}</p>
                        </>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No comments yet</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Feedback history is read-only. Talk with the creator and reviewers in the post&apos;s discussion.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentingPost(null)} className="min-h-9 text-xs">
              Close
            </Button>
            {commentingPost && (
              <Button asChild className="min-h-9 text-xs">
                <Link href={`/dashboard/projects/posts/${commentingPost}?tab=discussion`}>Open discussion</Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deletingCommentId !== null} onOpenChange={() => setDeletingCommentId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Delete Comment</DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-xs text-muted-foreground">
            Are you sure you want to delete this comment? This action cannot be undone.
          </DialogDescription>
          <DialogFooter className="mt-4 flex space-x-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setDeletingCommentId(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deletingCommentId && handleDelete(deletingCommentId)}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
