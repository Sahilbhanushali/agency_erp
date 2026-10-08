"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import toast from "react-hot-toast"
import { Edit, FileText, Loader2, Plus, Search, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatMoney, toNumber } from "@/lib/finance"
import type { QuotationRow, QuotationStatus } from "@/types/finance"

const fetcher = (url: string) => fetch(url).then((response) => response.json())

const STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CONVERTED: "Invoiced",
}

/** Colour carries meaning, so the label repeats it for anyone who cannot see the hue. */
const STATUS_STYLES: Record<QuotationStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  ACCEPTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  EXPIRED: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  CONVERTED: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
}

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <Badge variant="outline" className={`border-transparent ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"

/**
 * The quotation list. Scoped to one company when `companyId` is given (the company
 * detail page), unscoped on /dashboard/quotations. Filtering and paging happen
 * server-side — the browser never holds the whole table.
 */
export default function QuotationTable({ companyId }: { companyId?: string }) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("ALL")
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState<QuotationRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const query = new URLSearchParams({ page: String(page), limit: "25" })
  if (companyId) query.set("companyId", companyId)
  if (status !== "ALL") query.set("status", status)
  if (search.trim()) query.set("search", search.trim())

  const { data, error, isLoading, mutate } = useSWR<{
    quotations: QuotationRow[]
    total: number
    error?: string
  }>(`/api/quotations?${query}`, fetcher, { keepPreviousData: true })

  const quotations = data?.quotations ?? []
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / 25))
  const isFiltered = status !== "ALL" || search.trim() !== ""

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/quotations/${deleting.id}`, { method: "DELETE" })
      const body = await response.json()
      if (!response.ok) {
        toast.error(body.error ?? "Could not delete the quotation")
        return
      }
      toast.success(body.message ?? `${deleting.number} deleted`)
      setDeleting(null)
      mutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search quotations by number or title"
            placeholder="Search number or title"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[170px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as QuotationStatus[]).map((value) => (
              <SelectItem key={value} value={value}>
                {STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && !data ? (
            <div className="space-y-3 p-6">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-12 w-full" />
              ))}
            </div>
          ) : error || data?.error ? (
            <div className="p-10 text-center">
              <p className="text-sm text-destructive">{data?.error ?? "Could not load quotations."}</p>
              <Button variant="outline" className="mt-4" onClick={() => mutate()}>
                Try again
              </Button>
            </div>
          ) : quotations.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h2 className="mt-4 text-base font-medium">
                {isFiltered ? "No quotations match those filters" : "No quotations yet"}
              </h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {isFiltered
                  ? "Try a different status, number or title."
                  : "Build one from your line items — it gets a number, GST breakdown and a client link."}
              </p>
              {!isFiltered && (
                <Button asChild className="mt-5">
                  <Link href={companyId ? `/dashboard/quotations/new?companyId=${companyId}` : "/dashboard/quotations/new"}>
                    <Plus className="mr-2 h-4 w-4" />
                    New quotation
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Client</TableHead>
                    {!companyId && <TableHead className="hidden lg:table-cell">Issued by</TableHead>}
                    <TableHead className="hidden md:table-cell">Valid until</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((quotation) => (
                    <TableRow key={quotation.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/quotations/${quotation.id}`}
                          className="font-mono text-sm font-medium hover:underline"
                        >
                          {quotation.number}
                        </Link>
                        <p className="max-w-[22ch] truncate text-xs text-muted-foreground">
                          {quotation.title}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {quotation.client.company || quotation.client.name}
                        {quotation.project && (
                          <p className="text-xs text-muted-foreground">{quotation.project.name}</p>
                        )}
                      </TableCell>
                      {!companyId && (
                        <TableCell className="hidden text-sm lg:table-cell">
                          {quotation.company.name}
                        </TableCell>
                      )}
                      <TableCell className="hidden text-sm tabular-nums md:table-cell">
                        {formatDate(quotation.validUntil)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {formatMoney(toNumber(quotation.totalAmount), quotation.currency)}
                      </TableCell>
                      <TableCell>
                        <QuotationStatusBadge status={quotation.status} />
                        {quotation.invoice && (
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {quotation.invoice.number}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          aria-label={`Edit ${quotation.number}`}
                          disabled={quotation.status === "CONVERTED"}
                        >
                          <Link href={`/dashboard/quotations/${quotation.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${quotation.number}`}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(quotation)}
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

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {page} of {pages} · {total} quotation{total === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.title} for {deleting?.client.company || deleting?.client.name} will be
              removed along with its line items. This cannot be undone.
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
