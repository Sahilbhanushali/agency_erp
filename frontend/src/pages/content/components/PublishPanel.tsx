import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError, type Paginated } from "@/lib/api";
import { cn } from "@/lib/utils";
import { humanizeEnum } from "@/types/campaign";
import type { PostStatus } from "@/types/post";
import type { PostTarget, SocialAccount } from "@/types/social-account";
import { AlertTriangle, CheckCircle2, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

const PUBLISHABLE: PostStatus[] = ["APPROVED", "SCHEDULED"];

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: "text-emerald-600 dark:text-emerald-400",
  FAILED: "text-rose-600 dark:text-rose-400",
  PUBLISHING: "text-sky-600 dark:text-sky-400",
  PENDING: "text-muted-foreground",
  SCHEDULED: "text-primary",
  CANCELLED: "text-muted-foreground",
};

interface PublishPanelProps {
  postId: string;
  clientId: string;
  postStatus: PostStatus;
  canEdit: boolean;
  canPublish: boolean;
  onPublished: () => void;
}

export default function PublishPanel({
  postId,
  clientId,
  postStatus,
  canEdit,
  canPublish,
  onPublished,
}: PublishPanelProps) {
  const [targets, setTargets] = useState<PostTarget[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTargets(await api.get<PostTarget[]>(`/posts/${postId}/targets`));
    } catch {
      // The panel is secondary to the post itself; a failure here stays quiet.
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api
      .get<Paginated<SocialAccount>>(
        `/social-accounts?clientId=${clientId}&limit=200`
      )
      .then((page) => setAccounts(page.data))
      .catch(() => undefined);
  }, [clientId]);

  const act = async (label: string, run: () => Promise<unknown>) => {
    try {
      await run();
      await load();
      onPublished();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : label);
    } finally {
      setBusyId(null);
    }
  };

  const addTarget = async () => {
    if (!selectedAccount) return;
    setBusyId("add");
    await act("Could not add that destination.", () =>
      api.post(`/posts/${postId}/targets`, {
        socialAccountId: selectedAccount,
      })
    );
    setSelectedAccount("");
  };

  const targeted = new Set(targets.map((target) => target.socialAccountId));
  const available = accounts.filter((account) => !targeted.has(account.id));
  const readyToPublish = PUBLISHABLE.includes(postStatus);

  return (
    <section>
      <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
        <Send className="w-3.5 h-3.5" />
        Destinations
      </h4>

      {targets.length === 0 && (
        <p className="text-xs text-muted-foreground mb-2">
          No destinations yet. Add the client profiles this should go out on.
        </p>
      )}

      <ul className="space-y-2 mb-3">
        {targets.map((target) => (
          <li
            key={target.id}
            className="rounded-lg border border-border/70 p-2.5 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {target.socialAccount.accountName}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {humanizeEnum(target.socialAccount.platform)}
                </p>
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold shrink-0",
                  STATUS_TONE[target.status]
                )}
              >
                {humanizeEnum(target.status)}
              </span>
            </div>

            {target.failureReason && (
              <p className="text-[10px] text-rose-600 dark:text-rose-400 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                <span>{target.failureReason}</span>
              </p>
            )}

            {target.platformPostId && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                <span className="font-mono truncate">
                  {target.platformPostId}
                </span>
              </p>
            )}

            {canPublish && readyToPublish && target.status !== "PUBLISHED" && (
              <div className="space-y-1.5 pt-1">
                {target.socialAccount.publishingAvailable && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs w-full"
                    disabled={busyId === target.id}
                    onClick={() => {
                      setBusyId(target.id);
                      void act("Publishing failed.", () =>
                        api.post(
                          `/posts/${postId}/targets/${target.id}/publish`
                        )
                      );
                    }}
                  >
                    {target.status === "FAILED" ? "Retry publish" : "Publish"}
                  </Button>
                )}
                <div className="flex gap-1.5">
                  <Input
                    value={evidence[target.id] ?? ""}
                    onChange={(event) =>
                      setEvidence((current) => ({
                        ...current,
                        [target.id]: event.target.value,
                      }))
                    }
                    placeholder="Platform post id or URL"
                    className="h-7 text-[11px]"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs shrink-0"
                    disabled={busyId === target.id || !evidence[target.id]?.trim()}
                    onClick={() => {
                      setBusyId(target.id);
                      void act("Could not record that publish.", () =>
                        api.post(
                          `/posts/${postId}/targets/${target.id}/mark-published`,
                          { platformPostId: evidence[target.id].trim() }
                        )
                      );
                    }}
                  >
                    I posted it
                  </Button>
                </div>
              </div>
            )}

            {canEdit && target.status !== "PUBLISHED" && (
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1"
                onClick={() => {
                  setBusyId(target.id);
                  void act("Could not remove that destination.", () =>
                    api.delete(`/posts/${postId}/targets/${target.id}`)
                  );
                }}
              >
                <Trash2 className="w-3 h-3" />
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && available.length > 0 && (
        <div className="flex gap-1.5">
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue placeholder="Add a destination" />
            </SelectTrigger>
            <SelectContent>
              {available.map((account) => (
                <SelectItem
                  key={account.id}
                  value={account.id}
                  className="text-xs"
                >
                  {account.accountName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs shrink-0"
            disabled={!selectedAccount || busyId === "add"}
            onClick={() => void addTarget()}
          >
            Add
          </Button>
        </div>
      )}

      {!readyToPublish && targets.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-2">
          Content must be approved before it can be published.
        </p>
      )}
    </section>
  );
}
