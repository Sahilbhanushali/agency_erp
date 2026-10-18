import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from "@/lib/api-auth";

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

/**
 * There was a PATCH handler here that took a list of permission names and then either
 * found a role matching that exact set or created one called `CustomRole_<userId>_<ts>`.
 * It was dead — both callers only ever GET — and it worked against the role model: it
 * manufactured a throwaway role per user instead of assigning one of the real ones,
 * leaving unnamed roles in the list that nobody could interpret.
 *
 * Roles are assigned with PATCH /api/users/[id] and edited under
 * Users -> Roles & Permissions.
 */
