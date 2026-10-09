"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import useSWR from "swr"
import { Users, BarChart3, RefreshCw, Award, AlertTriangle } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type RoleSummary = {
  id: number
  name: string | null
  email: string
  avatar: string | null
  roleName: string | null
  totalPosts: number
  draftPosts: number
  underReviewPosts: number
  approvedPosts: number
  changesPosts: number
  overduePosts: number
  completedPosts: number
  inProgressPosts: number
  reworkCount: number
  avgReworksPerPost: number
  approvalRate: number
  pendingReworks: number
  rejectionCount: number
  avgApprovalAttempts: number
  grade: string
  submittedPosts: number
}

type RoleReportResponse = {
  data: RoleSummary[]
  summary: {
    totalUsers: number
    totalPosts: number
    avgReworksPerPost: number
    topPerformer: {
      id: number
      name: string | null
      completedPosts: number
      approvalRate: number
      roleName: string | null
    } | null
  }
  filters: {
    projectId: string | null
    availableProjects: { id: string; name: string }[]
    availableRoles: string[]
    selectedProject: { id: string; name: string } | null
    role: string | null
    availablePeriods: string[]
    selectedPeriod: string | null
  }
}

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("Failed to load designer report")
  }
  return response.json()
}

interface DesignerPerformanceReportProps {
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
}

