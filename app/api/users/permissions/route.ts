import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, requireSession } from '@/lib/api-auth';

/**
 * GET /api/users/permissions — the CALLER's own permission names.
 *
 * The `?id=` parameter is deliberately ignored: this used to accept any user id with
 * its session check commented out, which handed any user's permission set to anyone
 * who asked. Both existing callers only ever passed their own id, so scoping it to the
 * session is backward compatible.
 */
export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        role: {
          select: {
            name: true,
            permissions: { select: { permission: { select: { name: true } } } },
          },
        },
      },
    });

    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const permissions = user.role?.permissions.map((rp) => rp.permission.name) ?? [];
    return NextResponse.json({ permissions, role: user.role?.name ?? null });
  } catch (error) {
    console.error('[users/permissions] read failed:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

// PATCH /api/users/permissions?id={userId}
export async function PATCH(request: Request) {
  const auth = await requirePermission('Manage-User');
  if (!auth.ok) return auth.response;

  try {
    // Extract userId from query parameters and permissions from body
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');
    const { permissions } = await request.json();
    console.log('PATCH userId:', userId, 'permissions:', permissions);

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!Array.isArray(permissions)) {
      return NextResponse.json({ error: 'Permissions must be an array' }, { status: 400 });
    }

    // Validate that all provided permissions exist
    const permissionRecords = await prisma.permission.findMany({
      where: { name: { in: permissions } },
      select: { id: true, name: true },
    });

    if (permissionRecords.length !== permissions.length) {
      const invalidPermissions = permissions.filter(
        (p: string) => !permissionRecords.some((pr) => pr.name === p)
      );
      return NextResponse.json(
        { error: `Invalid permissions: ${invalidPermissions.join(', ')}` },
        { status: 400 }
      );
    }

    // Find or create a role with the specified permissions
    let role = await prisma.role.findFirst({
      where: {
        permissions: {
          every: {
            permission: { name: { in: permissions } },
          },
          none: {
            permission: { name: { notIn: permissions } },
          },
        },
      },
      include: { permissions: true },
    });

    if (!role) {
      // Create a new role if no exact match is found
      role = await prisma.role.create({
        data: {
          name: `CustomRole_${userId}_${Date.now()}`, // Unique name for the role
          description: 'Custom role created for user permissions',
          permissions: {
            create: permissionRecords.map((pr) => ({
              permissionId: pr.id,
              createdAt: new Date(),
            })),
          },
        },
      });
    }

    // Update the user's role
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: {
        roleId: role.id,
      },
      include: {
        role: {
          include: {
            permissions: {
              select: {
                permission: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Extract updated permissions
    const updatedPermissions = updatedUser.role?.permissions.map((rp) => rp.permission.name) || [];
    console.log('Updated permissions for user', userId, ':', updatedPermissions);

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      permissions: updatedPermissions,
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating user permissions:', error);
    return NextResponse.json({ error: 'Failed to update user permissions', details: error.message }, { status: 500 });
  } finally {
    // await prisma.$disconnect(); // Commented out for serverless compatibility
  }
}