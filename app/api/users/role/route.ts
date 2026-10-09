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