export function DesignerPerformanceReport({ selectedPeriod, onPeriodChange }: DesignerPerformanceReportProps = {}) {
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  
  const [periodFilter, setPeriodFilter] = useState<string | null>(selectedPeriod || "all")

  useEffect(() => {
    if (selectedPeriod !== undefined) {
      setPeriodFilter(selectedPeriod)
    }
  }, [selectedPeriod])


  const queryParams = new URLSearchParams()
  if (projectFilter !== "all") {
    queryParams.set("projectId", projectFilter)
  }
  if (roleFilter !== "all") {
    queryParams.set("role", roleFilter)
  }
  if (periodFilter && periodFilter !== "all") {
    const [year, month] = periodFilter.split("-")
    if (year && month) {
      queryParams.set("year", year)
      queryParams.set("month", month)
    }
  }
  const query = queryParams.toString()

  const { data, error, isLoading } = useSWR<RoleReportResponse>(`/api/reports/roles${query ? `?${query}` : ""}`, fetcher, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    // Only set from server if we don't have a local value and server provides one
    if (!periodFilter && data?.filters.selectedPeriod) {
      setPeriodFilter(data.filters.selectedPeriod)
    }
  }, [data?.filters.selectedPeriod])

  const designers = useMemo(() => data?.data ?? [], [data])
  const rows = useMemo(
    () => [...designers].sort((a, b) => b.completedPosts - a.completedPosts || b.totalPosts - a.totalPosts),
    [designers]
  )
  const isTopPerformer = (id: number) => data?.summary.topPerformer?.id === id
  const selectedProjectLabel =
    projectFilter !== "all"
      ? data?.filters.availableProjects.find((project) => project.id === projectFilter)?.name
      : "All projects"
  const selectedRoleLabel = roleFilter !== "all" ? roleFilter : "All roles"
  const selectedPeriodValue = periodFilter || data?.filters.selectedPeriod || ""
  const selectedPeriodLabel = selectedPeriodValue ? formatPeriodLabel(selectedPeriodValue) : "Select month"

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Team Performance</h2>
          <p className="text-muted-foreground text-sm">
            Track throughput, rework averages, and approval health for every role across your workspace.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-medium">
              {selectedProjectLabel}
            </Badge>
            <Badge variant="secondary" className="text-xs font-medium">
              {selectedRoleLabel}
            </Badge>
            <Badge variant="secondary" className="text-xs font-medium">
              {selectedPeriodLabel}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={projectFilter} onValueChange={setProjectFilter} disabled={!data && !error && isLoading}>
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {(data?.filters.availableProjects ?? []).map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter} disabled={!data && !error && isLoading}>
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {(data?.filters.availableRoles ?? []).map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={periodFilter || "all"}
              onValueChange={(val) => {
                setPeriodFilter(val)
                if (onPeriodChange) onPeriodChange(val)
              }}
              disabled={!data && !error && isLoading}
            >
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                {(data?.filters.availablePeriods && data.filters.availablePeriods.length > 0
                  ? data.filters.availablePeriods
                  : []
                ).map((period) => (
                  <SelectItem key={period} value={period}>
                    {formatPeriodLabel(period)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Unable to load designer report</AlertTitle>
          <AlertDescription>Please try again later or contact your administrator.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Tracked Teammates"
          value={data?.summary.totalUsers ?? 0}
          subtitle="Matching the current role filter"
          icon={<Users className="h-5 w-5 text-blue-500" />}
          isLoading={isLoading}
        />
        <SummaryCard
          title="Total Posts Assigned"
          value={data?.summary.totalPosts ?? 0}
          subtitle="Filtered by project scope"
          icon={<BarChart3 className="h-5 w-5 text-emerald-500" />}
          isLoading={isLoading}
        />
        <SummaryCard
          title="Avg. Changes / Post"
          value={(data?.summary.avgReworksPerPost ?? 0).toFixed(2)}
          subtitle="Lower is better"
          icon={<RefreshCw className="h-5 w-5 text-amber-500" />}
          isLoading={isLoading}
        />
        <SummaryCard
          title="Top Performer"
          value={
            data?.summary.topPerformer
              ? `${data.summary.topPerformer.name ?? "Unnamed"}`
              : "—"
          }
          subtitle={
            data?.summary.topPerformer
              ? `${data.summary.topPerformer.completedPosts} posts • ${data.summary.topPerformer.approvalRate}% approval`
              : "No completed posts yet"
          }
          icon={<Award className="h-5 w-5 text-purple-500" />}
          isLoading={isLoading}
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Role Activity by Output</CardTitle>
          <CardDescription>
            Completed work, in-progress load, and rework pressure across every team member.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {[...Array(5)].map((_, index) => (
                <Skeleton key={`designer-skeleton-${index}`} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-center">Total Assigned</TableHead>
                  <TableHead className="text-center">Draft</TableHead>
                  <TableHead className="text-center">Under Review</TableHead>
                  <TableHead className="text-center">Approved</TableHead>
                  <TableHead className="text-center">Changes</TableHead>
                  <TableHead className="text-center">Overdue</TableHead>
                  <TableHead className="text-center">Avg Chg/Post</TableHead>
                  <TableHead className="text-center">Avg Attempts</TableHead>
                  <TableHead className="text-center">Approval Rate</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((designer) => (
                  <TableRow key={designer.id} className={isTopPerformer(designer.id) ? "bg-muted/40" : undefined}>
                    <TableCell className="min-w-[220px]">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {designer.avatar ? (
                            <AvatarImage src={designer.avatar} alt={designer.name ?? designer.email} />
                          ) : (
                            <AvatarFallback>
                              {(designer.name || designer.email).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <p className="font-medium leading-tight">{designer.name ?? "Unnamed teammate"}</p>
                          <p className="text-muted-foreground text-xs">{designer.email}</p>
                          {isTopPerformer(designer.id) && (
                            <Badge variant="default" className="mt-1 text-[0.65rem]">
                              Top Performer
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-medium">
                        {designer.roleName ?? "Unassigned"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{designer.totalPosts}</TableCell>
                    <TableCell className="text-center text-amber-500">{designer.draftPosts}</TableCell>
                    <TableCell className="text-center text-violet-500">{designer.underReviewPosts}</TableCell>
                    <TableCell className="text-center text-emerald-500">{designer.approvedPosts}</TableCell>
                    <TableCell className="text-center text-slate-500">{designer.changesPosts}</TableCell>
                    <TableCell className="text-center text-rose-500">{designer.overduePosts}</TableCell>
                    <TableCell className="text-center">{designer.avgReworksPerPost.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{designer.avgApprovalAttempts.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span>{designer.approvalRate}%</span>
                        </div>
                        <Progress value={designer.approvalRate} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          designer.grade === "A"
                            ? "default"
                            : designer.grade === "B"
                            ? "secondary"
                            : designer.grade === "C"
                            ? "outline"
                            : "destructive"
                        }
                        className="text-xs font-medium"
                      >
                        {designer.grade}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <p className="text-lg font-medium">No activity within this scope</p>
              <p className="text-muted-foreground text-sm">
                Try selecting another project or role to see throughput and rework data.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  isLoading,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: ReactNode
  isLoading: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-6">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p className="text-2xl font-semibold">{value}</p>
          )}
          <p className="text-muted-foreground text-xs mt-1">{subtitle}</p>
        </div>
        <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">{icon}</div>
      </CardContent>
    </Card>
  )
}

function formatPeriodLabel(value: string) {
  if (!value || value === "all") {
    return "All Time"
  }
  const [year, month] = value.split("-").map((part) => Number(part))
  if (!year || !month) {
    return value
  }

  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleString("en-US", { month: "short", year: "numeric" })
}

export default DesignerPerformanceReport