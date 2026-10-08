
"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Building2, CheckCircle, FireExtinguisherIcon, UtilityPole, Menu, X, ChevronLeft, Key } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { NotificationCenter } from "./notification-center"
import { Badge } from "@/components/ui/badge"
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Settings,
  LogOut,
  FolderOpen,
  ImageIcon,
  BarChart3,
  Moon,
  Sun,
  UserCog,
  User,
  Loader2,
  FileClock
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"

type NavigationItem = {
  name: string
  href: string
  icon: any
  permissions?: string[]
  allowedRoles?: string[]
  subItems?: { name: string; href: string; icon: any }[]
}

const navigation: NavigationItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Tasks", href: "/dashboard/tasks", icon: CheckCircle, permissions: ["View-tasks"] },
  {
    name: "Projects",
    href: "/dashboard/projects",
    icon: FolderOpen,
    permissions: ["Manage-projects", "View-project"],
  },
  { 
    name: "Project Summary", 
    href: "/dashboard/project-summary", 
    icon: FileText, 
    permissions: ["Manage-projects", "View-project"] 
  },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar, permissions: ["View-calender"] },
  { name: "Pending Approvals", href: "/dashboard/approvals", icon: FileClock, permissions: ["Manage-approvals"] },
  { name: "Assets", href: "/dashboard/assets", icon: ImageIcon, permissions: ["View-assets"] },
  { name: "Reports", href: "/dashboard/reports", icon: BarChart3, permissions: ["View-reports"] },
  { name: "Clients", href: "/dashboard/clients", icon: Users, permissions: ["Manage-clients", "View-clients"] },
  { name: "Companies", href: "/dashboard/companies", icon: Building2, permissions: ["Manage-companies", "View-companies"] },
  { name: "User Management", href: "/dashboard/users", icon: UserCog, permissions: ["Manage-User"], allowedRoles: ["ADMIN", "MANAGER"] },
  { name: "Utilities", href: "/dashboard/utilities", icon: UtilityPole, permissions: ["View-utilities"] },
  { name: "Credentials", href: "/dashboard/credentials", icon: Key, allowedRoles: ["ADMIN", "MANAGER", "TEAM_LEAD"] },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, permissions: ["Manage-settings"] },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (session?.user?.id) {
      const fetchPermissions = async () => {
        try {
          const response = await fetch(`/api/users/permissions?id=${session.user.id}`, {
            headers: {
              'Content-Type': 'application/json',
            },
          })
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          const data = await response.json()
          setUserPermissions(data.permissions || [])
        } catch (error) {
          console.error('Fetch permissions error:', error)
          setUserPermissions([])
        } finally {
          setIsPermissionsLoading(false)
        }
      }
      fetchPermissions()
    } else {
      setIsPermissionsLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  if (status === "loading" || isPermissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-semibold text-foreground">Loading Dashboard</p>
            <p className="text-sm text-muted-foreground">Please wait while we prepare your workspace</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated" || !session) {
    window.location.href = "/auth/signin"
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-xl font-semibold text-foreground">Redirecting</p>
            <p className="text-sm text-muted-foreground">Taking you to the login page</p>
          </div>
        </div>
      </div>
    )
  }

  const filteredNavigation = navigation.filter((item) => {
    // Check role-based access first
    if ((item as any).allowedRoles) {
      const userRole = (session?.user as any)?.role?.toUpperCase();
      if (!userRole || !(item as any).allowedRoles.includes(userRole)) {
        return false;
      }
    }

    if (!item.permissions || item.permissions.length === 0) {
      return true
    }
    // if (session.user.role === "ADMIN") {
    //   return true
    // }
    return item.permissions.some((permission) => userPermissions.includes(permission))
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm border-b border-slate-200/60 dark:border-slate-800/60 fixed top-0 w-full z-50">
        <div className="flex items-center justify-between px-4 lg:px-6 py-3">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="h-10 w-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <Link 
              href="/dashboard"
              className="flex items-center space-x-3 cursor-pointer select-none transition-opacity hover:opacity-80"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-md transition-transform active:scale-95">
                <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent tracking-tight">
                  itsmeDezino Agency ERP
                </h1>
                <p className="text-xs text-muted-foreground font-medium">Content Management System</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-4 px-4 py-2 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{session.user.name}</p>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs font-medium px-2 py-0.5">
                    {session.user.role}
                  </Badge>
                </div>
              </div>
              <div className="w-px h-8 bg-slate-300 dark:bg-slate-600"></div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="h-10 w-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>

              <NotificationCenter />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold text-sm">
                        {session.user.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72 rounded-xl" align="end" sideOffset={8}>
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{session.user.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{session.user.email}</p>
                    <div className="flex flex-wrap items-center mt-2 gap-1">
                      {userPermissions.length > 0 ? (
                        userPermissions.slice(0, 3).map((permission) => (
                          <Badge key={permission} variant="secondary" className="text-xs font-medium">
                            {permission}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          No Permissions
                        </Badge>
                      )}
                      {userPermissions.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{userPermissions.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="mr-3 h-4 w-4" />
                      Profile Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings" className="cursor-pointer">
                      <Settings className="mr-3 h-4 w-4" />
                      System Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
                    onClick={() => signOut({ callbackUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/signin` })}
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Drawer Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <nav className={`
        fixed left-0 top-0 lg:top-[73px] h-screen lg:h-[calc(100vh-73px)] w-64 bg-white dark:bg-slate-900 
        shadow-2xl lg:shadow-none border-r border-slate-200/60 dark:border-slate-800/60 z-40
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        overflow-hidden flex flex-col
      `}>
        {/* Drawer Header (Mobile Only) */}
        <div className="flex lg:hidden items-center justify-between p-4 border-b border-slate-200/60 dark:border-slate-800/60 flex-shrink-0">
          <Link 
            href="/dashboard"
            className="flex items-center space-x-3 cursor-pointer select-none"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-md">
              <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent tracking-tight">
                itsmeDezino Agency ERP
              </h2>
              <p className="text-[10px] text-muted-foreground font-medium">Content System</p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
            className="h-10 w-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Scrollable Nav Items */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
          <ul className="space-y-1">
            {filteredNavigation.map((item) => {
              // Highlight "Projects" if pathname starts with /dashboard/projects
              const isActive = item.href === "/dashboard/projects" 
                ? pathname.startsWith(item.href)
                : pathname === item.href || 
                  (item.subItems && item.subItems.some((sub) => pathname === sub.href))
              
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`
                      flex items-center px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-200 group
                      ${isActive 
                        ? "bg-slate-200 dark:bg-slate-700/80 text-slate-900 dark:text-white shadow-sm border border-slate-300/50 dark:border-slate-600/50" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-50"
                      }
                    `}
                  >
                    <item.icon className={`h-5 w-5 flex-shrink-0 mr-3 ${isActive ? "text-slate-900 dark:text-white" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                  
                  {item.subItems && pathname.startsWith(item.href) && (
                    <ul className="ml-6 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                      {item.subItems.map((subItem) => (
                        <li key={subItem.name}>
                          <Link
                            href={subItem.href}
                            className={`
                              flex items-center px-3 py-2 rounded-lg text-sm transition-colors
                              ${pathname === subItem.href
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
                              }
                            `}
                          >
                            <subItem.icon className="mr-2 h-4 w-4" />
                            {subItem.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* Main Content */}
      <main className="transition-all duration-300 ease-in-out pt-[73px] min-h-screen lg:ml-64">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
