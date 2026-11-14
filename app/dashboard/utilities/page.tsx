// app/dashboard/utilities/page.tsx
"use client";

import { useLiveRefresh } from "@/hooks/use-live-refresh"

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Sliders, Plus, Trash2, Edit, Shield, Check } from "lucide-react";
import toast from "react-hot-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog";
import Link from "next/link";

type Utility = {
  id: string;
  name: string;
  type: string;
  values: string[];
  createdAt: string;
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Role = {
  id: number;
  name: string;
};

export default function UtilitiesPage() {
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [userRoleChanges, setUserRoleChanges] = useState<{ [userId: string]: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "",
    values: "",
  });

  // Fetch utilities
  // Live: the loader below lives inside its effect, so a tick in the effect's
  // dependencies is how a change elsewhere re-runs it.
  const [liveTick, setLiveTick] = useState(0)
  useLiveRefresh(() => setLiveTick((t) => t + 1), ["Utility"])

  useEffect(() => {
    const fetchUtilities = async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const res = await fetch("/api/utilities");
        if (!res.ok) throw new Error("Failed to fetch utilities");
        const data = await res.json();
        setUtilities(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching utilities:", err);
        setError("Failed to load utilities");
      } finally {
        setLoading(false);
      }
    };
    // A live refresh re-reads quietly; the first load shows the spinner.
    fetchUtilities({ silent: liveTick > 0 });
  }, [liveTick]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/users");
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to fetch users");
        }
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to load users");
      }
    };
    fetchUsers();
  }, []);

  // Fetch roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch("/api/roles");
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to fetch roles");
        }
        const data = await res.json();
        setRoles(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching roles:", err);
        setError("Failed to load roles");
      }
    };
    fetchRoles();
  }, []);

  // Handle utility form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.type) return;

    setSubmitting(true);
    try {
      const url = editingId ? `/api/utilities/${editingId}` : "/api/utilities";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          values: form.values ? form.values.split(",").map((v) => v.trim()) : [],
        }),
      });
      if (res.ok) {
        const updatedUtility = await res.json();
        if (editingId) {
          setUtilities(utilities.map((u) => (u.id === editingId ? updatedUtility : u)));
          toast.success("Utility updated successfully");
        } else {
          setUtilities([updatedUtility, ...utilities]);
          toast.success("Utility created successfully");
        }
        setForm({ name: "", type: "", values: "" });
        setEditingId(null);
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save utility");
      }
    } catch (err) {
      console.error("Error saving utility:", err);
      toast.error("Failed to save utility");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle utility edit
  const handleEdit = (u: Utility) => {
    setForm({
      name: u.name,
      type: u.type,
      values: u.values.join(", "),
    });
    setEditingId(u.id);
  };

  // Handle utility delete
  const [utilityToDelete, setUtilityToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingUtility, setIsDeletingUtility] = useState(false);

  const confirmDeleteUtility = async () => {
    if (!utilityToDelete) return;
    setIsDeletingUtility(true);
    try {
      const res = await fetch(`/api/utilities/${utilityToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUtilities(utilities.filter((u) => u.id !== utilityToDelete.id));
        toast.success(data.message || "Utility deleted successfully");
        setUtilityToDelete(null);
      } else {
        toast.error(data.error || "Failed to delete utility");
      }
    } catch (err: any) {
      console.error("Error deleting utility:", err);
      toast.error(err.message || "Failed to delete utility");
    } finally {
      setIsDeletingUtility(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setForm({ name: "", type: "", values: "" });
    setEditingId(null);
  };

  // Handle user role change
  const handleUserRoleChange = async (userId: string, role: string) => {
    setUserRoleChanges((prev) => ({ ...prev, [userId]: role }));
  };

  // Save user role changes
  const handleSaveUserRole = async (userId: string) => {
    const newRole = userRoleChanges[userId];
    if (!newRole) return;

    try {
      const res = await fetch("/api/user/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (res.ok) {
        setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
        setUserRoleChanges((prev) => {
          const { [userId]: _, ...rest } = prev;
          return rest;
        });
        toast.success("User role updated");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update user role");
      }
    } catch (err) {
      console.error("Error updating user role:", err);
      toast.error("Failed to update user role");
    }
  };


  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title="System Taxonomy & Utilities"
        description="Manage platform categories, post type dimensions, taxonomy values, and system roles."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add/Edit Utility Form */}
        <Card className="shadow-2xs border-border/70">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sliders className="size-4 text-primary" />
              {editingId ? "Edit Utility Dimension" : "Add Utility Dimension"}
            </CardTitle>
            <CardDescription className="text-xs">
              Configure system dimensions and comma-separated option values.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium">Dimension Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Platforms"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type" className="text-xs font-medium">Type Identifier</Label>
                <Input
                  id="type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  placeholder="e.g. PLATFORM"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="values" className="text-xs font-medium">Values (comma separated)</Label>
                <Input
                  id="values"
                  value={form.values}
                  onChange={(e) => setForm({ ...form, values: e.target.value })}
                  placeholder="e.g. INSTAGRAM, FACEBOOK, LINKEDIN"
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm" disabled={submitting} className="gap-1.5">
                  <Plus className="size-3.5" />
                  {submitting ? "Saving..." : editingId ? "Update Dimension" : "Add Dimension"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Roles are created and given permissions on one screen, under
            Users -> Roles & Permissions. Creating them here as well meant two sources
            for the same list, and a role made here had no permissions and no obvious
            place to get them. */}
        <Card className="shadow-2xs border-border/70">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              Roles &amp; Permissions
            </CardTitle>
            <CardDescription className="text-xs">
              Roles now live with their permissions, so a new role can be given access in
              the same place it is created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {roles.length} role{roles.length === 1 ? "" : "s"} defined. Use the table
              below to change which role a person has.
            </p>
            <Button size="sm" variant="outline" asChild className="gap-1.5">
              <Link href="/dashboard/users?tab=roles">
                <Shield className="size-3.5" />
                Manage roles and permissions
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Utilities Table */}
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
        {loading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : utilities.length === 0 ? (
          <EmptyState
            icon={Sliders}
            title="No utilities configured"
            description="Create your first categorization dimension above to populate select options across modules."
            className="my-4"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dimension Name</TableHead>
                  <TableHead>Identifier</TableHead>
                  <TableHead>Defined Values</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {utilities.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-xs text-foreground">{u.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {u.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {Array.isArray(u.values) && u.values.map((v, i) => (
                          <Badge key={i} variant="secondary" className="text-xs font-normal">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {new Date(u.createdAt).toLocaleDateString("en-GB")}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Edit ${u.name}`}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => handleEdit(u)}
                      >
                        <Edit className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Delete ${u.name}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setUtilityToDelete({ id: u.id, name: `${u.name} (${u.type})` })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* User Role Management */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Manage User Roles</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p>No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="border p-2 text-left">Name</th>
                    <th className="border p-2 text-left">Email</th>
                    <th className="border p-2 text-left">Role</th>
                    <th className="border p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/50">
                      <td className="border p-2">{user.name}</td>
                      <td className="border p-2">{user.email}</td>
                      <td className="border p-2">
                        <Select
                          value={userRoleChanges[user.id] || user.role}
                          onValueChange={(role) => handleUserRoleChange(user.id, role)}
                        >
                          <SelectTrigger aria-label="Select role" className="w-[180px]">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.name}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="border p-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveUserRole(user.id)}
                          disabled={!userRoleChanges[user.id] || userRoleChanges[user.id] === user.role}
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card> */}

      {/* Delete Confirmation Alert */}
      <DeleteConfirmationDialog
        isOpen={!!utilityToDelete}
        onClose={() => setUtilityToDelete(null)}
        onConfirm={confirmDeleteUtility}
        itemName={utilityToDelete?.name || "Utility"}
        entityType="utility"
        isLoading={isDeletingUtility}
      />
    </div>
  );
}