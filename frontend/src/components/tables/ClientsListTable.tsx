import StatusBadge from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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

export default function ClientsListTable({
  clients,
  onView,
  onEdit,
  onDelete,
}: ClientsListTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${headClass} w-14 text-center`}>#</TableHead>
          <TableHead className={headClass}>Client Name</TableHead>
          <TableHead className={headClass}>Contact Email</TableHead>
          <TableHead className={headClass}>Industry</TableHead>
          <TableHead className={headClass}>Phone</TableHead>
          <TableHead className={headClass}>Status</TableHead>
          <TableHead className={`${headClass} text-end pe-6`}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client, index) => (
          <TableRow
            key={client.id}
            className={`cursor-pointer ${rowClass}`}
            onClick={() => onView(client)}
          >
            <TableCell className={`${cellClass} text-center font-mono text-xs text-muted-foreground`}>
              {String(index + 1).padStart(2, "0")}
            </TableCell>
            <TableCell className={cellClass}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-xs shrink-0 border border-primary/20">
                  {client.name[0]?.toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {client.name}
                  </span>
                  {client.website && (
                    <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                      {client.website.replace(/^https?:\/\//, "")}
                    </span>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell className={`${cellClass} text-muted-foreground text-xs font-mono`}>
              {client.email}
            </TableCell>
            <TableCell className={cellClass}>
              <span className="text-xs text-foreground/80">
                {client.industry || "—"}
              </span>
            </TableCell>
            <TableCell className={`${cellClass} text-xs text-muted-foreground font-mono`}>
              {client.phone || "—"}
            </TableCell>
            <TableCell className={cellClass}>
              <StatusBadge status={client.isActive} />
            </TableCell>
            <TableCell className={`${cellClass} text-end pe-6`}>
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
