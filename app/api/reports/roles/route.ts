import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const DESIGN_ROLE_NAMES = new Set([
  "designer",
  "team lead",
  "video editor",
  "creative executive(design & media)",
  "creative executive (design & media)",
  "creative designer",
  "manager",
])
const CONTENT_ROLE_NAMES = new Set([
  "social media manager",
  "social media executive",
  "content writer",
  "content strategist",
])

const isFlowRelevantForRole = (roleName: string | null | undefined, flowType: string) => {
  const normalizedRole = (roleName || "").trim().toLowerCase()
  const normalizedFlow = (flowType || "").trim().toUpperCase()

  if (DESIGN_ROLE_NAMES.has(normalizedRole)) {
    return normalizedFlow === "DESIGN"
  }

  if (CONTENT_ROLE_NAMES.has(normalizedRole)) {
    return normalizedFlow === "CONTENT"
  }

  return true
}

type BasicRole = { name: string | null }
type BasicProject = { id: string; name: string }
type TrackedUser = {
  id: number
  name: string | null
  email: string
  avatar: string | null
  role: { name: string | null } | null
}

type FlowWithHistory = {
  id: string
  flowType: string
  status: string
  postId: string
  submittedById: number | null
  submittedAt: Date | null
  submissionCount: number
  version: number
  history: {
    id: string
    action: string
    createdAt: Date
  }[]
}

