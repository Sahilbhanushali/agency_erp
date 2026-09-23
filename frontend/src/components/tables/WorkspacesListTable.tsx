import StatusBadge from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Workspace } from "@/types/workspace";
import { Users } from "lucide-react";
import RowActions from "./RowActions";
import { cellClass, headClass, rowClass } from "./table-styles";

interface WorkspacesListTableProps {
  workspaces: Workspace[];
  onView: (workspace: Workspace) => void;
  onEdit: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
}

export default function WorkspacesListTable({
  workspaces,
  onView,
  onEdit,
  onDelete,
}: WorkspacesListTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${headClass} w-14 text-center`}>#</TableHead>
          <TableHead className={headClass}>Workspace Name</TableHead>
          <TableHead className={headClass}>Description</TableHead>
          <TableHead className={headClass}>Assigned Members</TableHead>
          <TableHead className={headClass}>Status</TableHead>
          <TableHead className={`${headClass} text-end pe-6`}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workspaces.map((workspace, index) => (
          <TableRow
            key={workspace.id}
            className={`cursor-pointer ${rowClass}`}
            onClick={() => onView(workspace)}
          >
            <TableCell
              className={`${cellClass} text-center font-mono text-xs text-muted-foreground`}
            >
              {String(index + 1).padStart(2, "0")}
            </TableCell>
            <TableCell className={cellClass}>
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-border/50"
                  style={{
                    backgroundColor: workspace.colorHex ?? "var(--primary)",
                  }}
                />
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {workspace.name}
                </span>
              </div>
            </TableCell>
            <TableCell className={`${cellClass} text-xs text-muted-foreground max-w-xs truncate`}>
              {workspace.description || "—"}
            </TableCell>
            <TableCell className={cellClass}>
              <div className="flex items-center gap-1.5 text-xs text-foreground/80">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-mono">{workspace.members.length}</span>
                <span className="text-muted-foreground">
                  member{workspace.members.length === 1 ? "" : "s"}
                </span>
              </div>
            </TableCell>
            <TableCell className={cellClass}>
              <StatusBadge status={workspace.isActive} />
            </TableCell>
            <TableCell className={`${cellClass} text-end pe-6`}>
              <RowActions
                label={workspace.name}
                onView={() => onView(workspace)}
                onEdit={() => onEdit(workspace)}
                onDelete={() => onDelete(workspace)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
