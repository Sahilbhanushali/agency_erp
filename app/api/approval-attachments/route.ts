// app/api/approval-attachments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { PrismaClient } from "@prisma/client";

// Create a fresh Prisma instance for this route
let prisma: PrismaClient;

// Initialize Prisma with proper error handling
function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
  }
  return prisma;
}

export async function POST(request: NextRequest) {
  console.log("[Approval Attachments API] Received POST request");

  try {
    // Get Prisma client
    const db = getPrismaClient();
    
    console.log("[Approval Attachments API] Prisma client initialized:", !!db);

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      console.warn("[Approval Attachments API] Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[Approval Attachments API] Request from user: ${session.user.id}`);

    // Parse form data
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const postId = formData.get("postId") as string | null;
    const flowType = formData.get("flowType") as string | null;

    // Validate required fields
    if (!audioFile || !postId || !flowType) {
      console.warn("[Approval Attachments API] Missing required fields", {
        hasAudio: !!audioFile,
        hasPostId: !!postId,
        hasFlowType: !!flowType,
      });
      return NextResponse.json(
        { error: "Missing required fields: audio, postId, and flowType are required" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!audioFile.type || !audioFile.type.startsWith("audio/")) {
      console.warn(`[Approval Attachments API] Invalid file type: ${audioFile.type}`);
      return NextResponse.json(
        { error: "Only audio files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (audioFile.size > maxSize) {
      console.warn(`[Approval Attachments API] File too large: ${audioFile.size} bytes`);
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    console.log(`[Approval Attachments API] Processing audio file: ${audioFile.name}, size: ${audioFile.size} bytes`);

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "audio");
    if (!existsSync(uploadsDir)) {
      console.log(`[Approval Attachments API] Creating uploads directory: ${uploadsDir}`);
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = audioFile.name.split(".").pop() || "webm";
    const filename = `rejection-${postId}-${timestamp}.${extension}`;
    const filepath = path.join(uploadsDir, filename);

    // Save file
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);
    console.log(`[Approval Attachments API] File saved: ${filepath}`);

    // Get or create approval flow
    const flowTypeUpper = flowType.toUpperCase();
    console.log(`[Approval Attachments API] Looking for approval flow: postId=${postId}, flowType=${flowTypeUpper}`);

    let approvalFlow = await db.approvalFlow.findFirst({
      where: {
        postId,
        flowType: flowTypeUpper,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!approvalFlow) {
      console.log("[Approval Attachments API] Creating new approval flow");
      approvalFlow = await db.approvalFlow.create({
        data: {
          postId,
          flowType: flowTypeUpper,
          status: "PENDING",
          submittedById: parseInt(session.user.id, 10),
          submittedAt: new Date(),
          version: 1,
          submissionCount: 0,
        },
      });
      console.log(`[Approval Attachments API] Created approval flow: ${approvalFlow.id}`);
    } else {
      console.log(`[Approval Attachments API] Using existing approval flow: ${approvalFlow.id}`);
    }

    // Create approval attachment
    const attachment = await db.approvalAttachment.create({
      data: {
        type: "AUDIO",
        url: `/api/uploads/audio/${filename}`,
        filename: audioFile.name,
        size: audioFile.size,
        mimeType: audioFile.type,
        approvalFlowId: approvalFlow.id,
        uploadedById: parseInt(session.user.id, 10),
      },
    });
    console.log(`[Approval Attachments API] Created attachment: ${attachment.id}`);

    // Create user activity log
    await db.userActivity.create({
      data: {
        activityType: "COMMENT_ADDED",
        entityType: "Post",
        entityId: postId,
        description: `Audio feedback uploaded for ${flowType} rejection`,
        metadata: {
          attachmentId: attachment.id,
          filename: audioFile.name,
          size: audioFile.size,
          flowType,
        },
        userId: parseInt(session.user.id, 10),
      },
    });

    console.log("[Approval Attachments API] Successfully processed audio attachment");

    return NextResponse.json({
      success: true,
      attachmentId: attachment.id,
      url: attachment.url,
      filename: attachment.filename,
      message: "Audio attachment uploaded successfully",
    });
  } catch (error: any) {
    console.error("[Approval Attachments API] Error:", error);
    console.error("[Approval Attachments API] Stack trace:", error.stack);
    
    return NextResponse.json(
      { 
        error: "Failed to upload audio attachment",
        details: process.env.NODE_ENV === "development" ? error.message : undefined
      },
      { status: 500 }
    );
  }
}