"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import toast from "react-hot-toast"
import { Edit, Eye, Loader2, Plus, Receipt, Search, Trash2 } from "lucide-react"
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
import { INVOICE_STATUS_LABELS, type InvoiceRow, type InvoiceStatus } from "@/types/finance"

const fetcher = (url: string) => fetch(url).then((response) => response.json())

/** Colour carries meaning, so the label repeats it for anyone who cannot see the hue. */
const STATUS_STYLES: Record<InvoiceStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  PARTIAL: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  OVERDUE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  CANCELLED: "bg-muted text-muted-foreground line-through",
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant="outline" className={`border-transparent ${STATUS_STYLES[status]}`}>
      {INVOICE_STATUS_LABELS[status]}
    </Badge>
  )
}

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—"

/** Past due with money still owed. A paid or cancelled invoice is never overdue. */
const isLate = (invoice: InvoiceRow) =>
  !!invoice.dueDate &&
  new Date(invoice.dueDate) < new Date(new Date().toDateString()) &&
  toNumber(invoice.balance) > 0 &&
  invoice.status !== "PAID" &&
  invoice.status !== "CANCELLED" &&
  invoice.status !== "DRAFT"

export default function InvoiceTable({ companyId }: { companyId?: string }) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("ALL")
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState<InvoiceRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const query = new URLSearchParams({ page: String(page), limit: "25" })
  if (companyId) query.set("companyId", companyId)
  if (status === "UNPAID") query.set("unpaid", "1")
  else if (status !== "ALL") query.set("status", status)
  if (search.trim()) query.set("search", search.trim())

  const { data, error, isLoading, mutate } = useSWR<{
    invoices: InvoiceRow[]
    total: number
    outstanding: number
    error?: string
  }>(`/api/invoices?${query}`, fetcher, { keepPreviousData: true })

  const invoices = data?.invoices ?? []
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / 25))
  const isFiltered = status !== "ALL" || search.trim() !== ""

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/invoices/${deleting.id}`, { method: "DELETE" })
      const body = await response.json()
      if (!response.ok) {
        toast.error(body.error ?? "Could not delete the invoice")
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
            aria-label="Search invoices by number or title"
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
          <SelectTrigger className="w-[180px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="UNPAID">Anything owed</SelectItem>
            {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((value) => (
              <SelectItem key={value} value={value}>
                {INVOICE_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {data && data.outstanding > 0 && (
          <p className="text-sm text-muted-foreground">
            Outstanding:{" "}
            <strong className="tabular-nums text-foreground">
              {formatMoney(data.outstanding, invoices[0]?.currency ?? "INR")}
            </strong>
          </p>
        )}
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
              <p className="text-sm text-destructive">{data?.error ?? "Could not load invoices."}</p>
              <Button variant="outline" className="mt-4" onClick={() => mutate()}>
                Try again
              </Button>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h2 className="mt-4 text-base font-medium">
                {isFiltered ? "No invoices match those filters" : "No invoices yet"}
              </h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {isFiltered
                  ? "Try a different status, number or title."
                  : "Raise one directly, or convert an accepted quotation into an invoice."}
              </p>
              {!isFiltered && (
                <Button asChild className="mt-5">
                  <Link
                    href={
                      companyId
                        ? `/dashboard/invoices/new?companyId=${companyId}`
                        : "/dashboard/invoices/new"
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New invoice
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
                    <TableHead className="hidden md:table-cell">Due</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="font-mono text-sm font-medium hover:underline"
                        >
                          {invoice.number}
                        </Link>
                        <p className="max-w-[22ch] truncate text-xs text-muted-foreground">
                          {invoice.title}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.client.company || invoice.client.name}
                        {invoice.quotation && (
                          <p className="font-mono text-xs text-muted-foreground">
                            from {invoice.quotation.number}
                          </p>
                        )}
                      </TableCell>
                      {!companyId && (
                        <TableCell className="hidden text-sm lg:table-cell">
                          {invoice.company.name}
                        </TableCell>
                      )}
                      <TableCell className="hidden text-sm tabular-nums md:table-cell">
                        <span className={isLate(invoice) ? "font-medium text-destructive" : ""}>
                          {formatDate(invoice.dueDate)}
                          {isLate(invoice) && <span className="sr-only"> (overdue)</span>}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatMoney(toNumber(invoice.totalAmount), invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {toNumber(invoice.balance) <= 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatMoney(toNumber(invoice.balance), invoice.currency)
                        )}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge
                          status={isLate(invoice) ? "OVERDUE" : invoice.status}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          asChild
                          aria-label={`View ${invoice.number}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Link href={`/dashboard/invoices/${invoice.id}`}>
                            <Eye className="size-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          asChild
                          aria-label={`Edit ${invoice.number}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
                            <Edit className="size-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Delete ${invoice.number}`}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(invoice)}
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
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {page} of {pages} · {total} invoice{total === 1 ? "" : "s"}
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
              This cannot be undone. An invoice with payments recorded against it cannot be
              deleted — cancel it instead so the record of money received survives.
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
