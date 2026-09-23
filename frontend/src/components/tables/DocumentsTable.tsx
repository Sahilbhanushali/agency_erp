import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import type { EmployeeDocument } from "@/types/user";
import { Download, FileText, Trash2 } from "lucide-react";
import { cellClass, headClass, rowClass } from "./table-styles";

function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentsTableProps {
    documents: EmployeeDocument[];
    onDownload: (document: EmployeeDocument) => void;
    onDelete: (document: EmployeeDocument) => void;
}

export default function DocumentsTable({ documents, onDownload, onDelete }: DocumentsTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className={`${headClass} rounded-tl-xl`}>Name</TableHead>
                    <TableHead className={headClass}>Category</TableHead>
                    <TableHead className={headClass}>Size</TableHead>
                    <TableHead className={headClass}>Uploaded</TableHead>
                    <TableHead className={`${headClass} text-center rounded-tr-xl`}>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {documents.map((document) => (
                    <TableRow key={document.id} className={`cursor-pointer ${rowClass}`} onClick={() => onDownload(document)}>
                        <TableCell className={cellClass}>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary shrink-0">
                                    <FileText className="w-4.5 h-4.5" />
                                </span>
                                <div className="min-w-0">
                                    <span className="block font-medium text-neutral-900 dark:text-white truncate">{document.name}</span>
                                    {document.isClientVisible && (
                                        <span className="text-xs text-info">Visible to client</span>
                                    )}
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className={cellClass}>{document.category.replace(/_/g, " ")}</TableCell>
                        <TableCell className={cellClass}>{formatSize(document.file.sizeBytes)}</TableCell>
                        <TableCell className={cellClass}>{document.createdAt.slice(0, 10)}</TableCell>
                        <TableCell className={cellClass}>
                            <div className="flex justify-center gap-2" onClick={(event) => event.stopPropagation()}>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`Download ${document.name}`}
                                    className="rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 text-blue-500 bg-blue-500/10 hover:bg-blue-500/15"
                                    onClick={() => onDownload(document)}
                                >
                                    <Download className="w-4.5 h-4.5" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`Delete ${document.name}`}
                                    className="rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 text-red-500 bg-red-500/10 hover:bg-red-500/15"
                                    onClick={() => onDelete(document)}
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
