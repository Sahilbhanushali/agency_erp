import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import nodemailer from "nodemailer"
import fs from "fs/promises"
import path from "path"
import CryptoJS from "crypto-js"
import { requireCan } from "@/lib/api-auth";

// Load the comment email template
const commentEmailTemplatePath = path.join(
  process.cwd(),
  "public/templates",
  "comment-email-template.html"
)
let commentEmailTemplate: string | null = null

const fallbackCommentEmailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Comment on Post</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333;">
  <h1 style="color: #111827;">New Comment on Post</h1>
  <p>Dear {{ recipientName }},</p>
  <p>A new comment has been added to the post <strong>{{ postTitle }}</strong> in the project <strong>{{ projectName }}</strong>.</p>
  <p><strong>Comment by:</strong> {{ commenterName }}</p>
  <p><strong>Comment:</strong> {{ commentContent }}</p>
  <p><strong>Commented At:</strong> {{ commentedAt }}</p>
  <p><a href="{{ dashboardUrl }}" style="color: #111827;">View Post in Dashboard</a></p>
  <p>&copy; {{ currentYear }} Automation.rndtechnosoft.com. All rights reserved.</p>
</body>
</html>
`

async function loadCommentEmailTemplate() {
  try {
    commentEmailTemplate = await fs.readFile(commentEmailTemplatePath, "utf-8")
    console.log("[Comment API] Comment email template loaded successfully")
  } catch (error) {
    console.error("[Comment API] Error loading comment email template:", error)
    commentEmailTemplate = fallbackCommentEmailTemplate
    console.log("[Comment API] Using fallback comment email template")
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const auth = await requireCan("posts", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const { content } = await request.json()
    const postId = params.id

    // Verify post exists and user has access
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        project: { include: { client: true } },
        assignedTo: { select: { email: true, name: true, id: true } },
      },
    })

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Check if user can comment on this post
    // const canComment =
    //   session.user.role === "ADMIN" ||
    //   session.user.role === "Manager" ||
    //   session.user.role === "Team Lead" ||
    //   session.user.role === "Designer" ||
    //   session.user.role === "Content Writer" ||
    //   session.user.role === "Social Media Manager" ||
    //   post.createdById === session.user.id ||
    //   (session.user.role === "CLIENT" && post.project.client.email === session.user.email)

    // if (!canComment) {
    //   return NextResponse.json({ error: "Cannot comment on this post" }, { status: 403 })
    // }

    const comment = await prisma.comment.create({
      data: {
        content,
        postId,
        userId: Number(session.user.id),
      },
      include: {
        user: true,
      },
    })

    // Create notification for post creator (if not commenting on own post)
    if (post.createdById !== Number(session.user.id)) {
      await prisma.notification.create({
        data: {
          title: "New comment on your post",
          message: `${session.user.name} commented on "${post.title}".`,
          userId: post.createdById,
          link: `/dashboard/projects/posts/${post.id}`,
        },
      })
    }

    // Create notification for assigned user (if they are not the commenter and not the creator)
    if (
      post.assignedToId && 
      post.assignedToId !== Number(session.user.id) && 
      post.assignedToId !== post.createdById
    ) {
      await prisma.notification.create({
        data: {
          title: "New comment on assigned post",
          message: `${session.user.name} commented on "${post.title}" which is assigned to you.`,
          userId: post.assignedToId,
          link: `/dashboard/projects/posts/${post.id}`,
        },
      })
    }

    // Send email notification for comment
    try {
      if (!commentEmailTemplate) {
        await loadCommentEmailTemplate()
      }

      let smtpDetails = await prisma.smtpDetails.findUnique({
        where: { userId: Number(session.user.id) },
        select: {
          host: true,
          port: true,
          username: true,
          password: true,
          encryption: true,
          isVerified: true,
        },
      })

      // Fallback to any verified SMTP account (like Admin's) if current user hasn't set one up
      if (!smtpDetails || !smtpDetails.isVerified) {
        smtpDetails = await prisma.smtpDetails.findFirst({
          where: { isVerified: true },
          select: {
            host: true,
            port: true,
            username: true,
            password: true,
            encryption: true,
            isVerified: true,
          },
        });
      }

      const encryptionKey = process.env.SMTP_PASSWORD_ENCRYPTION_KEY
      if (!encryptionKey) {
        console.error("[Comment API] SMTP password encryption key not found")
      } else if (!smtpDetails || !smtpDetails.isVerified) {
        console.error(
          `[Comment API] No verified SMTP configuration found to send comment emails.`
        )
      } else {
        let decryptedPassword = "";
        try {
          const bytes = CryptoJS.AES.decrypt(smtpDetails.password, encryptionKey)
          decryptedPassword = bytes.toString(CryptoJS.enc.Utf8)
          if (!decryptedPassword) {
            throw new Error("Decryption failed: Invalid key or corrupted data")
          }
        } catch (decryptError: any) {
          console.error("[Comment API] Failed to decrypt SMTP password:", decryptError.message)
        }

        const transporter = nodemailer.createTransport({
          host: smtpDetails.host,
          port: smtpDetails.port,
          secure: smtpDetails.port === 465,
          auth: {
            user: smtpDetails.username,
            pass: decryptedPassword,
          },
          tls: {
            minVersion: "TLSv1.2",
            rejectUnauthorized: true,
          },
        })

        await transporter.verify()

        // Fetch users to notify (only Admin, Manager, and Social Media Manager roles)
        const rolesToNotify = ["Social Media Manager"]
        const usersToNotify = await prisma.user.findMany({
          where: {
            role: {
              name: { in: rolesToNotify },
            },
          },
          select: { id: true, email: true, name: true },
        })

        // Include post creator if not the commenter
        if (
          post.createdById !== Number(session.user.id) &&
          !usersToNotify.some((user: any) => user.id === post.createdById)
        ) {
          const creator = await prisma.user.findUnique({
            where: { id: post.createdById },
            select: { id: true, email: true, name: true },
          })
          if (creator) usersToNotify.push(creator)
        }

        // Include assigned designer if not the commenter and explicitly assigned to the post
        if (
          post.assignedToId &&
          post.assignedToId !== Number(session.user.id) &&
          !usersToNotify.some((user: any) => user.id === post.assignedToId)
        ) {
          const designer = await prisma.user.findUnique({
            where: { id: post.assignedToId },
            select: { id: true, email: true, name: true },
          })
          if (designer) usersToNotify.push(designer)
        }

        // Include project manager if not already included
        if (
          post.project.managerId &&
          !usersToNotify.some((user: any) => user.id === post.project.managerId)
        ) {
          const manager = await prisma.user.findUnique({
            where: { id: post.project.managerId },
            select: { id: true, email: true, name: true },
          })
          if (manager) usersToNotify.push(manager)
        }

        const notifiedUsersList: string[] = []
        // Send email to each user
        for (const user of usersToNotify) {
          let emailHtml = commentEmailTemplate!
          emailHtml = emailHtml.replace("{{ recipientName }}", user.name || "User")
          emailHtml = emailHtml.replace("{{ postTitle }}", post.title)
          emailHtml = emailHtml.replace("{{ projectName }}", post.project.name)
          emailHtml = emailHtml.replace("{{ commenterName }}", session.user.name || "Anonymous")
          emailHtml = emailHtml.replace("{{ commentContent }}", content)
          emailHtml = emailHtml.replace(
            "{{ commentedAt }}",
            new Date().toLocaleString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "numeric",
              hour12: true,
            })
          )
          emailHtml = emailHtml.replace(
            "{{ dashboardUrl }}",
            `${process.env.NEXT_PUBLIC_BASE_URL || "https://automation.rndtechnosoft.com"}/dashboard/projects/posts/${postId}`
          )
          emailHtml = emailHtml.replace(
            "{{ currentYear }}",
            new Date().getFullYear().toString()
          )

          await transporter.sendMail({
            from: `<${smtpDetails.username}>`,
            to: user.email,
            subject: `New Comment on Post: ${post.title}`,
            html: emailHtml,
          })

          notifiedUsersList.push(user.name || user.email)
          console.log(
            `[Comment API] Comment email sent successfully to ${user.email}`
          )
        }
        return NextResponse.json({ ...comment, notifiedUsersList })
      }
    } catch (emailError: any) {
      console.error("[Comment API] Error sending comment email:", emailError)
    }

    return NextResponse.json(comment)
  } catch (error) {
    console.error("Error creating comment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const auth = await requireCan("posts", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const comments = await prisma.comment.findMany({
      where: { postId: params.id },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
