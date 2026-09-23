import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { getSidebarNav } from "@/data/SidebarData";
import { cn } from "@/lib/utils";
import {
  Building2,
  ChevronsUpDown,
  Layers,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { NavMain } from "./NavMain";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/auth/login");
  };

  const initial =
    user?.firstName?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "A";
  const displayName = user?.firstName || user?.email?.split("@")[0] || "User";
  const roleDisplay = user?.roleName?.replace(/_/g, " ") || "Workspace";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar transition-all duration-200">
      {/* Workspace Brand Header */}
      <SidebarHeader className="p-0 border-b border-sidebar-border">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/dashboard"
                className="h-14 px-3.5 flex items-center justify-between hover:bg-sidebar-accent/60 transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-xs shrink-0 ring-1 ring-primary/20">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0 text-left group-data-[collapsible=icon]:hidden">
                    <span className="text-xs font-bold tracking-tight text-sidebar-foreground truncate">
                      AgencyOS
                    </span>
                    <span className="text-[10px] text-sidebar-foreground/60 font-mono tracking-tight leading-tight truncate">
                      {roleDisplay}
                    </span>
                  </div>
                </div>

                <span className="px-1.5 py-0.5 text-[9px] font-mono font-medium uppercase tracking-wider rounded bg-sidebar-accent text-sidebar-foreground/70 border border-sidebar-border group-data-[collapsible=icon]:hidden">
                  PRO
                </span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="group-data-[collapsible=icon]:block hidden">
              AgencyOS Dashboard
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarHeader>

      {/* Main Navigation Scroll Area */}
      <SidebarContent className={cn("scrollbar-thin py-2")}>
        <NavMain items={getSidebarNav(user)} />
      </SidebarContent>

      {/* User Footer Profile & Popover */}
      {user && (
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2.5 p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground transition-colors cursor-pointer group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1 focus:outline-none focus:ring-1 focus:ring-sidebar-ring"
                aria-label="User account menu"
              >
                <div className="relative shrink-0">
                  <div className="w-7.5 h-7.5 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center border border-primary/25">
                    {initial}
                  </div>
                  {/* Status indicator dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
                </div>

                <div className="flex flex-col min-w-0 text-left flex-1 group-data-[collapsible=icon]:hidden">
                  <span className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-sidebar-foreground/60 truncate leading-tight font-mono">
                    {user.email}
                  </span>
                </div>

                <ChevronsUpDown className="w-3.5 h-3.5 text-sidebar-foreground/50 shrink-0 group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={8}
              className="w-56 p-1.5 rounded-xl border border-border shadow-lg bg-popover text-popover-foreground"
            >
              <DropdownMenuLabel className="p-2 font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-xs font-semibold leading-none text-foreground">{displayName}</p>
                  <p className="text-[11px] leading-none text-muted-foreground font-mono truncate">{user.email}</p>
                  <div className="pt-1">
                    <span className="inline-block px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded bg-muted text-muted-foreground border border-border">
                      {roleDisplay}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="my-1 bg-border/60" />

              <DropdownMenuItem
                className="text-xs flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent"
                onClick={() => navigate("/view-profile")}
              >
                <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                <span>My Profile</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="text-xs flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent"
                onClick={() => navigate("/company")}
              >
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Company Settings</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-border/60" />

              <DropdownMenuItem
                className="text-xs flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}