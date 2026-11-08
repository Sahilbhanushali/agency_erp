"use client"

import { useLiveRefresh } from "@/hooks/use-live-refresh"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Trash2, Edit, Plus, Search, AlertCircle, AlertTriangle, CheckCircle, Mail, RefreshCw, FileText, Clock, Send, Folder, Briefcase, Ban, UserCheck } from "lucide-react"
import SmtpConfigForm from "@/components/SmtpConfigForm"
import { toast } from "react-hot-toast"
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog"
import UserProfileModal from "@/components/users/user-profile-modal"
import HrDocumentsModal from "@/components/users/hr-documents-modal"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import RolesManager from "@/components/roles/roles-manager"

interface User {
  id: string
  name: string
  email: string
  role: string | null
  avatar?: string | null
  hasPassword?: boolean
  createdAt: string
  /** Deactivated accounts keep every record but cannot sign in. */
  isActive?: boolean
  deactivatedAt?: string | null
}

interface Role {
  id: number
  name: string
}

interface Permission {
  id: number
  name: string
}

interface SmtpConfig {
  id: number
  userId: number
  host: string
  port: number
  username: string
   password: string 
  encryption: string
  isActive: boolean
  isVerified: boolean
  createdAt: string
  updatedAt: string
  userEmail: string
}

