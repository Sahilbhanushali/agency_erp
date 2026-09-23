import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import EmptyState from "./EmptyState";
import Pagination from "./Pagination";
import TableSkeleton from "./TableSkeleton";

interface SearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface EmptyConfig {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: LucideIcon;
  };
}

interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

interface DataTableShellProps {
  search?: SearchConfig;
  filters?: ReactNode;
  actions?: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyState?: EmptyConfig;
  skeletonColumns?: number;
  skeletonRows?: number;
  pagination?: PaginationConfig;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}

export default function DataTableShell({
  search,
  filters,
  actions,
  isLoading,
  isEmpty,
  emptyState,
  skeletonColumns = 6,
  skeletonRows = 6,
  pagination,
  children,
  className,
  headerClassName,
}: DataTableShellProps) {
  const hasToolbar = search || filters || actions;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-xs overflow-hidden flex flex-col",
        className
      )}
    >
      {hasToolbar && (
        <div
          className={cn(
            "p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card",
            headerClassName
          )}
        >
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {search && (
              <div className="relative w-full sm:w-64 md:w-72">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder={search.placeholder ?? "Search..."}
                  value={search.value}
                  onChange={(e) => search.onChange(e.target.value)}
                  className="ps-9 pe-8 h-9 text-sm bg-background border-border rounded-lg"
                />
                {search.value && (
                  <button
                    type="button"
                    onClick={() => search.onChange("")}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="sr-only">Clear search</span>
                  </button>
                )}
              </div>
            )}

            {filters && <div className="flex items-center gap-2 flex-wrap">{filters}</div>}
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}

      <div className="overflow-x-auto min-w-full">
        {isLoading ? (
          <TableSkeleton columns={skeletonColumns} rows={skeletonRows} />
        ) : isEmpty ? (
          <div className="p-8">
            <EmptyState
              icon={emptyState?.icon}
              title={emptyState?.title ?? "No data found"}
              description={emptyState?.description ?? "There are no records matching your query."}
              action={emptyState?.action}
            />
          </div>
        ) : (
          children
        )}
      </div>

      {!isLoading && !isEmpty && pagination && pagination.total > 0 && (
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
          pageSizeOptions={pagination.pageSizeOptions}
        />
      )}
    </div>
  );
}
