// app/api/role-permission/route.ts
import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma"// Adjust the import path to your Prisma client
import { requireCan } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await requireCan("roles", "update");
  if (!auth.ok) return auth.response;

  try {
    const { role, permission } = await request.json();
    if (!role || !permission) {
      return NextResponse.json({ error: 'Role and permission are required' }, { status: 400 });
    }

    const roleRecord = await prisma.role.findUnique({ where: { name: role } });
    const permissionRecord = await prisma.permission.findUnique({ where: { name: permission } });

    if (!roleRecord || !permissionRecord) {
      return NextResponse.json({ error: 'Invalid role or permission' }, { status: 404 });
    }

    const existing = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: roleRecord.id,
          permissionId: permissionRecord.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ success: true, message: 'Permission already assigned' });
    }

    await prisma.rolePermission.create({
      data: {
        roleId: roleRecord.id,
        permissionId: permissionRecord.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding permission to role:', error);
    return NextResponse.json({ error: 'Failed to add permission' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireCan("roles", "update");
  if (!auth.ok) return auth.response;

  try {
    const { role, permission } = await request.json();
    if (!role || !permission) {
      return NextResponse.json({ error: 'Role and permission are required' }, { status: 400 });
    }

    const roleRecord = await prisma.role.findUnique({ where: { name: role } });
    const permissionRecord = await prisma.permission.findUnique({ where: { name: permission } });

    if (!roleRecord || !permissionRecord) {
      return NextResponse.json({ error: 'Invalid role or permission' }, { status: 404 });
    }

    await prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId: roleRecord.id,
          permissionId: permissionRecord.id,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing permission from role:', error);
    return NextResponse.json({ error: 'Failed to remove permission' }, { status: 500 });
  }
}