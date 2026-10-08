// app/api/role-permission/role/[roleName]/route.ts
import { NextResponse } from 'next/server';
import {prisma} from '@/lib/prisma'; // Adjust the import path to your Prisma client
import { requireSession } from "@/lib/api-auth";

export async function GET(request: Request, context: { params: Promise<{ roleName: string }> }) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const params = await context.params; // Await the params Promise
  const { roleName } = params;
  try {
    const role = await prisma.role.findUnique({
      where: { name: roleName },
      include: {
        permissions: { // Adjust to 'rolePermissions' if your schema uses that
          include: {
            permission: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const permissions = role.permissions.map((rp) => ({ permission: rp.permission.name }));
    return NextResponse.json(permissions);
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    return NextResponse.json({ error: 'Failed to fetch role permissions' }, { status: 500 });
  }
}