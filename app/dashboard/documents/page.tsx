"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "react-hot-toast"
import { formatDistanceToNow, format } from "date-fns"
import { AlertTriangle, CheckCircle2, ExternalLink, FileCheck2, FileText, Loader2, RefreshCw, XCircle } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface PendingDocument {
  id: string
  userId: number
  title: string
  category: string
  fileName: string
  fileSize: number | null
  expiryDate: string | null
  uploadedAt: string
  notes: string | null
  fileUrl: string
  user: { id: number; name: string; email: string; avatar: string | null }
  uploadedBy: { id: number; name: string } | null
}

interface PendingResponse {
  documents: PendingDocument[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 25

const CATEGORY_LABELS: Record<string, string> = {
  IDENTITY: "Identity",
  ID_PROOF: "Identity",
  EDUCATION: "Education",
  EMPLOYMENT: "Employment",
  BANK_TAX: "Bank & Tax",
  CONTRACTS: "Contracts",
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || "Could not load pending documents")
  return body
}

const formatSize = (bytes: number | null) =>
  bytes == null ? null : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export default function DocumentVerificationPage() {
  const [page, setPage] = useState(1)
  const { data, error, isLoading, mutate } = useSWR<PendingResponse>(
    `/api/documents/pending?page=${page}&pageSize=${PAGE_SIZE}`,
    fetcher,
    { keepPreviousData: true },
  )
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<PendingDocument | null>(null)
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState<string | null>(null)

  const documents = data?.documents ?? []
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const decide = async (doc: PendingDocument, status: "VERIFIED" | "REJECTED", rejectionReason?: string) => {
    setBusyId(doc.id)
    try {
      const res = await fetch(`/api/users/${doc.userId}/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Could not update the document")
      toast.success(status === "VERIFIED" ? `Verified "${doc.title}"` : `Rejected "${doc.title}"`)
      setRejecting(null)
      // The last item on a later page: step back so the list is not left empty.
      if (documents.length === 1 && page > 1) setPage(page - 1)
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the document")
    } finally {
      setBusyId(null)
    }
  }

  const submitReject = () => {
    if (!rejecting) return
    if (!reason.trim()) {
      setReasonError("Tell the employee what to fix, so they can upload the right file.")
      return
    }
    decide(rejecting, "REJECTED", reason.trim())
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Document Verification"
        description="Employee documents waiting for review, oldest first. Verify them, or reject with a reason so the employee knows what to upload instead."
        badge={
          data ? (
            <Badge variant="secondary" className="tabular-nums">
              {total} pending
            </Badge>
          ) : undefined
        }
      >
        <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5" aria-label="Refresh the pending list">
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </PageHeader>

      {isLoading && !data ? (
        <ul className="space-y-3" aria-busy="true" aria-label="Loading pending documents">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-4 rounded-xl border border-border/70 bg-card p-4">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-9 w-48 rounded-md" />
            </li>
          ))}
        </ul>
      ) : error && !data ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="size-6 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">Could not load pending documents</p>
            <p className="text-xs text-muted-foreground">{error.message}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => mutate()}>
            Try again
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="All caught up"
          description="No documents are waiting. You'll get a notification when an employee uploads one."
        />
      ) : (
        <>
          <ul className="space-y-3">
            {documents.map((doc) => {
              const busy = busyId === doc.id
              const size = formatSize(doc.fileSize)
              const uploadedBySomeoneElse = doc.uploadedBy && doc.uploadedBy.id !== doc.userId
              return (
                <li
                  key={doc.id}
                  className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-2xs sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Avatar className="size-10 shrink-0">
                      {doc.user.avatar && <AvatarImage src={doc.user.avatar} alt="" />}
                      <AvatarFallback>{doc.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground" title={doc.title}>
                          {doc.title}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_LABELS[doc.category] ?? "Other"}
                        </Badge>
                      </p>
                      <p className="truncate text-xs text-muted-foreground" title={doc.user.email}>
                        {doc.user.name}
                        {uploadedBySomeoneElse && ` · uploaded by ${doc.uploadedBy!.name}`}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <FileText className="size-3 shrink-0" aria-hidden />
                          <span className="truncate" title={doc.fileName}>{doc.fileName}</span>
                          {size && <span className="tabular-nums">({size})</span>}
                        </span>
                        <time dateTime={doc.uploadedAt} title={format(new Date(doc.uploadedAt), "d MMM yyyy, HH:mm")}>
                          {formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })}
                        </time>
                        {doc.expiryDate && <span>Expires {format(new Date(doc.expiryDate), "d MMM yyyy")}</span>}
                      </p>
                      {doc.notes && <p className="line-clamp-2 text-xs text-foreground/80">“{doc.notes}”</p>}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm" className="min-h-11 gap-1.5 sm:min-h-9">
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer" aria-label={`Open ${doc.title} from ${doc.user.name} in a new tab`}>
                        <ExternalLink className="size-3.5" />
                        View
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setRejecting(doc)
                        setReason("")
                        setReasonError(null)
                      }}
                      className="min-h-11 gap-1.5 text-amber-700 hover:text-amber-800 dark:text-amber-400 sm:min-h-9"
                      aria-label={`Reject ${doc.title} from ${doc.user.name}`}
                    >
                      <XCircle className="size-3.5" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => decide(doc, "VERIFIED")}
                      className="min-h-11 gap-1.5 sm:min-h-9"
                      aria-label={`Verify ${doc.title} from ${doc.user.name}`}
                    >
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                      Verify
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>

          {pages > 1 && (
            <nav className="mt-6 flex items-center justify-between text-xs text-muted-foreground" aria-label="Pending documents pages">
              <span className="tabular-nums">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </nav>
          )}
        </>
      )}

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && busyId === null && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject “{rejecting?.title}”?</DialogTitle>
            <DialogDescription>
              {rejecting?.user.name} will be notified with your reason and can upload a corrected file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Reason</Label>
            <Textarea
              id="rejection-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (reasonError) setReasonError(null)
              }}
              placeholder="e.g. The scan is blurry — please upload a clear copy of both sides."
              aria-invalid={!!reasonError}
              aria-describedby={reasonError ? "rejection-reason-error" : undefined}
              rows={3}
            />
            {reasonError && (
              <p id="rejection-reason-error" className="text-xs text-destructive">
                {reasonError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={busyId !== null}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitReject} disabled={busyId !== null} className="gap-1.5">
              {busyId !== null && <Loader2 className="size-3.5 animate-spin" />}
              Reject document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
