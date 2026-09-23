import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { LogOut, Settings, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function ProfileDropdown() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/auth/login");
      toast.success("Logged out successfully.");
    } finally {
      setLoggingOut(false);
    }
  };

  const initial = user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";
  const displayName = user?.firstName || user?.email?.split("@")[0] || "User";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 p-1 rounded-full hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer"
          )}
          aria-label="User menu"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-primary/70 text-primary-foreground font-semibold text-xs flex items-center justify-center shadow-xs">
            {initial}
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 p-1.5 rounded-xl shadow-lg border border-border"
      >
        <DropdownMenuLabel className="p-2 font-normal">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground leading-none">
                {displayName}
              </p>
              {user?.roleName && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                  {user.roleName}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate leading-none pt-0.5">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="cursor-pointer text-xs rounded-lg py-2">
            <Link to="/view-profile" className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>Personal Profile</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer text-xs rounded-lg py-2">
            <Link to="/company" className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span>Company Settings</span>
            </Link>
          </DropdownMenuItem>

          {user?.roleName === "SUPER_ADMIN" && (
            <DropdownMenuItem asChild className="cursor-pointer text-xs rounded-lg py-2">
              <Link to="/roles-list" className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                <span>Access & Roles</span>
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          disabled={loggingOut}
          onClick={handleLogout}
          className="cursor-pointer text-xs rounded-lg py-2 text-rose-600 focus:text-rose-600 focus:bg-rose-500/10 dark:text-rose-400 dark:focus:text-rose-400"
        >
          <LogOut className="w-4 h-4 mr-2" />
          <span>{loggingOut ? "Signing out..." : "Sign out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
