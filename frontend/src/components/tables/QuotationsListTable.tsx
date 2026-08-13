import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import type { Quotation, QuotationStatus } from "@/types/quotation";
import { Edit, Trash2 } from "lucide-react";
import { cellClass, headClass, rowClass } from "./table-styles";

const STATUS_STYLES: Record<QuotationStatus, string> = {
    DRAFT: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30",
    SENT: "bg-info/15 text-info border-info/30",
    ACCEPTED: "bg-success/15 text-success border-success/30",
    REJECTED: "bg-destructive/15 text-destructive border-destructive/30",
    EXPIRED: "bg-warning/20 text-warning-foreground dark:text-warning border-warning/40",
    CONVERTED: "bg-primary/15 text-primary border-primary/30",
};

interface QuotationsListTableProps {
    quotations: Quotation[];
    onView: (quotation: Quotation) => void;
    onEdit: (quotation: Quotation) => void;
    onDelete: (quotation: Quotation) => void;
}

export default function QuotationsListTable({ quotations, onView, onEdit, onDelete }: QuotationsListTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className={`${headClass} rounded-tl-xl`}>Number</TableHead>
                    <TableHead className={headClass}>Title</TableHead>
                    <TableHead className={headClass}>Client</TableHead>
                    <TableHead className={headClass}>Total</TableHead>
                    <TableHead className={headClass}>Valid Until</TableHead>
                    <TableHead className={headClass}>Status</TableHead>
                    <TableHead className={`${headClass} text-center rounded-tr-xl`}>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {quotations.map((quotation) => (
                    <TableRow key={quotation.id} className={`cursor-pointer ${rowClass}`} onClick={() => onView(quotation)}>
                        <TableCell className={`${cellClass} font-medium text-neutral-900 dark:text-white`}>{quotation.quotationNumber}</TableCell>
                        <TableCell className={cellClass}>{quotation.title}</TableCell>
                        <TableCell className={cellClass}>{quotation.client.name}</TableCell>
                        <TableCell className={cellClass}>{quotation.currency} {Number(quotation.totalAmount).toFixed(2)}</TableCell>
                        <TableCell className={cellClass}>{quotation.validUntil.slice(0, 10)}</TableCell>
                        <TableCell className={cellClass}>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[quotation.status]}`}>
                                {quotation.status}
                            </span>
                        </TableCell>
                        <TableCell className={cellClass}>
                            <div className="flex justify-center gap-2" onClick={(event) => event.stopPropagation()}>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`Edit ${quotation.title}`}
                                    className="rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 text-green-600 bg-green-600/10 hover:bg-green-600/15"
                                    onClick={() => onEdit(quotation)}
                                >
                                    <Edit className="w-4.5 h-4.5" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`Delete ${quotation.title}`}
                                    className="rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 text-red-500 bg-red-500/10 hover:bg-red-500/15"
                                    onClick={() => onDelete(quotation)}
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
