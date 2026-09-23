import StatusBadge from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Invoice } from "@/types/invoice";
import RowActions from "./RowActions";
import { cellClass, headClass, rowClass } from "./table-styles";

interface InvoicesListTableProps {
  invoices: Invoice[];
  onView?: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}

export default function InvoicesListTable({
  invoices,
  onView,
  onEdit,
  onDelete,
}: InvoicesListTableProps) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${headClass} w-28`}>Invoice #</TableHead>
          <TableHead className={headClass}>Title & Project</TableHead>
          <TableHead className={headClass}>Client</TableHead>
          <TableHead className={`${headClass} text-end`}>Total Amount</TableHead>
          <TableHead className={`${headClass} text-end`}>Balance Due</TableHead>
          <TableHead className={headClass}>Due Date</TableHead>
          <TableHead className={headClass}>Status</TableHead>
          <TableHead className={`${headClass} text-end pe-6`}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => {
          const isOverdue =
            invoice.dueDate.slice(0, 10) < today &&
            invoice.status !== "PAID" &&
            invoice.status !== "CANCELLED";

          return (
            <TableRow
              key={invoice.id}
              className={`cursor-pointer ${rowClass}`}
              onClick={() => (onView ? onView(invoice) : onEdit(invoice))}
            >
              <TableCell className={`${cellClass} font-mono font-semibold text-xs text-foreground group-hover:text-primary transition-colors`}>
                {invoice.invoiceNumber}
              </TableCell>
              <TableCell className={cellClass}>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground text-xs">
                    {invoice.title}
                  </span>
                  {invoice.project?.title && (
                    <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                      {invoice.project.title}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className={`${cellClass} text-xs text-foreground/80`}>
                {invoice.client?.name ?? "—"}
              </TableCell>
              <TableCell className={`${cellClass} text-end font-mono font-semibold text-xs tabular-nums text-foreground`}>
                {invoice.currency} {Number(invoice.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell className={`${cellClass} text-end font-mono text-xs tabular-nums`}>
                {invoice.balanceDue > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {invoice.currency} {Number(invoice.balanceDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Paid
                  </span>
                )}
              </TableCell>
              <TableCell
                className={`${cellClass} text-xs font-mono ${
                  isOverdue
                    ? "text-rose-600 dark:text-rose-400 font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {invoice.dueDate.slice(0, 10)}
              </TableCell>
              <TableCell className={cellClass}>
                <StatusBadge status={invoice.status} />
              </TableCell>
              <TableCell className={`${cellClass} text-end pe-6`}>
                <RowActions
                  label={invoice.invoiceNumber}
                  onView={onView ? () => onView(invoice) : undefined}
                  onEdit={() => onEdit(invoice)}
                  onDelete={() => onDelete(invoice)}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
