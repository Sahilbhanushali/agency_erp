import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import Pagination from "@/components/shared/Pagination";
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
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { can } from "@/lib/permissions";
import {
  APPROVABLE_ENTITIES,
  APPROVAL_STATUSES,
  type ApprovalRequest,
  type ApprovalStatus,
} from "@/types/approval";
import { humanizeEnum } from "@/types/campaign";
import { CheckCheck } from "lucide-react";
import { useMemo, useState } from "react";
import ApprovalCard from "./components/ApprovalCard";

export default function ApprovalsList() {
  const { user: actor } = useAuth();
  const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";
  const canOverride = isSuperAdmin || can(actor, "approvals:update");

  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState<ApprovalStatus | "ALL">("ALL");
  const [entity, setEntity] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /** Any filter change invalidates the current offset, so page resets with it. */
  function applyFilter(change: () => void) {
    change();
    setPage(1);
  }

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    // The server reads mine=true as "pending and assigned to me", so the status
    // filter only applies to the wider list.
    if (scope === "mine") params.set("mine", "true");
    else {
      if (status !== "ALL") params.set("status", status);
      if (entity !== "ALL") params.set("entity", entity);
    }
    return params.toString();
  }, [page, pageSize, scope, status, entity]);

  const {
    data: approvals,
    total,
    isLoading,
    refetch,
  } = usePaginatedList<ApprovalRequest>(
    "/approvals",
    query,
    "Failed to load approvals."
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Everything waiting on a sign-off, and the decision trail behind each one."
        breadcrumbs={[{ label: "Approvals" }]}
        badge={
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            {total} {scope === "mine" ? "waiting on me" : "total"}
          </span>
        }
        actions={
          <Tabs
            value={scope}
            onValueChange={(value) =>
              applyFilter(() => setScope(value as "mine" | "all"))
            }
          >
            <TabsList className="h-8 p-0.5 bg-muted rounded-lg border border-border/80">
              <TabsTrigger value="mine" className="h-7 text-xs px-3">
                My queue
              </TabsTrigger>
              <TabsTrigger value="all" className="h-7 text-xs px-3">
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {scope === "all" && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onValueChange={(value) =>
              applyFilter(() => setStatus(value as ApprovalStatus | "ALL"))
            }
          >
            <SelectTrigger className="w-44 h-9 text-xs bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">
                All Statuses
              </SelectItem>
              {APPROVAL_STATUSES.map((option) => (
                <SelectItem key={option} value={option} className="text-xs">
                  {humanizeEnum(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={entity}
            onValueChange={(value) => applyFilter(() => setEntity(value))}
          >
            <SelectTrigger className="w-40 h-9 text-xs bg-background">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">
                All Types
              </SelectItem>
              {APPROVABLE_ENTITIES.map((option) => (
                <SelectItem key={option} value={option} className="text-xs">
                  {humanizeEnum(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title={
            scope === "mine" ? "Nothing waiting on you" : "No approvals yet"
          }
          description={
            scope === "mine"
              ? "When someone asks you to review content, a quotation or an invoice, it lands here."
              : "Approvals are raised from the record itself — open a piece of content that is in review and request a sign-off."
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {approvals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                currentUserId={actor?.id}
                canOverride={canOverride}
                onChanged={refetch}
              />
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => applyFilter(() => setPageSize(size))}
          />
        </>
      )}
    </div>
  );
}
