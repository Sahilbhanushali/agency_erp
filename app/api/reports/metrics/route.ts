import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireCan } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    const auth = await requireCan("reports", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;
    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe') || 'all';

    let dateCondition: any = {};
    if (timeframe !== 'all') {
      const [year, month] = timeframe.split('-').map(Number);
      if (year && month) {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
        dateCondition = {
          OR: [
            { scheduledAt: { gte: monthStart, lte: monthEnd } },
            { scheduledAt: null, designDueDate: { gte: monthStart, lte: monthEnd } },
            { scheduledAt: null, designDueDate: null, createdAt: { gte: monthStart, lte: monthEnd } },
          ],
        };
      }
    }

    const baseWhere = {
      project: { isActive: true },
      ...dateCondition,
    };

    const [
      totalPosts,
      approvedPosts,
      rejectedPosts,
      scheduledPosts,
      totalUsers,
      totalClients,
    ] = await Promise.all([
      prisma.post.count({ where: baseWhere }),
      prisma.post.count({ where: { ...baseWhere, status: "APPROVED" } }),
      prisma.post.count({ where: { ...baseWhere, status: "REJECTED" } }),
      prisma.post.count({ where: { ...baseWhere, status: "SCHEDULED" } }),
      prisma.user.count(),
      prisma.client.count(),
    ]);

    const approvalRate = totalPosts > 0 ? ((approvedPosts / totalPosts) * 100).toFixed(1) : "0";
    const rejectionRate = totalPosts > 0 ? ((rejectedPosts / totalPosts) * 100).toFixed(1) : "0";

    return NextResponse.json({
      totalPosts,
      approvedPosts,
      rejectedPosts,
      scheduledPosts,
      totalUsers,
      totalClients,
      approvalRate,
      rejectionRate,
    });
  } catch (error: any) {
    console.error('Error fetching report metrics:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
