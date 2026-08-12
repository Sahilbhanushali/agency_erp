import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import type { User } from "@/types/user";
import RowActions from "./RowActions";
import { cellClass, headClass, rowClass } from "./table-styles";

const STATUS_STYLES: Record<User["status"], string> = {
    ACTIVE: "bg-success/15 text-success border-success/30",
    INACTIVE: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-300 border-neutral-400/30",
    SUSPENDED: "bg-destructive/15 text-destructive border-destructive/30",
    INVITED: "bg-warning/20 text-warning-foreground dark:text-warning border-warning/40",
};

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
                <TableRow className="hover:bg-transparent">
                    <TableHead className={`${headClass} rounded-tl-xl w-[64px]`}>#</TableHead>
                    <TableHead className={headClass}>Name</TableHead>
                    <TableHead className={headClass}>Email</TableHead>
                    <TableHead className={headClass}>Department</TableHead>
                    <TableHead className={headClass}>Designation</TableHead>
                    <TableHead className={headClass}>Role</TableHead>
                    <TableHead className={headClass}>Status</TableHead>
                    <TableHead className={`${headClass} text-center rounded-tr-xl`}>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map((user, index) => (
                    <TableRow key={user.id} className={`cursor-pointer ${rowClass}`} onClick={() => onView(user)}>
                        <TableCell className={`${cellClass} text-neutral-400`}>{String(index + 1).padStart(2, "0")}</TableCell>
                        <TableCell className={cellClass}>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                                    {user.firstName[0]?.toUpperCase()}
                                </span>
                                <span className="font-medium text-neutral-900 dark:text-white">{user.firstName} {user.lastName}</span>
                            </div>
                        </TableCell>
                        <TableCell className={cellClass}>{user.email}</TableCell>
                        <TableCell className={cellClass}>{user.department || "—"}</TableCell>
                        <TableCell className={cellClass}>{user.designation || "—"}</TableCell>
                        <TableCell className={cellClass}>{user.role.displayName}</TableCell>
                        <TableCell className={cellClass}>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[user.status]}`}>
                                {user.status}
                            </span>
                        </TableCell>
                        <TableCell className={cellClass}>
                            <RowActions
                                label={`${user.firstName} ${user.lastName}`}
                                onView={() => onView(user)}
                                onEdit={() => onEdit(user)}
                                onDelete={() => onDelete(user)}
                            />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
