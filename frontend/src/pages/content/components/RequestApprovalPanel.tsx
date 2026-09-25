import Combobox from "@/components/shared/Combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, type Paginated } from "@/lib/api";
import type { ApprovalRequest } from "@/types/approval";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

interface MinimalUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface RequestApprovalPanelProps {
  postId: string;
  postTitle: string;
  /** Approvals are raised while the work is actually under review. */
  isUnderReview: boolean;
  canRequest: boolean;
  onRequested: () => void;
}

export default function RequestApprovalPanel({
  postId,
  postTitle,
  isUnderReview,
  canRequest,
  onRequested,
}: RequestApprovalPanelProps) {
  const [history, setHistory] = useState<ApprovalRequest[]>([]);
  const [users, setUsers] = useState<MinimalUser[]>([]);
  const [reviewerId, setReviewerId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await api.get<Paginated<ApprovalRequest>>(
        `/approvals?entity=POST&entityId=${postId}&limit=50`
      );
      setHistory(page.data);
    } catch {
      // The caller may simply lack approvals:read; the panel then stays quiet.
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canRequest) return;
    api.list<MinimalUser>("/users").then(setUsers).catch(() => undefined);
  }, [canRequest]);

  const pending = history.find((entry) => entry.status === "PENDING");

  const request = async () => {
    if (!reviewerId) return;
    setBusy(true);
    try {
      await api.post("/approvals", {
        entity: "POST",
        entityId: postId,
        assignedToId: reviewerId,
        title: `Approve "${postTitle}"`,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      toast.success("Approval requested.");
      setReviewerId("");
      setDueAt("");
      await load();
      onRequested();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not request approval."
      );
    } finally {
      setBusy(false);
    }
  };

  if (history.length === 0 && !canRequest) return null;

  return (
    <section>
      <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
        <CheckCheck className="w-3.5 h-3.5" />
        Approvals
      </h4>

      {history.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {history.map((entry) => (
            <li key={entry.id} className="text-xs text-muted-foreground">
              <span className="text-foreground/90">
                {entry.status.toLowerCase().replace("_", " ")}
              </span>
              {" — "}
              {entry.assignedTo?.firstName ?? entry.clientPortalUser?.name ?? "—"}
              {", "}
              {formatDistanceToNowStrict(new Date(entry.createdAt), {
                addSuffix: true,
              })}
              {entry.decisions.length > 0 && (
                <span> · {entry.decisions.length} decision(s)</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {pending ? (
        <p className="text-xs text-muted-foreground">
          Waiting on {pending.assignedTo?.firstName ?? "the client"}.{" "}
          <Link to="/approvals" className="text-primary hover:underline">
            Open approvals
          </Link>
        </p>
      ) : canRequest && isUnderReview ? (
        <div className="space-y-1.5">
          <Combobox
            value={reviewerId}
            onChange={setReviewerId}
            options={users.map((user) => ({
              value: user.id,
              label: `${user.firstName} ${user.lastName}`,
            }))}
            placeholder="Pick a reviewer"
            emptyText="No people found"
          />
          <div className="flex gap-1.5">
            <Input
              type="date"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className="h-7 text-[11px]"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs shrink-0"
              disabled={busy || !reviewerId}
              onClick={() => void request()}
            >
              Request
            </Button>
          </div>
        </div>
      ) : canRequest ? (
        <p className="text-[11px] text-muted-foreground">
          Move this to In Review to request a sign-off.
        </p>
      ) : null}
    </section>
  );
}
