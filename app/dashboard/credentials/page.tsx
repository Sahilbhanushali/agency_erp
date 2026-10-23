"use client"

import { useLiveRefresh } from "@/hooks/use-live-refresh"
import toast from "react-hot-toast";

import { useState, useEffect } from "react"
import { CredentialFormDialog } from "@/components/credentials/credential-form-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Copy, Download, Edit, Eye, EyeOff, Loader2, Plus, Search, Trash2, Upload } from "lucide-react"
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog"

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [scope, setScope] = useState<"all" | "internal" | "client">("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const [categories, setCategories] = useState<string[]>([])
  // Passwords are no longer part of the list payload. Each one is fetched on demand
  // from the audited reveal endpoint and held only for this page view.
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [revealing, setRevealing] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editData, setEditData] = useState<any>(null)
  const [credentialToDelete, setCredentialToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingCredential, setIsDeletingCredential] = useState(false)
  

  const fetchCredentials = async () => {
    try {
      const res = await fetch("/api/credentials")
      if (res.ok) {
        const data = await res.json()
        setCredentials(Array.isArray(data) ? data : (data.credentials ?? []))
        if (!Array.isArray(data)) setCategories(data.categories ?? [])
      }
    } catch (err) {
      console.error("Error fetching credentials:", err)
    }
  }
  // Live: re-read when someone else changes what this shows.
  useLiveRefresh(fetchCredentials, ["Credential"])

  useEffect(() => {
    fetchCredentials()
  }, [])

  const handleSave = async (data: any) => {
    try {
      if (editData) {
        // Edit mode (PUT)
        const platformData = data.platforms[0] // Only 1 platform in edit mode
        const res = await fetch(`/api/credentials/${editData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: data.location,
            platform: platformData.platform,
            userId: platformData.userId,
            password: platformData.password,
          })
        })
        const resJson = await res.json().catch(() => ({}))
        if (res.ok) {
          toast.success("Credential updated successfully!")
          setIsDialogOpen(false)
          fetchCredentials()
        } else {
          toast.error(resJson.error || "Failed to update credential.")
        }
      } else {
        // Add mode (POST)
        const res = await fetch(`/api/credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        const resJson = await res.json().catch(() => ({}))
        if (res.ok) {
          toast.success("Credentials created successfully!")
          setIsDialogOpen(false)
          fetchCredentials()
        } else {
          toast.error(resJson.error || "Failed to create credentials.")
        }
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || "Something went wrong.")
    }
  }

  const confirmDeleteCredential = async () => {
    if (!credentialToDelete) return;
    setIsDeletingCredential(true);
    try {
      const res = await fetch(`/api/credentials/${credentialToDelete.id}`, {
        method: 'DELETE',
      })
      const resJson = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(resJson.message || "Credential deleted successfully!")
        fetchCredentials()
        setCredentialToDelete(null)
      } else {
        toast.error(resJson.error || "Failed to delete credential.")
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || "Failed to delete credential.")
    } finally {
      setIsDeletingCredential(false)
    }
  }

  const handleEditClick = (cred: any) => {
    setEditData(cred)
    setIsDialogOpen(true)
  }

  const handleAddNewClick = () => {
    setEditData(null)
    setIsDialogOpen(true)
  }

  // Search across everything that identifies a credential, not just the client —
  // an internal login has no client to match on.
  const filteredCredentials = credentials.filter((c) => {
    const needle = searchTerm.trim().toLowerCase()
    const matchesSearch =
      !needle ||
      [c.label, c.category, c.platform, c.userId, c.location, c.url, c.client?.name, c.project?.name]
        .filter(Boolean)
        .some((field: string) => field.toLowerCase().includes(needle))

    const matchesScope =
      scope === "all" || (scope === "internal" ? !c.clientId : !!c.clientId)
    const matchesCategory = categoryFilter === "all" || c.category === categoryFilter

    return matchesSearch && matchesScope && matchesCategory
  })

  const handleExport = async () => {
    const exportData = credentials.map(cred => ({
      "Client Name": cred.client?.name || "",
      "Project Name": cred.project?.name || "",
      "Location": cred.location || "",
      "Contact Number": cred.client?.phone || "-",
      "Platform": cred.platform,
      "User Id": cred.userId,
      // Deliberately omitted: an export is a file that leaves the app.
      "Password": "(revealed in app only)"
    }));

    // Loaded on demand — see the note on the removed top-level import.
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Credentials");
    XLSX.writeFile(workbook, "Credentials_Export.xlsx");
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const XLSX = await import("xlsx");
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Post data to bulk import endpoint
        const res = await fetch("/api/credentials/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.errors && resData.errors.length > 0) {
            toast.success(`Imported ${resData.count} credentials. Some rows failed.`);
            console.warn("Import errors:", resData.errors);
          } else {
            toast.success("Bulk import completed successfully!");
          }
          fetchCredentials();
        } else {
          const errorData = await res.json();
          console.error("Import failed:", errorData.details || errorData);
          toast.error(`Import failed: ${errorData.details?.[0] || 'Check the Excel format.'}`);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse Excel file.");
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    e.target.value = "";
  }


  const togglePasswordVisibility = async (id: string) => {
    if (visiblePasswords[id]) {
      setVisiblePasswords((prev) => ({ ...prev, [id]: false }))
      return
    }
    if (!revealed[id]) {
      setRevealing(id)
      try {
        const res = await fetch(`/api/credentials/${id}/reveal`)
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? "Could not reveal this password")
          return
        }
        setRevealed((prev) => ({ ...prev, [id]: data.password }))
      } catch {
        toast.error("Network error — please try again")
        return
      } finally {
        setRevealing(null)
      }
    }
    setVisiblePasswords((prev) => ({ ...prev, [id]: true }))
  }



  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Password Credentials</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every login the agency holds \u2014 websites, apps, mailboxes, hosting, banking and client platforms.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 shadow-2xs">
            <Download className="size-3.5" /> Export
          </Button>
          <div className="relative">
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleImport} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Import Excel"
            />
            <Button variant="outline" size="sm" className="gap-1.5 shadow-2xs">
              <Upload className="size-3.5" /> Import
            </Button>
          </div>
          <Button size="sm" onClick={handleAddNewClick} className="gap-1.5 shadow-2xs">
            <Plus className="size-3.5" /> Add Credential
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search label, platform, username, client…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full bg-background pl-9 text-xs"
            />
          </div>

          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger className="h-9 w-[150px] text-xs" aria-label="Filter by scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All credentials</SelectItem>
              <SelectItem value="internal">Internal only</SelectItem>
              <SelectItem value="client">Client only</SelectItem>
            </SelectContent>
          </Select>

          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[170px] text-xs" aria-label="Filter by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any category</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-2xs">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What it is for</TableHead>
                  <TableHead className="font-semibold text-foreground">Category</TableHead>
                  <TableHead className="font-semibold text-foreground">Platform</TableHead>
                  <TableHead className="font-semibold text-foreground">Username</TableHead>
                  <TableHead className="font-semibold text-foreground">Password</TableHead>
                  <TableHead className="font-semibold text-foreground">Belongs to</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCredentials.length > 0 ? (
                  filteredCredentials.map((c: any) => (
                    <TableRow key={c.id} className="border-border hover:bg-muted/20">
                      <TableCell className="py-3 font-medium">
                        {c.label || c.platform}
                        {c.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 block max-w-[24ch] truncate text-xs font-normal text-muted-foreground hover:underline"
                          >
                            {c.url}
                          </a>
                        )}
                        {c.notes && (
                          <p className="max-w-[28ch] truncate text-xs font-normal text-muted-foreground">
                            {c.notes}
                          </p>
                        )}
                      </TableCell>

                      <TableCell className="py-3">
                        {c.category ? (
                          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                            {c.category}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="py-3">
                        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          {c.platform}
                        </span>
                      </TableCell>

                      <TableCell className="py-3 font-mono text-sm">{c.userId}</TableCell>

                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <Input
                            type={visiblePasswords[c.id] ? "text" : "password"}
                            value={visiblePasswords[c.id] ? (revealed[c.id] ?? "") : "••••••••"}
                            readOnly
                            aria-label={`Password for ${c.label || c.platform}`}
                            className="h-8 w-32 border-border bg-transparent font-mono text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => togglePasswordVisibility(c.id)}
                            disabled={revealing === c.id}
                            aria-label={
                              visiblePasswords[c.id]
                                ? `Hide password for ${c.label || c.platform}`
                                : `Reveal password for ${c.label || c.platform}`
                            }
                          >
                            {revealing === c.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : visiblePasswords[c.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          {visiblePasswords[c.id] && revealed[c.id] && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                              aria-label={`Copy password for ${c.label || c.platform}`}
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(revealed[c.id])
                                  toast.success("Password copied")
                                } catch {
                                  toast.error("Could not reach the clipboard")
                                }
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>

                      {/* An internal credential belongs to the agency, not a client. */}
                      <TableCell className="py-3 text-sm">
                        {c.clientId ? (
                          <>
                            {c.client?.company || c.client?.name}
                            {c.project?.name && (
                              <p className="text-xs text-muted-foreground">{c.project.name}</p>
                            )}
                            {c.location && (
                              <p className="text-xs text-muted-foreground">{c.location}</p>
                            )}
                          </>
                        ) : (
                          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                            Internal
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleEditClick(c)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Edit ${c.label || c.platform}`}
                        >
                          <Edit className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            setCredentialToDelete({ id: c.id, name: c.label || c.platform })
                          }
                          className="text-destructive hover:text-destructive"
                          aria-label={`Delete ${c.label || c.platform}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <p className="text-sm font-medium">
                        {searchTerm || scope !== "all" || categoryFilter !== "all"
                          ? "No credentials match those filters"
                          : "No credentials stored yet"}
                      </p>
                      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                        {searchTerm || scope !== "all" || categoryFilter !== "all"
                          ? "Try a different search, scope or category."
                          : "Store a website, app, mailbox, hosting panel or client platform login — anything with a username and password."}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

      <CredentialFormDialog
        categories={categories} 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        onSave={handleSave}
        editData={editData}
      />

      <DeleteConfirmationDialog
        isOpen={!!credentialToDelete}
        onClose={() => setCredentialToDelete(null)}
        onConfirm={confirmDeleteCredential}
        title="Delete Stored Credential"
        itemName={credentialToDelete?.name || ""}
        entityType="credential"
        isLoading={isDeletingCredential}
      />
    </div>
  )
}