type RoleSummary = {
  id: number
  name: string | null
  email: string
  avatar: string | null
  roleName: string | null
  totalPosts: number  // Unique assigned posts
  draftPosts: number
  underReviewPosts: number
  approvedPosts: number
  changesPosts: number
  overduePosts: number
  completedPosts: number  // Unique approved posts (status: APPROVED)
  inProgressPosts: number  // Assigned but not completed/pending
  pendingReworks: number  // Unique posts with status: REJECTED or RESUBMITTED
  reworkCount: number  // Total rejection events across all posts (from history)
  avgReworksPerPost: number  // reworkCount / submittedPosts
  approvalRate: number  // (completedPosts / submittedPosts) * 100
  rejectionCount: number  // Same as reworkCount
  avgApprovalAttempts: number  // (submissionCount + resubmits from history) / submittedPosts
  grade: string
  submittedPosts: number  // Unique posts submitted by user (any status except DRAFT)
  totalAttempts: number  // Total attempts from submissionCount + history resubmits
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const projectId = url.searchParams.get("projectId") || undefined
  const roleParam = url.searchParams.get("role") || undefined
  const roleFilter = roleParam && roleParam !== "all" ? roleParam : undefined
  const monthParam = url.searchParams.get("month")
  const yearParam = url.searchParams.get("year")
  
  // Default to all time if not provided
  const isAllTime = !monthParam || !yearParam
  const monthFilter = monthParam ? Number(monthParam) : 1
  const yearFilter = yearParam ? Number(yearParam) : 2000

  const startDate = isAllTime ? new Date(0) : new Date(Date.UTC(yearFilter, monthFilter - 1, 1, 0, 0, 0))
  const endDate = isAllTime ? new Date(3000, 0, 1) : new Date(Date.UTC(yearFilter, monthFilter, 1, 0, 0, 0))

  const periodLabel = isAllTime ? "all" : `${yearFilter}-${String(monthFilter).padStart(2, "0")}`

  const currentUserId = Number(session.user.id)
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { role: { select: { name: true } } },
  })

  const normalizedRole = (currentUser?.role?.name || session.user.role || "user").toLowerCase()
  const normalizedCompactRole = normalizedRole.replace(/\s+/g, "")
  const isClient = normalizedRole === "client"
  const isRestrictedContributor = ["designer", "videoeditor"].includes(normalizedCompactRole)

  const projectAccessWhere = isClient
    ? { client: { email: session.user.email || undefined } }
    : isRestrictedContributor
      ? { assignedUsers: { some: { id: currentUserId } } }
      : {}

  const postAccessWhere = isClient
    ? { project: { client: { email: session.user.email || undefined } } }
    : isRestrictedContributor
      ? { project: { assignedUsers: { some: { id: currentUserId } } } }
      : {}

  const [projects, roles] = await Promise.all([
    prisma.project.findMany({
      where: projectAccessWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.role.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const typedProjects = projects as BasicProject[]
  const availableRoles = roles
    .map((role: BasicRole) => role.name)
    .filter((name: string | null): name is string => Boolean(name))

  let trackedUsers = await prisma.user.findMany({
    where: roleFilter
      ? {
          role: {
            name: roleFilter,
          },
        }
      : {
          role: {
            isNot: null,
          },
        },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  })

  // If no specific role filter, narrow to design roles for this report
  if (!roleFilter) {
    trackedUsers = trackedUsers.filter((user: any) =>
      DESIGN_ROLE_NAMES.has((user.role?.name || "").trim().toLowerCase())
    )
  }

  if (!trackedUsers.length) {
    return NextResponse.json({
      data: [],
      summary: {
        totalUsers: 0,
        totalPosts: 0,
        avgReworksPerPost: 0,
        topPerformer: null,
      },
      filters: {
        projectId: projectId || null,
        role: roleFilter || null,
        availableProjects: typedProjects,
        availableRoles,
        selectedProject: projectId ? typedProjects.find((project) => project.id === projectId) || null : null,
        selectedPeriod: periodLabel,
        availablePeriods: [],
      },
    })
  }

  const typedTrackedUsers = trackedUsers as TrackedUser[]
  const trackedUserIds = typedTrackedUsers.map((user) => user.id)
  const trackedUserIdSet = new Set(trackedUserIds)

  const flowFilters = {
    ...postAccessWhere,
    ...(projectId ? { projectId } : {}),
  }

  const posts = await prisma.post.findMany({
    where: {
      ...flowFilters,
      project: {
        isActive: true,
        ...((flowFilters as any).project || {})
      },
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
      OR: [
        { assignedToId: { in: trackedUserIds } },
        { assignedUsers: { some: { id: { in: trackedUserIds } } } }
      ]
    },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      assignedToId: true,
      assignedUsers: { select: { id: true } }
    }
  })

  // Group unique posts per user with their basic post details
  const userAssignedPosts = new Map<number, Map<string, { status: string, scheduledAt: Date | null }>>()
  posts.forEach((post: any) => {
    // Determine which tracked users are assigned to this post
    const assignedIds = new Set<number>()
    if (post.assignedToId && trackedUserIdSet.has(post.assignedToId)) {
      assignedIds.add(post.assignedToId)
    }
    post.assignedUsers?.forEach((user: { id: number }) => {
      if (trackedUserIdSet.has(user.id)) {
        assignedIds.add(user.id)
      }
    })

    // Assign the post to those users in the map
    assignedIds.forEach((userId) => {
      let userPosts = userAssignedPosts.get(userId)
      if (!userPosts) {
        userPosts = new Map()
        userAssignedPosts.set(userId, userPosts)
      }
      userPosts.set(post.id, {
        status: post.status,
        scheduledAt: post.scheduledAt
      })
    })
  })

  // Early exit if no assignments
  let hasAssignments = false
  typedTrackedUsers.forEach((user) => {
    if ((userAssignedPosts.get(user.id)?.size ?? 0) > 0) {
      hasAssignments = true
    }
  })
  if (!hasAssignments) {
    return NextResponse.json({
      data: typedTrackedUsers.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        roleName: user.role?.name || null,
        totalPosts: 0,
        draftPosts: 0,
        underReviewPosts: 0,
        approvedPosts: 0,
        changesPosts: 0,
        overduePosts: 0,
        completedPosts: 0,
        inProgressPosts: 0,
        pendingReworks: 0,
        reworkCount: 0,
        avgReworksPerPost: 0,
        approvalRate: 0,
        rejectionCount: 0,
        avgApprovalAttempts: 0,
        grade: "N/A",
        submittedPosts: 0,
        totalAttempts: 0,
      })),
      summary: {
        totalUsers: typedTrackedUsers.length,
        totalPosts: 0,
        avgReworksPerPost: 0,
        topPerformer: null,
      },
      filters: {
        projectId: projectId || null,
        role: roleFilter || null,
        availableProjects: typedProjects,
        availableRoles,
        selectedProject: projectId ? typedProjects.find((project: BasicProject) => project.id === projectId) || null : null,
        selectedPeriod: periodLabel,
        availablePeriods: [],
      },
    })
  }

  const allAssignedPostIds = new Set(
    Array.from(userAssignedPosts.values()).flatMap((postsMap) => Array.from(postsMap.keys()))
  )

  // Primary query: Fetch from approvalFlow directly, filtered by submittedAt for period
  // Include history only for attempt/rejection details
  const approvalFlows = await prisma.approvalFlow.findMany({
    where: {
      postId: { in: Array.from(allAssignedPostIds) },
      submittedById: { in: trackedUserIds },
      submittedAt: {
        gte: startDate,
        lt: endDate,
      },
      status: {
        not: "DRAFT",  // Exclude drafts; focus on submitted flows
      },
      flowType: roleFilter ? undefined : "DESIGN",  // Default to DESIGN if no role filter
    },
    include: {
      history: {
        where: {
          action: {
            in: ["RESUBMITTED", "REJECTED"],  // Only need resubmits/rejects for counts (APPROVED handled by status)
          },
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  // Build available periods from all flows' submittedAt
  const allFlowsForPeriods = await prisma.approvalFlow.findMany({
    where: {
      submittedById: { in: trackedUserIds },
      post: flowFilters,
    },
    select: {
      submittedAt: true,
    },
  })

  const availablePeriodsSet = new Set<string>()
  allFlowsForPeriods.forEach((flow: any) => {
    if (flow.submittedAt) {
      const date = flow.submittedAt instanceof Date ? flow.submittedAt : new Date(flow.submittedAt)
      const period = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
      availablePeriodsSet.add(period)
    }
  })
  if (periodLabel) {
    availablePeriodsSet.add(periodLabel)
  }
  const availablePeriods = Array.from(availablePeriodsSet).sort((a, b) => (a > b ? -1 : 1))

  // Process flows: Group by postId to ensure unique per post
  const postFlowMap = new Map<string, FlowWithHistory>()
  approvalFlows.forEach((flowRaw: any) => {
    const flow: FlowWithHistory = {
      id: flowRaw.id,
      flowType: flowRaw.flowType,
      status: flowRaw.status,
      postId: flowRaw.postId,
      submittedById: flowRaw.submittedById,
      submittedAt: flowRaw.submittedAt,
      submissionCount: flowRaw.submissionCount,
      version: flowRaw.version,
      history: flowRaw.history,
    }
    // Overwrite if multiple flows per post (keep latest/most complete)
    postFlowMap.set(flow.postId, flow)
  })

  type InternalSummary = RoleSummary

  const summaries = new Map<number, InternalSummary>()

  typedTrackedUsers.forEach((user) => {
    const assignedPosts = userAssignedPosts.get(user.id) || new Map<string, { status: string, scheduledAt: Date | null }>()
    summaries.set(user.id, {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      roleName: user.role?.name || null,
      totalPosts: assignedPosts.size,
      draftPosts: 0,
      underReviewPosts: 0,
      approvedPosts: 0,
      changesPosts: 0,
      overduePosts: 0,
      completedPosts: 0,
      inProgressPosts: assignedPosts.size,  // Start with all assigned as in-progress
      pendingReworks: 0,
      reworkCount: 0,
      avgReworksPerPost: 0,
      approvalRate: 0,
      rejectionCount: 0,
      avgApprovalAttempts: 0,
      grade: "N/A",
      submittedPosts: 0,
      totalAttempts: 0,
    })
  })

  const today = new Date()

  typedTrackedUsers.forEach((user) => {
    const summary = summaries.get(user.id)!
    const assignedPosts = userAssignedPosts.get(user.id)
    if (!assignedPosts) return

    assignedPosts.forEach((postDetails, postId) => {
      const flow = postFlowMap.get(postId)
      
      let effectiveStatus = "DRAFT"
      let isSubmittedByMe = false

      if (flow && flow.submittedById === user.id && isFlowRelevantForRole(summary.roleName, flow.flowType)) {
        isSubmittedByMe = true
        effectiveStatus = flow.status
        
        let rejections = 0
        let extraAttempts = 0
        flow.history.forEach((h) => {
          if (h.action === "REJECTED") rejections++
          else if (h.action === "RESUBMITTED") extraAttempts++
        })

        summary.submittedPosts += 1
        summary.totalAttempts += flow.submissionCount + extraAttempts
        summary.rejectionCount += rejections
        summary.reworkCount = summary.rejectionCount
        
        if (effectiveStatus === "APPROVED") {
          summary.completedPosts += 1
        } else if (["REJECTED", "RESUBMITTED"].includes(effectiveStatus)) {
          summary.pendingReworks += 1
        }
      }

      // New columns based on My Tasks logic (uses global post status like My Tasks dashboard)
      const postStatus = postDetails.status
      if (postStatus === "DRAFT") {
        summary.draftPosts += 1
      } else if (["SUBMITTED", "RESUBMITTED"].includes(postStatus)) {
        summary.underReviewPosts += 1
      } else if (["APPROVED", "SCHEDULED", "POSTED"].includes(postStatus)) {
        summary.approvedPosts += 1
      } else if (postStatus === "REJECTED") {
        summary.changesPosts += 1
      }

      // Overdue logic
      if (postDetails.scheduledAt) {
        const dueDate = new Date(postDetails.scheduledAt)
        dueDate.setDate(dueDate.getDate() - 7)
        if (dueDate < today && ["DRAFT", "REJECTED"].includes(postStatus)) {
          summary.overduePosts += 1
        }
      }
    })

    // Adjust old in-progress
    summary.inProgressPosts = summary.totalPosts - summary.completedPosts - summary.pendingReworks
  })

  const data = Array.from(summaries.values()).map((summary) => {
    const submittedPosts = summary.submittedPosts
    if (submittedPosts > 0) {
      summary.approvalRate = Number(((summary.completedPosts / submittedPosts) * 100).toFixed(1))
      summary.avgReworksPerPost = Number((summary.rejectionCount / submittedPosts).toFixed(2))
      summary.avgApprovalAttempts = Number((summary.totalAttempts / submittedPosts).toFixed(2))

      // Updated grading: Blend with approval rate for better alignment
      const avgRej = summary.avgReworksPerPost
      const avgAtt = summary.avgApprovalAttempts
      const appRate = summary.approvalRate
      if (avgRej === 0 && avgAtt <= 1 && appRate >= 80) {
        summary.grade = "A"
      } else if (avgRej < 0.5 && avgAtt <= 1.5 && appRate >= 60) {
        summary.grade = "B"
      } else if (avgRej < 1 && avgAtt <= 2 && appRate >= 40) {
        summary.grade = "C"
      } else {
        summary.grade = "D"
      }
    } else {
      summary.approvalRate = 0
      summary.avgReworksPerPost = 0
      summary.avgApprovalAttempts = 0
      summary.grade = "N/A"
    }

    return summary
  })

  const totalPosts = data.reduce((total, summary) => total + summary.totalPosts, 0)
  const totalSubmitted = data.reduce((total, summary) => total + summary.submittedPosts, 0)
  const totalReworks = data.reduce((total, summary) => total + summary.reworkCount, 0)

  const sortedByCompletion = [...data].sort((a, b) => b.completedPosts - a.completedPosts)
  const topPerformer = sortedByCompletion[0] && sortedByCompletion[0].completedPosts > 0 ? sortedByCompletion[0] : null

  const denominator = totalSubmitted > 0 ? totalSubmitted : 1

  return NextResponse.json({
    data,
    summary: {
      totalUsers: data.length,
      totalPosts,
      avgReworksPerPost: data.length ? Number((totalReworks / denominator).toFixed(2)) : 0,
      topPerformer: topPerformer
        ? {
            id: topPerformer.id,
            name: topPerformer.name,
            completedPosts: topPerformer.completedPosts,
            approvalRate: topPerformer.approvalRate,
            roleName: topPerformer.roleName,
          }
        : null,
    },
    filters: {
      projectId: projectId || null,
      role: roleFilter || null,
      availableProjects: typedProjects,
      availableRoles,
      selectedProject: projectId ? typedProjects.find((project: BasicProject) => project.id === projectId) || null : null,
      selectedPeriod: periodLabel,
      availablePeriods,
    },
  })
}
