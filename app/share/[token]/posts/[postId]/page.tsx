import { Metadata } from "next"
import { cookies } from "next/headers"
import Link from "next/link"
import { CustomerPostDetailView } from "@/components/confirm/customer-post-detail-view"
import { CustomerPasswordScreen } from "@/components/confirm/customer-password-screen"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowLeft, Clock, ShieldX } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { projectCompanyName, projectLogo } from "@/lib/client-company"
import { PostStatus, ContentStatus } from "@prisma/client"
import {
  verifyCustomerSessionToken,
  getCustomerSessionCookieName,
} from "@/lib/export-link"

interface PageProps {
  params: Promise<{ token: string; postId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token, postId } = await params
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { project: true },
    })
    if (post) {
      return {
        title: `${post.title} - Content Review | ${post.project?.name || "Content Review"}`,
        description: `Review and approval for ${post.title}`,
      }
    }
  } catch {}
  return {
    title: "Post Details - Content Review",
    description: "Customer content review and approval",
  }
}

export default async function CustomerPostDetailPage({ params }: PageProps) {
  const { token, postId } = await params

  if (!token || !postId) {
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
    // POST LOOKUP & CRITICAL VISIBILITY RULE:
    // Only show posts where INTERNAL "I Approve" has been completed.
    // Content status must be APPROVED or C_APPROVED.
    // Must NOT be in internal pending review or draft stage.
    // Must belong to this project and match the export link's scope.
    // ===============================================
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        projectId: exportLink.projectId,
        OR: [
          { contentStatus: ContentStatus.APPROVED },
          { status: PostStatus.C_APPROVED },
        ],
      },
      select: {
        id: true,
        title: true,
        caption: true,
        writeUp: true,
        type: true,
        status: true,
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
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!post) {
      return (
        <ErrorScreen
          icon={<ShieldX className="w-10 h-10 text-amber-500" />}
          title="Post Not Found or Unavailable"
          message="This post is not available for customer review or is still undergoing internal preparation."
          backUrl={`/share/${token}`}
          backLabel="Back to All Posts"
        />
      )
    }

    // Check scope if restricted to specific post IDs
    const postIds = exportLink.postIds as string[] | null
    if (Array.isArray(postIds) && postIds.length > 0) {
      if (!postIds.includes(post.id)) {
        return (
          <ErrorScreen
            icon={<ShieldX className="w-10 h-10 text-amber-500" />}
            title="Post Outside Review Scope"
            message="This post is not included in the current review link."
            backUrl={`/share/${token}`}
            backLabel="Back to All Posts"
          />
        )
      }
    } else if (exportLink.month && exportLink.year) {
      // Check month context
      const postDate = post.scheduledAt || post.scheduledFor || post.createdAt
      const postMonth = postDate.getUTCMonth() + 1
      const postYear = postDate.getUTCFullYear()

      if (postMonth !== exportLink.month || postYear !== exportLink.year) {
        return (
          <ErrorScreen
            icon={<ShieldX className="w-10 h-10 text-amber-500" />}
            title="Post Outside Review Scope"
            message="This post does not belong to the month being reviewed."
            backUrl={`/share/${token}`}
            backLabel="Back to All Posts"
          />
        )
      }
    }

    // Customer-safe data payload (no internal user IDs, employee IDs, audit logs)
    const postData = {
      id: post.id,
      title: post.title,
      caption: post.caption,
      writeUp: post.writeUp,
      type: post.type,
      status: post.status,
      contentStatus: post.contentStatus,
      scheduledAt: post.scheduledAt?.toISOString() || post.scheduledFor?.toISOString() || post.createdAt.toISOString(),
      notes: post.notes,
      approvedAt: post.approvedAt?.toISOString() || null,
      rejectedAt: post.rejectedAt?.toISOString() || null,
      assets: post.assets.map((a: any) => ({
        id: a.id,
        filename: a.filename,
        url: a.url,
        type: a.type,
        size: a.size,
        isReference: a.isReference,
        isEdited: a.isEdited,
      })),
      platforms: post.platforms.map((pl: any) => pl.platform),
      comments: post.comments.map((c: any) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
        authorName: c.authorName || c.user?.name || "Creative Team",
        authorRole: c.authorRole || "Internal",
        type: c.type,
      })),
    }

    const projectData = {
      name: exportLink.project?.name || "Content Review",
      description: exportLink.project?.description || null,
      clientName: exportLink.project?.client?.name || projectCompanyName(exportLink.project) || "Valued Client",
      clientCompany: projectCompanyName(exportLink.project) || null,
      clientAvatar: projectLogo(exportLink.project) || null,
      month: exportLink.month,
      year: exportLink.year,
    }

    return (
      <CustomerPostDetailView
        post={postData}
        project={projectData}
        token={token}
      />
    )
  } catch (error) {
    console.error("Error loading customer post detail page:", error)
    return (
      <ErrorScreen
        icon={<AlertCircle className="w-10 h-10 text-red-500" />}
        title="Unable to Load Post"
        message="A temporary error occurred while retrieving this content. Please refresh or contact your account manager."
        backUrl={`/share/${token}`}
        backLabel="Back to All Posts"
      />
    )
  }
}

function ErrorScreen({
  icon,
  title,
  message,
  backUrl,
  backLabel,
}: {
  icon?: React.ReactNode
  title: string
  message: string
  backUrl?: string
  backLabel?: string
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg border-slate-200 rounded-2xl bg-white">
        <CardHeader className="text-center pb-2 pt-6">
          <div className="mx-auto flex items-center justify-center mb-3">
            {icon || <ShieldX className="w-10 h-10 text-slate-400" />}
          </div>
          <CardTitle className="text-lg font-bold text-slate-900">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center pt-2 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{message}</p>
          {backUrl && (
            <div className="pt-2">
              <Link href={backUrl}>
                <Button variant="outline" size="sm" className="rounded-xl text-xs">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  {backLabel || "Go Back"}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
