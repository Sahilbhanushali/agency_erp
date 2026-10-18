import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { encrypt } from "@/lib/encryption"
import { credentialUpdateSchema } from "@/lib/validation/credential"

export const dynamic = "force-dynamic"

const select = {
  id: true,
  label: true,
  category: true,
  clientId: true,
  projectId: true,
  location: true,
  platform: true,
  userId: true,
  url: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, company: true, phone: true } },
  project: { select: { id: true, name: true } },
}

/** Everything except the password, which comes from the audited reveal endpoint. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("credentials", "read")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const credential = await prisma.credential.findUnique({ where: { id }, select })
    if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ credential })
  } catch (error) {
    console.error("[credentials] read failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

/** PUT kept alongside PATCH so the existing form keeps working. */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return update(request, context)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return update(request, context)
}

async function update(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("credentials", "update")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const parsed = credentialUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }
    const input = parsed.data

    const existing = await prisma.credential.findUnique({
      where: { id },
      select: { id: true, label: true, platform: true, clientId: true },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const clientId = input.clientId !== undefined ? input.clientId : existing.clientId
    if (input.projectId && !clientId) {
      return NextResponse.json(
        { error: "A credential filed under a project also needs its client." },
        { status: 422 },
      )
    }
    if (input.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, clientId: true },
      })
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
      if (project.clientId !== clientId) {
        return NextResponse.json(
          { error: "That project belongs to a different client." },
          { status: 422 },
        )
      }
    }

    const credential = await prisma.credential.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.platform !== undefined ? { platform: input.platform } : {}),
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        // An omitted password leaves the stored one alone, so editing a label does not
        // require retyping the secret.
        ...(input.password ? { password: encrypt(input.password) } : {}),
      },
      select,
    })

    await logAuditAction({
      userId: String(auth.userId),
      action: input.password ? "UPDATE_WITH_SECRET" : "UPDATE",
      entityType: "Credential",
      entityId: id,
      oldValues: JSON.stringify({ label: existing.label, platform: existing.platform }),
      newValues: JSON.stringify({ label: credential.label, platform: credential.platform }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ credential })
  } catch (error) {
    console.error("[credentials] update failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCan("credentials", "delete")
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    const credential = await prisma.credential.findUnique({
      where: { id },
      select: { id: true, label: true, platform: true, userId: true },
    })
    if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.credential.delete({ where: { id } })

    await logAuditAction({
      userId: String(auth.userId),
      action: "DELETE",
      entityType: "Credential",
      entityId: id,
      oldValues: JSON.stringify({
        label: credential.label,
        platform: credential.platform,
        userId: credential.userId,
      }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ message: "Credential deleted" })
  } catch (error) {
    console.error("[credentials] delete failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
