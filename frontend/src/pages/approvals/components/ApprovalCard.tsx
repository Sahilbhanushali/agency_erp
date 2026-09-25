import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { humanizeEnum } from "@/types/campaign";
import {
  DECISION_COPY,
  ENTITY_LINK,
  type ApprovalDecisionType,
  type ApprovalRequest,
} from "@/types/approval";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowUpRight, Clock } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

interface ApprovalCardProps {
  approval: ApprovalRequest;
  currentUserId?: string;
  canOverride: boolean;
  onChanged: () => void;
}

export default function ApprovalCard({
  approval,
  currentUserId,
  canOverride,
  onChanged,
}: ApprovalCardProps) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const isPending = approval.status === "PENDING";
  const isMine = approval.assignedTo?.id === currentUserId;
  // A client-assigned approval is decided in the portal, not here.
  const decidableHere = isPending && !approval.clientPortalUser;
  const canDecide = decidableHere && (isMine || canOverride);
  const canCancel =
    isPending && (approval.requestedById === currentUserId || canOverride);

  const link = ENTITY_LINK[approval.entity]?.(approval.entityId) ?? null;

  const send = async (decision: ApprovalDecisionType) => {
    setBusy(true);
    try {
      await api.post(`/approvals/${approval.id}/decisions`, {
        decision,
        comment: comment.trim() || undefined,
      });
      setComment("");
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not record that."
      );
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await api.patch(`/approvals/${approval.id}/cancel`);
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not withdraw it."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
              {humanizeEnum(approval.entity)}
            </span>
            <StatusBadge status={approval.status} />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {approval.title}
          </p>
          {approval.note && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {approval.note}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Asked by {approval.requestedBy?.firstName ?? "—"} ·{" "}
            {approval.clientPortalUser
              ? `client: ${approval.clientPortalUser.name}`
              : `reviewer: ${approval.assignedTo?.firstName ?? "—"}`}{" "}
            · {formatDistanceToNowStrict(new Date(approval.createdAt), {
              addSuffix: true,
            })}
          </p>
          {approval.dueAt && isPending && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              due{" "}
              {formatDistanceToNowStrict(new Date(approval.dueAt), {
                addSuffix: true,
              })}
            </p>
          )}
        </div>
        {link && (
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs shrink-0">
            <Link to={link}>
              Open <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        )}
      </div>

      {approval.decisions.length > 0 && (
        <ol className="space-y-1.5 border-s border-border/70 ps-3">
          {approval.decisions.map((entry) => {
            const copy = DECISION_COPY[entry.decision];
            return (
              <li key={entry.id} className="text-xs">
                <span className={cn("font-medium", copy.tone)}>
                  {copy.label}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  by{" "}
                  {entry.user
                    ? entry.user.firstName
                    : (entry.clientPortalUser?.name ?? "someone")}{" "}
                  ·{" "}
                  {formatDistanceToNowStrict(new Date(entry.createdAt), {
                    addSuffix: true,
                  })}
                </span>
                {entry.comment && (
                  <p className="text-muted-foreground mt-0.5">
                    {entry.comment}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {canDecide && (
        <div className="space-y-2 pt-1">
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            placeholder="Comment — required when asking for changes"
            className="text-xs"
          />
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={busy}
              onClick={() => void send("APPROVE")}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={busy}
              onClick={() => void send("REQUEST_CHANGES")}
            >
              Request changes
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-rose-600 dark:text-rose-400"
              disabled={busy}
              onClick={() => void send("REJECT")}
            >
              Reject
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={busy || !comment.trim()}
              onClick={() => void send("COMMENT")}
            >
              Comment only
            </Button>
          </div>
        </div>
      )}

      {!canDecide && isPending && approval.clientPortalUser && (
        <p className="text-[11px] text-muted-foreground">
          Waiting on the client to decide in their portal.
        </p>
      )}

      {!isPending && (
        <p className="text-[11px] text-muted-foreground">
          Decided {approval.resolvedAt
            ? formatDistanceToNowStrict(new Date(approval.resolvedAt), {
                addSuffix: true,
              })
            : ""}
          . A decision cannot be edited — raise a new approval for another round.
        </p>
      )}

      {canCancel && (
        <button
          type="button"
          className="text-[11px] text-muted-foreground hover:text-destructive"
          disabled={busy}
          onClick={() => void cancel()}
        >
          Withdraw request
        </button>
      )}
    </Card>
  );
}
