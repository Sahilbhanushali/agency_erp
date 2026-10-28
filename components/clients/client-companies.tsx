"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"
import toast from "react-hot-toast"
import { Briefcase, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { companySchema } from "@/lib/client-company"
import { resizeImageFile } from "@/lib/resize-image"
import { getMediaUrl } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type FormValues = z.input<typeof companySchema>

export interface ClientCompany {
  id: string
  name: string
  website: string | null
  industry: string | null
  gstin: string | null
  panNumber: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  postalCode: string | null
  logo: string | null
  _count: { projects: number; invoices: number; quotations: number }
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load companies")
  return r.json()
}

const EMPTY: FormValues = {
  name: "", website: "", industry: "", gstin: "", panNumber: "",
  address: "", city: "", state: "", country: "India", postalCode: "",
}

/** The companies one client runs: each project picks one of these. */
export function ClientCompanies({
  clientId,
  canEdit,
  clientAvatar,
}: {
  clientId: string
  canEdit: boolean
  /** Shown for a company without its own logo, as the rest of the app does. */
  clientAvatar?: string | null
}) {
  const url = `/api/clients/${clientId}/companies`
  const { data, error, isLoading, mutate } = useSWR<ClientCompany[]>(url, fetcher)
  const [editing, setEditing] = useState<ClientCompany | "new" | null>(null)
  const [deleting, setDeleting] = useState<ClientCompany | null>(null)
  const [busyDelete, setBusyDelete] = useState(false)

  const remove = async () => {
    if (!deleting) return
    setBusyDelete(true)
    try {
      const r = await fetch(`${url}/${deleting.id}`, { method: "DELETE" })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not delete")
      toast.success(`Removed "${deleting.name}"`)
      setDeleting(null)
      mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusyDelete(false)
    }
  }

  return (
    <Card className="shadow-2xs">
      <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Briefcase className="size-4 text-primary" />
            Companies
          </CardTitle>
          <CardDescription className="text-xs">
            Businesses this client runs. Each project is for one of them.
          </CardDescription>
        </div>
        {canEdit && data && data.length > 0 && (
          <Button size="sm" className="h-9 shrink-0" onClick={() => setEditing("new")}>
            <Plus className="size-4 mr-1" /> Add company
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center text-sm">
            <p className="text-destructive">{(error as Error).message}</p>
            <Button variant="outline" size="sm" onClick={() => mutate()}>Try again</Button>
          </div>
        ) : !data?.length ? (
          <EmptyState
            icon={Briefcase}
            title="No companies yet"
            description={canEdit ? "Add the businesses this client runs, then pick one when you create a project." : "Nobody has added this client's companies yet."}
            action={canEdit ? { label: "Add company", onClick: () => setEditing("new") } : undefined}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.map((c) => (
              <li key={c.id} className="rounded-lg border border-border/70 p-3 text-xs space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <Avatar className="size-10 shrink-0 rounded-md border border-border/70">
                    {(c.logo || clientAvatar) && (
                      <AvatarImage src={getMediaUrl((c.logo || clientAvatar)!)} alt={`${c.name} logo`} className="object-contain" />
                    )}
                    <AvatarFallback className="rounded-md text-xs font-medium">{c.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate" title={c.name}>{c.name}</p>
                    <p className="text-muted-foreground">
                      {[
                        c.industry,
                        `${c._count.projects} project${c._count.projects === 1 ? "" : "s"}`,
                        c._count.invoices ? `${c._count.invoices} invoice${c._count.invoices === 1 ? "" : "s"}` : null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 -mr-1 -mt-1">
                      <Button variant="ghost" size="icon" className="size-9" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-9 text-destructive hover:text-destructive" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  <dt className="text-muted-foreground">GSTIN</dt>
                  <dd className="font-mono uppercase">{c.gstin || "—"}</dd>
                  <dt className="text-muted-foreground">PAN</dt>
                  <dd className="font-mono uppercase">{c.panNumber || "—"}</dd>
                  <dt className="text-muted-foreground">Address</dt>
                  <dd className="truncate" title={[c.address, c.city, c.state, c.postalCode].filter(Boolean).join(", ")}>
                    {[c.address, c.city, c.state].filter(Boolean).join(", ") || "—"}
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <CompanyDialog
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        url={url}
        company={editing}
        onClose={() => setEditing(null)}
        onSaved={() => mutate()}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && !busyDelete && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the company &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting._count.invoices + deleting._count.quotations > 0
                ? `It has been billed on ${deleting._count.quotations} quotation(s) and ${deleting._count.invoices} invoice(s), which must keep it, so it can't be deleted. `
                : null}
              {deleting?._count.projects
                ? `Its ${deleting._count.projects} project${deleting._count.projects === 1 ? "" : "s"} stay, but will no longer name a company.`
                : "No projects use it."}{" "}
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void remove() }}
              disabled={busyDelete || (!!deleting && deleting._count.invoices + deleting._count.quotations > 0)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busyDelete && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function CompanyDialog({
  url,
  company,
  onClose,
  onSaved,
}: {
  url: string
  company: ClientCompany | "new" | null
  onClose: () => void
  onSaved: () => void
}) {
  const existing = company && company !== "new" ? company : null
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [preview, setPreview] = useState<string | null>(existing?.logo ? getMediaUrl(existing.logo) : null)
  useEffect(() => {
    if (!logoFile) return
    const url = URL.createObjectURL(logoFile)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logoFile])

  const pickLogo = (file: File | undefined) => {
    if (!file) return
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Logo must be a PNG or JPEG image")
      return
    }
    setLogoFile(file)
    setRemoveLogo(false)
  }

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: existing
      ? Object.fromEntries(Object.entries(EMPTY).map(([k]) => [k, (existing as any)[k] ?? ""])) as FormValues
      : EMPTY,
  })

  const submit = handleSubmit(async (values) => {
    const r = await fetch(existing ? `${url}/${existing.id}` : url, {
      method: existing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) {
      for (const [field, message] of Object.entries(body.fields ?? {})) {
        setError(field as keyof FormValues, { message: String(message) })
      }
      if (!body.fields) toast.error(body.error ?? "Could not save the company")
      return
    }
    // The logo is its own request, so the details are saved even if the image is refused.
    const logoUrl = `${url}/${body.id}/logo`
    if (logoFile) {
      const { file } = await resizeImageFile(logoFile, 512)
      const form = new FormData()
      form.append("logo", file)
      const lr = await fetch(logoUrl, { method: "POST", body: form })
      if (!lr.ok) {
        toast.error(`Saved "${body.name}", but the logo wasn't: ${(await lr.json().catch(() => ({}))).error ?? "upload failed"}`)
        onSaved()
        onClose()
        return
      }
    } else if (removeLogo && existing?.logo) {
      await fetch(logoUrl, { method: "DELETE" })
    }
    toast.success(existing ? `Saved "${body.name}"` : `Added "${body.name}"`)
    onSaved()
    onClose()
  })

  const field = (name: keyof FormValues, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`cc-${name}`} className="text-xs font-medium">{label}</Label>
      <Input id={`cc-${name}`} aria-invalid={!!errors[name]} {...register(name)} {...props} />
      {errors[name] && <p className="text-xs text-destructive">{errors[name]?.message}</p>}
    </div>
  )

  return (
    <Dialog open={company !== null} onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.name}` : "Add a company"}</DialogTitle>
          <DialogDescription>Tax details and address are for this company only.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="flex items-center gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40">
              {preview && !removeLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview / blob URL
                <img src={preview} alt="Logo preview" className="size-full object-contain" />
              ) : (
                <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="h-9" asChild>
                  <label htmlFor="cc-logo" className="cursor-pointer">
                    {preview && !removeLogo ? "Change logo" : "Upload logo"}
                  </label>
                </Button>
                {preview && !removeLogo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 text-destructive hover:text-destructive"
                    onClick={() => {
                      setLogoFile(null)
                      setRemoveLogo(true)
                    }}
                  >
                    <X className="mr-1 size-3.5" /> Remove
                  </Button>
                )}
              </div>
              <input
                id="cc-logo"
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(e) => {
                  pickLogo(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
              <p className="text-xs text-muted-foreground">PNG or JPEG. Without one, the client&apos;s photo is used.</p>
            </div>
          </div>
          {field("name", "Company name *", { autoFocus: true, maxLength: 150 })}
          <div className="grid gap-3 sm:grid-cols-2">
            {field("industry", "Industry")}
            {field("website", "Website", { placeholder: "example.com" })}
            {field("gstin", "GSTIN", { className: "uppercase font-mono", maxLength: 15 })}
            {field("panNumber", "PAN", { className: "uppercase font-mono", maxLength: 10 })}
          </div>
          {field("address", "Address")}
          <div className="grid gap-3 grid-cols-2">
            {field("city", "City")}
            {field("state", "State")}
            {field("postalCode", "Postal code")}
            {field("country", "Country")}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {existing ? "Save" : "Add company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
