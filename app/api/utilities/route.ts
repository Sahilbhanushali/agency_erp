import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requirePermission } from "@/lib/api-auth";

const prisma = new PrismaClient()

export async function GET() {
  const auth = await requirePermission("View-utilities");
  if (!auth.ok) return auth.response;

  try {
    const utilities = await prisma.utility.findMany()
    return NextResponse.json(utilities, { status: 200 })
  } catch (error) {
    console.error('Error fetching utilities:', error)
    return NextResponse.json({ error: 'Failed to fetch utilities' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission("Manage-settings");
  if (!auth.ok) return auth.response;

  try {
    const { name, type, values } = await request.json()
    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
    }
    const utility = await prisma.utility.create({
      data: {
        name,
        type,
        values,
      },
    })
    return NextResponse.json(utility, { status: 200 })
  } catch (error) {
    console.error('Error creating utility:', error)
    return NextResponse.json({ error: 'Failed to create utility' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const auth = await requirePermission("Manage-settings");
  if (!auth.ok) return auth.response;

  try {
    const { id, name, type, values } = await request.json()
    if (!id || !name || !type) {
      return NextResponse.json({ error: 'ID, name, and type are required' }, { status: 400 })
    }
    const utility = await prisma.utility.update({
      where: { id },
      data: { name, type, values },
    })
    return NextResponse.json(utility, { status: 200 })
  } catch (error) {
    console.error('Error updating utility:', error)
    return NextResponse.json({ error: 'Failed to update utility' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePermission("Manage-settings");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }
    await prisma.utility.delete({ where: { id } })
    return NextResponse.json({ message: 'Utility deleted' }, { status: 200 })
  } catch (error) {
    console.error('Error deleting utility:', error)
    return NextResponse.json({ error: 'Failed to delete utility' }, { status: 500 })
  }
}