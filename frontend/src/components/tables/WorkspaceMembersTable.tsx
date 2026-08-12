import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import type { WorkspaceMember } from "@/types/workspace";
import { Eye, Trash2 } from "lucide-react";
import { cellClass, headClass, rowClass } from "./table-styles";

interface WorkspaceMembersTableProps {
    members: WorkspaceMember[];
    onView: (member: WorkspaceMember) => void;
    onRemove: (member: WorkspaceMember) => void;
}

export default function WorkspaceMembersTable({ members, onView, onRemove }: WorkspaceMembersTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className={`${headClass} rounded-tl-xl w-[64px]`}>#</TableHead>
                    <TableHead className={headClass}>Name</TableHead>
                    <TableHead className={headClass}>Email</TableHead>
                    <TableHead className={headClass}>Role</TableHead>
                    <TableHead className={`${headClass} text-center rounded-tr-xl`}>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {members.map((member, index) => (
                    <TableRow key={member.id} className={`cursor-pointer ${rowClass}`} onClick={() => onView(member)}>
                        <TableCell className={`${cellClass} text-neutral-400`}>{String(index + 1).padStart(2, "0")}</TableCell>
                        <TableCell className={cellClass}>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                                    {member.user.firstName[0]?.toUpperCase()}
                                </span>
                                <span className="font-medium text-neutral-900 dark:text-white">{member.user.firstName} {member.user.lastName}</span>
                            </div>
                        </TableCell>
                        <TableCell className={cellClass}>{member.user.email}</TableCell>
                        <TableCell className={cellClass}>{member.memberRole || "—"}</TableCell>
                        <TableCell className={cellClass}>
                            <div className="flex justify-center gap-2" onClick={(event) => event.stopPropagation()}>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`View ${member.user.firstName} ${member.user.lastName}`}
                                    className="rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 text-blue-500 bg-blue-500/10 hover:bg-blue-500/15"
                                    onClick={() => onView(member)}
                                >
                                    <Eye className="w-4.5 h-4.5" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`Remove ${member.user.firstName} ${member.user.lastName}`}
                                    className="rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 text-red-500 bg-red-500/10 hover:bg-red-500/15"
                                    onClick={() => onRemove(member)}
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
