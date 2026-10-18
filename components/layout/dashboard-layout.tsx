"use client"

import type React from "react"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import {
  BarChart3,
  Building2,
  Calendar,
  CheckCircle,
  ChevronRight,
  FileClock,
  FileSignature,
  FileText,
  FolderOpen,
  ImageIcon,
  Key,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Search,
  Settings,
  Sun,
  Target,
  User,
  UserCog,
  Users,
  UtilityPole,
  X,
  CalendarClock,
  Banknote,
  Briefcase,
} from "lucide-react"
import { useBreadcrumbs } from "@/lib/route-labels"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationCenter } from "./notification-center"
import DesktopNotifications from "@/components/notifications/desktop-notifications"

type NavigationItem = {
  name: string
  href: string
  icon: any
  /**
   * Catalog module this entry governs. Visibility follows `module:read`, which is the
   * same permission the page and its API check — so the sidebar cannot disagree with
   * what the user can actually open.
   */
  module?: string
  /** @deprecated Legacy flat names; kept so an unmigrated entry still resolves. */
  permissions?: string[]
  /**
   * @deprecated Role-name gating. Replaced by `module`, because a role name is not
   * proof of authorization — two installs can give the same role different permissions.
   */
  allowedRoles?: string[]
  subItems?: { name: string; href: string; icon: any }[]
}

const navigation: NavigationItem[] = [
  { name: "Dashboard", href: "/dashboard", module: "dashboard", icon: LayoutDashboard },
  { name: "My Tasks", href: "/dashboard/tasks", module: "tasks", icon: CheckCircle, permissions: ["View-tasks"] },
  { name: "My Day", href: "/dashboard/my-day", icon: Sun },
  { name: "Projects", href: "/dashboard/projects", module: "projects", icon: FolderOpen, permissions: ["Manage-projects", "View-project"] },
  { name: "Calendar", href: "/dashboard/calendar", module: "calendar", icon: Calendar, permissions: ["View-calender"] },
  { name: "Pending Approvals", href: "/dashboard/approvals", module: "approvals", icon: FileClock, permissions: ["Manage-approvals"] },
  { name: "Assets", href: "/dashboard/assets", module: "assets", icon: ImageIcon, permissions: ["View-assets"] },
  { name: "Reports", href: "/dashboard/reports", module: "reports", icon: BarChart3, permissions: ["View-reports"] },
  { name: "Leads Pipeline", href: "/dashboard/leads", module: "leads", icon: Target, allowedRoles: ["ADMIN", "MANAGER", "TEAM_LEAD"] },
  { name: "Clients", href: "/dashboard/clients", module: "clients", icon: Users, permissions: ["Manage-clients", "View-clients"] },
  { name: "Contracts & SOW", href: "/dashboard/contracts", module: "contracts", icon: FileSignature, permissions: ["Manage-clients", "View-clients"] },
  { name: "Expenses & Margins", href: "/dashboard/expenses", module: "expenses", icon: Receipt, allowedRoles: ["ADMIN", "MANAGER", "TEAM_LEAD"] },
  { name: "Companies", href: "/dashboard/companies", module: "companies", icon: Building2, permissions: ["Manage-companies", "View-companies"] },
  { name: "Quotations", href: "/dashboard/quotations", module: "quotations", icon: FileText, permissions: ["Manage-quotations", "View-quotations"] },
  { name: "Invoices", href: "/dashboard/invoices", module: "invoices", icon: Receipt, permissions: ["Manage-invoices", "View-invoices"] },
  { name: "User Management", href: "/dashboard/users", module: "users", icon: UserCog, permissions: ["Manage-User"], allowedRoles: ["ADMIN", "MANAGER"] },
  { name: "Recruitment & HRMS", href: "/dashboard/hrms", module: "hrms", icon: Briefcase, allowedRoles: ["ADMIN", "MANAGER", "TEAM_LEAD"] },
  { name: "Attendance & Leaves", href: "/dashboard/attendance", module: "attendance", icon: CalendarClock },
  { name: "Payroll", href: "/dashboard/payroll", module: "payroll", icon: Banknote },
  { name: "Utilities", href: "/dashboard/utilities", module: "utilities", icon: UtilityPole, permissions: ["View-utilities"] },
  { name: "Credentials", href: "/dashboard/credentials", module: "credentials", icon: Key, allowedRoles: ["ADMIN", "MANAGER", "TEAM_LEAD"] },
  { name: "Settings", href: "/dashboard/settings", module: "settings", icon: Settings, permissions: ["Manage-settings"] },
]

