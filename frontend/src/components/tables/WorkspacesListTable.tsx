import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import type { Workspace } from "@/types/workspace";
import RowActions from "./RowActions";
import { cellClass, headClass, rowClass } from "./table-styles";

interface WorkspacesListTableProps {
    workspaces: Workspace[];
    onView: (workspace: Workspace) => void;
    onEdit: (workspace: Workspace) => void;
    onDelete: (workspace: Workspace) => void;
}

export default function WorkspacesListTable({ workspaces, onView, onEdit, onDelete }: WorkspacesListTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className={`${headClass} rounded-tl-xl w-[64px]`}>#</TableHead>
                    <TableHead className={headClass}>Name</TableHead>
                    <TableHead className={headClass}>Description</TableHead>
                    <TableHead className={headClass}>Members</TableHead>
                    <TableHead className={headClass}>Status</TableHead>
                    <TableHead className={`${headClass} text-center rounded-tr-xl`}>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {workspaces.map((workspace, index) => (
                    <TableRow key={workspace.id} className={`cursor-pointer ${rowClass}`} onClick={() => onView(workspace)}>
                        <TableCell className={`${cellClass} text-neutral-400`}>{String(index + 1).padStart(2, "0")}</TableCell>
                        <TableCell className={cellClass}>
                            <div className="flex items-center gap-2.5">
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: workspace.colorHex ?? "#94a3b8" }}
                                />
                                <span className="font-medium text-neutral-900 dark:text-white">{workspace.name}</span>
                            </div>
                        </TableCell>
                        <TableCell className={cellClass}>{workspace.description || "—"}</TableCell>
                        <TableCell className={cellClass}>{workspace.members.length}</TableCell>
                        <TableCell className={cellClass}>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${workspace.isActive ? "bg-success/15 text-success border-success/30" : "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30"}`}>
                                {workspace.isActive ? "ACTIVE" : "INACTIVE"}
                            </span>
                        </TableCell>
                        <TableCell className={cellClass}>
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
