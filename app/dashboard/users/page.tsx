"use client"

import type React from "react"
import { useState, useEffect } from "react"
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
import { Trash2, Edit, Plus, Search, AlertCircle, CheckCircle, Mail, RefreshCw, FileText } from "lucide-react"
import SmtpConfigForm from "@/components/SmtpConfigForm"
import { toast } from "react-hot-toast"
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog"
import UserProfileModal from "@/components/users/user-profile-modal"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"

interface User {
  id: string
  name: string
  email: string
  role: string | null
  avatar?: string | null
  createdAt: string
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
  const [rolePermissions, setRolePermissions] = useState<{ [roleName: string]: string[] }>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadingPermissions, setLoadingPermissions] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [selectedRole, setSelectedRole] = useState<string>("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
    password: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [selectedHrUserId, setSelectedHrUserId] = useState<string | null>(null)

  // SMTP-specific state
  const [smtpConfigs, setSmtpConfigs] = useState<SmtpConfig[]>([])
  const [smtpLoading, setSmtpLoading] = useState(true)
  const [smtpError, setSmtpError] = useState<string | null>(null)
  const [showSmtpForm, setShowSmtpForm] = useState(false)
  const [editingSmtpConfig, setEditingSmtpConfig] = useState<SmtpConfig | null>(null)
  const [testingConnection, setTestingConnection] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'createdAt' | 'isActive' | 'isVerified'>('createdAt')

  // Fetch users, roles, permissions, and SMTP configs
  useEffect(() => {
    if (status === "authenticated") {
      Promise.all([fetchUsers(), fetchRoles(), fetchPermissions(), fetchSmtpConfigs()])
    }
  }, [status])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/users")
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

  const fetchRolePermissions = async (roleName: string) => {
    if (!roleName) return
    setLoadingPermissions(true)
    try {
      const response = await fetch(`/api/role-permission/role/${roleName}`)
      if (!response.ok) throw new Error("Failed to fetch permissions")
      const data = await response.json()
      const permissionNames = data.map((item: { permission: string }) => item.permission)
      setRolePermissions((prev) => ({ ...prev, [roleName]: permissionNames || [] }))
    } catch (error: any) {
      console.error(error)
      setError(error.message || "Failed to load role permissions")
    } finally {
      setLoadingPermissions(false)
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
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create user")
      }

      await fetchUsers()
      setIsCreateDialogOpen(false)
      setFormData({ name: "", email: "", role: roles[0]?.name || "", password: "" })
      toast.success("User created successfully")
    } catch (error: any) {
      console.error(error)
      setError(error.message || "Failed to create user")
      toast.error(error.message || "Failed to create user")
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
      setFormData({ name: "", email: "", role: roles[0]?.name || "", password: "" })
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

  const handleDeleteUser = async (userId: string) => {
    setIsDeletingUser(true)
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete user")
      }

      await fetchUsers()
      toast.success("User deleted successfully")
      setUserToDelete(null)
    } catch (error: any) {
      console.error(error)
      setError(error.message || "Failed to delete user")
      toast.error(error.message || "Failed to delete user")
    } finally {
      setIsDeletingUser(false)
    }
  }

  const handleRoleSelection = (roleName: string) => {
    setSelectedRole(roleName)
    if (roleName && !rolePermissions[roleName]) {
      fetchRolePermissions(roleName)
    }
  }

  const handlePermissionChange = async (permission: string, checked: boolean) => {
    if (!selectedRole) return

    try {
      const method = checked ? "POST" : "DELETE"
      const response = await fetch("/api/role-permission", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole, permission }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${checked ? "add" : "remove"} permission`)
      }

      setRolePermissions((prev) => {
        const currentPerms = prev[selectedRole] || []
        let newPerms
        if (checked) {
          newPerms = [...currentPerms, permission]
        } else {
          newPerms = currentPerms.filter((p) => p !== permission)
        }
        return { ...prev, [selectedRole]: newPerms }
      })
    } catch (error: any) {
      console.error(error)
      setError(error.message || `Failed to ${checked ? "add" : "remove"} permission`)
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

  const handleSmtpDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this SMTP configuration?")) return

    try {
      const response = await fetch(`/api/smtp-config?id=${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete SMTP configuration")
      }

      await fetchSmtpConfigs()
    } catch (err: any) {
      setSmtpError(err.message || "An error occurred")
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
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!session || !session.user.id) {
    return (
      <div className="max-w-4xl mx-auto p-6">
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
      <div className="max-w-4xl mx-auto p-6">
        <EmptyState
          icon={AlertCircle}
          title="Access Denied"
          description="Only administrators and managers can access user management and system settings."
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      {(error || smtpError) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error || smtpError}</span>
          {smtpError && smtpError !== "Forbidden: Admin access required" && (
            <Button
              variant="outline"
              size="sm"
              className="ml-4"
              onClick={fetchSmtpConfigs}
            >
              Retry
            </Button>
          )}
        </div>
      )}
      <h1 className="text-2xl font-bold">User Management</h1>
      <p className="text-muted-foreground">Manage system users, roles, permissions, and SMTP settings</p>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="smtp">SMTP Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.name}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={roles.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>Add a new user to the system</DialogDescription>
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
                      <SelectTrigger>
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
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={8}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={roles.length === 0}>
                    Create User
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {isLoading ? (
              <div>Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div>No users found.</div>
            ) : (
              filteredUsers.map((user) => (
                <Card key={user.id}>
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={user.avatar || "/placeholder.svg"} />
                        <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{user.name}</h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Created: {new Date(user.createdAt).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getRoleBadgeVariant(user.role)}>{user.role ?? "NONE"}</Badge>
                      <Select
                        value={user.role || ""}
                        onValueChange={(value) => handleUpdateUserRole(user.id, value)}
                        disabled={roles.length === 0}
                      >
                        <SelectTrigger className="w-32">
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedHrUserId(user.id)}
                        className="gap-1.5 text-xs text-primary border-primary/20 hover:bg-primary/5"
                        title="Manage employee HR profile, salary, offer letter & documents"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">HR & Docs</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingUser(user)
                          setFormData({
                            name: user.name,
                            email: user.email,
                            role: user.role || "",
                            password: "",
                          })
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {session.user.id !== user.id && (
                        <Button variant="outline" size="sm" onClick={() => setUserToDelete({ id: user.id, name: user.name })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
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
                    <SelectTrigger>
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
            onUserUpdated={fetchUsers}
          />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Manage Role Permissions</CardTitle>
              <p className="text-sm text-muted-foreground">Select a role to view and edit its permissions</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {roles.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No roles available. Please add roles via the Utilities page.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-4">
                    <div className="space-y-2">
                      <Label htmlFor="roleSelect">Select Role</Label>
                      <Select value={selectedRole} onValueChange={handleRoleSelection}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Choose a role..." />
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
                    {loadingPermissions && (
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading permissions...</span>
                      </div>
                    )}
                  </div>

                  {selectedRole ? (
                    permissions.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          No permissions available. Please add permissions via the Utilities page.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-lg">
                          <h3 className="font-semibold mb-2">
                            Permissions for <span className="capitalize">{selectedRole}</span>
                          </h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            {permissions.length} available permissions
                          </p>
                          {loadingPermissions ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                              {permissions.map((permission) => (
                                <div
                                  key={permission.id}
                                  className="flex items-center space-x-3 p-2 border rounded-md hover:bg-accent"
                                >
                                  <Checkbox
                                    id={`perm-${permission.name}`}
                                    checked={(rolePermissions[selectedRole] || []).includes(permission.name)}
                                    onCheckedChange={(checked) => handlePermissionChange(permission.name, checked as boolean)}
                                  />
                                  <Label htmlFor={`perm-${permission.name}`} className="cursor-pointer flex-1">
                                    <span className="font-medium">{permission.name}</span>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {permission.name.toLowerCase().replace(/_/g, " ")}
                                    </p>
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Please select a role to manage its permissions.</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
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
                  <SelectTrigger className="w-48">
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
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
                              onClick={() => handleSmtpDelete(config.id)}
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
        isLoading={isDeletingUser}
      />
    </div>
  )
}