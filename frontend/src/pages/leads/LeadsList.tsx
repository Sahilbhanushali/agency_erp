import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useDebounced } from "@/hooks/use-debounced";
import { api, ApiError, type Paginated } from "@/lib/api";
import { can } from "@/lib/permissions";
import { humanizeEnum } from "@/types/campaign";
import {
  LEAD_SOURCES,
  type Lead,
  type LeadDetail,
  type PipelineStageSummary,
} from "@/types/lead";
import { Target, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import LeadBoard from "./components/LeadBoard";
import LeadDetailSheet from "./components/LeadDetailSheet";
import LeadFormDialog from "./components/LeadFormDialog";

/** The board needs every card at once; a pipeline this size fits one page. */
const BOARD_LIMIT = 200;

export default function LeadsList() {
  const { user: actor } = useAuth();
  const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";
  const canCreate = isSuperAdmin || can(actor, "leads:create");
  const canEdit = isSuperAdmin || can(actor, "leads:update");
  const canDelete = isSuperAdmin || can(actor, "leads:delete");
  const canConvert = canEdit && (isSuperAdmin || can(actor, "clients:create"));

  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<PipelineStageSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [view, setView] = useState<"board" | "followups">("board");
  const [formOpen, setFormOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    searchParams.get("leadId")
  );

  const debouncedSearch = useDebounced(search);

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: String(BOARD_LIMIT) });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (owner !== "ALL") params.set("ownerId", owner);
    if (source !== "ALL") params.set("source", source);
    if (view === "followups") params.set("followUpDue", "true");
    return params.toString();
  }, [debouncedSearch, owner, source, view]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [page, pipeline] = await Promise.all([
        api.get<Paginated<Lead>>(`/leads?${query}`),
        api.get<PipelineStageSummary[]>("/leads/pipeline"),
      ]);
      setLeads(page.data);
      setSummary(pipeline);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to load leads."
      );
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    for (const lead of leads) {
      if (lead.owner) {
        map.set(lead.owner.id, `${lead.owner.firstName} ${lead.owner.lastName}`);
      }
    }
    return [...map].map(([id, name]) => ({ id, name }));
  }, [leads]);

  const closeDetail = () => {
    setSelectedId(null);
    if (searchParams.has("leadId")) {
      searchParams.delete("leadId");
      setSearchParams(searchParams, { replace: true });
    }
  };

  const handleDelete = async () => {
    if (!leadToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/leads/${leadToDelete.id}`);
      toast.success("Lead removed.");
      setLeadToDelete(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not remove that lead."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const openValue = summary
    .filter((row) => row.status !== "WON" && row.status !== "LOST")
    .reduce((sum, row) => sum + row.value, 0);
  const wonValue = summary.find((row) => row.status === "WON")?.value ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Every prospect in play, from first contact to won or lost."
        breadcrumbs={[{ label: "Leads" }]}
        badge={
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            ₹{openValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })} in
            play
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Tabs
              value={view}
              onValueChange={(value) =>
                setView(value as "board" | "followups")
              }
            >
              <TabsList className="h-8 p-0.5 bg-muted rounded-lg border border-border/80">
                <TabsTrigger value="board" className="h-7 text-xs px-3">
                  Pipeline
                </TabsTrigger>
                <TabsTrigger value="followups" className="h-7 text-xs px-3">
                  Follow-ups due
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {canCreate && (
              <Button
                size="sm"
                className="gap-1.5 h-9 rounded-lg shadow-xs"
                onClick={() => {
                  setLeadToEdit(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                <span>New Lead</span>
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, company, email or phone..."
          className="h-9 text-xs max-w-xs"
        />
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="w-44 h-9 text-xs bg-background">
            <SelectValue placeholder="All Owners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">
              All Owners
            </SelectItem>
            {owners.map((entry) => (
              <SelectItem key={entry.id} value={entry.id} className="text-xs">
                {entry.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-40 h-9 text-xs bg-background">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">
              All Sources
            </SelectItem>
            {LEAD_SOURCES.map((option) => (
              <SelectItem key={option} value={option} className="text-xs">
                {humanizeEnum(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {wonValue > 0 && (
          <span className="text-[11px] text-muted-foreground ms-auto font-mono">
            won: ₹{wonValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-7 sm:grid-cols-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Target}
          title={
            view === "followups"
              ? "Nothing due for a chase"
              : "No leads in the pipeline"
          }
          description={
            view === "followups"
              ? "Leads with a follow-up date in the past show up here so nothing goes quiet."
              : "Add your first prospect and move it through contact, qualification and proposal until it becomes a client."
          }
          action={
            canCreate && view === "board"
              ? {
                  label: "Add Lead",
                  onClick: () => {
                    setLeadToEdit(null);
                    setFormOpen(true);
                  },
                }
              : undefined
          }
        />
      ) : view === "followups" ? (
        <div className="space-y-2">
          {leads.map((lead) => (
            <Card
              key={lead.id}
              className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setSelectedId(lead.id)}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {lead.name}
                  {lead.companyName ? ` · ${lead.companyName}` : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {humanizeEnum(lead.status)} ·{" "}
                  {lead.owner?.firstName ?? "Unassigned"}
                </p>
              </div>
              <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 shrink-0">
                due {lead.nextFollowUpAt?.slice(0, 10)}
              </span>
            </Card>
          ))}
        </div>
      ) : (
        <LeadBoard
          leads={leads}
          summary={summary}
          canMove={canEdit}
          onSelect={(lead) => setSelectedId(lead.id)}
          onMoved={load}
        />
      )}

      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={leadToEdit}
        onSaved={load}
      />

      <LeadDetailSheet
        leadId={selectedId}
        onOpenChange={(open) => !open && closeDetail()}
        onChanged={load}
        canEdit={canEdit}
        canConvert={canConvert}
        canDelete={canDelete}
        onEdit={(lead: LeadDetail) => {
          setLeadToEdit(lead);
          setFormOpen(true);
          closeDetail();
        }}
        onDelete={(lead: LeadDetail) => {
          setLeadToDelete(lead);
          closeDetail();
        }}
      />

      <ConfirmDialog
        open={!!leadToDelete}
        onOpenChange={(open) => !open && setLeadToDelete(null)}
        title="Remove Lead"
        description={`Remove ${leadToDelete?.name}? Its activity history goes with it. This cannot be undone.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
