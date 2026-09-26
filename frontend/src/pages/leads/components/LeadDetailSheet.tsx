import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { humanizeEnum } from "@/types/campaign";
import {
  LOGGABLE_ACTIVITIES,
  type LeadActivityType,
  type LeadDetail,
} from "@/types/lead";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowUpRight, Trash2, UserCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

interface LeadDetailSheetProps {
  leadId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  canEdit: boolean;
  canConvert: boolean;
  canDelete: boolean;
  onEdit: (lead: LeadDetail) => void;
  onDelete: (lead: LeadDetail) => void;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-foreground/90 text-end break-all">
        {value}
      </span>
    </div>
  );
}

export default function LeadDetailSheet({
  leadId,
  onOpenChange,
  onChanged,
  canEdit,
  canConvert,
  canDelete,
  onEdit,
  onDelete,
}: LeadDetailSheetProps) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [type, setType] = useState<LeadActivityType>("CALL");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!leadId) return;
    setIsLoading(true);
    try {
      setLead(await api.get<LeadDetail>(`/leads/${leadId}`));
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to load lead."
      );
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      return;
    }
    void load();
  }, [leadId, load]);

  const logActivity = async () => {
    if (!lead || !note.trim()) return;
    setBusy(true);
    try {
      await api.post(`/leads/${lead.id}/activities`, {
        type,
        note: note.trim(),
      });
      setNote("");
      await load();
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not log that."
      );
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    if (!lead) return;
    setBusy(true);
    try {
      await api.post(`/leads/${lead.id}/convert`, {});
      toast.success("Lead converted to a client.");
      await load();
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not convert."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!leadId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 flex flex-col gap-0 border-l border-border bg-card">
        {isLoading && !lead ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !lead ? null : (
          <>
            <SheetHeader className="p-5 pb-4 border-b border-border/80 sticky top-0 bg-card/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={lead.status} />
                <span className="text-[11px] text-muted-foreground font-mono">
                  {humanizeEnum(lead.source)}
                </span>
              </div>
              <SheetTitle className="text-base font-semibold text-foreground pe-6 leading-snug">
                {lead.name}
                {lead.companyName ? ` · ${lead.companyName}` : ""}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Lead details and activity history.
              </SheetDescription>
            </SheetHeader>

            <div className="p-5 space-y-6">
              {lead.convertedClient ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-xs text-foreground flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Now a client:{" "}
                    <Link
                      to={`/clients-list/${lead.convertedClient.id}`}
                      className="text-primary hover:underline"
                    >
                      {lead.convertedClient.name}
                      <ArrowUpRight className="w-3 h-3 inline ms-0.5" />
                    </Link>
                  </p>
                </div>
              ) : (
                canConvert && (
                  <Button
                    size="sm"
                    className="h-8 text-xs w-full"
                    disabled={busy}
                    onClick={() => void convert()}
                  >
                    Convert to client
                  </Button>
                )
              )}

              <div className="flex gap-2">
                {canEdit && !lead.convertedClient && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs flex-1"
                    onClick={() => onEdit(lead)}
                  >
                    Edit lead
                  </Button>
                )}
                {canDelete && !lead.convertedClient && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(lead)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              <section className="rounded-lg border border-border/70 px-3 py-1 divide-y divide-border/50">
                <Meta label="Owner" value={lead.owner ? `${lead.owner.firstName} ${lead.owner.lastName}` : "Unassigned"} />
                <Meta label="Email" value={lead.email ?? "—"} />
                <Meta label="Phone" value={lead.phone ?? "—"} />
                <Meta label="Industry" value={lead.industry ?? "—"} />
                <Meta
                  label="Estimated value"
                  value={
                    lead.estimatedValue
                      ? `${lead.currency === "INR" ? "₹" : lead.currency + " "}${Number(lead.estimatedValue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                      : "—"
                  }
                />
                <Meta label="Priority" value={humanizeEnum(lead.priority)} />
                <Meta
                  label="Next follow-up"
                  value={lead.nextFollowUpAt?.slice(0, 10) ?? "Not set"}
                />
                {lead.lostReason && (
                  <Meta label="Lost because" value={lead.lostReason} />
                )}
              </section>

              {lead.notes && (
                <section>
                  <h4 className="text-xs font-semibold text-foreground mb-2">
                    Notes
                  </h4>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {lead.notes}
                  </p>
                </section>
              )}

              {canEdit && (
                <section>
                  <h4 className="text-xs font-semibold text-foreground mb-2">
                    Log an interaction
                  </h4>
                  <div className="space-y-1.5">
                    <Select
                      value={type}
                      onValueChange={(value) =>
                        setType(value as LeadActivityType)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOGGABLE_ACTIVITIES.map((option) => (
                          <SelectItem
                            key={option}
                            value={option}
                            className="text-xs"
                          >
                            {humanizeEnum(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={2}
                      placeholder="What happened?"
                      className="text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={busy || !note.trim()}
                      onClick={() => void logActivity()}
                    >
                      Log it
                    </Button>
                  </div>
                </section>
              )}

              <section>
                <h4 className="text-xs font-semibold text-foreground mb-2">
                  History
                </h4>
                <ol className="space-y-2.5">
                  {lead.activities.map((entry) => (
                    <li key={entry.id} className="flex gap-2.5 text-xs">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                      <div className="flex-1">
                        <p className="text-foreground/90">
                          {entry.user
                            ? `${entry.user.firstName} ${entry.user.lastName}`
                            : "Someone"}{" "}
                          <span className="text-muted-foreground">
                            {humanizeEnum(entry.type).toLowerCase()}
                            {entry.fromValue && entry.toValue
                              ? ` — ${humanizeEnum(entry.fromValue)} → ${humanizeEnum(entry.toValue)}`
                              : ""}
                          </span>
                        </p>
                        {entry.note && (
                          <p className="text-muted-foreground mt-0.5">
                            {entry.note}
                          </p>
                        )}
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
