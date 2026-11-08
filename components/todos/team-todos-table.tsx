"use client"

import { jsonFetcher } from "@/lib/fetcher";
import { useState, useEffect, useMemo } from "react"
import useSWR from "swr"
import toast from "react-hot-toast"
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Flag,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import TodoDetailSheet, { type TodoDetailItem } from "@/components/todos/todo-detail-sheet"
import TodoFormDialog from "@/components/todos/todo-form-dialog"
import BlockerDialog from "@/components/todos/blocker-dialog"
import {
  TODO_PRIORITIES,
  TODO_STATUSES,
  type TaskPriority,
  type TodoStatus,
} from "@/lib/validation/todo"

// Throws on non-2xx, so a failed load is an error state, not an empty list.
const fetcher = (url: string) => jsonFetcher(url);

const STATUS_CONFIG: Record<TodoStatus, { label: string; class: string }> = {
  PENDING: { label: "Not Started", class: "bg-muted text-muted-foreground border-transparent" },
  IN_PROGRESS: { label: "In Progress", class: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-transparent" },
  BLOCKED: { label: "Blocked", class: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-transparent" },
  DONE: { label: "Done", class: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-transparent" },
  CARRIED_OVER: { label: "Carried Over", class: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border-transparent" },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; class: string }> = {
  LOW: { label: "Low", class: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-transparent" },
  MEDIUM: { label: "Medium", class: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-transparent" },
  HIGH: { label: "High", class: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-transparent" },
  URGENT: { label: "Urgent", class: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-transparent" },
}

interface UserSummary {
  id: number
  name: string | null
  email: string
  avatar?: string | null
}

interface TeamTodosTableProps {
  canUpdate?: boolean
  canDelete?: boolean
}

export default function TeamTodosTable({
  canUpdate = true,
  canDelete = true,
}: TeamTodosTableProps) {
  // Query parameters state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL")
  const [blockedFilter, setBlockedFilter] = useState<"all" | "blocked" | "unblocked">("all")
  const [userFilter, setUserFilter] = useState<string>("ALL")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [sortBy, setSortBy] = useState<"date" | "priority" | "status" | "title" | "createdAt">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Modal / Drawer states
  const [viewingTodo, setViewingTodo] = useState<TodoDetailItem | null>(null)
  const [editingTodo, setEditingTodo] = useState<TodoDetailItem | null>(null)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [blockerTodo, setBlockerTodo] = useState<TodoDetailItem | null>(null)
  const [blockerModalOpen, setBlockerModalOpen] = useState(false)
  const [deletingTodo, setDeletingTodo] = useState<TodoDetailItem | null>(null)
  const [busyActionId, setBusyActionId] = useState<string | null>(null)

  // Debounce search input (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(handler)
  }, [searchInput])

  // Fetch team members list for filter
  const { data: usersData } = useSWR<{ id: number; name: string | null; email: string }[] | { users: any[] }>(
    "/api/users",
    fetcher,
  )
  const teamMembers: UserSummary[] = useMemo(() => {
    if (!usersData) return []
    if (Array.isArray(usersData)) return usersData
    return usersData.users || []
  }, [usersData])

  // Build query string
  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      table: "1",
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortOrder,
    })

    if (debouncedSearch) params.set("search", debouncedSearch)
    if (statusFilter !== "ALL") params.set("status", statusFilter)
    if (priorityFilter !== "ALL") params.set("priority", priorityFilter)
    if (blockedFilter !== "all") params.set("blocked", blockedFilter)
    if (userFilter !== "ALL") params.set("userId", userFilter)
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)

    return params.toString()
  }, [
    page,
    pageSize,
    debouncedSearch,
    statusFilter,
    priorityFilter,
    blockedFilter,
    userFilter,
    startDate,
    endDate,
    sortBy,
    sortOrder,
  ])

  // Fetch todos data
  const { data, error, isLoading, mutate } = useSWR<{
    todos: TodoDetailItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
    summary?: {
      total: number
      done: number
      inProgress: number
      blocked: number
      carried: number
      completion: number
    }
    canUpdate?: boolean
    canDelete?: boolean
    error?: string
  }>(`/api/todos?${queryString}`, fetcher, { keepPreviousData: true })

  const todos = data?.todos || []
  const total = data?.total || 0
  const totalPages = data?.totalPages || 1
  const summary = data?.summary

  const hasActiveFilters =
    debouncedSearch !== "" ||
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    blockedFilter !== "all" ||
    userFilter !== "ALL" ||
    startDate !== "" ||
    endDate !== ""

  const clearFilters = () => {
    setSearchInput("")
    setDebouncedSearch("")
    setStatusFilter("ALL")
    setPriorityFilter("ALL")
    setBlockedFilter("all")
    setUserFilter("ALL")
    setStartDate("")
    setEndDate("")
    setPage(1)
  }

  // Quick patch handler
  const quickPatch = async (id: string, updates: Record<string, unknown>) => {
    setBusyActionId(id)
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Failed to update todo")
        return
      }
      toast.success("Todo updated")
      mutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusyActionId(null)
    }
  }

  // Delete handler
  const confirmDelete = async () => {
    if (!deletingTodo) return
    const id = deletingTodo.id
    setBusyActionId(id)
    try {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const j = await res.json()
        toast.error(j.error ?? "Failed to delete todo")
        return
      }
      toast.success("Todo deleted successfully")
      setDeletingTodo(null)
      mutate()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setBusyActionId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm">
        {/* Search, Date range, and Clear filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search by todo, notes, or team member name"
              placeholder="Search by todo, notes, or team member name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {searchInput && (
              <button aria-label="Clear search"
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Range:</span>
            </div>
            <Input aria-label="Range start date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(1)
              }}
              className="h-9 w-[130px] text-xs"
              title="Start Date"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input aria-label="Range end date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(1)
              }}
              className="h-9 w-[130px] text-xs"
              title="End Date"
            />

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </Button>
            )}

            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setEditingTodo(null)
                setFormDialogOpen(true)
              }}
              className="h-9 gap-1.5 text-xs ml-auto"
            >
              <Plus className="h-4 w-4" />
              New Todo
            </Button>
          </div>
        </div>

        {/* Dropdown Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground shrink-0">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter by:</span>
          </div>

          {/* User / Team Member */}
          <Select
            value={userFilter}
            onValueChange={(val) => {
              setUserFilter(val)
              setPage(1)
            }}
          >
            <SelectTrigger aria-label="All Members" className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="All Members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Team Members</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name || m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status */}
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val)
              setPage(1)
            }}
          >
            <SelectTrigger aria-label="All Statuses" className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {TODO_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority */}
          <Select
            value={priorityFilter}
            onValueChange={(val) => {
              setPriorityFilter(val)
              setPage(1)
            }}
          >
            <SelectTrigger aria-label="All Priorities" className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Priorities</SelectItem>
              {TODO_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_CONFIG[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Blocker Filter */}
          <Select
            value={blockedFilter}
            onValueChange={(val) => {
              setBlockedFilter(val as any)
              setPage(1)
            }}
          >
            <SelectTrigger aria-label="Blocker State" className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Blocker State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Blockers State</SelectItem>
              <SelectItem value="blocked">Blocked Only</SelectItem>
              <SelectItem value="unblocked">Unblocked Only</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort By Column */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Sort:</span>
            <Select
              value={sortBy}
              onValueChange={(val) => {
                setSortBy(val as any)
                setPage(1)
              }}
            >
              <SelectTrigger aria-label="Sort by" className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Todo Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="createdAt">Created Date</SelectItem>
              </SelectContent>
            </Select>

            <Button aria-label={`Sort order: ${sortOrder === "asc" ? "Ascending" : "Descending"}`}
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                setPage(1)
              }}
              title={`Sort order: ${sortOrder === "asc" ? "Ascending" : "Descending"}`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Scorecard Bar */}
      {summary && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Total Matching: <strong className="text-foreground">{total}</strong>
            </span>
            <span>
              Completed: <strong className="text-emerald-600 dark:text-emerald-400">{summary.done}</strong>
            </span>
            <span>
              In Progress: <strong className="text-sky-600 dark:text-sky-400">{summary.inProgress}</strong>
            </span>
            {summary.blocked > 0 && (
              <span className="text-destructive font-medium">
                Blocked: {summary.blocked}
              </span>
            )}
            {summary.carried > 0 && (
              <span>
                Carried Over: <strong>{summary.carried}</strong>
              </span>
            )}
          </div>
          <span className="tabular-nums">Avg Completion: {summary.completion}%</span>
        </div>
      )}

      {/* Main Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[180px]">Assigned User</TableHead>
              <TableHead className="min-w-[220px]">Todo Title & Notes</TableHead>
              <TableHead className="w-[110px]">Date</TableHead>
              <TableHead className="w-[100px]">Priority</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[180px]">Blockers</TableHead>
              <TableHead className="w-[120px] hidden lg:table-cell">Created</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-44" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-6 w-6 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : todos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-44 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
                    <p className="font-medium text-foreground">No Todos Found</p>
                    <p className="text-xs">
                      {hasActiveFilters
                        ? "Try clearing active filters or adjusting your search query."
                        : "No team members have planned todos for this period."}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2 text-xs">
                        Reset Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              todos.map((todo) => {
                const activeBlockers = (todo.blockers || []).filter(
                  (b) => b.status === "OPEN" || b.status === "IN_PROGRESS",
                )
                const isBlocked = todo.status === "BLOCKED" || activeBlockers.length > 0 || Boolean(todo.blocker)
                const isBusy = busyActionId === todo.id

                return (
                  <TableRow
                    key={todo.id}
                    className="hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => setViewingTodo(todo)}
                  >
                    {/* User */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 text-xs">
                          {todo.user.avatar && <AvatarImage src={todo.user.avatar} alt={todo.user.name || ""} />}
                          <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                            {todo.user.name
                              ? todo.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                              : "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {todo.user.name || "Unnamed"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {todo.user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Title & Notes */}
                    <TableCell>
                      <div className="space-y-0.5 max-w-md">
                        <p className={`text-xs font-medium leading-tight ${todo.status === "DONE" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {todo.title}
                        </p>
                        {todo.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {todo.notes}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Date */}
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(todo.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </TableCell>

                    {/* Priority */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${PRIORITY_CONFIG[todo.priority]?.class}`}
                      >
                        <Flag className="mr-1 h-2.5 w-2.5" />
                        {PRIORITY_CONFIG[todo.priority]?.label}
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${STATUS_CONFIG[todo.status]?.class}`}
                      >
                        {STATUS_CONFIG[todo.status]?.label}
                      </Badge>
                    </TableCell>

                    {/* Blockers */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {activeBlockers.length > 0 ? (
                        <div className="space-y-0.5">
                          <Badge variant="destructive" className="text-xs gap-1 font-medium">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {activeBlockers.length} Open Blocker{activeBlockers.length === 1 ? "" : "s"}
                          </Badge>
                          <p className="text-xs text-destructive truncate max-w-[170px]" title={activeBlockers[0].title}>
                            {activeBlockers[0].title}
                          </p>
                        </div>
                      ) : todo.blocker ? (
                        <div className="space-y-0.5">
                          <Badge variant="destructive" className="text-xs gap-1 font-medium">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Blocked
                          </Badge>
                          <p className="text-xs text-destructive truncate max-w-[170px]" title={todo.blocker}>
                            {todo.blocker}
                          </p>
                        </div>
                      ) : (todo.blockers || []).length > 0 ? (
                        <Badge variant="outline" className="text-xs border-emerald-600/30 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                          <Check className="mr-1 h-2.5 w-2.5" />
                          All Resolved
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">—</span>
                      )}
                    </TableCell>

                    {/* Created */}
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {new Date(todo.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-label="More actions for this to-do" variant="ghost" size="icon" className="h-7 w-7" disabled={isBusy}>
                            {isBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setViewingTodo(todo)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {canUpdate && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingTodo(todo)
                                  setFormDialogOpen(true)
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Todo
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setBlockerTodo(todo)
                                  setBlockerModalOpen(true)
                                }}
                              >
                                <AlertTriangle className="mr-2 h-4 w-4 text-destructive" />
                                Add Blocker
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {/* Quick Status Submenu */}
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <Check className="mr-2 h-4 w-4" />
                                  Change Status
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  <DropdownMenuRadioGroup
                                    value={todo.status}
                                    onValueChange={(val) => quickPatch(todo.id, { status: val })}
                                  >
                                    {TODO_STATUSES.map((st) => (
                                      <DropdownMenuRadioItem key={st} value={st}>
                                        {STATUS_CONFIG[st].label}
                                      </DropdownMenuRadioItem>
                                    ))}
                                  </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>

                              {/* Quick Priority Submenu */}
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <Flag className="mr-2 h-4 w-4" />
                                  Change Priority
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  <DropdownMenuRadioGroup
                                    value={todo.priority}
                                    onValueChange={(val) => quickPatch(todo.id, { priority: val })}
                                  >
                                    {TODO_PRIORITIES.map((pr) => (
                                      <DropdownMenuRadioItem key={pr} value={pr}>
                                        {PRIORITY_CONFIG[pr].label}
                                      </DropdownMenuRadioItem>
                                    ))}
                                  </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            </>
                          )}

                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeletingTodo(todo)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Todo
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Server Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-border bg-muted/10 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val))
                setPage(1)
              }}
            >
              <SelectTrigger aria-label="Rows per page" className="h-7 w-[68px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((sz) => (
                  <SelectItem key={sz} value={String(sz)}>
                    {sz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>
              Showing {todos.length === 0 ? 0 : (page - 1) * pageSize + 1} -{" "}
              {Math.min(page * pageSize, total)} of {total}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="mr-2">
              Page {page} of {totalPages}
            </span>
            <Button aria-label="Previous page"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button aria-label="Next page"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Todo Details Sheet */}
      <TodoDetailSheet
        open={Boolean(viewingTodo)}
        onOpenChange={(open) => !open && setViewingTodo(null)}
        todo={viewingTodo}
        canEdit={canUpdate}
        canDelete={canDelete}
        onMutate={() => {
          mutate()
          // Update viewingTodo with freshly mutated data
          if (viewingTodo) {
            fetch(`/api/todos?userId=${viewingTodo.userId}&date=${new Date(viewingTodo.date).toISOString()}`)
              .then((r) => r.json())
              .then((res) => {
                const refreshed = (res.todos || []).find((t: any) => t.id === viewingTodo.id)
                if (refreshed) setViewingTodo(refreshed)
              })
              .catch(() => {})
          }
        }}
        onOpenEditForm={(t) => {
          setViewingTodo(null)
          setEditingTodo(t)
          setFormDialogOpen(true)
        }}
      />

      {/* Add / Edit Todo Dialog */}
      <TodoFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        todo={editingTodo}
        canAssignUser={canUpdate}
        teamMembers={teamMembers}
        onSuccess={() => {
          mutate()
        }}
      />

      {/* Add Blocker Dialog */}
      {blockerTodo && (
        <BlockerDialog
          open={blockerModalOpen}
          onOpenChange={setBlockerModalOpen}
          todoId={blockerTodo.id}
          todoTitle={blockerTodo.title}
          onSuccess={() => {
            mutate()
            setBlockerTodo(null)
          }}
        />
      )}

      {/* Confirm Todo Deletion */}
      <AlertDialog open={Boolean(deletingTodo)} onOpenChange={(open) => !open && setDeletingTodo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this todo?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingTodo?.title}&rdquo;? Any associated blockers will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busyActionId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(busyActionId)}
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
            >
              {busyActionId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
