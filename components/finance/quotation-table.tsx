"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import toast from "react-hot-toast"
import { Edit, Eye, FileText, Loader2, Plus, Search, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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

const getStatusBadgeVariant = (status: QuotationStatus) => {
  switch (status) {
    case "ACCEPTED":
      return "success";
    case "SENT":
      return "info";
    case "REJECTED":
      return "destructive";
    case "EXPIRED":
      return "warning";
    case "CONVERTED":
      return "purple";
    default:
      return "neutral";
  }
}

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <Badge variant={getStatusBadgeVariant(status)} dot className="text-[10px]">
      {STATUS_LABELS[status]}
    </Badge>
  )
}

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"

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
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search quotations by number or title"
            placeholder="Search number or title..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            className="pl-9 h-8 text-xs"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[150px] h-8 text-xs bg-card" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as QuotationStatus[]).map((value) => (
              <SelectItem key={value} value={value} className="text-xs">
                {STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && !data ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : error || data?.error ? (
        <div className="p-8 text-center rounded-xl border border-border/80 bg-card">
          <p className="text-xs text-destructive font-medium">{data?.error ?? "Could not load quotations."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => mutate()}>
            Try again
          </Button>
        </div>
      ) : quotations.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={isFiltered ? "No quotations match filters" : "No quotations created yet"}
          description={isFiltered ? "Try searching for a different number or status." : "Create financial quotations with GST itemization and instant PDF export."}
          actionLabel={!isFiltered ? "New Quotation" : undefined}
          actionHref={!isFiltered ? (companyId ? `/dashboard/quotations/new?companyId=${companyId}` : "/dashboard/quotations/new") : undefined}
          className="my-4"
        />
      ) : (
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
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
                      className="font-mono text-xs font-semibold text-primary hover:underline"
                    >
                      {quotation.number}
                    </Link>
                    <p className="max-w-[22ch] truncate text-[11px] text-muted-foreground">
                      {quotation.title}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="font-medium text-foreground">{quotation.client.company || quotation.client.name}</span>
                    {quotation.project && (
                      <p className="text-[11px] text-muted-foreground">{quotation.project.name}</p>
                    )}
                  </TableCell>
                  {!companyId && (
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {quotation.company.name}
                    </TableCell>
                  )}
                  <TableCell className="hidden text-xs tabular-nums text-muted-foreground md:table-cell">
                    {formatDate(quotation.validUntil)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold tabular-nums text-foreground">
                    {formatMoney(toNumber(quotation.totalAmount), quotation.currency)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <QuotationStatusBadge status={quotation.status} />
                      {quotation.invoice && (
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {quotation.invoice.number}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      asChild
                      aria-label={`View ${quotation.number}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Link href={`/dashboard/quotations/${quotation.id}`}>
                        <Eye className="size-3.5" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      asChild
                      aria-label={`Edit ${quotation.number}`}
                      disabled={quotation.status === "CONVERTED"}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Link href={`/dashboard/quotations/${quotation.id}/edit`}>
                        <Edit className="size-3.5" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Delete ${quotation.number}`}
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleting(quotation)}
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

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <p>
            Page {page} of {pages} · {total} quotation{total === 1 ? "" : "s"}
          </p>
          <div className="flex gap-1.5">
            <Button variant="outline" size="xs" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="xs"
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
              {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
