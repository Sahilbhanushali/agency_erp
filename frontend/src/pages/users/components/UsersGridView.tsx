import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@/types/user";
import { ArrowUpRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface UsersGridViewProps {
  users: User[];
  onView: (user: User) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export default function UsersGridView({
  users,
  onView,
  onEdit,
  onDelete,
}: UsersGridViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
      {users.map((user) => (
        <div
          key={user.id}
          className="group relative rounded-xl border border-border bg-card p-5 shadow-xs hover:shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between"
        >
          {/* Top row: Status & Actions */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <StatusBadge status={user.status} />

            <DropdownMenu>
              <DropdownMenuTrigger
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="User actions"
              >
                <MoreHorizontal className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem onClick={() => onEdit(user)}>
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Edit details
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(user)}
                  className="text-rose-600 focus:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Remove user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* User profile center */}
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center border-2 border-primary/20 mb-3 shadow-xs">
              {user.firstName?.[0]?.toUpperCase() ?? "U"}
            </div>

            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {user.firstName} {user.lastName}
            </h4>

            <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px] mt-0.5">
              {user.email}
            </p>

            <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground/80 border border-border/60">
              <span>{user.role?.displayName ?? "Member"}</span>
              {user.designation && <span>• {user.designation}</span>}
            </div>
          </div>

          {/* Department stats */}
          <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-1.5 rounded-lg bg-muted/40">
              <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                Department
              </span>
              <span className="font-medium text-foreground truncate block">
                {user.department || "—"}
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-muted/40">
              <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                Status
              </span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {user.status}
              </span>
            </div>
          </div>

          {/* View Profile Action */}
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4 h-8 text-xs gap-1.5 rounded-lg border-border hover:bg-primary/5 hover:text-primary hover:border-primary/30"
            onClick={() => onView(user)}
          >
            <span>View Profile</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
