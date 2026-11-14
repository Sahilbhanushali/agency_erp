import { Metadata } from "next"
import { cookies } from "next/headers"
import { CustomerConfirmationView } from "@/components/confirm/customer-confirmation-view"
import { CustomerPasswordScreen } from "@/components/confirm/customer-password-screen"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Clock, ShieldX } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { projectCompanyName, projectLogo } from "@/lib/client-company"
import { PostStatus, ContentStatus } from "@prisma/client"
import {
  verifyCustomerSessionToken,
  getCustomerSessionCookieName,
} from "@/lib/export-link"

interface PageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  try {
    const exportLink = await prisma.exportLink.findUnique({
      where: { token },
      include: { project: true },
    })
    if (exportLink) {
      return {
        title: `Content Review - ${exportLink.project?.name || "Review"}`,
        description: "Customer review and approval portal for planned social media content.",
      }
    }
  } catch {}
  return {
    title: "Content Review",
    description: "Customer review and approval portal",
  }
}

export default async function CustomerSharePage({ params }: PageProps) {
  const { token } = await params

  if (!token) {
    return <ErrorScreen title="Invalid Link" message="This share link is invalid." />
  }

  try {
    const exportLink = await prisma.exportLink.findUnique({
      where: { token },
      include: {
        project: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                company: true,
                avatar: true,
              },
            },
            clientCompany: { select: { name: true, logo: true } },
          },
        },
      },
    })

    if (!exportLink) {
      return (
        <ErrorScreen
          icon={<ShieldX className="w-10 h-10 text-red-500" />}
          title="Share Link Not Found"
          message="This share link is no longer available or was deleted. Please contact your account manager for an updated link."
        />
      )
    }

    if (exportLink.status === "REVOKED" || exportLink.revokedAt) {
      return (
        <ErrorScreen
          icon={<ShieldX className="w-10 h-10 text-amber-500" />}
          title="Link Revoked"
          message="This share link has been revoked by your social media team. Please ask for an updated share link."
        />
      )
    }

    const now = new Date()
    if (exportLink.expiresAt && exportLink.expiresAt < now) {
      return (
        <ErrorScreen
          icon={<Clock className="w-10 h-10 text-amber-500" />}
          title="Share Link Expired"
          message="This share link has expired. Please reach out to your account manager to generate a fresh link."
        />
      )
    }

    // ===============================================
    // PASSWORD PROTECTION & SESSION VERIFICATION
    // ===============================================
    if (exportLink.passwordHash) {
      const cookieStore = await cookies()
      const cookieName = getCustomerSessionCookieName(token)
      const sessionCookie = cookieStore.get(cookieName)?.value

      const isAuthenticated = verifyCustomerSessionToken(
        sessionCookie,
        token,
        exportLink.id,
        exportLink.passwordUpdatedAt,
        exportLink.passwordExpiresAt
      )

      if (!isAuthenticated) {
        const isLocked = !!(exportLink.lockedUntil && exportLink.lockedUntil > now)
        const isPasswordExpired = !!(exportLink.passwordExpiresAt && exportLink.passwordExpiresAt < now)
        const lockRemainingMinutes = isLocked
          ? Math.ceil((exportLink.lockedUntil!.getTime() - now.getTime()) / (60 * 1000))
          : 0

        return (
          <CustomerPasswordScreen
            token={token}
            projectName={exportLink.project?.name || "Content Review"}
            clientName={exportLink.project?.client?.name || projectCompanyName(exportLink.project) || undefined}
            month={exportLink.month}
            year={exportLink.year}
            isLocked={isLocked}
            isPasswordExpired={isPasswordExpired}
            lockRemainingMinutes={lockRemainingMinutes}
          />
        )
      }
    }

    // ===============================================
    // AUTHENTICATED: FETCH & RENDER POSTS LOOKBOOK
    // CRITICAL VISIBILITY RULE:
    // Only show posts where INTERNAL "I Approve" has been completed.
    // Content status must be APPROVED or C_APPROVED.
    // Must NOT be in internal pending review or draft stage.
    // ===============================================
    const postWhereClause: any = {
      projectId: exportLink.projectId,
      OR: [
        { contentStatus: ContentStatus.APPROVED },
        { status: PostStatus.C_APPROVED },
      ],
    }

    const postIds = exportLink.postIds as string[] | null
    if (Array.isArray(postIds) && postIds.length > 0) {
      postWhereClause.id = { in: postIds }
    } else if (exportLink.month && exportLink.year) {
      const startOfMonth = new Date(Date.UTC(exportLink.year, exportLink.month - 1, 1))
      const endOfMonth = new Date(Date.UTC(exportLink.year, exportLink.month, 0, 23, 59, 59, 999))
      postWhereClause.AND = [
        {
          OR: [
            { scheduledAt: { gte: startOfMonth, lte: endOfMonth } },
            { scheduledAt: null, createdAt: { gte: startOfMonth, lte: endOfMonth } },
          ],
        },
      ]
    }

    const posts = await prisma.post.findMany({
      where: postWhereClause,
      select: {
        id: true,
        title: true,
        caption: true,
        writeUp: true,
        type: true,
        status: true,
        requiresClientApproval: true,
        contentStatus: true,
        scheduledAt: true,
        scheduledFor: true,
        notes: true,
        createdAt: true,
        approvedAt: true,
        rejectedAt: true,
        assets: {
          select: {
            id: true,
            filename: true,
            url: true,
            type: true,
            size: true,
            order: true,
            isReference: true,
            isEdited: true,
          },
          orderBy: { order: "asc" },
        },
        platforms: {
          select: {
            platform: true,
          },
        },
        comments: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            authorName: true,
            authorRole: true,
            type: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [
        { scheduledAt: "asc" },
        { createdAt: "asc" },
      ],
    })

    const data = {
      project: {
        name: exportLink.project?.name || "Content Review",
        description: exportLink.project?.description || null,
        clientName: exportLink.project?.client?.name || projectCompanyName(exportLink.project) || "Valued Client",
        clientCompany: projectCompanyName(exportLink.project) || null,
        clientAvatar: projectLogo(exportLink.project) || null,
      },
      link: {
        status: exportLink.status,
        confirmedAt: exportLink.confirmedAt?.toISOString() || null,
        confirmedByName: exportLink.confirmedByName,
        expiresAt: exportLink.expiresAt?.toISOString() || null,
        month: exportLink.month,
        year: exportLink.year,
        feedback: exportLink.feedback,
      },
      posts: posts.map((p: any) => ({
        id: p.id,
        title: p.title,
        caption: p.caption,
        writeUp: p.writeUp,
        type: p.type,
        status: p.status,
        requiresClientApproval: p.requiresClientApproval,
        contentStatus: p.contentStatus,
        scheduledAt: p.scheduledAt?.toISOString() || p.scheduledFor?.toISOString() || p.createdAt.toISOString(),
        notes: p.notes,
        approvedAt: p.approvedAt?.toISOString() || null,
        rejectedAt: p.rejectedAt?.toISOString() || null,
        assets: p.assets.map((a: any) => ({
          id: a.id,
          filename: a.filename,
          url: a.url,
          type: a.type,
          size: a.size,
          isReference: a.isReference,
          isEdited: a.isEdited,
        })),
        platforms: p.platforms.map((pl: any) => pl.platform),
        comments: p.comments.map((c: any) => ({
          id: c.id,
          content: c.content,
          createdAt: c.createdAt.toISOString(),
          authorName: c.authorName || c.user?.name || "Team Member",
          authorRole: c.authorRole || "Internal",
          type: c.type,
        })),
      })),
    }

    return <CustomerConfirmationView initialData={data} token={token} />
  } catch (error) {
    console.error("Error loading share page:", error)
    return (
      <ErrorScreen
        icon={<AlertCircle className="w-10 h-10 text-red-500" />}
        title="Unable to Load Content"
        message="A temporary error occurred while retrieving this content. Please refresh or contact your account manager."
      />
    )
  }
}

function ErrorScreen({
  icon,
  title,
  message,
}: {
  icon?: React.ReactNode
  title: string
  message: string
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg border-slate-200">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex items-center justify-center mb-3">
            {icon || <ShieldX className="w-10 h-10 text-slate-400" />}
          </div>
          <CardTitle className="text-lg font-bold text-slate-900">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center pt-2">
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </CardContent>
      </Card>
    </div>
  )
}
