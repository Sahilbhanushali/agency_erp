"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import toast from "react-hot-toast"
import { Building2, Edit, FileText, Loader2, Plus, Receipt, Search, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">
            Your billing entities — the issuer on every quotation and invoice.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New company
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search companies"
          placeholder="Search by name, GSTIN or city"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-12 w-full" />
              ))}
            </div>
          ) : error || data?.error ? (
            <div className="p-10 text-center">
              <p className="text-sm text-destructive">
                {data?.error ?? "Could not load companies."}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => mutate()}>
                Try again
              </Button>
            </div>
          ) : companies.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h2 className="mt-4 text-base font-medium">
                {search ? "No companies match your search" : "No companies yet"}
              </h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {search
                  ? "Try a different name, GSTIN or city."
                  : "Add the entity you bill from — its name, GSTIN and bank details appear on every document."}
              </p>
              {!search && (
                <Button
                  className="mt-5"
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add your first company
                </Button>
              )}
            </div>
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
                          className="font-medium hover:underline"
                        >
                          {company.name}
                        </Link>
                        {company.legalName && (
                          <p className="text-xs text-muted-foreground">{company.legalName}</p>
                        )}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs md:table-cell">
                        {company.gstNumber ?? "—"}
                      </TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">
                        {[company.city, company.state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            {company._count?.quotations ?? 0}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Receipt className="h-3.5 w-3.5" />
                            {company._count?.invoices ?? 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={company.isActive ? "default" : "secondary"}>
                          {company.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${company.name}`}
                          onClick={() => {
                            setEditing(company)
                            setFormOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${company.name}`}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(company)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
