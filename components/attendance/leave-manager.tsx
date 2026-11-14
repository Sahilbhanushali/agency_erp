"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "react-hot-toast"
import { format } from "date-fns"
import { AlertTriangle, CalendarPlus, History, Loader2, Minus, Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body
}

interface Balance {
  id: string
  leaveTypeId: string
  year: number
  totalQuota: number
  usedDays: number
  pendingDays: number
  remainingDays: number
  leaveType: { id: string; name: string; code: string; isPaid: boolean }
}

interface LedgerEntry {
  id: string
  entryType: string
  days: number
  balanceAfter: number
  notes: string | null
  effectiveDate: string
  createdAt: string
  by: string | null
  leaveType: { name: string; code: string }
}

const ENTRY_LABEL: Record<string, string> = {
  ACCRUAL: "Yearly quota",
  USAGE: "Leave taken",
  ADJUSTMENT: "Manual adjustment",
  REVERSAL: "Leave cancelled",
  ENCASHMENT: "Encashed",
  LAPSE: "Lapsed",
}

const today = () => new Date().toISOString().split("T")[0]

/**
 * HR's control over one employee's leave: add or take away days, record leave they
 * took without applying, and see every change with who made it and why.
 */
export function LeaveManager({ canAdjust, canRecord }: { canAdjust: boolean; canRecord: boolean }) {
  const thisYear = new Date().getFullYear()
  const [userId, setUserId] = useState<string>("")
  const [year, setYear] = useState(thisYear)

  const { data: people, error: peopleError } = useSWR<{ id: number | string; name: string }[]>("/api/users", fetcher)
  const {
    data: balances,
    error: balancesError,
    isLoading: balancesLoading,
    mutate: mutateBalances,
  } = useSWR<Balance[]>(userId ? `/api/leaves/balances?userId=${userId}&year=${year}` : null, fetcher)
  const { data: history, mutate: mutateHistory } = useSWR<{ entries: LedgerEntry[] }>(
    userId ? `/api/leaves/adjustments?userId=${userId}&year=${year}` : null,
    fetcher,
  )
  const employee = (people ?? []).find((p) => String(p.id) === userId)

  // Adjust dialog
  const [adjusting, setAdjusting] = useState<{ balance: Balance; direction: 1 | -1 } | null>(null)
  const [adjustDays, setAdjustDays] = useState("1")
  const [adjustReason, setAdjustReason] = useState("")
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [adjustBusy, setAdjustBusy] = useState(false)

  // Record-leave dialog
  const [recording, setRecording] = useState(false)
  const [recType, setRecType] = useState("")
  const [recStart, setRecStart] = useState(today())
  const [recEnd, setRecEnd] = useState(today())
  const [recHalf, setRecHalf] = useState(false)
  const [recSession, setRecSession] = useState<"FIRST_HALF" | "SECOND_HALF">("FIRST_HALF")
  const [recReason, setRecReason] = useState("")
  const [recError, setRecError] = useState<string | null>(null)
  const [recBusy, setRecBusy] = useState(false)

  const refresh = () => {
    void mutateBalances()
    void mutateHistory()
  }

  const openAdjust = (balance: Balance, direction: 1 | -1) => {
    setAdjusting({ balance, direction })
    setAdjustDays("1")
    setAdjustReason("")
    setAdjustError(null)
  }

  const submitAdjust = async () => {
    if (!adjusting) return
    const n = Number(adjustDays)
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n * 2)) {
      setAdjustError("Enter a number of days, in whole or half days.")
      return
    }
    if (adjusting.direction < 0 && n > adjusting.balance.remainingDays) {
      setAdjustError(`Only ${adjusting.balance.remainingDays} days are left to take away.`)
      return
    }
    if (adjustReason.trim().length < 3) {
      setAdjustError("Give a reason — the employee sees it and it stays in the history.")
      return
    }
    setAdjustBusy(true)
    try {
      const res = await fetch("/api/leaves/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(userId),
          leaveTypeId: adjusting.balance.leaveTypeId,
          year,
          days: n * adjusting.direction,
          reason: adjustReason.trim(),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Could not adjust the balance")
      toast.success(
        `${adjusting.direction > 0 ? "Added" : "Took away"} ${n} ${adjusting.balance.leaveType.name} day${n === 1 ? "" : "s"}. ${employee?.name ?? "They"} now ${employee ? "has" : "have"} ${body.remainingDays}.`,
      )
      setAdjusting(null)
      refresh()
    } catch (e) {
      setAdjustError((e as Error).message)
    } finally {
      setAdjustBusy(false)
    }
  }

  const openRecord = () => {
    setRecording(true)
    setRecType(balances?.[0]?.leaveTypeId ?? "")
    setRecStart(today())
    setRecEnd(today())
    setRecHalf(false)
    setRecReason("")
    setRecError(null)
  }

  const submitRecord = async () => {
    if (!recType) return setRecError("Choose a leave type.")
    if (!recHalf && recEnd < recStart) return setRecError("The end date is before the start date.")
    if (recReason.trim().length < 3) return setRecError("Give a reason.")
    setRecBusy(true)
    try {
      const res = await fetch("/api/leaves/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(userId),
          leaveTypeId: recType,
          startDate: recStart,
          endDate: recHalf ? recStart : recEnd,
          isHalfDay: recHalf,
          halfDaySession: recHalf ? recSession : undefined,
          reason: recReason.trim(),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Could not record the leave")
      toast.success(
        body.convertedToUnpaid
          ? `Recorded ${body.totalDays} day(s) as Unpaid Leave — not enough balance for the type chosen.`
          : `Recorded ${body.totalDays} day(s) of ${body.leaveType?.name ?? "leave"}; attendance updated.`,
        { duration: 6000 },
      )
      setRecording(false)
      refresh()
    } catch (e) {
      setRecError((e as Error).message)
    } finally {
      setRecBusy(false)
    }
  }

  const years = useMemo(() => [thisYear + 1, thisYear, thisYear - 1, thisYear - 2], [thisYear])

  return (
    <div className="space-y-4">
      <Card className="shadow-2xs">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="lm-employee" className="text-xs">Employee</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="lm-employee" className="h-10">
                <SelectValue placeholder={peopleError ? "Could not load employees" : people ? "Choose an employee" : "Loading…"} />
              </SelectTrigger>
              <SelectContent>
                {(people ?? []).map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:w-32">
            <Label htmlFor="lm-year" className="text-xs">Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger id="lm-year" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canRecord && (
            <Button onClick={openRecord} disabled={!userId || !balances?.length} className="h-10 gap-1.5">
              <CalendarPlus className="size-4" /> Record leave taken
            </Button>
          )}
        </CardContent>
      </Card>

      {!userId ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <Users className="mb-3 size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">Choose an employee</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            See their leave balances, add or take away days, and record leave they took without applying.
          </p>
        </div>
      ) : balancesError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="size-5 text-destructive" aria-hidden />
          <p className="text-sm">{balancesError.message}</p>
          <Button size="sm" variant="outline" onClick={refresh}>Try again</Button>
        </div>
      ) : (
        <>
          <Card className="shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">
                {employee?.name}&apos;s balances — {year}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Leave type</TableHead>
                      <TableHead className="text-right text-xs">Entitled</TableHead>
                      <TableHead className="text-right text-xs">Used</TableHead>
                      <TableHead className="text-right text-xs">Remaining</TableHead>
                      {canAdjust && <TableHead className="text-right text-xs">Adjust</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balancesLoading || !balances
                      ? Array.from({ length: 4 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="ml-auto h-4 w-8" /></TableCell>
                            <TableCell><Skeleton className="ml-auto h-4 w-8" /></TableCell>
                            <TableCell><Skeleton className="ml-auto h-4 w-8" /></TableCell>
                            {canAdjust && <TableCell><Skeleton className="ml-auto h-8 w-24" /></TableCell>}
                          </TableRow>
                        ))
                      : balances.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="text-xs font-medium">
                              {b.leaveType.name}
                              <Badge variant={b.leaveType.isPaid ? "success" : "neutral"} className="ml-2 py-0 text-xs">
                                {b.leaveType.isPaid ? "Paid" : "Unpaid"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">{b.totalQuota}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums">{b.usedDays}</TableCell>
                            <TableCell className="text-right text-sm font-semibold tabular-nums">{b.remainingDays}</TableCell>
                            {canAdjust && (
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 gap-1"
                                    onClick={() => openAdjust(b, 1)}
                                    aria-label={`Add ${b.leaveType.name} days for ${employee?.name}`}
                                  >
                                    <Plus className="size-3.5" /> Add
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 gap-1"
                                    disabled={b.remainingDays <= 0}
                                    onClick={() => openAdjust(b, -1)}
                                    aria-label={`Take away ${b.leaveType.name} days from ${employee?.name}`}
                                  >
                                    <Minus className="size-3.5" /> Deduct
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="size-4 text-muted-foreground" aria-hidden /> History — {year}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!history ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : history.entries.length === 0 ? (
                <p className="px-4 pb-4 text-xs text-muted-foreground">No changes recorded for {year} yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {history.entries.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                      <span
                        className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                          e.days > 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/10 text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        {e.days > 0 ? "+" : ""}
                        {e.days}
                      </span>
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-medium text-foreground">
                          {ENTRY_LABEL[e.entryType] ?? e.entryType} · {e.leaveType.name}
                        </p>
                        {e.notes && <p className="text-muted-foreground">{e.notes}</p>}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(e.createdAt), "d MMM yyyy, HH:mm")}
                          {e.by && ` · by ${e.by}`} · balance after: {e.balanceAfter}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Add / deduct */}
      <Dialog open={!!adjusting} onOpenChange={(o) => !o && !adjustBusy && setAdjusting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {adjusting?.direction === 1 ? "Add" : "Take away"} {adjusting?.balance.leaveType.name} days
            </DialogTitle>
            <DialogDescription className="text-xs">
              {employee?.name} has {adjusting?.balance.remainingDays} left for {year}. This changes their entitlement; to record leave they
              actually took, use “Record leave taken”.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="adj-days" className="text-xs">Days</Label>
              <Input
                id="adj-days"
                type="number"
                min={0.5}
                step={0.5}
                inputMode="decimal"
                value={adjustDays}
                onChange={(e) => setAdjustDays(e.target.value)}
                aria-invalid={!!adjustError}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-reason" className="text-xs">Reason</Label>
              <Textarea
                id="adj-reason"
                rows={3}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder={adjusting?.direction === 1 ? "e.g. Comp-off for working on Diwali weekend" : "e.g. Unapproved absence on 12 Oct"}
                aria-invalid={!!adjustError}
                aria-describedby={adjustError ? "adj-error" : undefined}
              />
            </div>
            {adjustError && <p id="adj-error" className="text-xs text-destructive">{adjustError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAdjusting(null)} disabled={adjustBusy}>Cancel</Button>
            <Button onClick={submitAdjust} disabled={adjustBusy} variant={adjusting?.direction === -1 ? "destructive" : "default"} className="gap-1.5">
              {adjustBusy && <Loader2 className="size-4 animate-spin" />}
              {adjusting?.direction === 1 ? "Add days" : "Take away days"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record leave taken */}
      <Dialog open={recording} onOpenChange={(o) => !o && !recBusy && setRecording(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Record leave for {employee?.name}</DialogTitle>
            <DialogDescription className="text-xs">
              Approved straight away: their balance is charged and those days are marked On Leave in attendance. If the balance is short, it is
              booked as Unpaid Leave.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-type" className="text-xs">Leave type</Label>
              <Select value={recType} onValueChange={setRecType}>
                <SelectTrigger id="rec-type"><SelectValue placeholder="Choose a type" /></SelectTrigger>
                <SelectContent>
                  {(balances ?? []).map((b) => (
                    <SelectItem key={b.leaveTypeId} value={b.leaveTypeId}>
                      {b.leaveType.name} ({b.remainingDays} left)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="rec-half" className="text-xs">Half day</Label>
              <Switch id="rec-half" checked={recHalf} onCheckedChange={setRecHalf} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rec-start" className="text-xs">{recHalf ? "Date" : "From"}</Label>
                <Input id="rec-start" type="date" value={recStart} onChange={(e) => setRecStart(e.target.value)} />
              </div>
              {recHalf ? (
                <div className="space-y-1.5">
                  <Label htmlFor="rec-session" className="text-xs">Session</Label>
                  <Select value={recSession} onValueChange={(v) => setRecSession(v as "FIRST_HALF" | "SECOND_HALF")}>
                    <SelectTrigger id="rec-session"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIRST_HALF">First half</SelectItem>
                      <SelectItem value="SECOND_HALF">Second half</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="rec-end" className="text-xs">To</Label>
                  <Input id="rec-end" type="date" min={recStart} value={recEnd} onChange={(e) => setRecEnd(e.target.value)} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-reason" className="text-xs">Reason</Label>
              <Textarea
                id="rec-reason"
                rows={3}
                value={recReason}
                onChange={(e) => setRecReason(e.target.value)}
                placeholder="e.g. Sick, informed by phone"
                aria-invalid={!!recError}
                aria-describedby={recError ? "rec-error" : undefined}
              />
            </div>
            {recError && <p id="rec-error" className="text-xs text-destructive">{recError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRecording(false)} disabled={recBusy}>Cancel</Button>
            <Button onClick={submitRecord} disabled={recBusy} className="gap-1.5">
              {recBusy && <Loader2 className="size-4 animate-spin" />}
              Record leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
