// app/api/tasks/[taskId]/assets/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

enum PostStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SCHEDULED = "SCHEDULED",
  POSTED = "POSTED",
  RESUBMITTED = "RESUBMITTED",
}

interface Task {
  id: string;
  title: string;
  caption?: string;
  type: string;
  status: PostStatus;
  scheduledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  project?: {
    id?: string;
    name?: string;
    client?: {
      name: string;
    };
  };
  assets: Array<{
    id: string;
    filename: string;
    url: string;
    createdAt?: string;
  }>;
  platforms?: Array<{
    id: string;
    platform: string;
  }>;
  assignedToId?: number;
  assignedTo?: {
    name: string;
    email: string;
  };
  feedback?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const session = await getServerSession(authOptions) as any;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const taskId = params.id;

  try {
    // Verify the task exists and is assigned to the user
    const task = await prisma.post.findFirst({
      where: {
        id: taskId,
        assignedToId: userId,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found or not assigned to you' }, { status: 404 });
    }

    // Handle file upload
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
    }

    // Ensure the Uploads directory exists
    const uploadDir = path.join(process.cwd(), 'public/Uploads');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      console.error('Error creating uploads directory:', error);
      return NextResponse.json({ error: 'Failed to create uploads directory' }, { status: 500 });
    }

    // Generate unique filename and save to uploads directory
    const fileExtension = path.extname(file.name);
    const filename = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(uploadDir, filename);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    try {
      await writeFile(filePath, fileBuffer);
    } catch (error) {
      console.error('Error writing file:', error);
      return NextResponse.json({ error: 'Failed to save uploaded file' }, { status: 500 });
    }

    // Create asset in database
    const asset = await prisma.asset.create({
      data: {
        id: uuidv4(),
        filename,
        url: `/api/uploads/${filename}`,
        type: file.type,
        size: file.size,
        postId: taskId,
        uploadedById: userId,
        createdAt: new Date(),
      },
    });

    // Fetch updated task with all related data
    const updatedTask = await prisma.post.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { name: true } },
          },
        },
        assets: {
          select: {
            id: true,
            filename: true,
            url: true,
            createdAt: true,
          },
        },
        platforms: {
          select: {
            id: true,
            platform: true,
          },
        },
        assignedTo: {
          select: {
            name: true,
            email: true,
          },
        },
        taskLogs: {
          select: { feedback: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!updatedTask) {
      return NextResponse.json({ error: 'Failed to fetch updated task' }, { status: 500 });
    }

    // Format response to match Task interface
    const taskResponse: Task = {
      id: updatedTask.id,
      title: updatedTask.title,
      caption: updatedTask.caption ?? undefined,
      type: updatedTask.type,
      status: updatedTask.status as PostStatus,
      scheduledAt: updatedTask.scheduledAt?.toISOString() ?? undefined,
      createdAt: updatedTask.createdAt.toISOString() ?? undefined,
      updatedAt: updatedTask.updatedAt.toISOString() ?? undefined,
      project: {
        id: updatedTask.project?.id,
        name: updatedTask.project?.name,
        client: {
          name: updatedTask.project?.client?.name ?? 'No Client',
        },
      },
      assets: updatedTask.assets.map((asset: any) => ({
        id: asset.id,
        filename: asset.filename,
        url: asset.url,
        createdAt: asset.createdAt?.toISOString() ?? undefined,
      })),
      platforms: updatedTask.platforms,
      assignedToId: updatedTask.assignedToId ?? undefined,
      assignedTo: updatedTask.assignedTo ?? undefined,
      feedback: updatedTask.taskLogs[0]?.feedback ?? undefined,
      priority: updatedTask.customData?.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | undefined,
    };

    return NextResponse.json(taskResponse);
  } catch (error) {
    console.error('Error uploading asset:', error);
    return NextResponse.json({ error: 'Failed to upload asset' }, { status: 500 });
  }
}