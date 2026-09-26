import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DataTableShell from "@/components/shared/DataTableShell";
import PageHeader from "@/components/shared/PageHeader";
import CampaignsListTable from "@/components/tables/CampaignsListTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useDebounced } from "@/hooks/use-debounced";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { api, ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";
import {
  CAMPAIGN_STATUSES,
  humanizeEnum,
  type Campaign,
  type CampaignStatus,
} from "@/types/campaign";
import CampaignFormDialog from "./components/CampaignFormDialog";
import { Megaphone, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

export default function CampaignsList() {
  const { user: actor } = useAuth();
  const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CampaignStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [campaignToEdit, setCampaignToEdit] = useState<Campaign | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const debouncedSearch = useDebounced(search);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (status !== "ALL") params.set("status", status);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    return params.toString();
  }, [page, pageSize, status, debouncedSearch]);

  const {
    data: campaigns,
    total,
    isLoading,
    refetch,
  } = usePaginatedList<Campaign>(
    "/campaigns",
    query,
    "Failed to load campaigns."
  );

  useEffect(() => setPage(1), [debouncedSearch, pageSize, status]);

  const canCreate = isSuperAdmin || can(actor, "campaigns:create");
  const canEdit = isSuperAdmin || can(actor, "campaigns:update");
  const canDelete = isSuperAdmin || can(actor, "campaigns:delete");

  const openCreate = () => {
    setCampaignToEdit(null);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!campaignToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/campaigns/${campaignToDelete.id}`);
      toast.success("Campaign deleted.");
      refetch();
      setCampaignToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to delete campaign."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Client marketing pushes — brief, budget, schedule and the content produced against them."
        breadcrumbs={[{ label: "Campaigns" }]}
        badge={
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            {total} total
          </span>
        }
        actions={
          canCreate && (
            <Button
              size="sm"
              className="gap-1.5 h-9 rounded-lg shadow-xs"
              onClick={openCreate}
            >
              <Plus className="w-4 h-4" />
              <span>New Campaign</span>
            </Button>
          )
        }
      />

      <DataTableShell
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search campaigns by name or client...",
        }}
        filters={
          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(value as CampaignStatus | "ALL")
            }
          >
            <SelectTrigger className="w-44 h-9 text-xs bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">
                All Statuses
              </SelectItem>
              {CAMPAIGN_STATUSES.map((option) => (
                <SelectItem key={option} value={option} className="text-xs">
                  {humanizeEnum(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        isLoading={isLoading}
        isEmpty={campaigns.length === 0}
        emptyState={{
          icon: Megaphone,
          title:
            search || status !== "ALL"
              ? "No matching campaigns"
              : "No campaigns yet",
          description:
            search || status !== "ALL"
              ? "Try a different search term or clear the status filter."
              : "Create your first campaign to start organising content, budget and performance for a client.",
          action:
            !search && status === "ALL" && canCreate
              ? { label: "Create Campaign", onClick: openCreate, icon: Plus }
              : undefined,
        }}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      >
        <CampaignsListTable
          campaigns={campaigns}
          onView={(campaign) => {
            if (!canEdit) return;
            setCampaignToEdit(campaign);
            setFormOpen(true);
          }}
          onEdit={(campaign) => {
            setCampaignToEdit(campaign);
            setFormOpen(true);
          }}
          onDelete={canDelete ? setCampaignToDelete : () => undefined}
        />
      </DataTableShell>

      <CampaignFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        campaign={campaignToEdit}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={!!campaignToDelete}
        onOpenChange={(open) => !open && setCampaignToDelete(null)}
        title="Delete Campaign"
        description={`Delete "${campaignToDelete?.name}"? Its posts and metrics are kept but will no longer be grouped under this campaign. This cannot be undone.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
