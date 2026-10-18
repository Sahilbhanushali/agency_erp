"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { AlertTriangle, Loader2, RotateCcw, Save, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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

interface MatrixAction {
  action: string
  label: string
  granted: boolean
  viaLegacy: boolean
}
interface MatrixModule {
  key: string
  label: string
  group: string
  href: string | null
  actions: MatrixAction[]
}

/** Column order, so every module row lines up even when it lacks some actions. */
const COLUMNS = ["read", "create", "update", "delete", "approve", "publish", "share", "convert", "reveal", "export"]
const COLUMN_LABEL: Record<string, string> = {
  read: "Read", create: "Create", update: "Update", delete: "Delete",
  approve: "Approve", publish: "Publish", share: "Share", convert: "Convert",
  reveal: "Reveal", export: "Export",
}

/**
 * The role permission editor: one row per module, one column per action.
 *
 * Read is the gate. Clearing it clears the whole row, because a role that may create
 * what it cannot see is not a coherent state — and the server enforces the same rule,
 * so this is a convenience rather than the protection.
 */
export default function PermissionMatrix({
  roleName,
  onSaved,
}: {
  roleName: string
  /** Called after a successful save, so a parent can refresh its own counts. */
  onSaved?: () => void
}) {
  const [modules, setModules] = useState<MatrixModule[]>([])
  const [selected, setSelected] = useState<Record<string, Set<string>>>({})
  const [initial, setInitial] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const isAdminRole = roleName === "ADMIN"

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/role-permission/role/${encodeURIComponent(roleName)}?view=matrix`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Could not load permissions")
        return
      }
      setModules(data.modules)
      const next: Record<string, Set<string>> = {}
      for (const m of data.modules) {
        next[m.key] = new Set(
          m.actions.filter((a: MatrixAction) => a.granted || a.viaLegacy).map((a: MatrixAction) => a.action),
        )
      }
      setSelected(next)
      setInitial(serialise(next))
    } catch {
      setError("Network error — please try again")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (roleName) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleName])

  const serialise = (sel: Record<string, Set<string>>) =>
    JSON.stringify(Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, [...v].sort()])))

  const dirty = useMemo(() => initial !== "" && serialise(selected) !== initial, [selected, initial])

  // Browser-level guard; the in-app guard is the Cancel confirmation below.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const toggle = (moduleKey: string, action: string, on: boolean) => {
    setSelected((prev) => {
      const next = { ...prev, [moduleKey]: new Set(prev[moduleKey] ?? []) }
      if (on) {
        next[moduleKey].add(action)
        // Any action implies being able to see the module.
        if (action !== "read") next[moduleKey].add("read")
      } else {
        next[moduleKey].delete(action)
        // Losing read closes the module entirely.
        if (action === "read") next[moduleKey].clear()
      }
      return next
    })
  }

  const toggleRow = (mod: MatrixModule, on: boolean) =>
    setSelected((prev) => ({
      ...prev,
      [mod.key]: on ? new Set(mod.actions.map((a) => a.action)) : new Set(),
    }))

  const toggleColumn = (action: string, on: boolean) =>
    setSelected((prev) => {
      const next: Record<string, Set<string>> = {}
      for (const m of modules) {
        const set = new Set(prev[m.key] ?? [])
        if (!m.actions.some((a) => a.action === action)) {
          next[m.key] = set
          continue
        }
        if (on) {
          set.add(action)
          if (action !== "read") set.add("read")
        } else {
          set.delete(action)
          if (action === "read") set.clear()
        }
        next[m.key] = set
      }
      return next
    })

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const matrix = Object.fromEntries(Object.entries(selected).map(([k, v]) => [k, [...v]]))
      const res = await fetch(`/api/role-permission/role/${encodeURIComponent(roleName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Could not save permissions")
        toast.error(data.error ?? "Could not save permissions")
        return
      }
      toast.success(data.message ?? "Permissions updated")
      await load()
      onSaved?.()
    } catch {
      setError("Network error — please try again")
      toast.error("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  const activeColumns = COLUMNS.filter((c) => modules.some((m) => m.actions.some((a) => a.action === c)))
  const groups = Array.from(new Set(modules.map((m) => m.group)))

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 w-full" />)}
      </div>
    )
  }

  if (error && modules.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={load}>Try again</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {isAdminRole && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">
            ADMIN holds every permission by design and cannot be edited — it is the account
            that fixes a misconfigured role, so it must never be able to lock itself out.
          </p>
        </div>
      )}

      {error && modules.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">Permissions for the {roleName} role</caption>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="px-3 py-2 text-left font-medium">Module</th>
              {activeColumns.map((c) => (
                <th key={c} scope="col" className="px-2 py-2 text-center font-medium">
                  <span className="block">{COLUMN_LABEL[c]}</span>
                  {!isAdminRole && (
                    <button
                      type="button"
                      onClick={() => toggleColumn(c, !modules.every((m) =>
                        !m.actions.some((a) => a.action === c) || selected[m.key]?.has(c)))}
                      className="mt-0.5 text-[10px] font-normal text-muted-foreground underline hover:text-foreground"
                    >
                      all
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group}>
                <tr className="bg-muted/20">
                  <th
                    scope="colgroup"
                    colSpan={activeColumns.length + 1}
                    className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {group}
                  </th>
                </tr>
                {modules.filter((m) => m.group === group).map((mod) => {
                  const set = selected[mod.key] ?? new Set<string>()
                  const allOn = mod.actions.every((a) => set.has(a.action))
                  const noRead = mod.actions.some((a) => a.action === "read") && !set.has("read")
                  return (
                    <tr key={mod.key} className={`border-t border-border ${noRead ? "opacity-60" : ""}`}>
                      <th scope="row" className="px-3 py-2 text-left font-normal">
                        <span className="font-medium">{mod.label}</span>
                        {!isAdminRole && (
                          <button
                            type="button"
                            onClick={() => toggleRow(mod, !allOn)}
                            className="ml-2 text-[10px] text-muted-foreground underline hover:text-foreground"
                          >
                            {allOn ? "none" : "all"}
                          </button>
                        )}
                        {noRead && (
                          <Badge variant="outline" className="ml-2 text-[10px]">No access</Badge>
                        )}
                      </th>
                      {activeColumns.map((col) => {
                        const def = mod.actions.find((a) => a.action === col)
                        if (!def) return <td key={col} className="px-2 py-2 text-center text-muted-foreground/30">—</td>
                        return (
                          <td key={col} className="px-2 py-2 text-center">
                            <Checkbox
                              checked={set.has(col)}
                              disabled={isAdminRole || saving}
                              onCheckedChange={(v) => toggle(mod.key, col, v as boolean)}
                              aria-label={`${def.label} ${mod.label}`}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {!isAdminRole && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {dirty ? "Unsaved changes" : "All changes saved"}
            {" · "}
            Clearing Read denies the whole module.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!dirty || saving}
              onClick={() => (dirty ? setConfirmDiscard(true) : undefined)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            {/*
              Deliberately not disabled on `dirty`. A greyed-out Save button is
              indistinguishable from a save that silently does nothing, and writing the
              same matrix again is idempotent — so the button always works.
            */}
            <Button size="sm" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save permissions
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved permission changes?</AlertDialogTitle>
            <AlertDialogDescription>
              The matrix will be reloaded from what is currently saved for {roleName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                setConfirmDiscard(false)
                load()
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
