import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requirePermission } from "@/lib/api-auth";

const prisma = new PrismaClient()

// GET /api/user/role?id=1
export async function GET(request: Request) {
  const auth = await requirePermission("Manage-User");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("id")

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: { 
        role: {
          select: { name: true }
        }
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ 
      role: user.role?.name || "CLIENT" 
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching user role:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  } finally {
    // await prisma.$disconnect()
  }
}

// PATCH /api/user/role (for updating user roles - body should contain userId and role)
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("Manage-User");
  if (!auth.ok) return auth.response;

  const params = await context.params;
    try {
      const { role } = await request.json();
      if (!role) {
        return NextResponse.json({ error: 'Role is required' }, { status: 400 });
      }
  
      const parsedUserId = parseInt(params.id);
      if (isNaN(parsedUserId)) {
        return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
      }
  
      const roleRecord = await prisma.role.findFirst({
        where: { name: role },
      });
  
      if (!roleRecord) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
  
      const user = await prisma.user.update({
        where: { id: parsedUserId },
        data: {
          roleId: roleRecord.id,
          updatedAt: new Date(),
        },
        include: {
          role: {
            select: { name: true },
          },
        },
      });
  
      return NextResponse.json(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role?.name || "CLIENT",
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error('Error updating user role:', error);
      if (error.code === 'P2020') {
        return NextResponse.json(
          { error: 'Invalid data in database: please contact support' },
          { status: 500 }
        );
      }
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
    }
  }