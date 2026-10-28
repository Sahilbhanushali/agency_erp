import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { logAuditAction } from "@/lib/audit";
import { companySchema, companySelect, fieldErrors } from "./schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** The companies a client runs. */
export async function GET(_request: Request, context: Ctx) {
  const auth = await requireCan("clients", "read");
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const client = await prisma.client.findUnique({
    where: { id },
    select: { companies: { select: companySelect, orderBy: { name: "asc" } } },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json(client.companies);
}

export async function POST(request: Request, context: Ctx) {
  const auth = await requireCan("clients", "update");
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const parsed = companySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 422 });
  }
  const client = await prisma.client.findUnique({ where: { id }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    const company = await prisma.clientCompany.create({
      data: { ...parsed.data, clientId: id },
      select: companySelect,
    });
    await logAuditAction({
      userId: String(auth.userId),
      action: "CLIENT_UPDATED",
      entityType: "ClientCompany",
      entityId: company.id,
      newValues: JSON.stringify({ clientId: id, name: company.name }),
    });
    return NextResponse.json(company, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "This client already has a company with that name", fields: { name: "Already added" } }, { status: 409 });
    }
    console.error("Error adding client company:", e);
    return NextResponse.json({ error: "Could not add the company" }, { status: 500 });
  }
}
