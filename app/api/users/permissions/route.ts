import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

const prisma = new PrismaClient();

// GET /api/users/permissions?id={userId}
export async function GET(request: Request) {
  // Validate session
  const session = await getServerSession();
  console.log('GET Session:', JSON.stringify(session, null, 2));

//   if (!session?.user?.id) {
//     console.log('Unauthorized: No session or user.id');
//     return NextResponse.json({ error: 'Unauthorized', details: 'No valid session or user ID' }, { status: 401 });
//   }

  // Extract userId from query parameters
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('id');
  console.log('userId:', userId, 'typeof userId:', typeof userId);

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    // Fetch user with their role and permissions
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
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

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Extract permission names
    const permissions = user.role?.permissions.map((rp) => rp.permission.name) || [];
    console.log('Fetched permissions for user', userId, ':', permissions);

    return NextResponse.json({ permissions }, { status: 200 });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  } finally {
    // await prisma.$disconnect(); // Commented out for serverless compatibility
  }
}

// PATCH /api/users/permissions?id={userId}
export async function PATCH(request: Request) {
  // Validate session
  const session = await getServerSession();
  console.log('PATCH Session:', JSON.stringify(session, null, 2));

  if (!session?.user?.id) {
    console.log('Unauthorized: No session or user.id');
    return NextResponse.json({ error: 'Unauthorized', details: 'No valid session or user ID' }, { status: 401 });
  }

  // Check if the requesting user has Manage-User permission
  const requestingUser = await prisma.user.findUnique({
    where: { id: parseInt(session.user.id) },
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

  if (!requestingUser || !requestingUser.role?.permissions.some((rp) => rp.permission.name === 'Manage-User')) {
    console.log('Forbidden: Manage-User permission missing for user', session.user.id);
    return NextResponse.json({ error: 'Forbidden: Manage-User permission required' }, { status: 403 });
  }

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