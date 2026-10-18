// app/api/roles/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCan, requireSession } from "@/lib/api-auth";
import { allPermissions } from "@/lib/permissions/catalog";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    // Still an array of {id, name, ...} — several pages use it as a plain dropdown
    // source. The extra fields let the role manager show what a role costs to delete
    // without a second request per role.
    const roles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { users: true, permissions: true } },
      },
      orderBy: { name: "asc" },
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
  // roles:create, not the legacy "Manage-settings": a role granted role management in
  // the permission matrix could not create a role, because that check only accepted
  // one pre-migration permission name.
  const auth = await requireCan("roles", "create");
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

    /**
     * A new role starts with the baseline permissions every signed-in person needs —
     * today that is reading the dashboard. Without them a freshly created role could
     * sign in to a sidebar with nothing in it, which read as "permissions were not
     * saved" even when the matrix had saved correctly.
     */
    const baseline = allPermissions().filter((p) => p.baseline).map((p) => p.name);
    const baselineRows = baseline.length
      ? await prisma.permission.findMany({
          where: { name: { in: baseline } },
          select: { id: true },
        })
      : [];

    const role = await prisma.role.create({
      data: {
        name,
        description: description || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: {
          create: baselineRows.map((p) => ({ permissionId: p.id, createdAt: new Date() })),
        },
      },
      select: { id: true, name: true },
    });

    await logAudit({
      action: "CREATE",
      userId: String(auth.userId),
      details: `Role "${role.name}" created with ${baselineRows.length} baseline permission(s)`,
      metadata: { roleId: role.id },
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