import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireCan, requirePermission } from "@/lib/api-auth";

const prisma = new PrismaClient()

// GET /api/user/role/1
export async function GET(
  request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("users", "update");
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const userId = params.id

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

// PATCH /api/user/role/1
export async function PATCH(
  request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("users", "update");
  if (!auth.ok) return auth.response;

  const params = await context.params;
  try {
    const { role } = await request.json()
    const userId = params.id

    if (!role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }

    // First, find the role by name
    const roleRecord = await prisma.role.findFirst({
      where: { name: role }
    })

    if (!roleRecord) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: {
        roleId: roleRecord.id
      },
      include: {
        role: {
          select: { name: true }
        }
      },
    })

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role?.name || "CLIENT"
    }, { status: 200 })
  } catch (error) {
    console.error('Error updating user role:', error)
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 })
  } finally {
    // await prisma.$disconnect()
  }
}