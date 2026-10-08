// app/api/permissions/route.ts
import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma"// Adjust the import path to your Prisma client
import { requireSession } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const permissions = await prisma.permission.findMany({
      select: { id: true, name: true },
    });
    return NextResponse.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
  }
}