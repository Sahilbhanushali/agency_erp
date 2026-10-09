import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { assignedToId } = await request.json()

    // Convert assignedToId to an integer or null
    const parsedAssignedToId = assignedToId ? parseInt(assignedToId, 10) : null

    // Validate that assignedToId is a valid integer if provided
    if (assignedToId && isNaN(parsedAssignedToId as number)) {
      return NextResponse.json({ error: "Invalid assignedToId: must be a number or null" }, { status: 400 })
    }

    const post = await prisma.post.update({
      where: { id: params.id },
      data: { assignedToId: parsedAssignedToId },
      include: {
        project: { include: { client: true } },
        createdBy: true,
        assignedTo: true,
        assets: true,
      },
    })

    // Create notification for assigned designer
    if (parsedAssignedToId) {
      await prisma.notification.create({
        data: {
          title: "New Task Assigned",
          message: `You have been assigned to work on "${post.title}"`,
          userId: parsedAssignedToId,
          link: `/dashboard/projects/posts/${post.id}`,
        },
      })
      
      // Send email notification
      try {
        const assignedUser = await prisma.user.findUnique({
          where: { id: parsedAssignedToId },
          select: { email: true, name: true }
        });
        
        if (assignedUser && assignedUser.email) {
          const { createEmailService } = await import("@/lib/emailService");
          const emailService = createEmailService(parseInt(session.user.id, 10));
          await emailService.initialize();
          
          await emailService.sendEmail({
            to: assignedUser.email,
            subject: `New Task Assigned: ${post.title}`,
            html: `<p>Hello ${assignedUser.name},</p><p>You have been assigned a new task: <strong>${post.title}</strong> in project <strong>${post.project.name}</strong>.</p><p>Please log in to the dashboard to view details.</p>`,
            text: `Hello ${assignedUser.name},\n\nYou have been assigned a new task: ${post.title} in project ${post.project.name}.\n\nPlease log in to the dashboard to view details.`,
          });
          console.log(`Assignment email sent to ${assignedUser.email}`);
        }
      } catch (emailError) {
        console.error("Failed to send assignment email:", emailError);
      }
    }

    return NextResponse.json(post)
  } catch (error) {
    console.error("Error assigning post:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}