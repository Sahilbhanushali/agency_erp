import EmptyState from "@/components/shared/EmptyState";
import TableSkeleton from "@/components/shared/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { LucideIcon } from "lucide-react";
import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "react-toastify";

interface CompanyEntityPanelProps<T> {
  /** Company-scoped list endpoint, e.g. `/invoices?companyId=abc`. */
  endpoint: string;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  errorMessage: string;
  searchPlaceholder?: string;
  /** Decides whether a row survives the filter box. Omit to hide the box. */
  matches?: (row: T, query: string) => boolean;
  action?: { label: string; onClick: () => void };
  children: (rows: T[], reload: () => void) => ReactNode;
}

/**
 * Every tab on a company page does the same four things — fetch a company-scoped
 * list, show a skeleton, filter it, or explain why it is empty. This holds that once
 * so each tab is only its table.
 */
export default function CompanyEntityPanel<T>({
  endpoint,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  errorMessage,
  searchPlaceholder,
  matches,
  action,
  children,
}: CompanyEntityPanelProps<T>) {
  // Holds which endpoint the rows answer, so loading is derived rather than set
  // inside the effect — switching tabs then shows a skeleton with no extra state.
  const [state, setState] = useState<{ endpoint: string | null; rows: T[] }>({
    endpoint: null,
    rows: [],
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");

  const load = useCallback(() => setReloadKey((key) => key + 1), []);
  const isLoading = state.endpoint !== endpoint;

  useEffect(() => {
    let cancelled = false;
    api
      .list<T>(endpoint)
      .then((rows) => {
        if (!cancelled) setState({ endpoint, rows });
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error instanceof ApiError ? error.message : errorMessage);
        // Settle anyway, so the tab shows an empty state instead of a stuck skeleton.
        setState({ endpoint, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, errorMessage, reloadKey]);

  const rows = state.rows;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query || !matches) return rows;
    return rows.filter((row) => matches(row, query));
  }, [rows, search, matches]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {matches ? (
          <div className="relative max-w-xs w-full">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 ps-8 text-xs"
            />
          </div>
        ) : (
          <span />
        )}
        {action && (
          <Button size="sm" className="gap-1.5 h-9" onClick={action.onClick}>
            <Plus className="w-4 h-4" />
            <span>{action.label}</span>
          </Button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={search ? "Nothing matches that search" : emptyTitle}
          description={
            search ? "Try a different term or clear the box." : emptyDescription
          }
          action={search ? undefined : action}
        />
      ) : (
        children(filtered, load)
      )}
    </div>
  );
}
