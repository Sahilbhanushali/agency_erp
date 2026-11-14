
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { projectCompanyName, projectLogo } from '@/lib/client-company';
import { can, requireCan } from '@/lib/api-auth';
// Define the PostStatus enum to match the Prisma schema
enum PostStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SCHEDULED = "SCHEDULED",
  POSTED = "POSTED",
  RESUBMITTED = "RESUBMITTED",
  NEEDS_MINOR_CHANGE = "NEEDS_MINOR_CHANGE",
}

// Interface for Task to match the frontend expectation
interface Task {
  id: string;
  title: string;
  caption?: string;
  type: string;
  status: PostStatus;
  scheduledAt?: string;
  designDueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  project?: {
    id?: string;
    name?: string;
    client?: {
      name: string;
      company?: string;
      avatar?: string;
    };
  };
  assets: Array<{
    id: string;
    filename: string;
    type: string;
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
  comments: Array<{
    id: string;
    user: {
      name: string;
    };
    content: string;
    createdAt: string;
    type: string;
  }>;
  tasklogs: Array<{
    feedback: string;
  }>;
  auditLogs: any;
  approvalFlows?: Array<{
    status: string;
    attachments: Array<{
      type: string;
      url: string;
      filename: string;
      size?: number;
      duration?: number;
      mimeType?: string;
      uploadedAt: string;
    }>;
  }>;
  designRejectionCount?: number;
}

// Interface for ProjectGroup to match the frontend
interface ProjectGroup {
  projectId: string;
  projectName: string;
  clientName: string;
  companyName: string;
  tasks: Task[];
  stats: {
    total: number;
    draft: number;
    pending: number;
    approved: number;
    overdue: number;
    thisWeek: number;
    nextWeek: number;
    rejected: number; // Added rejected field
  };
}

export async function GET(request: Request) {
  const auth = await requireCan("tasks", "read");
  if (!auth.ok) return auth.response;

  const userId = auth.userId;

  // Who sees everyone's work is an RBAC question, not a role-name string match.
  // Resolved through the catalog: the literal legacy name "Manage-projects" is never
  // granted by the permission matrix, so a role given every permission still saw an empty queue.
  const seesAllWork = await can(auth.session, 'projects', 'update');

  try {
    // Build where clause based on role
    const whereClause: any = seesAllWork
      ? { project: { isActive: true } }  // Admins/Managers see all tasks for active projects
      : {
          AND: [
            { project: { isActive: true } },
            {
              OR: [
                { assignedToId: userId },
                { assignedUsers: { some: { id: userId } } }
              ]
            }
          ]
        };

    // Hard ceiling: this query pulls six nested relations per row, so an unbounded
    // findMany over every active project's posts is a timeout waiting to happen.
    // ponytail: newest-first cap rather than real paging — the screen groups by project
    // and has no pager. Add ?page= here if a client ever outgrows 500 open items.
    const LIMIT = 500;

    const posts = await prisma.post.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: {
              select: {
                name: true,
                company: true,
                avatar: true,
              },
            },
            clientCompany: { select: { name: true, logo: true } },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        assets: {
          select: {
            id: true,
            filename: true,
            type: true,
            url: true,
            createdAt: true,
            isReference: true,
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
        assignedUsers: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true,
              }
            }
          },
        },
        comments: {
          select: {
            id: true,
            user: { select: { name: true } },
            content: true,
            createdAt: true,
            type: true,
          },
        },
        approvalFlows: {
          select: {
            status: true,
            flowType: true,
            submissionCount: true,
            rejectionReason: true,
            attachments: {
              select: {
                type: true,
                url: true,
                filename: true,
                size: true,
                duration: true,
                mimeType: true,
                uploadedAt: true,
              },
            },
          },
        },
        taskLogs: {
          select: {
            feedback: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    // Only work that is actually assigned to someone belongs in a work queue.
    // This filter used to be computed and then discarded, so unassigned posts leaked
    // into the list for anyone who could see all work.
    const filteredPosts = seesAllWork
      ? posts.filter((p: any) => p.assignedToId || (p.assignedUsers && p.assignedUsers.length > 0))
      : posts;

    // Map Prisma posts to Task interface
    const tasks: Task[] = filteredPosts.map((post: any) => {
      const designRejections = (post.approvalFlows || [])
        .filter((flow: any) => flow.flowType === 'DESIGN' && flow.status === 'REJECTED')
        .length;

      return {
        id: post.id,
        title: post.title,
        caption: post.caption ?? undefined,
        type: post.type,
        status: post.status,
        contentStatus: post.contentStatus,
        scheduledAt: post.scheduledAt?.toISOString() ?? undefined,
        designDueDate: post.designDueDate?.toISOString() ?? undefined,
        createdAt: post.createdAt?.toISOString() ?? undefined,
        updatedAt: post.updatedAt?.toISOString() ?? undefined,
        createdBy: post.createdBy?.name || 'Unknown',
        project: {
          id: post.project?.id,
          name: post.project?.name,
          client: {
            name: post.project?.client?.name ?? 'No Client',
            company: projectCompanyName(post.project) ?? 'No Company',
            avatar: projectLogo(post.project) ?? 'No Avatar',
          },
        },
        assets: post.assets || [],
        customData: post.customData,
        platforms: post.platforms || [],
        assignedToId: post.assignedToId ?? undefined,
        assignedTo: post.assignedTo ?? undefined,
        assignedUsers: post.assignedUsers || [],
        feedback: post.taskLogs?.[0]?.feedback ?? undefined,
        priority: post.customData?.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | undefined,
        comments: post.comments || [],
        tasklogs: post.taskLogs || [],
        auditLogs: post.auditLogs || [],
        approvalFlows: post.approvalFlows?.map((flow: any) => ({
          status: flow.status,
          attachments: (flow.attachments || []).map((attachment: any) => ({
            type: attachment.type,
            url: attachment.url,
            filename: attachment.filename,
            size: attachment.size ?? undefined,
            duration: attachment.duration ?? undefined,
            mimeType: attachment.mimeType ?? undefined,
            uploadedAt: attachment.uploadedAt?.toISOString(),
          })),
        })) ?? undefined,
        designRejectionCount: designRejections,
      };
    });

    // Group tasks by project
    const grouped = groupTasksByProject(tasks);

    return NextResponse.json(grouped);
  } catch (error: any) {
    console.error('Error fetching tasks:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    });
    return NextResponse.json({ 
      error: 'Failed to fetch tasks',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

function groupTasksByProject(tasks: Task[]): ProjectGroup[] {
  const grouped: Record<string, Task[]> = tasks.reduce((acc: Record<string, Task[]>, task) => {
    const projectId = task.project?.id || 'unassigned';
    if (!acc[projectId]) {
      acc[projectId] = [];
    }
    acc[projectId].push(task);
    return acc;
  }, {});

  return Object.entries(grouped).map(([projectId, projectTasks]) => {
    const firstTask = projectTasks[0];
    const projectName = firstTask?.project?.name || 'Unassigned Tasks';
    const clientName = firstTask?.project?.client?.name || 'No Client';
    const companyName = firstTask?.project?.client?.company || 'No Company';

    // Calculate stats
    const stats = calculateProjectStats(projectTasks);

    return {
      projectId,
      projectName,
      clientName,
      companyName,
      tasks: projectTasks,
      stats,
    };
  }).sort((a, b) => {
    // Sort by overdue tasks first, then by total tasks
    if (a.stats.overdue !== b.stats.overdue) {
      return b.stats.overdue - a.stats.overdue;
    }
    return b.stats.total - a.stats.total;
  });
}

function calculateProjectStats(tasks: Task[]) {
  const today = new Date();

  return {
    total: tasks.length,
    draft: tasks.filter(task => task.status === PostStatus.DRAFT).length,
    pending: tasks.filter(task =>
      [PostStatus.SUBMITTED, PostStatus.RESUBMITTED].includes(task.status)
    ).length,
    approved: tasks.filter(task =>
      [PostStatus.APPROVED, PostStatus.SCHEDULED, PostStatus.POSTED].includes(task.status)
    ).length,
    approvedOnly: tasks.filter(task => task.status === PostStatus.APPROVED).length,
    postedOnly: tasks.filter(task =>
      [PostStatus.SCHEDULED, PostStatus.POSTED].includes(task.status)
    ).length,
    overdue: tasks.filter(task => {
      if (!task.designDueDate) return false;
      const designDueDate = new Date(task.designDueDate);
      return designDueDate < today && [PostStatus.DRAFT, PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE].includes(task.status);
    }).length,
    thisWeek: tasks.filter(task => {
      let designDueDate = task.designDueDate ? new Date(task.designDueDate) : null;
      if (!designDueDate && task.scheduledAt) {
        designDueDate = new Date(task.scheduledAt);
        designDueDate.setDate(designDueDate.getDate() - 7);
      }
      if (!designDueDate) return false;
      const weekFromNow = new Date();
      weekFromNow.setDate(today.getDate() + 7);
      return designDueDate >= today && designDueDate <= weekFromNow;
    }).length,
    nextWeek: tasks.filter(task => {
      let designDueDate = task.designDueDate ? new Date(task.designDueDate) : null;
      if (!designDueDate && task.scheduledAt) {
        designDueDate = new Date(task.scheduledAt);
        designDueDate.setDate(designDueDate.getDate() - 7);
      }
      if (!designDueDate) return false;
      const weekFromNow = new Date();
      weekFromNow.setDate(today.getDate() + 7);
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(today.getDate() + 14);
      return designDueDate > weekFromNow && designDueDate <= twoWeeksFromNow;
    }).length,
    rejected: tasks.filter(task =>
      [PostStatus.REJECTED, PostStatus.NEEDS_MINOR_CHANGE].includes(task.status)
    ).length,
  };
}
