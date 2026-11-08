"use client";

import { useLiveRefresh } from "@/hooks/use-live-refresh"

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, ChevronLeft, ChevronRight, FileCheck2, Image as ImageIcon } from "lucide-react";
import { VisualProofingCanvas } from "./visual-proofing-canvas";
import { ApprovalChainStepper, ApprovalChain } from "./approval-chain-stepper";

interface ProofingApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postTitle: string;
  projectName?: string;
  assets: Array<{
    id: string;
    url: string;
    filename: string;
    isReference?: boolean;
    isEdited?: boolean;
  }>;
  isClientView?: boolean;
  onUpdate?: () => void;
}

export function ProofingApprovalDialog({
  open,
  onOpenChange,
  postId,
  postTitle,
  projectName,
  assets = [],
  isClientView = false,
  onUpdate,
}: ProofingApprovalDialogProps) {
  const [chain, setChain] = useState<ApprovalChain | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);

  const deliverableAssets = assets.filter((a) => !a.isReference);
  const displayAssets = deliverableAssets.length > 0 ? deliverableAssets : assets;

  const currentAsset = displayAssets[currentAssetIndex] || displayAssets[0];
  const previousAsset = displayAssets.length > 1 ? displayAssets[1] : null;

  const fetchChain = async (opts?: { silent?: boolean }) => {
    if (!postId) return;
    if (!opts?.silent) setLoadingChain(true);
    try {
      const res = await fetch(`/api/posts/${postId}/approval-chain`);
      if (res.ok) {
        const data = await res.json();
        setChain(data.chain);
      }
    } catch (e) {
      console.error("Error fetching approval chain:", e);
    } finally {
      setLoadingChain(false);
    }
  };
  // Live: re-read when someone else changes what this shows.
  useLiveRefresh(() => fetchChain({ silent: true }), ["ApprovalChain", "ApprovalStep", "Post"])

  useEffect(() => {
    if (open && postId) {
      fetchChain();
    }
  }, [open, postId]);

  const handleRefresh = () => {
    fetchChain();
    if (onUpdate) onUpdate();
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileCheck2 className="size-4 text-primary" />
                <DialogTitle className="text-base font-semibold text-foreground">
                  {postTitle}
                </DialogTitle>
                {projectName && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {projectName}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visual proofing review, annotation pinpoints, and multi-stage approval sign-off
              </p>
            </div>

            {displayAssets.length > 1 && (
              <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg border border-border/50 text-xs">
                <span className="text-xs text-muted-foreground px-1">
                  Asset {currentAssetIndex + 1} of {displayAssets.length}
                </span>
                <Button aria-label="Previous asset"
                  size="icon-sm"
                  variant="ghost"
                  className="size-6"
                  disabled={currentAssetIndex === 0}
                  onClick={() => setCurrentAssetIndex((prev) => prev - 1)}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button aria-label="Next asset"
                  size="icon-sm"
                  variant="ghost"
                  className="size-6"
                  disabled={currentAssetIndex === displayAssets.length - 1}
                  onClick={() => setCurrentAssetIndex((prev) => prev + 1)}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Multi-Stage Stepper */}
          {loadingChain ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <ApprovalChainStepper
              postId={postId}
              chain={chain}
              onRefresh={handleRefresh}
              isClientView={isClientView}
            />
          )}

          {/* Proofing Canvas */}
          {currentAsset ? (
            <VisualProofingCanvas
              postId={postId}
              currentAssetUrl={currentAsset.url}
              previousAssetUrl={previousAsset?.url}
              assetId={currentAsset.id}
              canAnnotate={true}
              currentAuthorName={isClientView ? "Client Reviewer" : undefined}
              currentAuthorRole={isClientView ? "Client" : undefined}
            />
          ) : (
            <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              <ImageIcon className="size-8 mx-auto text-muted-foreground/50 mb-2" />
              No deliverable images or creatives uploaded for this post yet.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