const navigationGroups = [
  { label: "Overview", names: ["Dashboard"] },
  { label: "Delivery", names: ["My Tasks", "My Day", "Projects", "Calendar", "Pending Approvals", "Assets", "Reports"] },
  { label: "Agency", names: ["Leads Pipeline", "Clients", "Contracts & SOW", "Expenses & Margins", "Companies", "Quotations", "Invoices", "User Management", "Recruitment & HRMS", "Attendance & Leaves", "Payroll", "Utilities", "Credentials"] },
  { label: "Preferences", names: ["Settings"] },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [accessibleModules, setAccessibleModules] = useState<string[]>([])
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)

  // Dynamic breadcrumbs based on pathname with entity resolution
  const breadcrumbs = useBreadcrumbs(pathname)

  useEffect(() => {
    if (session?.user?.id) {
      const fetchPermissions = async () => {
        try {
          // Session-scoped: takes no user id, so there is nothing to tamper with.
          // Returns both the legacy flat names and the effective module:action set.
          const [legacyRes, effectiveRes] = await Promise.all([
            fetch("/api/users/permissions", { headers: { "Content-Type": "application/json" } }),
            fetch("/api/me/permissions", { headers: { "Content-Type": "application/json" } }),
          ])
          if (!legacyRes.ok) throw new Error(`HTTP ${legacyRes.status}: ${legacyRes.statusText}`)
          const legacy = await legacyRes.json()
          setUserPermissions(legacy.permissions || [])

          if (effectiveRes.ok) {
            const effective = await effectiveRes.json()
            setAccessibleModules(effective.modules || [])
          }
        } catch (error) {
          console.error("Fetch permissions error:", error)
          setUserPermissions([])
          setAccessibleModules([])
        } finally {
          setIsPermissionsLoading(false)
        }
      }
      fetchPermissions()
    } else {
      setIsPermissionsLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => setSidebarOpen(false), [pathname])

  // Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCmdOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = useCallback((command: () => void) => {
    setCmdOpen(false)
    command()
  }, [])

  if (status === "loading" || isPermissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-xs space-y-4 px-6 text-center" aria-label="Loading dashboard">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Loader2 className="size-5 animate-spin" />
          </div>
          <p className="text-xs font-medium text-muted-foreground animate-pulse">Loading workspace...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated" || !session) {
    if (typeof window !== "undefined") {
      window.location.href = "/auth/signin"
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" aria-live="polite">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Redirecting to sign in...
        </div>
      </div>
    )
  }

  // Navigation is built from effective permissions. `module:read` is the same
  // permission the page and its API enforce, so a visible link always leads somewhere
  // the user can actually open — and a hidden one is never the only protection.
  const filteredNavigation = navigation.filter((item) => {
    if (item.module) return accessibleModules.includes(item.module)
    // Entries not yet mapped to a module fall back to the legacy names.
    if (item.permissions?.length) {
      return item.permissions.some((permission) => userPermissions.includes(permission))
    }
    return true
  })

  const userInitial = session.user.name?.charAt(0).toUpperCase() || "U"

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Slim Top Bar */}
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-border/70 bg-card/80 backdrop-blur-md supports-[backdrop-filter]:bg-card/70">
        <div className="flex h-full items-center justify-between px-3 sm:px-5">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open navigation"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-muted-foreground hover:text-foreground"
            >
              <Menu className="size-4" />
            </Button>
            
            {/* Breadcrumb Navigation */}
            <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs">
              <Link href="/dashboard" className="font-medium text-muted-foreground hover:text-foreground transition-colors">
                Workspace
              </Link>
              {breadcrumbs.slice(1).map((bc, idx) => (
                <div key={bc.href} className="flex items-center gap-1.5 text-muted-foreground">
                  <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                  {idx === breadcrumbs.length - 2 ? (
                    <span className="font-semibold text-foreground truncate max-w-[180px]">{bc.title}</span>
                  ) : (
                    <Link href={bc.href} className="hover:text-foreground transition-colors truncate max-w-[120px]">
                      {bc.title}
                    </Link>
                  )}
                </div>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Cmd+K Search Trigger */}
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:border-border hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Search className="size-3.5" />
              <span className="hidden md:inline">Quick jump...</span>
              <kbd className="hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border border-border/80 bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-[9px]">⌘</span>K
              </kbd>
            </button>

            {/* Role Badge */}
            <Badge variant="outline" className="hidden lg:inline-flex text-[10px] font-mono uppercase tracking-wider">
              {session.user.role || "User"}
            </Badge>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-muted-foreground hover:text-foreground"
            >
              <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            {/* Notification Center */}
            <DesktopNotifications />
            <NotificationCenter />
          </div>
        </div>
      </header>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-[240px] flex-col border-r border-border/70 bg-sidebar transition-transform duration-200 ease-out lg:top-0 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Workspace Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-border/70 px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-2xs font-bold text-xs">
              iD
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-tight text-foreground leading-none">itsmeDezino</span>
              <span className="text-[10px] text-muted-foreground/80 mt-0.5 font-medium leading-none">Agency Platform</span>
            </div>
          </Link>
          
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Navigation Groups */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
          {navigationGroups.map((group) => {
            const items = filteredNavigation.filter((item) => group.names.includes(item.name))
            if (!items.length) return null
            return (
              <section key={group.label} className="space-y-1">
                <h2 className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </h2>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const isActive = item.href === "/dashboard/projects"
                      ? pathname.startsWith(item.href)
                      : pathname === item.href || item.subItems?.some((sub) => pathname === sub.href)
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          title={item.name}
                          className={`group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                            isActive
                              ? "bg-accent text-accent-foreground font-semibold shadow-2xs"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          }`}
                        >
                          <item.icon className={`size-4 shrink-0 transition-colors ${isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`} />
                          <span className="truncate">{item.name}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="border-t border-border/70 p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto w-full justify-start gap-2.5 p-2 text-left hover:bg-muted/60">
                <Avatar className="size-7 shrink-0 border border-border/60">
                  <AvatarFallback className="bg-muted text-[11px] font-bold text-foreground">{userInitial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground leading-tight">{session.user.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground leading-tight">{session.user.email}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" side="top">
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-foreground">{session.user.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{session.user.email}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {userPermissions.length ? (
                    userPermissions.slice(0, 2).map((permission) => (
                      <Badge key={permission} variant="neutral" className="text-[9px] px-1.5 py-0">{permission}</Badge>
                    ))
                  ) : (
                    <Badge variant="neutral" className="text-[9px]">Standard Access</Badge>
                  )}
                  {userPermissions.length > 2 && (
                    <Badge variant="neutral" className="text-[9px]">+{userPermissions.length - 2}</Badge>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="text-xs cursor-pointer">
                <Link href="/profile"><User className="mr-2 size-3.5" />Profile Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-xs cursor-pointer">
                <Link href="/dashboard/settings"><Settings className="mr-2 size-3.5" />System Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs text-destructive focus:text-destructive cursor-pointer"
                onClick={() => signOut({ callbackUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/signin` })}
              >
                <LogOut className="mr-2 size-3.5" />Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Cmd+K Command Palette */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Type a command or search routes..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {filteredNavigation.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => runCommand(() => router.push(item.href))}
                className="cursor-pointer"
              >
                <item.icon className="mr-2 size-4 text-muted-foreground" />
                <span>{item.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Main Content Viewport */}
      <main className="min-h-screen pt-14 lg:pl-[240px]">
        <div className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
