import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"

export const dynamic = "force-dynamic"

/** `null` clears the assignment. The id arrives as a string from the client. */
const assignSchema = z.object({
  assignedToId: z
    .union([z.coerce.number().int().positive(), z.null()])
    .optional()
    .transform((value) => value ?? null),
})

/**
 * Reassign a post's primary designer. Mutating who works on a post is a management
 * action that also emails the assignee, so it needs Manage-post — not merely a session.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("Manage-post")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const parsed = assignSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }
    const assignedToId = parsed.data.assignedToId

    const [existing, assignee] = await Promise.all([
      prisma.post.findUnique({
        where: { id },
        select: { id: true, title: true, assignedToId: true, project: { select: { name: true } } },
      }),
      // A valid-looking id from an untrusted caller is still untrusted: without this the
      // foreign key would fail and surface as a 500.
      assignedToId
        ? prisma.user.findUnique({
            where: { id: assignedToId },
            select: { id: true, name: true, email: true },
          })
        : null,
    ])

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (assignedToId && !assignee) {
      return NextResponse.json({ error: "That user does not exist" }, { status: 422 })
    }

    const post = await prisma.post.update({
      where: { id },
      data: { assignedToId },
      select: {
        id: true,
        title: true,
        assignedToId: true,
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    })

    await logAuditAction({
      userId: String(auth.userId),
      action: "ASSIGN",
      entityType: "Post",
      entityId: id,
      oldValues: JSON.stringify({ assignedToId: existing.assignedToId }),
      newValues: JSON.stringify({ assignedToId }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    if (assignee) {
      await prisma.notification.create({
        data: {
          title: "New Task Assigned",
          message: `You have been assigned to work on "${post.title}"`,
          userId: assignee.id,
          link: `/dashboard/projects/posts/${post.id}`,
        },
      })

      // Email is best-effort: a dead SMTP config must not fail the assignment.
      try {
        const { createEmailService } = await import("@/lib/emailService")
        const emailService = createEmailService(auth.userId)
        await emailService.initialize()
        await emailService.sendEmail({
          to: assignee.email,
          subject: `New Task Assigned: ${post.title}`,
          html: `<p>Hello ${assignee.name},</p><p>You have been assigned a new task: <strong>${post.title}</strong> in project <strong>${existing.project?.name ?? "—"}</strong>.</p><p>Please log in to the dashboard to view details.</p>`,
          text: `Hello ${assignee.name},\n\nYou have been assigned a new task: ${post.title} in project ${existing.project?.name ?? "—"}.\n\nPlease log in to the dashboard to view details.`,
        })
      } catch (emailError) {
        console.error("[posts/assign] notification email failed:", emailError)
      }
    }

    return NextResponse.json({ post })
  } catch (error) {
    console.error("[posts/assign] failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
