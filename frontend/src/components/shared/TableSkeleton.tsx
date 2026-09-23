import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cellClass, headClass } from "../tables/table-styles";

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
}

export default function TableSkeleton({
  columns = 5,
  rows = 6,
}: TableSkeletonProps) {
  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: columns }).map((_, index) => (
              <TableHead key={index} className={headClass}>
                <Skeleton className="h-3.5 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex} className="border-b border-border/60">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <TableCell key={colIndex} className={cellClass}>
                  <Skeleton
                    className={`h-4 ${
                      colIndex === 0
                        ? "w-8"
                        : colIndex === 1
                        ? "w-36"
                        : colIndex === columns - 1
                        ? "w-16 ms-auto"
                        : "w-24"
                    }`}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
