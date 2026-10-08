// app/dashboard/utilities/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [roleForm, setRoleForm] = useState({ name: "", description: "" });

  // Fetch utilities
  useEffect(() => {
    const fetchUtilities = async () => {
      setLoading(true);
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
    fetchUtilities();
  }, []);

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
        } else {
          setUtilities([updatedUtility, ...utilities]);
        }
        setForm({ name: "", type: "", values: "" });
        setEditingId(null);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to save utility");
      }
    } catch (err) {
      console.error("Error saving utility:", err);
      alert("Failed to save utility");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle role form submit
  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name) {
      alert("Role name is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roleForm.name,
          description: roleForm.description || null,
        }),
      });
      if (res.ok) {
        const newRole = await res.json();
        setRoles([...roles, newRole]);
        setRoleForm({ name: "", description: "" });
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create role");
      }
    } catch (err) {
      console.error("Error creating role:", err);
      alert("Failed to create role");
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
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this utility?")) return;
    try {
      const res = await fetch(`/api/utilities/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUtilities(utilities.filter((u) => u.id !== id));
      } else {
        alert("Failed to delete utility");
      }
    } catch (err) {
      console.error("Error deleting utility:", err);
      alert("Failed to delete utility");
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
      } else {
        const error = await res.json();
        alert(error.error || "Failed to update user role");
      }
    } catch (err) {
      console.error("Error updating user role:", err);
      alert("Failed to update user role");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      <h1 className="text-3xl font-bold">Utilities</h1>
      <p className="text-gray-600">Manage global utility values like Platforms, Post Types, and Roles.</p>
      {error && <p className="text-red-500">{error}</p>}

      {/* Add/Edit Utility Form */}
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Utility" : "Add Utility"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Platforms"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Input
                id="type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                placeholder="e.g. PLATFORM"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="values">Values (comma separated)</Label>
              <Input
                id="values"
                value={form.values}
                onChange={(e) => setForm({ ...form, values: e.target.value })}
                placeholder="e.g. INSTAGRAM, FACEBOOK"
              />
            </div>
            <div className="flex items-end space-x-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingId ? "Update" : "Add"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Add Role Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Role</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRoleSubmit} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="roleName">Role Name</Label>
              <Input
                id="roleName"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                placeholder="e.g. ADMIN"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleDescription">Description (Optional)</Label>
              <Input
                id="roleDescription"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                placeholder="e.g. Administrator role"
              />
            </div>
            <div className="flex items-end space-x-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Add Role"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Utilities Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Utilities</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading utilities...</p>
          ) : utilities.length === 0 ? (
            <p>No utilities found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">Name</th>
                    <th className="border p-2 text-left">Type</th>
                    <th className="border p-2 text-left">Values</th>
                    <th className="border p-2 text-left">Created</th>
                    <th className="border p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {utilities.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="border p-2">{u.name}</td>
                      <td className="border p-2">{u.type}</td>
                      <td className="border p-2">{Array.isArray(u.values) ? u.values.join(", ") : ""}</td>
                      <td className="border p-2">{new Date(u.createdAt).toLocaleString()}</td>
                      <td className="border p-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(u)}>
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="ml-2"
                          onClick={() => handleDelete(u.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
              <table className="w-full border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">Name</th>
                    <th className="border p-2 text-left">Email</th>
                    <th className="border p-2 text-left">Role</th>
                    <th className="border p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="border p-2">{user.name}</td>
                      <td className="border p-2">{user.email}</td>
                      <td className="border p-2">
                        <Select
                          value={userRoleChanges[user.id] || user.role}
                          onValueChange={(role) => handleUserRoleChange(user.id, role)}
                        >
                          <SelectTrigger className="w-[180px]">
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
    </div>
  );
}