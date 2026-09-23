import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pageNumbers = Array.from(
    { length: pageCount },
    (_, index) => index + 1
  ).filter(
    (pageNumber) =>
      pageNumber === 1 ||
      pageNumber === pageCount ||
      Math.abs(pageNumber - page) <= 1
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-border bg-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Rows per page:</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger className="h-8 w-16 text-xs bg-transparent border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((option) => (
              <SelectItem key={option} value={String(option)} className="text-xs">
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ms-2">
          {from}–{to} of {total}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 text-xs rounded-lg"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {pageNumbers.map((pageNumber, index) => {
          const previous = pageNumbers[index - 1];
          const showEllipsis = previous !== undefined && pageNumber - previous > 1;
          return (
            <div key={pageNumber} className="flex items-center gap-1">
              {showEllipsis && (
                <span className="px-1 text-xs text-muted-foreground">…</span>
              )}
              <Button
                size="icon"
                variant={pageNumber === page ? "default" : "outline"}
                className="h-8 w-8 text-xs rounded-lg"
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </Button>
            </div>
          );
        })}

        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 text-xs rounded-lg"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
