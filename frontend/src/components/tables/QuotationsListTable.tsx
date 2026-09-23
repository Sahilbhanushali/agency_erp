import StatusBadge from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Quotation } from "@/types/quotation";
import RowActions from "./RowActions";
import { cellClass, headClass, rowClass } from "./table-styles";

interface QuotationsListTableProps {
  quotations: Quotation[];
  onView?: (quotation: Quotation) => void;
  onEdit: (quotation: Quotation) => void;
  onDelete: (quotation: Quotation) => void;
}

export default function QuotationsListTable({
  quotations,
  onView,
  onEdit,
  onDelete,
}: QuotationsListTableProps) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${headClass} w-28`}>Quote #</TableHead>
          <TableHead className={headClass}>Title</TableHead>
          <TableHead className={headClass}>Client</TableHead>
          <TableHead className={`${headClass} text-end`}>Total Proposal</TableHead>
          <TableHead className={headClass}>Valid Until</TableHead>
          <TableHead className={headClass}>Status</TableHead>
          <TableHead className={`${headClass} text-end pe-6`}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {quotations.map((quotation) => {
          const isExpired =
            quotation.validUntil.slice(0, 10) < today &&
            quotation.status !== "ACCEPTED";

          return (
            <TableRow
              key={quotation.id}
              className={`cursor-pointer ${rowClass}`}
              onClick={() => (onView ? onView(quotation) : onEdit(quotation))}
            >
              <TableCell className={`${cellClass} font-mono font-semibold text-xs text-foreground group-hover:text-primary transition-colors`}>
                {quotation.quotationNumber}
              </TableCell>
              <TableCell className={`${cellClass} text-xs font-medium text-foreground`}>
                {quotation.title}
              </TableCell>
              <TableCell className={`${cellClass} text-xs text-foreground/80`}>
                {quotation.client?.name ?? "—"}
              </TableCell>
              <TableCell className={`${cellClass} text-end font-mono font-semibold text-xs tabular-nums text-foreground`}>
                {quotation.currency} {Number(quotation.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell
                className={`${cellClass} text-xs font-mono ${
                  isExpired
                    ? "text-rose-600 dark:text-rose-400 font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {quotation.validUntil.slice(0, 10)}
              </TableCell>
              <TableCell className={cellClass}>
                <StatusBadge status={quotation.status} />
              </TableCell>
              <TableCell className={`${cellClass} text-end pe-6`}>
                <RowActions
                  label={quotation.quotationNumber}
                  onView={onView ? () => onView(quotation) : undefined}
                  onEdit={() => onEdit(quotation)}
                  onDelete={() => onDelete(quotation)}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
