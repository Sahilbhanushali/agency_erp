"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { Building2, Edit, FileText, Loader2, Plus, Receipt, Search, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import CompanyForm from "@/components/companies/company-form"
import type { Company } from "@/types/finance"

const fetcher = (url: string) => fetch(url).then((response) => response.json())

export default function CompaniesPage() {
  const router = useRouter()
  const { data, error, isLoading, mutate } = useSWR<{ companies: Company[]; error?: string }>(
    "/api/companies",
    fetcher,
  )
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [deleting, setDeleting] = useState<Company | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const companies = useMemo(() => {
    const list = data?.companies ?? []
    const query = search.trim().toLowerCase()
    if (!query) return list
    return list.filter((company) =>
      [company.name, company.legalName, company.gstNumber, company.city]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(query)),
    )
  }, [data, search])

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/companies/${deleting.id}`, { method: "DELETE" })
      const body = await response.json()
      if (!response.ok) {
        toast.error(body.error ?? "Could not delete the company")
        return
      }
      toast.success(`${deleting.name} deleted`)
      setDeleting(null)
      mutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setIsDeleting(false)
    }
  }

  const totalCompanies = data?.companies?.length ?? 0
  const activeCompanies = data?.companies?.filter((c) => c.isActive).length ?? 0

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title="Billing Companies"
        description="Your agency billing entities — the issuer on every quotation and tax invoice."
        badge={
          <Badge variant="outline" className="font-mono text-[10px]">
            {totalCompanies} Registered
          </Badge>
        }
      >
        <Button size="sm" asChild className="gap-1.5">
          <Link href="/dashboard/companies/new">
            <Plus className="size-3.5" />
            New Company
          </Link>
        </Button>
      </PageHeader>

      {/* Metric chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total Entities</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-foreground tabular-nums">{totalCompanies}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Active Issuers</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-primary tabular-nums">{activeCompanies}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-border/70 bg-card p-3 shadow-2xs sm:col-span-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Filtered View</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-foreground tabular-nums">{companies.length}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search companies"
            placeholder="Search by name, GSTIN or city..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9 h-8 text-xs bg-card"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : error || data?.error ? (
          <div className="p-10 text-center">
            <p className="text-xs text-destructive font-medium">
              {data?.error ?? "Could not load companies."}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => mutate()}>
              Try again
            </Button>
          </div>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={search ? "No companies match your search" : "No companies yet"}
            description={
              search
                ? "Try searching with a different name, GSTIN or city."
                : "Add the entity you bill from — its name, GSTIN, bank details, and letterhead will appear on every document."
            }
            actionLabel={!search ? "Add your first company" : undefined}
            onAction={!search ? () => router.push("/dashboard/companies/new") : undefined}
            className="my-4"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="hidden md:table-cell">GSTIN</TableHead>
                  <TableHead className="hidden lg:table-cell">Location</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/companies/${company.id}`}
                        className="font-medium text-xs text-foreground hover:text-primary hover:underline"
                      >
                        {company.name}
                      </Link>
                      {company.legalName && (
                        <p className="text-[11px] text-muted-foreground">{company.legalName}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell text-muted-foreground">
                      {company.gstNumber ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-xs lg:table-cell text-muted-foreground">
                      {[company.city, company.state].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="size-3.5" />
                          {company._count?.quotations ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Receipt className="size-3.5" />
                          {company._count?.invoices ?? 0}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={company.isActive ? "success" : "neutral"} dot className="text-[10px]">
                        {company.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        asChild
                        aria-label={`Edit ${company.name}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Link href={`/dashboard/companies/${company.id}/edit`}>
                          <Edit className="size-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Delete ${company.name}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(company)}
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

      <CompanyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        company={editing}
        onSaved={() => mutate()}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. A company that has already issued quotations or invoices
              cannot be deleted — deactivate it instead so its documents stay intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
