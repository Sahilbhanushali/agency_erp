import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { logAuditAction } from "@/lib/audit";
import { deleteLocalFile } from "@/lib/storage";
import { companySchema, companySelect, fieldErrors } from "../schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; companyId: string }> };

// The company must belong to the client in the URL, or it reads as missing.
const find = (clientId: string, id: string) =>
  prisma.clientCompany.findFirst({ where: { id, clientId }, select: { id: true, name: true, logo: true } });

export async function PUT(request: Request, context: Ctx) {
  const auth = await requireCan("clients", "update");
  if (!auth.ok) return auth.response;
  const { id, companyId } = await context.params;

  const parsed = companySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the highlighted fields", fields: fieldErrors(parsed.error) }, { status: 422 });
  }
  const existing = await find(id, companyId);
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  try {
    const company = await prisma.clientCompany.update({ where: { id: companyId }, data: parsed.data, select: companySelect });
    await logAuditAction({
      userId: String(auth.userId),
      action: "CLIENT_UPDATED",
      entityType: "ClientCompany",
      entityId: companyId,
      oldValues: JSON.stringify({ name: existing.name }),
      newValues: JSON.stringify({ name: company.name }),
    });
    return NextResponse.json(company);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "This client already has a company with that name", fields: { name: "Already added" } }, { status: 409 });
    }
    console.error("Error updating client company:", e);
    return NextResponse.json({ error: "Could not save the company" }, { status: 500 });
  }
}

/**
 * Projects of a deleted company stay, unlinked, and show the client's name instead.
 * A company that quotations or invoices were billed to can't be deleted.
 */
export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireCan("clients", "update");
  if (!auth.ok) return auth.response;
  const { id, companyId } = await context.params;

  const existing = await find(id, companyId);
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  // Issued documents keep the company they billed (the schema restricts the delete).
  const billed = await prisma.clientCompany.findUnique({
    where: { id: companyId },
    select: { _count: { select: { invoices: true, quotations: true } } },
  });
  const docs = (billed?._count.invoices ?? 0) + (billed?._count.quotations ?? 0);
  if (docs > 0) {
    return NextResponse.json(
      { error: `${existing.name} is billed on ${docs} quotation${docs === 1 ? "" : "s"} or invoice${docs === 1 ? "" : "s"}, so it can't be deleted.` },
      { status: 409 },
    );
  }
  await prisma.clientCompany.delete({ where: { id: companyId } });
  // Its own uploaded logo goes with it; a migrated one is the client's photo and stays.
  if (existing.logo?.startsWith("/uploads/client-companies/")) await deleteLocalFile(existing.logo);
  await logAuditAction({
    userId: String(auth.userId),
    action: "CLIENT_UPDATED",
    entityType: "ClientCompany",
    entityId: companyId,
    oldValues: JSON.stringify({ clientId: id, name: existing.name, deleted: true }),
  });
  return NextResponse.json({ ok: true });
}
