import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import type { Client } from "@/types/client";
import RowActions from "./RowActions";
import { cellClass, headClass, rowClass } from "./table-styles";

interface ClientsListTableProps {
    clients: Client[];
    onView: (client: Client) => void;
    onEdit: (client: Client) => void;
    onDelete: (client: Client) => void;
}

export default function ClientsListTable({ clients, onView, onEdit, onDelete }: ClientsListTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className={`${headClass} rounded-tl-xl w-[64px]`}>#</TableHead>
                    <TableHead className={headClass}>Name</TableHead>
                    <TableHead className={headClass}>Email</TableHead>
                    <TableHead className={headClass}>Industry</TableHead>
                    <TableHead className={headClass}>Phone</TableHead>
                    <TableHead className={headClass}>Status</TableHead>
                    <TableHead className={`${headClass} text-center rounded-tr-xl`}>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {clients.map((client, index) => (
                    <TableRow key={client.id} className={`cursor-pointer ${rowClass}`} onClick={() => onView(client)}>
                        <TableCell className={`${cellClass} text-neutral-400`}>{String(index + 1).padStart(2, "0")}</TableCell>
                        <TableCell className={cellClass}>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                                    {client.name[0]?.toUpperCase()}
                                </span>
                                <span className="font-medium text-neutral-900 dark:text-white">{client.name}</span>
                            </div>
                        </TableCell>
                        <TableCell className={cellClass}>{client.email}</TableCell>
                        <TableCell className={cellClass}>{client.industry || "—"}</TableCell>
                        <TableCell className={cellClass}>{client.phone || "—"}</TableCell>
                        <TableCell className={cellClass}>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${client.isActive ? "bg-success/15 text-success border-success/30" : "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30"}`}>
                                {client.isActive ? "ACTIVE" : "INACTIVE"}
                            </span>
                        </TableCell>
                        <TableCell className={cellClass}>
                            <RowActions
                                label={client.name}
                                onView={() => onView(client)}
                                onEdit={() => onEdit(client)}
                                onDelete={() => onDelete(client)}
                            />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
