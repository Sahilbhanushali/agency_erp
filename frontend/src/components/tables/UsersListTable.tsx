import StatusBadge from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { User } from "@/types/user";
import RowActions from "./RowActions";
import { cellClass, headClass, rowClass } from "./table-styles";

interface UsersListTableProps {
  users: User[];
  onView: (user: User) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export default function UsersListTable({
  users,
  onView,
  onEdit,
  onDelete,
}: UsersListTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${headClass} w-14 text-center`}>#</TableHead>
          <TableHead className={headClass}>Team Member</TableHead>
          <TableHead className={headClass}>Email Address</TableHead>
          <TableHead className={headClass}>Department & Role</TableHead>
          <TableHead className={headClass}>System Access</TableHead>
          <TableHead className={headClass}>Status</TableHead>
          <TableHead className={`${headClass} text-end pe-6`}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user, index) => (
          <TableRow
            key={user.id}
            className={`cursor-pointer ${rowClass}`}
            onClick={() => onView(user)}
          >
            <TableCell
              className={`${cellClass} text-center font-mono text-xs text-muted-foreground`}
            >
              {String(index + 1).padStart(2, "0")}
            </TableCell>
            <TableCell className={cellClass}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0 border border-primary/20">
                  {user.firstName?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {user.firstName} {user.lastName}
                  </span>
                  {user.designation && (
                    <span className="text-[11px] text-muted-foreground">
                      {user.designation}
                    </span>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell className={`${cellClass} text-xs text-muted-foreground font-mono`}>
              {user.email}
            </TableCell>
            <TableCell className={cellClass}>
              <span className="text-xs text-foreground/85">
                {user.department || "—"}
              </span>
            </TableCell>
            <TableCell className={cellClass}>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-foreground/80 border border-border/70">
                {user.role?.displayName ?? "User"}
              </span>
            </TableCell>
            <TableCell className={cellClass}>
              <StatusBadge status={user.status} />
            </TableCell>
            <TableCell className={`${cellClass} text-end pe-6`}>
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
