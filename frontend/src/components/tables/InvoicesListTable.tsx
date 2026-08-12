import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import type { Invoice, InvoiceStatus } from "@/types/invoice";
import { Edit, Trash2 } from "lucide-react";
import { cellClass, headClass, rowClass } from "./table-styles";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
    DRAFT: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30",
    SENT: "bg-info/15 text-info border-info/30",
    VIEWED: "bg-info/15 text-info border-info/30",
    PARTIAL: "bg-warning/20 text-warning-foreground dark:text-warning border-warning/40",
    PAID: "bg-success/15 text-success border-success/30",
    OVERDUE: "bg-destructive/15 text-destructive border-destructive/30",
    CANCELLED: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30",
    REFUNDED: "bg-primary/15 text-primary border-primary/30",
};

interface InvoicesListTableProps {
    invoices: Invoice[];
    onEdit: (invoice: Invoice) => void;
    onDelete: (invoice: Invoice) => void;
}

export default function InvoicesListTable({ invoices, onEdit, onDelete }: InvoicesListTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className={`${headClass} rounded-tl-xl`}>Number</TableHead>
                    <TableHead className={headClass}>Title</TableHead>
                    <TableHead className={headClass}>Client</TableHead>
                    <TableHead className={headClass}>Total</TableHead>
                    <TableHead className={headClass}>Balance Due</TableHead>
                    <TableHead className={headClass}>Due Date</TableHead>
                    <TableHead className={headClass}>Status</TableHead>
                    <TableHead className={`${headClass} text-center rounded-tr-xl`}>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className={`cursor-pointer ${rowClass}`} onClick={() => onEdit(invoice)}>
                        <TableCell className={`${cellClass} font-medium text-neutral-900 dark:text-white`}>{invoice.invoiceNumber}</TableCell>
                        <TableCell className={cellClass}>{invoice.title}</TableCell>
                        <TableCell className={cellClass}>{invoice.client.name}</TableCell>
                        <TableCell className={cellClass}>{invoice.currency} {Number(invoice.totalAmount).toFixed(2)}</TableCell>
                        <TableCell className={cellClass}>
                            {invoice.balanceDue > 0 ? (
                                <span className="text-destructive font-medium">{invoice.currency} {invoice.balanceDue.toFixed(2)}</span>
                            ) : (
                                <span className="text-success font-medium">Paid</span>
                            )}
                        </TableCell>
                        <TableCell className={cellClass}>{invoice.dueDate.slice(0, 10)}</TableCell>
                        <TableCell className={cellClass}>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[invoice.status]}`}>
                                {invoice.status}
                            </span>
                        </TableCell>
                        <TableCell className={cellClass}>
                            <div className="flex justify-center gap-2" onClick={(event) => event.stopPropagation()}>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`Edit ${invoice.title}`}
                                    className="rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 text-green-600 bg-green-600/10 hover:bg-green-600/15"
                                    onClick={() => onEdit(invoice)}
                                >
                                    <Edit className="w-4.5 h-4.5" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`Delete ${invoice.title}`}
                                    className="rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 text-red-500 bg-red-500/10 hover:bg-red-500/15"
                                    onClick={() => onDelete(invoice)}
                                >
                                    <Trash2 className="w-4.5 h-4.5" />
                                </Button>
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
