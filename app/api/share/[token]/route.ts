import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PostStatus, ContentStatus } from "@prisma/client"
import {
  verifyPassword,
  createCustomerSessionToken,
  verifyCustomerSessionToken,
  getCustomerSessionCookieName,
} from "@/lib/export-link"
import { promises as fs } from "fs"
import path from "path"
import { deleteLocalFile } from "@/lib/storage"

interface RouteParams {
  params: Promise<{ token: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params

    if (!token || typeof token !== "string" || token.trim() === "") {
      return NextResponse.json({ error: "Invalid confirmation token" }, { status: 400 })
    }

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
          },
        },
      },
    })

    if (!exportLink) {
      return NextResponse.json(
        { error: "Confirmation link not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    // Check revocation
    if (exportLink.status === "REVOKED" || exportLink.revokedAt) {
      return NextResponse.json(
        {
          error: "This confirmation link has been revoked.",
          code: "REVOKED",
        },
        { status: 410 }
      )
    }

    // Check expiration
    const now = new Date()
    if (exportLink.expiresAt && exportLink.expiresAt < now) {
      return NextResponse.json(
        {
          error: "This confirmation link has expired.",
          code: "EXPIRED",
        },
        { status: 410 }
      )
    }

    // 1. Password Protection Check
    if (exportLink.passwordHash) {
      const cookieName = getCustomerSessionCookieName(token)
      const sessionCookie = request.cookies.get(cookieName)?.value

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

        // Return minimal public project info for the password prompt; DO NOT return posts or content!
        return NextResponse.json({
          authenticated: false,
          requiresPassword: true,
          isPasswordExpired,
          passwordExpiresAt: exportLink.passwordExpiresAt,
          isLocked,
          lockRemainingMinutes,
          project: {
            name: exportLink.project.name,
            clientName: exportLink.project.client?.name || exportLink.project.client?.company || "Valued Client",
          },
        })
      }
    }

    // 2. Authenticated: Fetch and return posts content
    // CRITICAL VISIBILITY RULE:
    // Customer must NOT see a post until INTERNAL "I Approve" is completed.
    // Must NOT be in internal pending review or draft stage.
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
            {
              scheduledAt: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
            {
              scheduledAt: null,
              createdAt: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
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

    const sanitizedProject = {
      name: exportLink.project.name,
      description: exportLink.project.description,
      clientName: exportLink.project.client?.name || exportLink.project.client?.company || "Valued Client",
      clientCompany: exportLink.project.client?.company,
      clientAvatar: exportLink.project.client?.avatar,
    }

    const sanitizedLink = {
      status: exportLink.status,
      confirmedAt: exportLink.confirmedAt,
      confirmedByName: exportLink.confirmedByName,
      expiresAt: exportLink.expiresAt,
      month: exportLink.month,
      year: exportLink.year,
      feedback: exportLink.feedback,
    }

    const sanitizedPosts = posts.map((post: any) => ({
      id: post.id,
      title: post.title,
      caption: post.caption,
      writeUp: post.writeUp,
      type: post.type,
      status: post.status,
      contentStatus: post.contentStatus,
      scheduledAt: post.scheduledAt || post.scheduledFor || post.createdAt,
      notes: post.notes,
      approvedAt: post.approvedAt,
      rejectedAt: post.rejectedAt,
      assets: post.assets.map((asset: any) => ({
        id: asset.id,
        filename: asset.filename,
        url: asset.url,
        type: asset.type,
        size: asset.size,
        isReference: asset.isReference,
        isEdited: asset.isEdited,
      })),
      platforms: post.platforms.map((p: any) => p.platform),
      comments: post.comments.map((c: any) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        authorName: c.authorName || c.user?.name || "Client Representative",
        authorRole: c.authorRole || (c.user ? "Team" : "Client"),
        type: c.type,
      })),
    }))

    return NextResponse.json({
      success: true,
      authenticated: true,
      project: sanitizedProject,
      link: sanitizedLink,
      posts: sanitizedPosts,
    })
  } catch (error: any) {
    console.error("[Customer Confirm GET] Error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params

    if (!token || typeof token !== "string" || token.trim() === "") {
      return NextResponse.json({ error: "Invalid confirmation token" }, { status: 400 })
    }

    const contentType = request.headers.get("content-type") || ""
    let action = "CONFIRM"
    let password: any = null
    let name: any = null
    let email: any = null
    let feedback: any = null
    let postId: any = null
    let content: any = null
    let approvedPostIds: any = null
    let imageData: any = null
    let originalAssetId: any = null
    let assetFilename: any = null
    let audioFile: File | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      action = (formData.get("action") as string) || "CONFIRM"
      password = formData.get("password") as string | null
      name = formData.get("name") as string | null
      email = formData.get("email") as string | null
      feedback = formData.get("feedback") as string | null
      postId = formData.get("postId") as string | null
      content = formData.get("content") as string | null
      audioFile = formData.get("audio") as File | null
    } else {
      const body = await request.json().catch(() => ({}))
      action = body.action || "CONFIRM"
      password = body.password
      name = body.name
      email = body.email
      feedback = body.feedback
      postId = body.postId
      content = body.content
      approvedPostIds = body.approvedPostIds
      imageData = body.imageData
      originalAssetId = body.originalAssetId
      assetFilename = body.filename
    }

    const exportLink = await prisma.exportLink.findUnique({
      where: { token },
      include: {
        project: {
          include: {
            client: true,
          },
        },
      },
    })

    if (!exportLink) {
      return NextResponse.json({ error: "Confirmation link not found" }, { status: 404 })
    }

    if (exportLink.status === "REVOKED" || exportLink.revokedAt) {
      return NextResponse.json({ error: "This confirmation link has been revoked." }, { status: 410 })
    }

    const now = new Date()
    if (exportLink.expiresAt && exportLink.expiresAt < now) {
      return NextResponse.json({ error: "This confirmation link has expired." }, { status: 410 })
    }

    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null
    const userAgent = request.headers.get("user-agent") || null

    // ==========================================
    // ACTION 1: CUSTOMER PASSWORD AUTHENTICATION
    // ==========================================
    if (action === "AUTHENTICATE") {
      if (!exportLink.passwordHash) {
        return NextResponse.json({ success: true, message: "No password required" })
      }

      // Check password expiration
      if (exportLink.passwordExpiresAt && exportLink.passwordExpiresAt < now) {
        return NextResponse.json(
          {
            error: "Your access password has expired. Please contact the client representative for a new password.",
            isPasswordExpired: true,
          },
          { status: 401 }
        )
      }

      // Check brute-force lockout
      if (exportLink.lockedUntil && exportLink.lockedUntil > now) {
        const remainingMinutes = Math.ceil((exportLink.lockedUntil.getTime() - now.getTime()) / (60 * 1000))
        return NextResponse.json(
          {
            error: `Too many failed attempts. Access is locked for ${remainingMinutes} more minute(s).`,
            isLocked: true,
            lockRemainingMinutes: remainingMinutes,
          },
          { status: 429 }
        )
      }

      if (!password || typeof password !== "string") {
        return NextResponse.json({ error: "Password is required" }, { status: 400 })
      }

      const isValid = await verifyPassword(password, exportLink.passwordHash)

      if (!isValid) {
        const newFailedCount = exportLink.failedAttemptCount + 1
        const willLock = newFailedCount >= 5
        const lockedUntil = willLock ? new Date(Date.now() + 15 * 60 * 1000) : null

        await prisma.exportLink.update({
          where: { id: exportLink.id },
          data: {
            failedAttemptCount: willLock ? 0 : newFailedCount,
            lockedUntil,
          },
        })

        if (willLock) {
          return NextResponse.json(
            {
              error: "Too many failed attempts. Access is locked for 15 minutes.",
              isLocked: true,
              lockRemainingMinutes: 15,
            },
            { status: 429 }
          )
        }

        const attemptsLeft = 5 - newFailedCount
        return NextResponse.json(
          {
            error: `Incorrect password. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.`,
          },
          { status: 401 }
        )
      }

      // Success: Reset failed attempts, update lastAuthenticatedAt
      await prisma.exportLink.update({
        where: { id: exportLink.id },
        data: {
          failedAttemptCount: 0,
          lockedUntil: null,
          lastAuthenticatedAt: now,
        },
      })

      // Issue customer session cookie
      const sessionToken = createCustomerSessionToken(token, exportLink.id, 24)
      const cookieName = getCustomerSessionCookieName(token)

      const response = NextResponse.json({
        success: true,
        message: "Authenticated successfully",
      })

      response.cookies.set(cookieName, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 24 * 60 * 60,
      })

      return response
    }

    // ==========================================
    // ACTIONS 2+: VERIFY CUSTOMER SESSION
    // ==========================================
    if (exportLink.passwordHash) {
      const cookieName = getCustomerSessionCookieName(token)
      const sessionCookie = request.cookies.get(cookieName)?.value

      const isAuthenticated = verifyCustomerSessionToken(
        sessionCookie,
        token,
        exportLink.id,
        exportLink.passwordUpdatedAt,
        exportLink.passwordExpiresAt
      )

      if (!isAuthenticated) {
        if (exportLink.passwordExpiresAt && exportLink.passwordExpiresAt < now) {
          return NextResponse.json(
            { error: "Your access password has expired. Please contact the team for a new password." },
            { status: 401 }
          )
        }
        return NextResponse.json(
          { error: "Authentication required to perform this action. Please enter your password." },
          { status: 401 }
        )
      }
    }

    const clientName =
      (name && String(name).trim()) ||
      exportLink.project.client?.name ||
      exportLink.project.client?.company ||
      "Client Representative"

    // ==========================================
    // ACTION 2: APPROVE INDIVIDUAL POST
    // ==========================================
    if (action === "APPROVE_POST") {
      if (!postId || typeof postId !== "string") {
        return NextResponse.json({ error: "Post ID is required" }, { status: 400 })
      }

      // Verify post belongs to this project and is eligible for customer view
      const post = await prisma.post.findFirst({
        where: {
          id: postId,
          projectId: exportLink.projectId,
          OR: [
            { contentStatus: ContentStatus.APPROVED },
            { status: PostStatus.C_APPROVED },
          ],
        },
      })

      if (!post) {
        return NextResponse.json(
          { error: "Post not found or not eligible for customer approval" },
          { status: 404 }
        )
      }

      const updatedPost = await prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.C_APPROVED,
          approvedAt: now,
        },
      })

      try {
        await prisma.auditLog.create({
          data: {
            action: "CLIENT_APPROVED_POST",
            entityType: "Post",
            entityId: postId,
            oldValues: JSON.stringify({ status: post.status, contentStatus: post.contentStatus }),
            newValues: JSON.stringify({ status: PostStatus.C_APPROVED, approvedAt: now }),
            feedback: `Post "${post.title}" approved by ${clientName}`,
            ipAddress: clientIp,
            userAgent: userAgent,
          },
        })
      } catch (auditErr) {
        console.error("Audit log error:", auditErr)
      }

      return NextResponse.json({
        success: true,
        message: `"${post.title}" approved successfully`,
        post: {
          id: updatedPost.id,
          status: updatedPost.status,
          contentStatus: updatedPost.contentStatus,
          approvedAt: updatedPost.approvedAt,
        },
      })
    }

    // ==========================================
    // ACTION 3.5: SAVE CUSTOMER-ANNOTATED IMAGE
    // Saves the edited image as an asset (isEdited: true) so it appears
    // on the internal product side linked to the rejection comment.
    // ==========================================
    if (action === "SAVE_ANNOTATED_IMAGE") {
      if (!postId || typeof postId !== "string") {
        return NextResponse.json({ error: "Post ID is required" }, { status: 400 })
      }
      if (!imageData || typeof imageData !== "string") {
        return NextResponse.json({ error: "Image data is required" }, { status: 400 })
      }
      if (!originalAssetId || typeof originalAssetId !== "string") {
        return NextResponse.json({ error: "Original asset ID is required" }, { status: 400 })
      }

      // Verify the post belongs to this project
      const post = await prisma.post.findFirst({
        where: { id: postId, projectId: exportLink.projectId },
        include: { assets: { where: { id: originalAssetId } } },
      })
      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 })
      }
      if (post.assets.length === 0) {
        return NextResponse.json({ error: "Original asset not found" }, { status: 404 })
      }

      const originalAsset = post.assets[0]

      // Delete any previous customer-annotated version for the same asset order
      const existingAnnotated = await prisma.asset.findFirst({
        where: { postId, isEdited: true, order: originalAsset.order },
      })
      if (existingAnnotated) {
        await deleteLocalFile(existingAnnotated.url);
        await prisma.asset.delete({ where: { id: existingAnnotated.id } })
      }

      // Save base64 image data to disk
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "")
      const buffer = Buffer.from(base64Data, "base64")
      const timestamp = Date.now()
      const sanitizedFilename = (assetFilename || originalAsset.filename)
        .replace(/\s+/g, "_")
        .replace(/[^\w.-]/g, "")
        .toLowerCase()
      const editedFilename = `client_annotated_${timestamp}_${sanitizedFilename}`
      const uploadDir = path.join(process.cwd(), "public", "uploads")
      await fs.mkdir(uploadDir, { recursive: true })
      const filePath = path.join(uploadDir, editedFilename)
      await fs.writeFile(filePath, buffer)
      const stats = await fs.stat(filePath)

      // Create the new annotated asset record
      const newAsset = await prisma.asset.create({
        data: {
          filename: sanitizedFilename,
          url: `/api/uploads/${editedFilename}`,
          size: stats.size,
          type: "image",
          postId,
          isEdited: true,
          isReference: false,
          order: originalAsset.order,
        },
      })

      // Audit log
      try {
        await prisma.auditLog.create({
          data: {
            action: "CLIENT_ANNOTATED_IMAGE",
            entityType: "Post",
            entityId: postId,
            newValues: JSON.stringify({ assetId: newAsset.id }),
            feedback: "Customer submitted annotated image via media editor",
            ipAddress: clientIp,
            userAgent: userAgent,
          },
        })
      } catch (auditErr) {
        console.error("Audit log error:", auditErr)
      }

      return NextResponse.json({
        success: true,
        asset: {
          id: newAsset.id,
          url: newAsset.url,
          filename: newAsset.filename,
          isEdited: true,
        },
      })
    }

    // ==========================================
    // ACTION 3: REQUEST CHANGES ON INDIVIDUAL POST
    // ==========================================
    if (action === "REQUEST_CHANGES_POST") {
      if (!postId || typeof postId !== "string") {
        return NextResponse.json({ error: "Post ID is required" }, { status: 400 })
      }
      if ((!feedback || !feedback.trim()) && !audioFile) {
        return NextResponse.json({ error: "Please enter your change request feedback or record audio" }, { status: 400 })
      }

      const post = await prisma.post.findFirst({
        where: {
          id: postId,
          projectId: exportLink.projectId,
          OR: [
            { contentStatus: ContentStatus.APPROVED },
            { status: PostStatus.C_APPROVED },
          ],
        },
      })

      if (!post) {
        return NextResponse.json(
          { error: "Post not found or not eligible for customer actions" },
          { status: 404 }
        )
      }

      let audioUrl: string | null = null
      if (audioFile) {
        const uploadDir = path.join(process.cwd(), "public", "uploads", "audio")
        await fs.mkdir(uploadDir, { recursive: true })
        const timestamp = Date.now()
        const audioFilename = `customer-comment-${postId}-${timestamp}.webm`
        const filePath = path.join(uploadDir, audioFilename)
        const buffer = Buffer.from(await audioFile.arrayBuffer())
        await fs.writeFile(filePath, buffer)
        audioUrl = `/api/uploads/audio/${audioFilename}`
      }

      const rawFeedback = (feedback || "").trim()
      let fullCommentText = rawFeedback
      if (audioUrl) {
        fullCommentText = rawFeedback
          ? `${rawFeedback}\n\n🎙️ Audio feedback: [AUDIO:${audioUrl}]`
          : `🎙️ Audio feedback: [AUDIO:${audioUrl}]`
      }

      // Update real post status to REJECTED
      const updatedPost = await prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.REJECTED,
          rejectedAt: now,
        },
      })

      // Create a real Comment associated with the post
      const comment = await prisma.comment.create({
        data: {
          postId,
          content: fullCommentText,
          authorName: clientName,
          authorRole: "Client",
          type: "CONTENT",
        },
      })

      try {
        await prisma.auditLog.create({
          data: {
            action: "CLIENT_REQUESTED_CHANGES_POST",
            entityType: "Post",
            entityId: postId,
            oldValues: JSON.stringify({ status: post.status }),
            newValues: JSON.stringify({ status: PostStatus.REJECTED, rejectedAt: now }),
            feedback: fullCommentText,
            ipAddress: clientIp,
            userAgent: userAgent,
          },
        })
      } catch (auditErr) {
        console.error("Audit log error:", auditErr)
      }

      return NextResponse.json({
        success: true,
        message: "Changes requested successfully. Your feedback has been sent to the team.",
        post: {
          id: updatedPost.id,
          status: updatedPost.status,
          rejectedAt: updatedPost.rejectedAt,
        },
        comment: {
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt,
          authorName: comment.authorName,
          authorRole: comment.authorRole,
        },
      })
    }

    // ==========================================
    // ACTION 4: ADD COMMENT TO POST
    // ==========================================
    if (action === "ADD_COMMENT") {
      if (!postId || typeof postId !== "string") {
        return NextResponse.json({ error: "Post ID is required" }, { status: 400 })
      }
      if (!content || typeof content !== "string" || !content.trim()) {
        return NextResponse.json({ error: "Comment text is required" }, { status: 400 })
      }

      const post = await prisma.post.findFirst({
        where: {
          id: postId,
          projectId: exportLink.projectId,
        },
      })

      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 })
      }

      const comment = await prisma.comment.create({
        data: {
          postId,
          content: content.trim(),
          authorName: clientName,
          authorRole: "Client",
          type: "CONTENT",
        },
      })

      return NextResponse.json({
        success: true,
        comment: {
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt,
          authorName: comment.authorName,
          authorRole: comment.authorRole,
        },
      })
    }

    // ==========================================
    // ACTION 5: BATCH CONFIRM ALL VISIBLE POSTS
    // ==========================================
    if (action === "CONFIRM") {
      const updatedLink = await prisma.exportLink.update({
        where: { id: exportLink.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: now,
          confirmedByName: clientName,
          confirmedByEmail: email ? String(email).trim() : null,
          feedback: feedback ? String(feedback).trim() : null,
        },
      })

      let targetPostWhere: any = {
        projectId: exportLink.projectId,
        OR: [
          { contentStatus: ContentStatus.APPROVED },
          { status: PostStatus.C_APPROVED },
        ],
      }

      if (Array.isArray(approvedPostIds) && approvedPostIds.length > 0) {
        targetPostWhere.id = { in: approvedPostIds }
      } else if (Array.isArray(exportLink.postIds) && exportLink.postIds.length > 0) {
        targetPostWhere.id = { in: exportLink.postIds as string[] }
      } else if (exportLink.month && exportLink.year) {
        const startOfMonth = new Date(Date.UTC(exportLink.year, exportLink.month - 1, 1))
        const endOfMonth = new Date(Date.UTC(exportLink.year, exportLink.month, 0, 23, 59, 59, 999))
        targetPostWhere.AND = [
          {
            OR: [
              { scheduledAt: { gte: startOfMonth, lte: endOfMonth } },
              { scheduledAt: null, createdAt: { gte: startOfMonth, lte: endOfMonth } },
            ],
          },
        ]
      }

      await prisma.post.updateMany({
        where: targetPostWhere,
        data: {
          status: PostStatus.C_APPROVED,
          approvedAt: now,
        },
      })

      try {
        await prisma.auditLog.create({
          data: {
            action: "CLIENT_CONFIRMED_ALL_POSTS",
            entityType: "Project",
            entityId: exportLink.projectId,
            oldValues: JSON.stringify({ linkId: exportLink.id, previousStatus: exportLink.status }),
            newValues: JSON.stringify({
              confirmedByName: updatedLink.confirmedByName,
              confirmedByEmail: updatedLink.confirmedByEmail,
              feedback: updatedLink.feedback,
              confirmedAt: now,
            }),
            feedback: feedback || "Content approved by customer via export link",
            ipAddress: clientIp,
            userAgent: userAgent,
          },
        })
      } catch (logErr) {
        console.error("Audit log error:", logErr)
      }

      return NextResponse.json({
        success: true,
        message: "All posts confirmed and approved successfully!",
        confirmedAt: now,
        confirmedByName: updatedLink.confirmedByName,
      })
    }

    // ==========================================
    // ACTION 6: REQUEST BATCH CHANGES
    // ==========================================
    if (action === "REQUEST_CHANGES") {
      const updatedLink = await prisma.exportLink.update({
        where: { id: exportLink.id },
        data: {
          status: "CHANGES_REQUESTED",
          feedback: feedback ? String(feedback).trim() : "Customer requested revisions",
          confirmedByName: clientName,
          confirmedByEmail: email ? String(email).trim() : null,
        },
      })

      try {
        await prisma.auditLog.create({
          data: {
            action: "CLIENT_REQUESTED_CHANGES",
            entityType: "Project",
            entityId: exportLink.projectId,
            newValues: JSON.stringify({
              feedback,
              requestedBy: updatedLink.confirmedByName,
            }),
            feedback: feedback || "Changes requested by customer via export link",
            ipAddress: clientIp,
            userAgent: userAgent,
          },
        })
      } catch (logErr) {
        console.error("Audit log error:", logErr)
      }

      return NextResponse.json({
        success: true,
        message: "Feedback submitted successfully. Your team will review the requested changes.",
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("[Customer Confirm POST] Error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred while processing your request." },
      { status: 500 }
    )
  }
}
