import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { deleteLocalFile } from "@/lib/storage";
import { requireCan } from "@/lib/api-auth";

export const dynamic = 'force-dynamic';


// Define schema for validating PUT request body
const updatePostSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  caption: z.string().optional(),
  type: z.enum(["PHOTO", "REEL", "STORY", "CAROUSEL", "VIDEO", "BLOG", "CUSTOM", "UNKNOWN"]).optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "SCHEDULED", "POSTED"]).optional(),
  designerHeadApproval: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "SCHEDULED", "POSTED"]).optional(),
  writeUp:z.string().optional(),
  keyword:z.string().optional(),
  notes: z.string().nullable().optional(),
  scheduledAt: z.union([
    z.string().datetime(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), // datetime-local format
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/) // date format
  ]).nullable().optional(),
  designDueDate: z.union([
    z.string().datetime(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), // datetime-local format
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/) // date format
  ]).nullable().optional(),
  approvedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  postedAt: z.string().datetime().optional(),
  projectId: z.string().optional(),
  assignedToId: z.union([
    z.number(), 
    z.string().transform((val) => {
      const parsed = parseInt(val);
      return isNaN(parsed) ? undefined : parsed;
    })
  ]).optional(),
  assignedToIds: z.array(z.number()).optional(),
  festivalId: z.union([
    z.number(), 
    z.string().transform((val) => {
      if (!val || val.trim() === '') return undefined;
      const parsed = parseInt(val);
      return isNaN(parsed) ? undefined : parsed;
    })
  ]).optional(),
  customData: z.record(z.any()).optional(),
  platforms: z.array(z.string()).optional(),
}).transform((data) => {
  // Transform scheduledAt to proper ISO format if needed
  if (data.scheduledAt && !data.scheduledAt.includes('Z') && !data.scheduledAt.includes('+')) {
    // Handle datetime-local format (YYYY-MM-DDTHH:mm)
    if (data.scheduledAt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
      data.scheduledAt = new Date(data.scheduledAt).toISOString();
    }
    // Handle date format (YYYY-MM-DD)
    if (data.scheduledAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
      data.scheduledAt = new Date(`${data.scheduledAt}T00:00:00.000Z`).toISOString();
    }
  }
  
  if (data.designDueDate && !data.designDueDate.includes('Z') && !data.designDueDate.includes('+')) {
    // Handle datetime-local format (YYYY-MM-DDTHH:mm)
    if (data.designDueDate.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
      data.designDueDate = new Date(data.designDueDate).toISOString();
    }
    // Handle date format (YYYY-MM-DD)
    if (data.designDueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      data.designDueDate = new Date(`${data.designDueDate}T00:00:00.000Z`).toISOString();
    }
  }
  
  // Clean up undefined values
  Object.keys(data).forEach(key => {
    if (data[key as keyof typeof data] === undefined) {
      delete data[key as keyof typeof data];
    }
  });
  
  return data;
});

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
      const session = await getServerSession(authOptions);
      // if (!session || !["ADMIN", "Manager", "Content Writer"].includes(session.user.role)) {
      //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      // }
  
      // Debug: Log Prisma model availability
      console.log('Prisma models:', {
        Asset: typeof prisma.asset,
        PostPlatform: typeof prisma.postPlatform,
        Comment: typeof prisma.comment,
        hasDeleteMany: {
          Asset: typeof prisma.asset?.deleteMany,
          PostPlatform: typeof prisma.postPlatform?.deleteMany,
          Comment: typeof prisma.comment?.deleteMany,
        },
      });
  
      // Await params to resolve the id
      const { id: postId } = await params;
  
      // Use transaction to ensure all operations succeed or fail together
      await prisma.$transaction(async (tx: any) => {
        // Validate post existence
        const post = await tx.post.findUnique({
          where: { id: postId },
        });
        if (!post) {
          throw new Error("Post not found");
        }
  
        // Find approval flows first to delete their children
        const approvalFlows = await tx.approvalFlow.findMany({
          where: { postId: postId },
          select: { id: true },
        });
        const approvalFlowIds = approvalFlows.map((f: any) => f.id);

        if (approvalFlowIds.length > 0) {
          await tx.approvalAttachment.deleteMany({
            where: { approvalFlowId: { in: approvalFlowIds } },
          });
          await tx.approvalHistory.deleteMany({
            where: { approvalFlowId: { in: approvalFlowIds } },
          });
          await tx.approvalFlow.deleteMany({
            where: { postId: postId },
          });
        }

        // Delete other relations without children
        await tx.taskLog.deleteMany({
          where: { postId: postId },
        });

        await tx.postAssignment.deleteMany({
          where: { postId: postId },
        });

        // Delete existing relations and physically clean up files from disk
        const assetsToDelete = await tx.asset.findMany({
          where: { postId: postId },
          select: { url: true },
        });
        for (const a of assetsToDelete) {
          await deleteLocalFile(a.url);
        }

        await tx.asset.deleteMany({
          where: { postId: postId },
        });
  
        await tx.postPlatform.deleteMany({
          where: { postId: postId },
        });
  
        await tx.comment.deleteMany({
          where: { postId: postId },
        });
  
        // Delete the post
        await tx.post.delete({
          where: { id: postId },
        });
      });
  
      return NextResponse.json({ message: "Post deleted successfully" }, { status: 200 });
    } catch (error: any) {
      console.error("Error deleting post:", {
        message: error.message,
        stack: error.stack,
        details: error,
      });
  
      // Handle custom error from transaction
      if (error.message === "Post not found") {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
  
      // Handle Prisma-specific errors
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
  
      return NextResponse.json(
        {
          error: "Internal server error",
          details: process.env.NODE_ENV === "development" ? error.message : undefined,
        },
        { status: 500 }
      );
    }
  }
  

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    // if (!session || !["ADMIN", "Manager", "Content Writer"].includes(session.user.role)) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const { id: postId } = await params;

    let body: any = {};
    const assets: { filename: string; generatedName: string; type: string; size: number }[] = [];
    let removedAssets: string[] = [];
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();

      for (const [key, value] of formData.entries()) {
        console.log(`Processing form data key: ${key}, value: ${value}`); // Debug form data
        if (key === "assets" && value instanceof File) {
          const file = value;
          const maxSize = 500 * 1024 * 1024; // 100MB
          const allowedTypes = ["image/", "video/", "application/pdf"];

          if (file.size > maxSize) {
            return NextResponse.json(
              { error: `File ${file.name} is too large. Maximum size is 100MB.` },
              { status: 400 }
            );
          }

          if (!allowedTypes.some((type) => file.type.startsWith(type))) {
            return NextResponse.json(
              { error: `File ${file.name} has invalid type. Only images, videos, and PDFs are allowed.` },
              { status: 400 }
            );
          }

          const originalName = file.name;
          const sanitizedBaseName = originalName
            .replace(/\s+/g, "_")
            .replace(/[^\w.-]/g, "")
            .toLowerCase();
          const generatedName = `${Date.now()}-${sanitizedBaseName}`;
          const uploadDir = path.join(process.cwd(), "public", "uploads");
          await fs.mkdir(uploadDir, { recursive: true });
          const filePath = path.join(uploadDir, generatedName);

          const fileBuffer = Buffer.from(await file.arrayBuffer());
          await fs.writeFile(filePath, fileBuffer);

          assets.push({
            filename: originalName,
            generatedName,
            type: file.type,
            size: file.size,
          });
        } else if (key === "removedAssets") {
          try {
            removedAssets = JSON.parse(value.toString());
          } catch (e) {
            console.error("Error parsing removedAssets:", e);
            removedAssets = [];
          }
        } else if (key === "linkUrl") {
          const linkUrl = value.toString();
          if (linkUrl.trim() !== '') {
            try {
              const urlObj = new URL(linkUrl);
              assets.push({
                filename: urlObj.hostname,
                generatedName: linkUrl,
                type: "link",
                size: 0,
              });
            } catch (e) {
              console.error("Invalid link URL:", linkUrl);
            }
          }
        } else {
          const stringValue = value.toString();

          if (key === 'platforms') {
            try {
              body[key] = JSON.parse(stringValue);
            } catch {
              body[key] = stringValue
                .split(',')
                .map((p) => p.trim())
                .filter((p) => p);
            }
          } else if (key === 'assignedToIds') {
            try {
              const parsedIds = JSON.parse(stringValue);
              if (Array.isArray(parsedIds)) {
                body[key] = parsedIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
              }
            } catch {
              body[key] = [];
            }
          } else if (key === 'assignedToId' || key === 'festivalId') {
            if (stringValue.trim() !== '') {
              const numValue = parseInt(stringValue, 10);
              if (!isNaN(numValue)) {
                body[key] = numValue;
              }
            }
          } else if (key === 'customData') {
            try {
              body[key] = JSON.parse(stringValue);
            } catch {
              body[key] = {};
            }
          } else {
            // Explicitly capture all fields, including writeUp, even if empty
            // But skip empty date fields to avoid Zod validation failures
            if ((key === 'scheduledAt' || key === 'designDueDate') && stringValue.trim() === '') {
              // Don't add empty date strings
            } else {
              body[key] = stringValue;
            }
          }
        }
      }
    } else if (contentType.includes("application/json")) {
      const rawBody = await request.text();
      if (!rawBody || rawBody.trim() === '') {
        return NextResponse.json({ error: "Request body is empty" }, { status: 400 });
      }
      body = JSON.parse(rawBody);
      removedAssets = body.removedAssets || [];
    } else {
      return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
    }

    console.log("Parsed request body:", JSON.stringify(body, null, 2));
    console.log("Removed assets:", removedAssets);
    console.log("New assets:", assets);

    const validation = updatePostSchema.safeParse(body);
    if (!validation.success) {
      console.log("Validation errors:", validation.error.errors); // Debug validation
      return NextResponse.json({ error: "Invalid input", details: validation.error.errors }, { status: 400 });
    }

    const { platforms, ...postData } = validation.data;

    // Explicitly ensure writeUp is included in the update data
    const finalPostData = {
      ...postData,
      writeUp: body.writeUp !== undefined ? body.writeUp : postData.writeUp, // Prefer raw body, fallback to validated
      keyword: body.keyword !== undefined ? body.keyword : postData.keyword,
      notes: body.notes !== undefined ? body.notes : postData.notes,
    };

    console.log("Final update data:", JSON.stringify(finalPostData, null, 2)); // Debug final data

    const updatedPost = await prisma.$transaction(async (tx: any) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
        include: { assets: true },
      });

      if (!post) {
        throw new Error("Post not found");
      }

      // Handle removed assets
      if (removedAssets.length > 0) {
        const assetsToRemove = await tx.asset.findMany({
          where: {
            id: { in: removedAssets },
            postId: postId,
          },
        });

        await tx.asset.deleteMany({
          where: {
            id: { in: removedAssets },
            postId: postId,
          },
        });

        for (const asset of assetsToRemove) {
          await deleteLocalFile(asset.url);
        }
      }

      // Add new assets
      if (assets.length > 0) {
        await tx.asset.createMany({
          data: assets.map((asset) => ({
            postId,
            filename: asset.filename,
            url: asset.type === "link" ? asset.generatedName : `/api/uploads/${asset.generatedName}`,
            type: asset.type,
            size: asset.size,
            isReference: true,
            isEdited: false,
          })),
        });
      }

      // Handle platforms updates
      if (platforms) {
        await tx.postPlatform.deleteMany({
          where: { postId },
        });

        if (platforms.length > 0) {
          await tx.postPlatform.createMany({
            data: platforms.map((platform: any) => ({
              postId,
              platform,
            })),
          });
        }
      }

      // Prepare assignedUsers relation update
      const updateData: any = { ...finalPostData };
      if (updateData.assignedToIds !== undefined) {
        // If we have assignedToIds array, we use it to set relations
        const userIds = updateData.assignedToIds;
        updateData.assignedUsers = {
          set: userIds.map((id: number) => ({ id }))
        };
        // Set the primary assignedToId for legacy reasons if applicable
        if (userIds.length > 0) {
          updateData.assignedToId = userIds[0];
        } else {
          updateData.assignedToId = null;
        }
        delete updateData.assignedToIds;
      }

      // Remove fields that are NOT direct Prisma Post model columns
      const nonPrismaFields = ['customType', 'comment', 'contentStatus'];
      nonPrismaFields.forEach(field => {
        delete updateData[field];
      });

      // Convert foreign key fields to Prisma relation connect syntax
      if (updateData.projectId) {
        updateData.project = { connect: { id: updateData.projectId } };
        delete updateData.projectId;
      }
      if (updateData.assignedToId !== undefined) {
        if (updateData.assignedToId === null) {
          updateData.assignedTo = { disconnect: true };
        } else {
          updateData.assignedTo = { connect: { id: updateData.assignedToId } };
        }
        delete updateData.assignedToId;
      }
      if (updateData.festivalId !== undefined) {
        if (updateData.festivalId === null) {
          updateData.festival = { disconnect: true };
        } else {
          updateData.festival = { connect: { id: updateData.festivalId } };
        }
        delete updateData.festivalId;
      }

      // Remove any undefined or empty string values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || updateData[key] === '') {
          delete updateData[key];
        }
      });

      console.log("Final Prisma updateData:", JSON.stringify(updateData, null, 2));

      // Update post in the database
      return await tx.post.update({
        where: { id: postId },
        data: updateData,
        include: {
          project: {
            include: {
              client: true,
            },
          },
          createdBy: true,
          assignedTo: true,
          assets: true,
          platforms: true,
        },
      });
    });

    return NextResponse.json(updatedPost, { status: 200 });
  } catch (error: any) {
    console.error("Error updating post:", {
      message: error.message,
      stack: error.stack,
      details: error,
    });

    if (error.message === "Post not found") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (error.code === "P2025") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (error.code === "P2024") {
      return NextResponse.json({
        error: "Database connection timeout",
        details: "Please try again in a moment",
      }, { status: 503 });
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
  
  export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
    const auth = await requireCan("posts", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session;
      // Fetch user with permissions
      const user = await prisma.user.findUnique({
        where: { id: parseInt(session.user.id) },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      });
  
      const permissions = user?.role?.permissions.map((rp: any) => rp.permission.name) || [];
  
      const { id: postId } = await params;
  
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          project: { include: { client: true } },
          createdBy: true,
          assignedTo: true,
          assets: true,
          comments: {
            include: { user: true },
            orderBy: { createdAt: "desc" },
          },
          platforms: true,
          taskLogs: true,
                 approvalFlows: {
          include: {
            attachments: true, // Include ApprovalAttachment
            history: true,     // Include ApprovalHistory
            submittedBy: true,
            reviewedBy: true,
            assignedTo: true,
          },
        },
        },
      });
  
      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
  
      // Permission check: has "View-post" OR is owner OR is client linked to the project
      const canView =
        permissions.includes("View-posts") 
        // post.createdById === parseInt(session.user.id, 10) ||
        // (session.user.role === "CLIENT" && post.project.client.email === session.user.email);
        console.log("Can view post:", canView);
  
      if (!canView) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
  
      return NextResponse.json(post, { status: 200 });
    } catch (error: any) {
      console.error("Error fetching post:", error);
      return NextResponse.json(
        {
          error: "Internal server error",
          details: process.env.NODE_ENV === "development" ? error.message : undefined,
        },
        { status: 500 }
      );
    }
  }
  