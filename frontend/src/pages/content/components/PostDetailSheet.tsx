import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { humanizeEnum } from "@/types/campaign";
import type { PostDetail, PostStatus } from "@/types/post";
import { formatDistanceToNowStrict } from "date-fns";
import { ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import PublishPanel from "./PublishPanel";
import RequestApprovalPanel from "./RequestApprovalPanel";

interface PostDetailSheetProps {
  postId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  canEdit: boolean;
  canPublish?: boolean;
  canRequestApproval?: boolean;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-foreground/90 text-end">{value}</span>
    </div>
  );
}

export default function PostDetailSheet({
  postId,
  onOpenChange,
  onChanged,
  canEdit,
  canPublish = false,
  canRequestApproval = false,
}: PostDetailSheetProps) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    if (!postId) return;
    setIsLoading(true);
    try {
      setPost(await api.get<PostDetail>(`/posts/${postId}`));
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to load content."
      );
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!postId) {
      setPost(null);
      return;
    }
    void load();
  }, [postId, load]);

  const moveTo = async (status: PostStatus) => {
    if (!post) return;
    setIsBusy(true);
    try {
      await api.patch(`/posts/${post.id}`, { status });
      toast.success(`Moved to ${humanizeEnum(status)}.`);
      await load();
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not change status."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const addReference = async () => {
    if (!post || !referenceUrl.trim()) return;
    setIsBusy(true);
    try {
      await api.post(`/posts/${post.id}/references`, { url: referenceUrl.trim() });
      setReferenceUrl("");
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not add reference."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const removeReference = async (referenceId: string) => {
    if (!post) return;
    try {
      await api.delete(`/posts/${post.id}/references/${referenceId}`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not remove reference."
      );
    }
  };

  return (
    <Sheet open={!!postId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 flex flex-col gap-0 border-l border-border bg-card">
        {isLoading && !post ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !post ? null : (
          <>
            <SheetHeader className="p-5 pb-4 border-b border-border/80 sticky top-0 bg-card/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={post.status} />
                <span className="text-[11px] text-muted-foreground font-mono">
                  {humanizeEnum(post.postType)}
                </span>
              </div>
              <SheetTitle className="text-base font-semibold text-foreground pe-6 leading-snug">
                {post.title}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Content details, production timeline and references.
              </SheetDescription>
            </SheetHeader>

            <div className="p-5 space-y-6">
              {canEdit && post.allowedTransitions.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold text-foreground mb-2">
                    Move to
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {post.allowedTransitions.map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        className="h-7 text-xs"
                        onClick={() => void moveTo(status)}
                      >
                        {humanizeEnum(status)}
                      </Button>
                    ))}
                  </div>
                </section>
              )}

              {post.caption && (
                <section>
                  <h4 className="text-xs font-semibold text-foreground mb-2">
                    Caption
                  </h4>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {post.caption}
                  </p>
                </section>
              )}

              <section className="rounded-lg border border-border/70 px-3 py-1 divide-y divide-border/50">
                <MetaRow label="Client" value={post.client?.name ?? "—"} />
                <MetaRow label="Campaign" value={post.campaign?.name ?? "—"} />
                <MetaRow
                  label="Owner"
                  value={
                    post.assignee
                      ? `${post.assignee.firstName} ${post.assignee.lastName}`
                      : "Unassigned"
                  }
                />
                <MetaRow
                  label="Scheduled"
                  value={
                    post.scheduledDate
                      ? new Date(post.scheduledDate).toLocaleString("en-IN")
                      : "Not scheduled"
                  }
                />
              </section>

              <section>
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  References
                </h4>
                {post.references.length === 0 && (
                  <p className="text-xs text-muted-foreground mb-2">
                    No reference links yet. Add competitor posts or mood
                    references the designer should see.
                  </p>
                )}
                <ul className="space-y-1.5 mb-2">
                  {post.references.map((reference) => (
                    <li
                      key={reference.id}
                      className="flex items-center gap-2 text-xs group/ref"
                    >
                      <a
                        href={reference.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate flex items-center gap-1 flex-1"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {reference.title ?? reference.url}
                        </span>
                      </a>
                      {canEdit && (
                        <button
                          type="button"
                          aria-label="Remove reference"
                          onClick={() => void removeReference(reference.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/ref:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {canEdit && (
                  <div className="flex gap-2">
                    <Input
                      value={referenceUrl}
                      onChange={(event) => setReferenceUrl(event.target.value)}
                      placeholder="https://..."
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2"
                      disabled={isBusy || !referenceUrl.trim()}
                      onClick={() => void addReference()}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </section>

              <RequestApprovalPanel
                postId={post.id}
                postTitle={post.title}
                isUnderReview={post.status === "IN_REVIEW"}
                canRequest={canRequestApproval}
                onRequested={() => {
                  void load();
                  onChanged();
                }}
              />

              <PublishPanel
                postId={post.id}
                clientId={post.clientId}
                postStatus={post.status}
                canEdit={canEdit}
                canPublish={canPublish}
                onPublished={() => {
                  void load();
                  onChanged();
                }}
              />

              <section>
                <h4 className="text-xs font-semibold text-foreground mb-2">
                  Production timeline
                </h4>
                <ol className="space-y-2.5">
                  {post.timeline.map((entry) => (
                    <li key={entry.id} className="flex gap-2.5 text-xs">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                      <div className="flex-1">
                        <p className="text-foreground/90">
                          {entry.user
                            ? `${entry.user.firstName} ${entry.user.lastName}`
                            : "Someone"}{" "}
                          <span className="text-muted-foreground">
                            {humanizeEnum(entry.action).toLowerCase()}
                            {entry.fromValue && entry.toValue
                              ? ` — ${humanizeEnum(entry.fromValue)} → ${humanizeEnum(entry.toValue)}`
                              : entry.toValue
                                ? ` — ${humanizeEnum(entry.toValue)}`
                                : ""}
                          </span>
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNowStrict(new Date(entry.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