export default function UsersPage() {
  const { data: session, status } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
    password: "",
    sendInvite: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [selectedHrUserId, setSelectedHrUserId] = useState<string | null>(null)
  const [selectedDocUserId, setSelectedDocUserId] = useState<string | null>(null)
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null)

  // SMTP-specific state
  const [smtpConfigs, setSmtpConfigs] = useState<SmtpConfig[]>([])
  const [smtpLoading, setSmtpLoading] = useState(true)
  const [smtpError, setSmtpError] = useState<string | null>(null)
  const [showSmtpForm, setShowSmtpForm] = useState(false)
  const [editingSmtpConfig, setEditingSmtpConfig] = useState<SmtpConfig | null>(null)
  const [testingConnection, setTestingConnection] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'createdAt' | 'isActive' | 'isVerified'>('createdAt')

  // Lets other pages link straight to a tab, e.g. /dashboard/users?tab=roles
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const initialTab = ["users", "roles", "smtp"].includes(requestedTab ?? "")
    ? (requestedTab as string)
    : "users"

  // Fetch users, roles, permissions, and SMTP configs
  useEffect(() => {
    if (status === "authenticated") {
      Promise.all([fetchUsers(), fetchRoles(), fetchPermissions(), fetchSmtpConfigs()])
    }
  }, [status])

  const fetchUsers = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setIsLoading(true)
      // This is the one screen that must see deactivated accounts — otherwise there
      // is no way to reactivate one. Everywhere else they are filtered out.
      const response = await fetch("/api/users?includeInactive=1")
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch users")
      }
      const data = await response.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error(error)
      setError(error.message || "Failed to load users")
    } finally {
      setIsLoading(false)
    }
  }
  // Live: re-read when someone else changes what this shows.
  useLiveRefresh(() => fetchUsers({ silent: true }), ["User", "Role", "UserDocument"])

  const fetchRoles = async () => {
    try {
      const response = await fetch("/api/roles")
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch roles")
      }
      const data = await response.json()
      setRoles(Array.isArray(data) ? data : [])
      if (data.length > 0 && !formData.role) {
        setFormData((prev) => ({ ...prev, role: data[0].name }))
      }
    } catch (error: any) {
      console.error(error)
      setError(error.message || "Failed to load roles")
    }
  }

  const fetchPermissions = async () => {
    try {
      const response = await fetch("/api/permissions")
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch permissions")
      }
      const data = await response.json()
      setPermissions(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error(error)
      setError(error.message || "Failed to load permissions")
    }
  }

  const fetchSmtpConfigs = async () => {
    try {
      setSmtpLoading(true)
      const response = await fetch("/api/smtp-config", {
        headers: {
          "Content-Type": "application/json",
        },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch SMTP configurations")
      }
      const data = await response.json()
      setSmtpConfigs(data.configs || [])
    } catch (err: any) {
      setSmtpError(err.message || "An error occurred")
    } finally {
      setSmtpLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          password: formData.sendInvite ? undefined : formData.password,
          sendInvite: formData.sendInvite,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to create user")
      }

      await fetchUsers()
      setIsCreateDialogOpen(false)
      setFormData({ name: "", email: "", role: roles[0]?.name || "", password: "", sendInvite: true })
      
      if (data.inviteSent) {
        toast.success(`User invited! Setup link sent to ${formData.email}`)
      } else if (data.inviteError) {
        // The account exists but the person has no way in yet. Saying "created
        // successfully" here is how a silently broken mail setup went unnoticed.
        toast.error(
          `${formData.name} was created, but the invitation email could not be sent: ${data.inviteError}. Fix SMTP in Settings, then use Resend invite.`,
          { duration: 12000 },
        )
        setError(`Invitation email failed: ${data.inviteError}`)
      } else {
        toast.success("User created with a password set — no invitation was sent.")
      }
    } catch (error: any) {
      console.error(error)
      setError(error.message || "Failed to create user")
      toast.error(error.message || "Failed to create user")
    }
  }

  const handleResendInvite = async (user: User) => {
    try {
      setResendingInviteId(user.id)
      const response = await fetch(`/api/users/${user.id}/resend-invite`, {
        method: "POST",
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to resend invitation")
      }
      toast.success(data.message || `Onboarding invitation resent to ${user.email}`)
    } catch (error: any) {
      toast.error(error.message || "Could not resend invitation")
    } finally {
      setResendingInviteId(null)
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update user")
      }

      await fetchUsers()
      setEditingUser(null)
      setFormData({ name: "", email: "", role: roles[0]?.name || "", password: "", sendInvite: true })
      toast.success("User updated successfully")
    } catch (error: any) {
      console.error(error)
      setError(error.message || "Failed to update user")
      toast.error(error.message || "Failed to update user")
    }
  }

  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update user role")
      }

      await fetchUsers()
      toast.success("User role updated successfully")
    } catch (error: any) {
      console.error(error)
      setError(error.message || "Failed to update user role")
      toast.error(error.message || "Failed to update user role")
    }
  }

  /**
   * Removes access without removing the person. The endpoint deactivates rather than
   * deletes, because deleting cascaded away payroll, payslips, attendance and leave,
   * and blanked the author on everything else they had touched.
   */
  const handleDeleteUser = async (userId: string) => {
    setIsDeletingUser(true)
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || "Failed to deactivate user")
      }

      await fetchUsers()
      toast.success(body.message || "Account deactivated")
      setUserToDelete(null)
    } catch (error: any) {
      console.error(error)
      setError(error.message || "Failed to deactivate user")
      toast.error(error.message || "Failed to deactivate user")
    } finally {
      setIsDeletingUser(false)
    }
  }

  const handleReactivateUser = async (userId: string, name: string) => {
    setReactivatingId(userId)
    try {
      const response = await fetch(`/api/users/${userId}`, { method: "POST" })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || `Could not reactivate ${name}`)
      }
      await fetchUsers()
      toast.success(body.message || `${name} can sign in again.`)
    } catch (error: any) {
      console.error(error)
      setError(error.message)
      toast.error(error.message)
    } finally {
      setReactivatingId(null)
    }
  }

  const handleSmtpFormSubmit = async () => {
    setShowSmtpForm(false)
    setEditingSmtpConfig(null)
    try {
      await fetchSmtpConfigs()
    } catch (err: any) {
      setSmtpError(err.message || "An error occurred")
    }
  }

  const [smtpToDelete, setSmtpToDelete] = useState<{ id: number; name: string } | null>(null)
  const [isDeletingSmtp, setIsDeletingSmtp] = useState(false)

  const confirmDeleteSmtp = async () => {
    if (!smtpToDelete) return
    setIsDeletingSmtp(true)
    try {
      const response = await fetch(`/api/smtp-config?id=${smtpToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete SMTP configuration")
      }
      toast.success("SMTP configuration deleted")
      setSmtpToDelete(null)
      await fetchSmtpConfigs()
    } catch (err: any) {
      toast.error(err.message || "Failed to delete SMTP configuration")
    } finally {
      setIsDeletingSmtp(false)
    }
  }

const testSmtpConnection = async (config: SmtpConfig) => {
  try {
    setTestingConnection(config.id);

    const response = await fetch("/api/smtp-config", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: config.userId,
        testConnection: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Connection test failed");
    }

    const result = await response.json();
    toast.success(result.message || "Connection test successful!");
    await fetchSmtpConfigs();
  } catch (err: any) {
    toast.error("Connection test failed: " + (err.message || "Unknown error"));
  } finally {
    setTestingConnection(null);
  }
};

  const setActiveSmtpConfig = async (id: number) => {
    try {
      const response = await fetch("/api/smtp-config/activate", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to set active SMTP configuration")
      }

      await fetchSmtpConfigs()
    } catch (err: any) {
      setSmtpError(err.message || "An error occurred")
    }
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "ALL" || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const sortedSmtpConfigs = [...smtpConfigs].sort((a, b) => {
    if (sortBy === 'createdAt') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    } else if (sortBy === 'isActive') {
      return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0)
    } else if (sortBy === 'isVerified') {
      return (b.isVerified ? 1 : 0) - (a.isVerified ? 1 : 0)
    }
    return 0
  })

  const getRoleBadgeVariant = (role: string | null) => {
    if (!role) return "secondary"
    switch (role.toUpperCase()) {
      case "ADMIN":
        return "destructive"
      case "MANAGER":
        return "default"
      case "DESIGNER":
        return "secondary"
      case "CLIENT":
        return "outline"
      default:
        return "secondary"
    }
  }

  if (status === "loading") {

    return (
      <div className="space-y-6 animate-in fade-in-50 duration-200">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!session || !session.user.id) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-12 text-center shadow-2xs">
        <EmptyState
          icon={AlertCircle}
          title="Sign In Required"
          description="Please log in to manage team members and system settings."
        />
      </div>
    );
  }

  const userRole = session.user.role || "CLIENT"

  if (!["ADMIN", "MANAGER", "Manager"].includes(userRole)) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-12 text-center shadow-2xs">
        <EmptyState
          icon={AlertCircle}
          title="Access Denied"
          description="Only administrators and managers can access user management and system settings."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {(error || smtpError) && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-destructive shrink-0" />
            <span className="text-xs font-medium text-destructive">{error || smtpError}</span>
          </div>
          {smtpError && smtpError !== "Forbidden: Admin access required" && (
            <Button
              variant="outline"
              size="xs"
              onClick={fetchSmtpConfigs}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage agency team members, role permissions, HR documentation, and SMTP integrations.
          </p>
        </div>
        <Link href="/dashboard/hrms">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/5 font-semibold">
            <Briefcase className="size-3.5" />
            <span>Recruitment & HRMS Workspace</span>
          </Button>
        </Link>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 border border-border/60 rounded-lg">
          <TabsTrigger value="users" className="text-xs">Users{isLoading ? "" : ` (${users.length})`}</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="smtp" className="text-xs">SMTP Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-3">
          {/* Deleting a role unassigns everyone who held it, and an account with no role
              cannot open anything. Surface the count rather than leaving it to be found
              one empty sidebar at a time. */}
          {users.filter((u) => !u.role).length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
              <div className="space-y-0.5 text-xs">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  {users.filter((u) => !u.role).length} account
                  {users.filter((u) => !u.role).length === 1 ? " has" : "s have"} no role
                </p>
                <p className="text-muted-foreground">
                  They can sign in but nothing is available to them — the sidebar will be
                  empty. Pick a role in the Role column for each.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
              <Input aria-label="Search users by name or email"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs bg-background"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger aria-label="Role" className="w-[140px] h-9 text-xs bg-background">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.name} className="text-xs">
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={roles.length === 0} className="gap-1.5 shadow-2xs">
                    <Plus className="size-3.5" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>Add a new team member to the agency</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => setFormData({ ...formData, role: value })}
                        disabled={roles.length === 0}
                      >
                        <SelectTrigger aria-label="Role">
                          <SelectValue placeholder={roles.length === 0 ? "No roles available" : "Select a role"} />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.name}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-lg border border-border/70 p-3 bg-muted/20 space-y-1.5">
                      <div className="flex items-start space-x-2.5">
                        <Checkbox
                          id="sendInvite"
                          checked={formData.sendInvite}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, sendInvite: !!checked })
                          }
                          className="mt-0.5"
                        />
                        <div className="space-y-0.5">
                          <Label htmlFor="sendInvite" className="text-xs font-semibold cursor-pointer">
                            Send Onboarding Invitation Email (Recommended)
                          </Label>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            The user will receive an email with a secure 48-hour link to create their password and activate their account.
                          </p>
                        </div>
                      </div>
                    </div>

                    {!formData.sendInvite && (
                      <div className="space-y-2">
                        <Label htmlFor="password">Set Manual Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required={!formData.sendInvite}
                          minLength={8}
                          placeholder="Minimum 8 characters"
                        />
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={roles.length === 0}>
                      {formData.sendInvite ? "Send Onboarding Invite" : "Create User"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card shadow-2xs overflow-hidden">
            {isLoading ? (
              <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading users">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No users found.</div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Reassign</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">HR Records</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className={`hover:bg-muted/40 transition-colors ${user.isActive === false ? "opacity-60" : ""}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 border border-border/60">
                            <AvatarImage src={user.avatar || "/placeholder.svg"} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                              {user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-xs text-foreground truncate">{user.name}</span>
                            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs uppercase font-mono tracking-wider">
                          {user.role ?? "NONE"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.isActive === false ? (
                          <Badge
                            variant="outline"
                            className="text-xs gap-1 text-destructive border-destructive/30 bg-destructive/5 font-mono"
                            title={
                              user.deactivatedAt
                                ? `Deactivated ${new Date(user.deactivatedAt).toLocaleDateString("en-GB")}`
                                : "Deactivated"
                            }
                          >
                            <Ban className="size-2.5" />
                            Deactivated
                          </Badge>
                        ) : user.hasPassword === false ? (
                          <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-500/30 bg-amber-500/5 font-mono">
                            <Clock className="size-2.5" />
                            Invite Pending
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-xs gap-1 font-mono">
                            <CheckCircle className="size-2.5" />
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* A user with no role cannot use the app at all, and an empty
                            dropdown did not say so. Deleting a role unassigns everyone
                            who held it, which is how accounts end up in this state. */}
                        <Select
                          value={user.role || ""}
                          onValueChange={(value) => handleUpdateUserRole(user.id, value)}
                          disabled={roles.length === 0}
                        >
                          <SelectTrigger
                            className={`h-8 w-28 text-xs bg-background ${
                              user.role ? "" : "border-amber-500/60 text-amber-700 dark:text-amber-400"
                            }`}
                            aria-label={`Role for ${user.name || user.email}`}
                          >
                            <SelectValue placeholder="No role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.name} className="text-xs">
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setSelectedHrUserId(user.id)}
                            className="gap-1 text-xs text-primary border-primary/20 hover:bg-primary/5"
                            title="Manage employee HR profile, compensation & details"
                          >
                            <FileText className="size-3.5" />
                            <span>HR Profile</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setSelectedDocUserId(user.id)}
                            className="gap-1 text-xs text-foreground border-border/80 hover:bg-muted/50"
                            title="Open dedicated HR Documents Vault with verification, previews and drag & drop"
                          >
                            <Folder className="size-3.5 text-primary" />
                            <span>Docs</span>
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {new Date(user.createdAt).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {user.hasPassword === false && (
                            <Button aria-label="Resend onboarding email invite"
                              variant="ghost"
                              size="icon-xs"
                              disabled={resendingInviteId === user.id}
                              onClick={() => handleResendInvite(user)}
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                              title="Resend onboarding email invite"
                            >
                              <Send className="size-3.5" />
                            </Button>
                          )}
                          <Button aria-label="Edit user"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => {
                              setEditingUser(user)
                              setFormData({
                                name: user.name,
                                email: user.email,
                                role: user.role || "",
                                password: "",
                                sendInvite: false,
                              })
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Edit className="size-3.5" />
                          </Button>
                          {session?.user?.id !== user.id &&
                            (user.isActive === false ? (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                disabled={reactivatingId === user.id}
                                onClick={() => handleReactivateUser(user.id, user.name)}
                                className="text-muted-foreground hover:text-emerald-600"
                                title={`Let ${user.name} sign in again`}
                                aria-label={`Reactivate ${user.name}`}
                              >
                                <UserCheck className="size-3.5" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setUserToDelete({ id: user.id, name: user.name })}
                                className="text-muted-foreground hover:text-destructive"
                                title={`Remove ${user.name}'s access`}
                                aria-label={`Deactivate ${user.name}`}
                              >
                                <Ban className="size-3.5" />
                              </Button>
                            ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>Update user information</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editName">Full Name</Label>
                  <Input
                    id="editName"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editEmail">Email</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editRole">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                    disabled={roles.length === 0}
                  >
                    <SelectTrigger aria-label="Role">
                      <SelectValue placeholder={roles.length === 0 ? "No roles available" : "Select a role"} />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={roles.length === 0}>
                  Update User
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <UserProfileModal
            userId={selectedHrUserId}
            isOpen={!!selectedHrUserId}
            onClose={() => setSelectedHrUserId(null)}
            onUserUpdated={() => fetchUsers()}
          />

          <HrDocumentsModal
            userId={selectedDocUserId}
            isOpen={!!selectedDocUserId}
            onClose={() => setSelectedDocUserId(null)}
            user={users.find((u) => u.id === selectedDocUserId)}
            onUpdate={() => fetchUsers()}
          />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          {/*
            Creating a role and setting its permissions are one job, so they are one
            screen. They used to be split — the role was created on the Utilities page
            and its permissions set here — which meant a role could exist in one place
            and be missing from the list in the other.
          */}
          <RolesManager />
        </TabsContent>

        <TabsContent value="smtp" className="space-y-4">
          <div className="mb-8">
            <h2 className="text-xl font-bold">SMTP Settings</h2>
            <p className="text-muted-foreground">
              Configure SMTP servers for sending emails from your application.
            </p>
          </div>

          {smtpLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-32 h-32 border-b-2 border-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : smtpError === "Forbidden: Admin access required" ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700">You do not have permission to access this page.</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => {
                      setShowSmtpForm(true)
                      setEditingSmtpConfig(null)
                    }}
                    className="flex items-center"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Add SMTP Configuration
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchSmtpConfigs}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                  <SelectTrigger aria-label="Sort by..." className="w-48">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Sort by Created Date</SelectItem>
                    <SelectItem value="isActive">Sort by Active Status</SelectItem>
                    <SelectItem value="isVerified">Sort by Verified Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                {sortedSmtpConfigs.length === 0 ? (
                  <div className="text-center py-12 bg-muted/50 rounded-lg">
                    <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      No SMTP configurations found
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Add your first SMTP configuration to start sending emails.
                    </p>
                    <Button
                      onClick={() => {
                        setShowSmtpForm(true)
                        setEditingSmtpConfig(null)
                      }}
                    >
                      Add Configuration
                    </Button>
                  </div>
                ) : (
                  sortedSmtpConfigs.map((config) => (
                    <Card key={config.id}>
                      <CardContent className={`p-6 ${config.isActive ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <h3 className="text-lg font-semibold">
                                {config.host}:{config.port}
                              </h3>
                              {config.isActive && (
                                <Badge className="ml-2 bg-green-100 text-green-800">
                                  Active
                                </Badge>
                              )}
                              {config.isVerified ? (
                                <CheckCircle className="ml-2 h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="ml-2 h-4 w-4 text-yellow-500" />
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                              <div>
                                <span className="font-medium">Username:</span> {config.username}
                              </div>
                              <div>
                                <span className="font-medium">Encryption:</span> {config.encryption}
                              </div>
                              <div>
                                <span className="font-medium">User:</span> {config.userEmail}
                              </div>
                              <div>
                                <span className="font-medium">Status:</span>{" "}
                                {config.isVerified ? "Verified" : "Unverified"}
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              Created: {new Date(config.createdAt).toLocaleDateString('en-GB')}
                              {config.updatedAt !== config.createdAt && (
                                <span className="ml-4">
                                  Updated: {new Date(config.updatedAt).toLocaleDateString('en-GB')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {!config.isActive && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveSmtpConfig(config.id)}
                              >
                                Set Active
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => testSmtpConnection(config)}
                              disabled={testingConnection === config.id}
                              title="Test Connection"
                            >
                              <RefreshCw
                                className={`h-4 w-4 ${testingConnection === config.id ? "animate-spin" : ""}`}
                              />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingSmtpConfig(config)
                                setShowSmtpForm(true)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSmtpToDelete({ id: config.id, name: `${config.host}:${config.port} (${config.username})` })}
                              title="Delete Configuration"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}

          <Dialog open={showSmtpForm} onOpenChange={() => {
            setShowSmtpForm(false)
            setEditingSmtpConfig(null)
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSmtpConfig ? "Edit SMTP Configuration" : "Add SMTP Configuration"}</DialogTitle>
                <DialogDescription>
                  Configure SMTP server settings for sending emails.
                </DialogDescription>
              </DialogHeader>
              <SmtpConfigForm
                users={users}
                initialData={editingSmtpConfig}
                onSuccess={handleSmtpFormSubmit}
                onCancel={() => {
                  setShowSmtpForm(false)
                  setEditingSmtpConfig(null)
                }}
                smtpConfigs={smtpConfigs}  
              />
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      <DeleteConfirmationDialog
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={() => {
          if (userToDelete) {
            handleDeleteUser(userToDelete.id)
          }
        }}
        itemName={userToDelete?.name || "User"}
        entityType="user"
        title="Deactivate this account?"
        isLoading={isDeletingUser}
      />

      <DeleteConfirmationDialog
        isOpen={!!smtpToDelete}
        onClose={() => setSmtpToDelete(null)}
        onConfirm={confirmDeleteSmtp}
        itemName={smtpToDelete?.name || "SMTP Config"}
        entityType="smtp"
        isLoading={isDeletingSmtp}
      />
    </div>
  )
}