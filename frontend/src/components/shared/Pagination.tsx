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

const Pagination = ({
    page,
    pageSize,
    total,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50],
}: PaginationProps) => {
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
        (pageNumber) => pageNumber === 1 || pageNumber === pageCount || Math.abs(pageNumber - page) <= 1,
    );

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-300">
                <span>Show</span>
                <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
                    <SelectTrigger className="min-w-[72px] h-9 focus-visible:shadow-none focus-visible:ring-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {pageSizeOptions.map((option) => (
                            <SelectItem key={option} value={String(option)}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <span>
                    {from}-{to} of {total}
                </span>
            </div>

            <div className="flex items-center flex-wrap gap-1">
                <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>

                {pageNumbers.map((pageNumber, index) => {
                    const previous = pageNumbers[index - 1];
                    const showEllipsis = previous !== undefined && pageNumber - previous > 1;
                    return (
                        <span key={pageNumber} className="flex items-center gap-1">
                            {showEllipsis && <span className="px-1 text-neutral-400">…</span>}
                            <Button
                                size="icon"
                                variant={pageNumber === page ? "default" : "outline"}
                                className="h-9 w-9"
                                onClick={() => onPageChange(pageNumber)}
                            >
                                {pageNumber}
                            </Button>
                        </span>
                    );
                })}

                <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9"
                    disabled={page >= pageCount}
                    onClick={() => onPageChange(page + 1)}
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

export default Pagination;
