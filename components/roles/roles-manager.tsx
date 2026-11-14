"use client"

import { useState } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import PermissionMatrix from "@/components/roles/permission-matrix"

interface Role {
  id: number
  name: string
  description: string | null
  _count: { users: number; permissions: number }
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  if (!Array.isArray(body)) throw new Error("Unexpected response from the server")
  return body as Role[]
}

/**
 * Roles and their permissions, on one screen.
 *
 * Creating a role used to live on the Utilities page while its permissions were set
 * here, so a role made in one place had to be found in the other — and if the list here
 * had not been refetched it was not there at all. Both halves are now the same surface,
 * and creating a role selects it so the next thing on screen is its permission matrix.
 */
export default function RolesManager() {
  const { data: roles, error, isLoading, mutate } = useSWR<Role[]>("/api/roles", fetcher)

  // Drift between the catalog in the code and the permissions table is what made saving
  // appear to do nothing on a server where the seed had never run. Say so plainly.
  const { data: catalog, mutate: recheckCatalog } = useSWR<{
    expected: number
    present: number
    inSync: boolean
  }>("/api/permissions/sync", async (url: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error("status unavailable")
    return res.json()
  })
  const [syncing, setSyncing] = useState(false)

  const syncCatalog = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/permissions/sync", { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Could not sync")
      toast.success(
        `Catalog synced — ${body.createdCanonical} permission(s) added, ${body.totalPermissions} total`,
      )
      await Promise.all([recheckCatalog(), mutate()])
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  const [selected, setSelected] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [busyId, setBusyId] = useState<number | null>(null)

  const [toDelete, setToDelete] = useState<Role | null>(null)
  const [deleteBlocker, setDeleteBlocker] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const create = async () => {
    const name = newName.trim()
    if (!name) return
    setCreateError(null)
    setCreating(true)
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: newDescription.trim() || null }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Could not create the role")

      setNewName("")
      setNewDescription("")
      await mutate()
      // Land on the new role's matrix — creating a role without permissions is half a job.
      setSelected(body.name ?? name)
      toast.success(`"${body.name ?? name}" created — now choose its permissions`)
    } catch (e) {
      setCreateError((e as Error).message)
      toast.error((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const rename = async (role: Role) => {
    const name = renameValue.trim()
    if (!name || name === role.name) {
      setRenamingId(null)
      return
    }
    setBusyId(role.id)
    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Could not rename the role")
      if (selected === role.name) setSelected(name)
      setRenamingId(null)
      await mutate()
      toast.success(`Renamed to "${name}"`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async (unassign: boolean) => {
    if (!toDelete) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/roles/${toDelete.id}${unassign ? "?unassign=1" : ""}`,
        { method: "DELETE" },
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        // 409 with a user list means "move these people first" — keep the dialog open
        // and say who, instead of a toast the user has to guess at.
        if (res.status === 409) {
          setDeleteBlocker(body.error ?? "This role is still in use")
          return
        }
        throw new Error(body.error ?? "Could not delete the role")
      }
      if (selected === toDelete.name) setSelected(null)
      toast.success(
        body.unassigned > 0
          ? `"${toDelete.name}" deleted — ${body.unassigned} person(s) now have no role`
          : `"${toDelete.name}" deleted`,
      )
      setToDelete(null)
      setDeleteBlocker(null)
      await mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-4 p-10 text-center">
          <p className="text-sm text-destructive">{(error as Error).message}</p>
          <Button variant="outline" onClick={() => mutate()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  const list = roles ?? []
  const current = list.find((r) => r.name === selected) ?? null

  return (
    <div className="space-y-6">
      {catalog && !catalog.inSync && (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-0.5 text-xs">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              This database knows {catalog.present} of {catalog.expected} permissions
            </p>
            <p className="text-muted-foreground">
              Permissions the database has no row for cannot be granted. Sync the catalog,
              then set this role&apos;s permissions again.
            </p>
          </div>
          <Button size="sm" variant="outline" disabled={syncing} onClick={syncCatalog}>
            {syncing ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            Sync catalog
          </Button>
        </div>
      )}

      {/* Create */}
      <Card className="shadow-2xs border-border/70">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Create a role</h2>
            <p className="text-xs text-muted-foreground">
              A new role starts with dashboard access only. Choose its permissions below
              once it exists.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="role-name" className="text-xs font-medium">
                Role name
              </Label>
              <Input
                id="role-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="e.g. Video Editor"
                className="h-9 text-xs"
                aria-describedby={createError ? "role-name-error" : undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-description" className="text-xs font-medium">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="role-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="What this role is for"
                className="h-9 text-xs"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={create}
                disabled={!newName.trim() || creating}
                size="sm"
                className="h-9 min-h-11 w-full gap-1.5 sm:min-h-9"
              >
                {creating ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-3.5" aria-hidden="true" />
                )}
                Create role
              </Button>
            </div>
          </div>

          {createError && (
            <p
              id="role-name-error"
              className="flex items-start gap-2 text-xs text-destructive"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {createError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* The roles themselves */}
      {list.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-sm font-medium">No roles yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create one above, then tick the modules and actions it may use.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Roles in this workspace</caption>
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th scope="col" className="px-3 py-2 font-medium">Role</th>
                <th scope="col" className="px-3 py-2 font-medium">People</th>
                <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">
                  Permissions
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((role) => {
                const isAdmin = role.name === "ADMIN"
                const isSelected = role.name === selected
                return (
                  <tr
                    key={role.id}
                    className={`border-t border-border ${isSelected ? "bg-accent/40" : ""}`}
                  >
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      {renamingId === role.id ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") rename(role)
                              if (e.key === "Escape") setRenamingId(null)
                            }}
                            autoFocus
                            aria-label={`New name for ${role.name}`}
                            className="h-8 w-40 text-xs"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={() => rename(role)}
                            disabled={busyId === role.id}
                            aria-label="Save name"
                          >
                            <Check className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={() => setRenamingId(null)}
                            aria-label="Cancel rename"
                          >
                            <X className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelected(isSelected ? null : role.name)}
                          className="text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          aria-expanded={isSelected}
                        >
                          <span className="font-medium">{role.name}</span>
                          {isAdmin && (
                            <ShieldCheck
                              className="ml-1.5 inline size-3.5 text-muted-foreground"
                              aria-label="Built-in role"
                            />
                          )}
                          {role.description && (
                            <span className="block text-xs text-muted-foreground">
                              {role.description}
                            </span>
                          )}
                        </button>
                      )}
                    </th>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="size-3.5" aria-hidden="true" />
                        {role._count.users}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2 sm:table-cell">
                      {role._count.permissions === 0 ? (
                        <Badge variant="outline" className="text-xs">
                          None yet
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {role._count.permissions}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant={isSelected ? "secondary" : "outline"}
                          className="h-8 min-h-11 text-xs sm:min-h-8"
                          onClick={() => setSelected(isSelected ? null : role.name)}
                        >
                          {isSelected ? "Hide" : "Permissions"}
                        </Button>
                        {!isAdmin && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-11 sm:size-8"
                              onClick={() => {
                                setRenamingId(role.id)
                                setRenameValue(role.name)
                              }}
                              aria-label={`Rename ${role.name}`}
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-11 text-destructive hover:text-destructive sm:size-8"
                              onClick={() => {
                                setToDelete(role)
                                setDeleteBlocker(null)
                              }}
                              aria-label={`Delete ${role.name}`}
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* The selected role's matrix */}
      {current && (
        <Card className="shadow-2xs border-border/70">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Permissions for {current.name}</h2>
              <p className="text-xs text-muted-foreground">
                Tick the actions this role may perform in each module. Saving writes the
                grants on the server, which is also what every page and API checks.
              </p>
            </div>
            <PermissionMatrix roleName={current.name} onSaved={() => mutate()} />
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) {
            setToDelete(null)
            setDeleteBlocker(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the &quot;{toDelete?.name}&quot; role?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlocker ? (
                <>
                  {deleteBlocker} You can delete it anyway — those people will be left with
                  no role and no access until you give them one.
                </>
              ) : (
                <>
                  This removes the role and its {toDelete?._count.permissions ?? 0} permission
                  grant(s). It cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                confirmDelete(deleteBlocker !== null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              {deleteBlocker ? "Delete anyway" : `Delete ${toDelete?.name ?? "role"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
