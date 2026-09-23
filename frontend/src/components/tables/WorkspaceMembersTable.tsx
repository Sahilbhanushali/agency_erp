import RowActions from "@/components/tables/RowActions";
import { cellClass, headClass, rowClass } from "@/components/tables/table-styles";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import type { WorkspaceMember } from "@/types/workspace";

interface WorkspaceMembersTableProps {
    members: WorkspaceMember[];
    onView: (member: WorkspaceMember) => void;
    onRemove: (member: WorkspaceMember) => void;
}

export default function WorkspaceMembersTable({ members, onView, onRemove }: WorkspaceMembersTableProps) {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className={`${headClass} min-w-[200px]`}>Member</TableHead>
                        <TableHead className={`${headClass} min-w-[200px]`}>Email</TableHead>
                        <TableHead className={`${headClass} w-[140px]`}>Workspace Role</TableHead>
                        <TableHead className={`${headClass} text-right w-[90px]`}>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {members.map((member) => (
                        <TableRow
                            key={member.id}
                            className={`cursor-pointer ${rowClass}`}
                            onClick={() => onView(member)}
                        >
                            <TableCell className={cellClass}>
                                <div className="flex items-center gap-2.5">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-xs shrink-0">
                                        {member.user.firstName[0]?.toUpperCase() ?? "U"}
                                    </span>
                                    <div>
                                        <p className="font-medium text-foreground text-sm leading-tight">
                                            {member.user.firstName} {member.user.lastName}
                                        </p>
                                        <span className="text-[11px] text-muted-foreground font-mono">
                                            {member.memberRole || "Member"}
                                        </span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className={`${cellClass} text-muted-foreground text-sm font-mono text-xs`}>
                                {member.user.email}
                            </TableCell>
                            <TableCell className={cellClass}>
                                {member.memberRole ? (
                                    <Badge variant="outline" className="text-xs font-normal border-border bg-muted/30">
                                        {member.memberRole}
                                    </Badge>
                                ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                )}
                            </TableCell>
                            <TableCell className={`${cellClass} text-right`} onClick={(e) => e.stopPropagation()}>
                                <RowActions
                                    label={`${member.user.firstName} ${member.user.lastName}`}
                                    onView={() => onView(member)}
                                    onDelete={() => onRemove(member)}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
