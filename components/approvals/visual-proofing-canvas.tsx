"use client";

import { useLiveRefresh } from "@/hooks/use-live-refresh"

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import {
  MessageSquare,
  Pin,
  CheckCircle2,
  Trash2,
  CornerDownRight,
  Send,
  X,
  Maximize2,
  Columns,
  Eye,
  Check,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMediaUrl } from "@/lib/utils";
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog";

export interface ProofAnnotationReply {
  id: string;
  annotationId: string;
  content: string;
  authorName: string;
  authorRole?: string | null;
  createdAt: string;
}

export interface ProofAnnotation {
  id: string;
  assetId?: string | null;
  postId: string;
  x: number;
  y: number;
  color?: string | null;
  comment: string;
  authorName: string;
  authorRole?: string | null;
  isResolved: boolean;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  version: number;
  createdAt: string;
  replies?: ProofAnnotationReply[];
}

interface VisualProofingCanvasProps {
  postId: string;
  currentAssetUrl: string;
  previousAssetUrl?: string | null;
  assetId?: string | null;
  currentAuthorName?: string;
  currentAuthorRole?: string;
  canAnnotate?: boolean;
}

export function VisualProofingCanvas({
  postId,
  currentAssetUrl,
  previousAssetUrl,
  assetId,
  currentAuthorName = "Reviewer",
  currentAuthorRole = "Internal Lead",
  canAnnotate = true,
}: VisualProofingCanvasProps) {
  const [annotations, setAnnotations] = useState<ProofAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [newComment, setNewComment] = useState("");
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [filterResolved, setFilterResolved] = useState<"ALL" | "OPEN" | "RESOLVED">("ALL");
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pinToDelete, setPinToDelete] = useState<string | null>(null);
  const [isDeletingPin, setIsDeletingPin] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchAnnotations = async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/annotations`);
      if (res.ok) {
        const data = await res.json();
        setAnnotations(data.annotations || []);
      }
    } catch (e) {
      console.error("Failed to load annotations", e);
    } finally {
      setLoading(false);
    }
  };
  // Live: re-read when someone else changes what this shows.
  useLiveRefresh(fetchAnnotations, ["ProofAnnotation", "ProofAnnotationReply"])

  useEffect(() => {
    if (postId) {
      fetchAnnotations();
    }
  }, [postId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAnnotating || !canAnnotate) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Constrain to 0-100%
    const boundedX = Math.max(2, Math.min(98, Number(x.toFixed(2))));
    const boundedY = Math.max(2, Math.min(98, Number(y.toFixed(2))));

    setPendingPin({ x: boundedX, y: boundedY });
    setActivePinId(null);
  };

  const handleCreateAnnotation = async () => {
    if (!pendingPin || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: assetId || null,
          x: pendingPin.x,
          y: pendingPin.y,
          comment: newComment.trim(),
          authorName: currentAuthorName,
          authorRole: currentAuthorRole,
        }),
      });

      if (!res.ok) throw new Error("Failed to add annotation");
      toast.success("Feedback pin dropped!");
      setNewComment("");
      setPendingPin(null);
      setIsAnnotating(false);
      fetchAnnotations();
    } catch (err: any) {
      toast.error(err.message || "Failed to drop pin");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleResolve = async (annotation: ProofAnnotation) => {
    try {
      const res = await fetch(`/api/posts/${postId}/annotations/${annotation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isResolved: !annotation.isResolved }),
      });
      if (!res.ok) throw new Error("Could not update");
      toast.success(annotation.isResolved ? "Marked as Open" : "Marked as Resolved");
      fetchAnnotations();
    } catch (err: any) {
      toast.error(err.message || "Error updating annotation");
    }
  };

  const confirmDeleteAnnotation = async () => {
    if (!pinToDelete) return;
    setIsDeletingPin(true);
    try {
      const res = await fetch(`/api/posts/${postId}/annotations/${pinToDelete}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not delete");
      toast.success("Annotation removed");
      if (activePinId === pinToDelete) setActivePinId(null);
      setPinToDelete(null);
      fetchAnnotations();
    } catch (err: any) {
      toast.error(err.message || "Error deleting annotation");
    } finally {
      setIsDeletingPin(false);
    }
  };

  const handleAddReply = async (annotationId: string) => {
    const text = replyTextMap[annotationId];
    if (!text?.trim()) return;

    try {
      const res = await fetch(`/api/posts/${postId}/annotations/${annotationId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text.trim(),
          authorName: currentAuthorName,
          authorRole: currentAuthorRole,
        }),
      });
      if (!res.ok) throw new Error("Could not add reply");
      toast.success("Reply added");
      setReplyTextMap((prev) => ({ ...prev, [annotationId]: "" }));
      fetchAnnotations();
    } catch (err: any) {
      toast.error(err.message || "Failed to reply");
    }
  };

  const filteredAnnotations = annotations.filter((a) => {
    if (filterResolved === "OPEN") return !a.isResolved;
    if (filterResolved === "RESOLVED") return a.isResolved;
    return true;
  });

  const activeAnnotation = annotations.find((a) => a.id === activePinId);


  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 p-2.5 rounded-lg border border-border/60">
        <div className="flex items-center gap-2">
          {canAnnotate && (
            <Button
              size="sm"
              variant={isAnnotating ? "default" : "outline"}
              onClick={() => {
                setIsAnnotating(!isAnnotating);
                setPendingPin(null);
              }}
              className="text-xs h-8"
            >
              <Pin className="size-3.5 mr-1.5" />
              {isAnnotating ? "Click image to place pin" : "Drop Pin / Feedback"}
            </Button>
          )}

          {previousAssetUrl && (
            <Button
              size="sm"
              variant={isCompareMode ? "secondary" : "ghost"}
              onClick={() => setIsCompareMode(!isCompareMode)}
              className="text-xs h-8"
            >
              <Columns className="size-3.5 mr-1.5" />
              {isCompareMode ? "Single View" : "Side-by-Side Compare"}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground mr-1">Filter pins:</span>
          <Button
            size="sm"
            variant={filterResolved === "ALL" ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setFilterResolved("ALL")}
          >
            All ({annotations.length})
          </Button>
          <Button
            size="sm"
            variant={filterResolved === "OPEN" ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setFilterResolved("OPEN")}
          >
            Open ({annotations.filter((a) => !a.isResolved).length})
          </Button>
          <Button
            size="sm"
            variant={filterResolved === "RESOLVED" ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setFilterResolved("RESOLVED")}
          >
            Resolved ({annotations.filter((a) => a.isResolved).length})
          </Button>
        </div>
      </div>

      {/* Main Proofing Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Visual Canvas Area (8 cols or 12 cols) */}
        <div className="lg:col-span-8 flex flex-col items-center">
          {isCompareMode && previousAssetUrl ? (
            /* Side-by-Side View */
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="flex flex-col items-center border border-border/70 rounded-lg p-2 bg-muted/20">
                <span className="text-xs font-semibold text-muted-foreground mb-2">Previous Version (v1)</span>
                <div className="relative max-h-[500px] w-full flex items-center justify-center">
                  <img
                    src={getMediaUrl(previousAssetUrl)}
                    alt="Previous revision"
                    className="max-h-[500px] w-auto object-contain rounded shadow-sm"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center border border-primary/40 rounded-lg p-2 bg-muted/20">
                <span className="text-xs font-semibold text-primary mb-2">Current Deliverable (Latest)</span>
                <div className="relative max-h-[500px] w-full flex items-center justify-center">
                  <img
                    src={getMediaUrl(currentAssetUrl)}
                    alt="Current deliverable"
                    className="max-h-[500px] w-auto object-contain rounded shadow-sm"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Single Interactive Proofing Canvas with Pin Markers */
            <div
              ref={containerRef}
              onClick={handleCanvasClick}
              className={`relative inline-block border border-border/80 rounded-xl overflow-hidden bg-muted/30 select-none shadow-sm ${
                isAnnotating ? "cursor-crosshair" : "cursor-default"
              }`}
            >
              <img
                src={getMediaUrl(currentAssetUrl)}
                alt="Deliverable asset"
                className="max-h-[580px] w-auto object-contain block"
              />

              {/* Render Existing Pins */}
              {filteredAnnotations.map((ann, idx) => {
                const isActive = activePinId === ann.id;
                return (
                  <button
                    key={ann.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePinId(isActive ? null : ann.id);
                    }}
                    style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center size-6 sm:size-7 rounded-full text-[11px] font-bold shadow-md transition-transform hover:scale-125 focus:outline-none z-10 ${
                      ann.isResolved
                        ? "bg-emerald-600 text-white ring-2 ring-emerald-300"
                        : isActive
                        ? "bg-neutral-900 text-white ring-4 ring-neutral-400 scale-110 dark:bg-white dark:text-neutral-900"
                        : "bg-red-600 text-white ring-2 ring-white/90"
                    }`}
                    title={`Pin #${idx + 1}: ${ann.comment}`}
                  >
                    {ann.isResolved ? <Check className="size-3.5" /> : idx + 1}
                  </button>
                );
              })}

              {/* Pending Pin Marker (when dropped but not yet saved) */}
              {pendingPin && (
                <div
                  style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 size-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs animate-bounce shadow-lg ring-4 ring-blue-300 z-20"
                >
                  +
                </div>
              )}
            </div>
          )}

          {/* Pending Pin Input Dialog Card (below canvas when dropping) */}
          {pendingPin && (
            <Card className="mt-3 w-full max-w-lg border-primary/50 shadow-md">
              <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between border-b border-border/50">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Pin className="size-3.5 text-primary" />
                  Add Feedback at ({pendingPin.x}%, {pendingPin.y}%)
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6"
                  onClick={() => setPendingPin(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="p-3 space-y-2.5">
                <Textarea
                  placeholder="Specify requested changes, corrections, or instructions..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="text-xs min-h-[70px] resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => setPendingPin(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs h-7"
                    disabled={!newComment.trim() || submitting}
                    onClick={handleCreateAnnotation}
                  >
                    Save Pin Feedback
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side Panel: Pin List & Active Thread (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          {activeAnnotation ? (
            /* Selected Active Pin Details & Reply Thread */
            <Card className="border-border/80 shadow-2xs">
              <CardHeader className="py-3 px-4 border-b border-border/50 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center size-6 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold">
                    #
                    {annotations.findIndex((a) => a.id === activeAnnotation.id) + 1}
                  </span>
                  <Badge
                    variant={activeAnnotation.isResolved ? "success" : "neutral"}
                    className="text-[10px]"
                  >
                    {activeAnnotation.isResolved ? "Resolved" : "Open"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setActivePinId(null)}
                  >
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-foreground">
                      {activeAnnotation.authorName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(activeAnnotation.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  {activeAnnotation.authorRole && (
                    <span className="text-[10px] text-muted-foreground block mb-2 uppercase font-medium">
                      {activeAnnotation.authorRole}
                    </span>
                  )}
                  <p className="text-xs text-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40 leading-relaxed whitespace-pre-wrap">
                    {activeAnnotation.comment}
                  </p>
                </div>

                {/* Actions: Resolve / Delete */}
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <Button
                    size="sm"
                    variant={activeAnnotation.isResolved ? "outline" : "default"}
                    className="text-xs h-7"
                    onClick={() => handleToggleResolve(activeAnnotation)}
                  >
                    {activeAnnotation.isResolved ? (
                      <>
                        <RotateCcw className="size-3 mr-1" /> Re-open
                      </>
                    ) : (
                      <>
                        <Check className="size-3 mr-1" /> Mark Resolved
                      </>
                    )}
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:text-destructive"
                    title="Delete Pin"
                    onClick={() => setPinToDelete(activeAnnotation.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {/* Thread Replies */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Discussion ({activeAnnotation.replies?.length || 0})
                  </span>

                  {activeAnnotation.replies && activeAnnotation.replies.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {activeAnnotation.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="bg-muted/30 p-2 rounded text-xs space-y-0.5 border border-border/30"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-foreground">
                              {reply.authorName}
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                              {formatDistanceToNow(new Date(reply.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                          <p className="text-foreground leading-snug">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Reply Input */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Input
                      placeholder="Reply to this thread..."
                      value={replyTextMap[activeAnnotation.id] || ""}
                      onChange={(e) =>
                        setReplyTextMap({
                          ...replyTextMap,
                          [activeAnnotation.id]: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddReply(activeAnnotation.id);
                        }
                      }}
                      className="text-xs h-8"
                    />
                    <Button
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => handleAddReply(activeAnnotation.id)}
                      disabled={!replyTextMap[activeAnnotation.id]?.trim()}
                    >
                      <Send className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Summary List of All Pins */
            <Card className="border-border/80 shadow-2xs">
              <CardHeader className="py-2.5 px-4 border-b border-border/50">
                <CardTitle className="text-xs font-semibold flex items-center justify-between">
                  <span>Annotation Pins ({filteredAnnotations.length})</span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Click any pin to inspect
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {filteredAnnotations.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No visual feedback pins placed yet.
                    {canAnnotate && (
                      <p className="mt-1 text-[11px] text-primary">
                        Click "Drop Pin / Feedback" to tag annotations on the image.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {filteredAnnotations.map((ann, idx) => (
                      <div
                        key={ann.id}
                        onClick={() => setActivePinId(ann.id)}
                        className="p-2.5 rounded-lg border border-border/60 hover:border-primary/50 hover:bg-muted/40 cursor-pointer transition-all space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="flex items-center justify-center size-5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-foreground truncate max-w-[120px]">
                              {ann.authorName}
                            </span>
                          </div>
                          <Badge
                            variant={ann.isResolved ? "success" : "neutral"}
                            className="text-[9px]"
                          >
                            {ann.isResolved ? "Resolved" : "Open"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {ann.comment}
                        </p>
                        {ann.replies && ann.replies.length > 0 && (
                          <div className="text-[10px] text-primary flex items-center gap-1 pt-0.5">
                            <MessageSquare className="size-3" />
                            {ann.replies.length} {ann.replies.length === 1 ? "reply" : "replies"}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <DeleteConfirmationDialog
        isOpen={!!pinToDelete}
        onClose={() => setPinToDelete(null)}
        onConfirm={confirmDeleteAnnotation}
        title="Delete Feedback Pin?"
        itemName="Feedback Pin"
        isLoading={isDeletingPin}
      />
    </div>
  );
}
