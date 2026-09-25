import { Card } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { humanizeEnum } from "@/types/campaign";
import {
  PIPELINE_STAGES,
  STAGE_DOT,
  type Lead,
  type LeadStatus,
  type PipelineStageSummary,
} from "@/types/lead";
import { Clock, IndianRupee } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";

interface LeadBoardProps {
  leads: Lead[];
  summary: PipelineStageSummary[];
  canMove: boolean;
  onSelect: (lead: Lead) => void;
  onMoved: () => void;
}

function money(value: number, currency = "INR") {
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function LeadBoard({
  leads,
  summary,
  canMove,
  onSelect,
  onMoved,
}: LeadBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<LeadStatus | null>(null);

  const columns = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>();
    for (const stage of PIPELINE_STAGES) map.set(stage, []);
    for (const lead of leads) map.get(lead.status)?.push(lead);
    return map;
  }, [leads]);

  const totals = useMemo(
    () => new Map(summary.map((row) => [row.status, row])),
    [summary]
  );

  const drop = async (stage: LeadStatus) => {
    if (!draggedId) return;
    const dragged = leads.find((lead) => lead.id === draggedId);
    setDraggedId(null);
    setDropStage(null);
    if (!dragged || dragged.status === stage) return;

    // The dropped card goes to the end of its new column.
    const ids = [
      ...(columns.get(stage) ?? []).map((lead) => lead.id),
      dragged.id,
    ];
    try {
      await api.patch("/leads/reorder", { status: stage, leadIds: ids });
      onMoved();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not move that lead."
      );
    }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-7 sm:grid-cols-3 grid-cols-1">
      {PIPELINE_STAGES.map((stage) => {
        const items = columns.get(stage) ?? [];
        const total = totals.get(stage);
        return (
          <section
            key={stage}
            aria-label={humanizeEnum(stage)}
            onDragOver={(event) => {
              if (!draggedId || !canMove) return;
              event.preventDefault();
              setDropStage(stage);
            }}
            onDragLeave={() =>
              setDropStage((current) => (current === stage ? null : current))
            }
            onDrop={(event) => {
              event.preventDefault();
              void drop(stage);
            }}
            className="min-w-0 flex flex-col"
          >
            <div className="flex items-center justify-between gap-2 mb-2 px-1.5 py-1 select-none">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={cn("w-2 h-2 rounded-full shrink-0", STAGE_DOT[stage])} />
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
                  {humanizeEnum(stage)}
                </h3>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                {total?.count ?? items.length}
              </span>
            </div>

            {total && total.value > 0 && (
              <p className="text-[10px] font-mono text-muted-foreground px-1.5 mb-1.5">
                {money(total.value)}
              </p>
            )}

            <div
              className={cn(
                "space-y-2 min-h-[140px] p-1.5 rounded-xl transition-colors",
                dropStage === stage
                  ? "bg-primary/5 ring-1 ring-primary/20"
                  : "bg-muted/20"
              )}
            >
              {items.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/80 py-6 text-center text-[11px] text-muted-foreground/60 select-none">
                  Empty
                </div>
              )}

              {items.map((lead) => (
                <Card
                  key={lead.id}
                  draggable={canMove && !lead.convertedClientId}
                  onDragStart={(event) => {
                    setDraggedId(lead.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", lead.id);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDropStage(null);
                  }}
                  onClick={() => onSelect(lead)}
                  className={cn(
                    "p-2.5 cursor-pointer hover:border-primary/40 transition-colors space-y-1.5",
                    canMove && !lead.convertedClientId && "active:cursor-grabbing",
                    draggedId === lead.id && "opacity-40"
                  )}
                >
                  <p className="text-xs font-semibold text-foreground leading-snug">
                    {lead.name}
                  </p>
                  {lead.companyName && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {lead.companyName}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-1.5 text-[10px]">
                    {lead.estimatedValue ? (
                      <span className="flex items-center gap-0.5 font-mono text-foreground/80">
                        <IndianRupee className="w-2.5 h-2.5" />
                        {Number(lead.estimatedValue).toLocaleString("en-IN", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    ) : (
                      <span />
                    )}
                    {lead.owner && (
                      <span
                        title={`${lead.owner.firstName} ${lead.owner.lastName}`}
                        className="w-4 h-4 rounded-full bg-muted border border-border text-[8px] font-semibold flex items-center justify-center text-muted-foreground shrink-0"
                      >
                        {lead.owner.firstName[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {lead.nextFollowUpAt && (
                    <p
                      className={cn(
                        "text-[10px] flex items-center gap-1",
                        new Date(lead.nextFollowUpAt) <= new Date()
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      )}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      {lead.nextFollowUpAt.slice(0, 10)}
                    </p>
                  )}
                  {lead.convertedClient && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      client: {lead.convertedClient.name}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
