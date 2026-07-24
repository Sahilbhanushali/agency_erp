import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import type { User } from "@/types/user";
import { Edit, Eye, Trash2 } from "lucide-react";

const STATUS_STYLES: Record<User["status"], string> = {
    ACTIVE: "bg-green-600/15 text-green-600 border-green-600",
    INACTIVE: "bg-gray-600/15 text-gray-600 dark:text-white border-gray-400",
    SUSPENDED: "bg-red-600/15 text-red-600 border-red-600",
    INVITED: "bg-yellow-500/15 text-yellow-600 border-yellow-500",
};

const cellClass = "py-4 px-4 border-b text-center first:border-s last:border-e border-neutral-200 dark:border-slate-600";
const headClass = "px-4 h-12 text-center bg-neutral-100 dark:bg-slate-700 border-t border-neutral-200 first:border-s last:border-e dark:border-slate-600";

interface UsersListTableProps {
    users: User[];
    onView: (user: User) => void;
    onEdit: (user: User) => void;
    onDelete: (user: User) => void;
}

export default function UsersListTable({ users, onView, onEdit, onDelete }: UsersListTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className={`${headClass} rounded-tl-lg w-[80px]`}>S.L</TableHead>
                    <TableHead className={`${headClass} text-start`}>Name</TableHead>
                    <TableHead className={headClass}>Email</TableHead>
                    <TableHead className={headClass}>Department</TableHead>
                    <TableHead className={headClass}>Designation</TableHead>
                    <TableHead className={headClass}>Role</TableHead>
                    <TableHead className={headClass}>Status</TableHead>
                    <TableHead className={`${headClass} rounded-tr-lg`}>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map((user, index) => {
                    const isLast = index === users.length - 1;
                    const rowCellClass = `${cellClass} ${isLast ? "rounded-bl-lg" : ""}`;
                    return (
                        <TableRow key={user.id} className="cursor-pointer" onClick={() => onView(user)}>
                            <TableCell className={rowCellClass}>{String(index + 1).padStart(2, "0")}</TableCell>
                            <TableCell className={`${rowCellClass} text-start`}>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                                        {user.firstName[0]?.toUpperCase()}
                                    </span>
                                    <span>{user.firstName} {user.lastName}</span>
                                </div>
                            </TableCell>
                            <TableCell className={rowCellClass}>{user.email}</TableCell>
                            <TableCell className={rowCellClass}>{user.department || "—"}</TableCell>
                            <TableCell className={rowCellClass}>{user.designation || "—"}</TableCell>
                            <TableCell className={rowCellClass}>{user.role.displayName}</TableCell>
                            <TableCell className={rowCellClass}>
                                <span className={`px-3 py-1.5 rounded text-sm font-medium border ${STATUS_STYLES[user.status]}`}>
                                    {user.status}
                                </span>
                            </TableCell>
                            <TableCell className={rowCellClass}>
                                <div className="flex justify-center gap-2" onClick={(event) => event.stopPropagation()}>
                                    <Button size="icon" variant="ghost" aria-label={`View ${user.firstName} ${user.lastName}`} className="rounded-[50%] text-blue-500 bg-primary/10" onClick={() => onView(user)}>
                                        <Eye className="w-5 h-5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" aria-label={`Edit ${user.firstName} ${user.lastName}`} className="rounded-[50%] text-green-600 bg-green-600/10" onClick={() => onEdit(user)}>
                                        <Edit className="w-5 h-5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" aria-label={`Delete ${user.firstName} ${user.lastName}`} className="rounded-[50%] text-red-500 bg-red-500/10" onClick={() => onDelete(user)}>
                                        <Trash2 className="w-5 h-5" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
