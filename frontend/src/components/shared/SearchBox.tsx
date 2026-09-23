import { useTheme } from "@/components/theme-provider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import {
  Briefcase,
  Building2,
  CheckSquare,
  FilePlus,
  FolderKanban,
  FolderPlus,
  House,
  LayoutGrid,
  Moon,
  Plus,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  User,
  UserPlus,
  UsersRound,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SearchBox() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const isSuperAdmin = user?.roleName === "SUPER_ADMIN";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/60 hover:bg-muted/90 hover:text-foreground border border-border/80 rounded-lg transition-colors cursor-pointer w-48 sm:w-64 justify-between"
      >
        <span className="flex items-center gap-2 truncate">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span>Search or jump to...</span>
        </span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground bg-background border border-border rounded">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search modules..." />
        <CommandList className="max-h-[360px] scrollbar-thin">
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Navigation">
            <CommandItem
              onSelect={() => runCommand(() => navigate("/dashboard"))}
            >
              <House className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </CommandItem>

            <CommandItem
              onSelect={() => runCommand(() => navigate("/tasks"))}
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              <span>My Tasks</span>
            </CommandItem>

            {(isSuperAdmin || can(user, "clients:read")) && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/clients-list"))}
              >
                <Briefcase className="mr-2 h-4 w-4" />
                <span>Clients</span>
              </CommandItem>
            )}

            {(isSuperAdmin || can(user, "projects:read")) && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/projects-list"))}
              >
                <FolderKanban className="mr-2 h-4 w-4" />
                <span>Projects</span>
              </CommandItem>
            )}

            {(isSuperAdmin || can(user, "workspaces:read")) && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/workspaces-list"))}
              >
                <LayoutGrid className="mr-2 h-4 w-4" />
                <span>Workspaces</span>
              </CommandItem>
            )}

            {(isSuperAdmin || can(user, "invoices:read")) && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/invoices-list"))}
              >
                <Wallet className="mr-2 h-4 w-4" />
                <span>Billing & Invoices</span>
              </CommandItem>
            )}

            {(isSuperAdmin || can(user, "quotations:read")) && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/quotations-list"))}
              >
                <Receipt className="mr-2 h-4 w-4" />
                <span>Quotations</span>
              </CommandItem>
            )}

            {(isSuperAdmin || can(user, "users:read")) && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/users-list"))}
              >
                <UsersRound className="mr-2 h-4 w-4" />
                <span>Team Members</span>
              </CommandItem>
            )}

            {(isSuperAdmin || can(user, "roles:read")) && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/roles-list"))}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                <span>Roles & Permissions</span>
              </CommandItem>
            )}

            {isSuperAdmin && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/companies-list"))}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <span>Companies</span>
              </CommandItem>
            )}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Quick Actions">
            {(isSuperAdmin || can(user, "clients:create")) && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/clients-list/create"))}
              >
                <Plus className="mr-2 h-4 w-4 text-emerald-500" />
                <span>Create New Client</span>
              </CommandItem>
            )}

            {(isSuperAdmin || can(user, "projects:create")) && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/projects-list/create"))}
              >
                <FolderPlus className="mr-2 h-4 w-4 text-emerald-500" />
                <span>Create New Project</span>
              </CommandItem>
            )}

            {(isSuperAdmin || can(user, "invoices:create")) && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/invoices-list/create"))}
              >
                <FilePlus className="mr-2 h-4 w-4 text-emerald-500" />
                <span>Create New Invoice</span>
              </CommandItem>
            )}

            {(isSuperAdmin || can(user, "quotations:create")) && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/quotations-list/create"))}
              >
                <Receipt className="mr-2 h-4 w-4 text-emerald-500" />
                <span>Create New Quotation</span>
              </CommandItem>
            )}

            {(isSuperAdmin || can(user, "users:create")) && (
              <CommandItem
                onSelect={() => runCommand(() => navigate("/users-list/create"))}
              >
                <UserPlus className="mr-2 h-4 w-4 text-emerald-500" />
                <span>Invite Team Member</span>
              </CommandItem>
            )}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Preferences & Settings">
            <CommandItem
              onSelect={() => runCommand(() => navigate("/view-profile"))}
            >
              <User className="mr-2 h-4 w-4" />
              <span>My Profile</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => navigate("/company"))}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Company Settings</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme("light"))}>
              <Sun className="mr-2 h-4 w-4" />
              <span>Switch to Light Theme</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme("dark"))}>
              <Moon className="mr-2 h-4 w-4" />
              <span>Switch to Dark Theme</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}