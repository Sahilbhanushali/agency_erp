import { type NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { logAuditAction } from "@/lib/audit";
import { imageDimensions } from "@/lib/images";
import { deleteLocalFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** PNG and JPEG only: the file is served publicly, and those are what we can verify. */
const ALLOWED = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
]);
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 2048; // the form sends 512px; this is the backstop for direct calls
const DIR = "client-companies";

type Ctx = { params: Promise<{ id: string; companyId: string }> };

const find = (clientId: string, id: string) =>
  prisma.clientCompany.findFirst({ where: { id, clientId }, select: { id: true, name: true, logo: true } });

/**
 * Only files this route wrote are deleted. A migrated company's first logo is the
 * client's own photo, which must survive the company changing its logo.
 */
const removeOwnFile = (url: string | null) =>
  url?.startsWith(`/uploads/${DIR}/`) ? deleteLocalFile(url) : Promise.resolve(false);

/** Replace a company's logo. */
export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireCan("clients", "update");
  if (!auth.ok) return auth.response;
  const { id, companyId } = await context.params;

  try {
    const company = await find(id, companyId);
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const file = (await request.formData()).get("logo");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose an image to upload" }, { status: 422 });
    }
    // The extension comes from the declared type, never the client's filename.
    const extension = ALLOWED.get(file.type);
    if (!extension) return NextResponse.json({ error: "Logo must be a PNG or JPEG image" }, { status: 422 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Logo must be 2MB or smaller" }, { status: 422 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const size = imageDimensions(bytes);
    if (!size) return NextResponse.json({ error: "That file is not a readable PNG or JPEG image" }, { status: 422 });
    if (size.width > MAX_EDGE || size.height > MAX_EDGE) {
      return NextResponse.json({ error: `Logo is ${size.width}×${size.height}px; the limit is ${MAX_EDGE}px` }, { status: 422 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", DIR);
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `${companyId}-${Date.now()}${extension}`;
    await fs.writeFile(path.join(uploadDir, filename), bytes);
    const logo = `/uploads/${DIR}/${filename}`;

    await prisma.clientCompany.update({ where: { id: companyId }, data: { logo } });
    await removeOwnFile(company.logo);

    await logAuditAction({
      userId: String(auth.userId),
      action: "UPDATE",
      entityType: "ClientCompany",
      entityId: companyId,
      newValues: JSON.stringify({ logo }),
    });
    return NextResponse.json({ logo });
  } catch (error) {
    console.error("[client-companies/logo] upload failed:", error);
    return NextResponse.json({ error: "Could not upload the logo" }, { status: 500 });
  }
}

/** Remove the logo; the company then shows the client's photo again. */
export async function DELETE(_request: NextRequest, context: Ctx) {
  const auth = await requireCan("clients", "update");
  if (!auth.ok) return auth.response;
  const { id, companyId } = await context.params;

  const company = await find(id, companyId);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  await prisma.clientCompany.update({ where: { id: companyId }, data: { logo: null } });
  await removeOwnFile(company.logo);
  return NextResponse.json({ removed: true });
}
