// app/api/roles/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, requireSession } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const roles = await prisma.role.findMany({
      select: { id: true, name: true },
    });
    return NextResponse.json(roles);
  } catch (error: any) {
    console.error('Error fetching roles:', error);
    if (error.code === 'P2020') {
      return NextResponse.json(
        { error: 'Invalid data in roles table: please contact support' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission("Manage-settings");
  if (!auth.ok) return auth.response;

  try {
    const { name, description } = await request.json();

    // Validate input
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }

    // Check for duplicate role
    const existingRole = await prisma.role.findUnique({ where: { name } });
    if (existingRole) {
      return NextResponse.json({ error: 'Role already exists' }, { status: 409 });
    }

    // Create role with explicit createdAt/updatedAt to avoid zero-date issues
    const role = await prisma.role.create({
      data: {
        name,
        description: description || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: { id: true, name: true },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error: any) {
    console.error('Error creating role:', error);
    if (error.code === 'P2020') {
      return NextResponse.json(
        { error: 'Invalid data in roles table: please contact support' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}