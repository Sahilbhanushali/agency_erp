"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Send,
  UserCheck,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog";

export interface ApprovalStep {
  id: string;
  stage: "INTERNAL_LEAD" | "ACCOUNT_MANAGER" | "CLIENT";
  order: number;
  status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" | "SKIPPED";
  decisionAt?: string | null;
  decisionByName?: string | null;
  feedback?: string | null;
}

export interface ApprovalChain {
  id: string;
  postId: string;
  currentStageIndex: number;
  isCompleted: boolean;
  finalStatus: string;
  steps: ApprovalStep[];
}

interface ApprovalChainStepperProps {
  postId: string;
  chain: ApprovalChain | null;
  onRefresh: () => void;
  canDecide?: boolean;
  isClientView?: boolean;
}

const STAGE_LABELS: Record<string, { title: string; subtitle: string }> = {
  INTERNAL_LEAD: {
    title: "1. Internal Lead Review",
    subtitle: "Design / Content Team Lead sign-off",
  },
  ACCOUNT_MANAGER: {
    title: "2. Account Manager Review",
    subtitle: "Client alignment & deliverable check",
  },
  CLIENT: {
    title: "3. Client Sign-Off",
    subtitle: "Final approval by client stakeholders",
  },
};

export function ApprovalChainStepper({
  postId,
  chain,
  onRefresh,
  canDecide = true,
  isClientView = false,
}: ApprovalChainStepperProps) {
  const [decisionModal, setDecisionModal] = useState<{
    stage: "INTERNAL_LEAD" | "ACCOUNT_MANAGER" | "CLIENT";
    decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  if (!chain || !chain.steps) return null;

  const steps = chain.steps;
  const currentStep = steps[chain.currentStageIndex];

  const handleDecisionSubmit = async () => {
    if (!decisionModal) return;
    if (decisionModal.decision === "CHANGES_REQUESTED" && !feedback.trim()) {
      toast.error("Please explain what changes are requested.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/approval-chain/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: decisionModal.stage,
          decision: decisionModal.decision,
          feedback: feedback.trim() || undefined,
          authorName: isClientView ? "Client" : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record decision");

      toast.success(data.message || "Decision recorded successfully");
      setDecisionModal(null);
      setFeedback("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Error submitting decision");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmResetChain = async () => {
    setIsResetting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/approval-chain`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to reset chain");
      toast.success("Approval chain reset for re-review");
      setShowResetConfirm(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/50">
        <div>
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Approval Workflow Chain
          </h4>
          <p className="text-[11px] text-muted-foreground">
            {chain.isCompleted
              ? "All approval stages completed. Deliverable approved."
              : `Currently waiting on Stage ${chain.currentStageIndex + 1}: ${
                  STAGE_LABELS[currentStep?.stage]?.title || ""
                }`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {chain.isCompleted ? (
            <Badge variant="success" className="text-xs">
              <CheckCircle2 className="size-3 mr-1" /> Approved & Ready
            </Badge>
          ) : chain.finalStatus === "CHANGES_REQUESTED" ? (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="size-3 mr-1" /> Changes Requested
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              <Clock className="size-3 mr-1" /> In Review
            </Badge>
          )}

          {!isClientView && (chain.isCompleted || chain.finalStatus === "CHANGES_REQUESTED") && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={() => setShowResetConfirm(true)}
            >
              <RotateCcw className="size-3 mr-1" /> Reset Chain
            </Button>
          )}
        </div>
      </div>

      {/* Stepper Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {steps.map((step, idx) => {
          const isCurrent = idx === chain.currentStageIndex && !chain.isCompleted;
          const isPast = idx < chain.currentStageIndex || chain.isCompleted;
          const meta = STAGE_LABELS[step.stage] || {
            title: step.stage,
            subtitle: "",
          };

          const isClientStage = step.stage === "CLIENT";
          const canActOnThisStage =
            canDecide &&
            isCurrent &&
            ((isClientView && isClientStage) || (!isClientView && !isClientStage));

          return (
            <div
              key={step.id}
              className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
                isCurrent
                  ? "border-primary/80 bg-primary/5 shadow-2xs"
                  : step.status === "APPROVED"
                  ? "border-emerald-600/30 bg-emerald-500/5"
                  : step.status === "CHANGES_REQUESTED"
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-border/60 bg-muted/20 opacity-75"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  {meta.title}
                </span>
                {step.status === "APPROVED" && (
                  <Badge variant="success" className="text-[10px]">
                    Approved
                  </Badge>
                )}
                {step.status === "CHANGES_REQUESTED" && (
                  <Badge variant="destructive" className="text-[10px]">
                    Changes Req.
                  </Badge>
                )}
                {step.status === "PENDING" && (
                  <Badge
                    variant={isCurrent ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {isCurrent ? "In Progress" : "Pending"}
                  </Badge>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-snug">
                {meta.subtitle}
              </p>

              {/* Decision Log if decided */}
              {step.decisionAt && (
                <div className="pt-1.5 border-t border-border/40 text-[10px] space-y-0.5">
                  <div className="text-foreground font-medium flex items-center justify-between">
                    <span>By: {step.decisionByName || "Reviewer"}</span>
                    <span className="text-muted-foreground">
                      {format(new Date(step.decisionAt), "MMM d, HH:mm")}
                    </span>
                  </div>
                  {step.feedback && (
                    <p className="text-muted-foreground italic bg-background/60 p-1.5 rounded border border-border/30 line-clamp-3">
                      "{step.feedback}"
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons for the active stage */}
              {canActOnThisStage && (
                <div className="pt-2 border-t border-border/40 flex items-center gap-1.5">
                  <Button
                    size="sm"
                    className="text-xs h-7 flex-1"
                    onClick={() =>
                      setDecisionModal({ stage: step.stage, decision: "APPROVED" })
                    }
                  >
                    <CheckCircle2 className="size-3 mr-1" /> Approve Stage
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 flex-1 text-destructive hover:text-destructive"
                    onClick={() =>
                      setDecisionModal({
                        stage: step.stage,
                        decision: "CHANGES_REQUESTED",
                      })
                    }
                  >
                    <AlertTriangle className="size-3 mr-1" /> Changes
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Decision Modal */}
      <Dialog
        open={!!decisionModal}
        onOpenChange={(open) => {
          if (!open) {
            setDecisionModal(null);
            setFeedback("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {decisionModal?.decision === "APPROVED"
                ? `Approve ${STAGE_LABELS[decisionModal?.stage || ""]?.title || "Stage"}`
                : `Request Changes for ${STAGE_LABELS[decisionModal?.stage || ""]?.title || "Stage"}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              {decisionModal?.decision === "APPROVED"
                ? "This will mark this stage as approved and automatically advance the deliverable to the next review tier."
                : "Describe the required edits or revisions. The creative team will be notified immediately."}
            </p>

            <Textarea
              placeholder={
                decisionModal?.decision === "APPROVED"
                  ? "Optional note or congratulatory remark..."
                  : "Detail what needs fixing or revision..."
              }
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="text-xs min-h-[90px]"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setDecisionModal(null);
                setFeedback("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              variant={
                decisionModal?.decision === "APPROVED" ? "default" : "destructive"
              }
              disabled={submitting}
              onClick={handleDecisionSubmit}
            >
              {decisionModal?.decision === "APPROVED"
                ? "Confirm Approval"
                : "Submit Change Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={confirmResetChain}
        title="Reset Approval Chain?"
        itemName="Approval Stages"
        isLoading={isResetting}
      />
    </div>
  );
}
