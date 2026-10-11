import { type NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { encrypt } from "@/lib/encryption"
import { credentialSchema } from "@/lib/validation/credential"

export const dynamic = "force-dynamic"

/**
 * Stored logins. A credential belongs to a client's project, or stands alone as an
 * internal one when clientId and projectId are both null.
 *
 * The list NEVER returns passwords — not even encrypted. It used to decrypt every
 * password in the table and hand them to anyone with a session. Reveal one at a time
 * through GET /api/credentials/[id]/reveal, which audits who looked.
 */
const listSelect = {
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
} satisfies Prisma.CredentialSelect

/**
 * Filters: `?scope=internal` (no client), `?scope=client` (has one), `?clientId=`,
 * `?projectId=`, `?category=`, `?search=` over label, platform, username and location.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("View-credentials")
  if (!auth.ok) return auth.response

  try {
    const query = request.nextUrl.searchParams
    const scope = query.get("scope")
    const search = query.get("search")?.trim()

    const where: Prisma.CredentialWhereInput = {
      ...(scope === "internal" ? { clientId: null } : {}),
      ...(scope === "client" ? { clientId: { not: null } } : {}),
      ...(query.get("clientId") ? { clientId: query.get("clientId")! } : {}),
      ...(query.get("projectId") ? { projectId: query.get("projectId")! } : {}),
      ...(query.get("category") ? { category: query.get("category")! } : {}),
      ...(search
        ? {
            OR: [
              { label: { contains: search } },
              { platform: { contains: search } },
              { userId: { contains: search } },
              { location: { contains: search } },
              { category: { contains: search } },
            ],
          }
        : {}),
    }

    const [credentials, categories] = await Promise.all([
      prisma.credential.findMany({
        where,
        select: listSelect,
        orderBy: [{ category: "asc" }, { label: "asc" }],
      }),
      // The category list drives the filter, so it comes from the data rather than a
      // hardcoded enum — new kinds of credential need no code change.
      prisma.credential.findMany({
        where: { category: { not: null } },
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      }),
    ])

    return NextResponse.json({
      credentials,
      categories: categories.map((row) => row.category).filter(Boolean),
    })
  } catch (error) {
    console.error("[credentials] list failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("Manage-credentials")
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()

    // The old endpoint only accepted { clientId, projectId, platforms[] }. Both shapes
    // work now: a bare object is one credential, `platforms` is still a batch.
    const items: unknown[] = Array.isArray(body?.platforms)
      ? body.platforms.map((entry: Record<string, unknown>) => ({
          label: entry.label ?? entry.platform ?? "",
          category: body.category,
          clientId: body.clientId ?? null,
          projectId: body.projectId ?? null,
          location: body.location ?? "",
          platform: entry.platform,
          userId: entry.userId,
          password: entry.password,
          url: entry.url,
          notes: entry.notes,
        }))
      : [body]

    const parsed = items.map((item) => credentialSchema.safeParse(item))
    const failure = parsed.find((result) => !result.success)
    if (failure && !failure.success) {
      return NextResponse.json(
        { error: "Invalid input", details: failure.error.flatten().fieldErrors },
        { status: 422 },
      )
    }
    const inputs = parsed.flatMap((result) => (result.success ? [result.data] : []))

    // A project must belong to the client it is filed under; an internal credential
    // may have neither.
    for (const input of inputs) {
      if (input.projectId && !input.clientId) {
        return NextResponse.json(
          { error: "A credential filed under a project also needs its client." },
          { status: 422 },
        )
      }
      if (input.clientId) {
        const client = await prisma.client.findUnique({
          where: { id: input.clientId },
          select: { id: true },
        })
        if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })
      }
      if (input.projectId) {
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: { id: true, clientId: true },
        })
        if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
        if (project.clientId !== input.clientId) {
          return NextResponse.json(
            { error: "That project belongs to a different client." },
            { status: 422 },
          )
        }
      }
    }

    const created = await prisma.$transaction(
      inputs.map((input) =>
        prisma.credential.create({
          data: { ...input, password: encrypt(input.password) },
          select: listSelect,
        }),
      ),
    )

    await logAuditAction({
      userId: String(auth.userId),
      action: "CREATE",
      entityType: "Credential",
      entityId: created.map((credential) => credential.id).join(","),
      // Never the password, not even encrypted.
      newValues: JSON.stringify(
        created.map((c) => ({ label: c.label, platform: c.platform, clientId: c.clientId })),
      ),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ credentials: created }, { status: 201 })
  } catch (error) {
    console.error("[credentials] create failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
