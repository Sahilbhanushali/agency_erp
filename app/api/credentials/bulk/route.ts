import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCan } from "@/lib/api-auth"
import { logAuditAction } from "@/lib/audit"
import { sealSecret } from "@/lib/credentials/vault"
import { credentialSchema } from "@/lib/validation/credential"
import { clientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const MAX_ROWS = 500

/** Case, spacing and punctuation do not matter; the name itself must match exactly. */
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")

/**
 * POST [{ "Client Name", "Project Name", "Location", "Platform", "User Id", "Password" }]
 *
 * Spreadsheet import. Rows are validated like single creates and sealed the same way.
 * Clients and projects match on their exact (normalized) name only — the old substring
 * match filed credentials under whichever client happened to contain the text. A row
 * that does not match is reported by row number, and never echoed back: the response
 * must not carry the passwords it was sent.
 */
export async function POST(request: NextRequest) {
  const auth = await requireCan("credentials", "create")
  if (!auth.ok) return auth.response

  const rows: unknown = await request.json().catch(() => null)
  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: "Expected a list of rows." }, { status: 400 })
  }
  if (rows.length === 0 || rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Import between 1 and ${MAX_ROWS} rows at a time.` }, { status: 422 })
  }

  try {
    const clients = await prisma.client.findMany({
      select: { id: true, name: true, projects: { select: { id: true, name: true } } },
    })
    const clientByName = new Map(clients.map((c) => [normalize(c.name), c]))

    const errors: string[] = []
    const ready: { clientId: string; projectId: string; data: ReturnType<typeof credentialSchema.parse> }[] = []

    rows.forEach((raw, index) => {
      const rowNo = index + 2 // header is row 1 in the sheet
      const row = (raw ?? {}) as Record<string, unknown>
      const text = (key: string) => (row[key] === undefined || row[key] === null ? "" : String(row[key]))
      const clientName = text("Client Name")
      const projectName = text("Project Name")

      const client = clientByName.get(normalize(clientName))
      if (!clientName || !client) return void errors.push(`Row ${rowNo}: no client named “${clientName.slice(0, 80)}”.`)
      const project = client.projects.find((p) => normalize(p.name) === normalize(projectName))
      if (!projectName || !project) {
        return void errors.push(`Row ${rowNo}: client “${client.name}” has no project named “${projectName.slice(0, 80)}”.`)
      }

      const parsed = credentialSchema.safeParse({
        label: text("Label") || text("Platform"),
        clientId: client.id,
        projectId: project.id,
        location: text("Location"),
        platform: text("Platform"),
        userId: text("User Id") || text("User ID"),
        password: text("Password"),
      })
      if (!parsed.success) {
        // Field names only: messages never include the submitted values.
        const fields = Object.keys(parsed.error.flatten().fieldErrors).join(", ")
        return void errors.push(`Row ${rowNo}: missing or invalid ${fields}.`)
      }
      ready.push({ clientId: client.id, projectId: project.id, data: parsed.data })
    })

    if (ready.length === 0) {
      return NextResponse.json({ error: "No rows could be imported.", details: errors }, { status: 422 })
    }

    const created = await prisma.$transaction(
      ready.map(({ data }) =>
        prisma.credential.create({
          data: { ...data, password: sealSecret(data.password, "password"), notes: null },
          select: { id: true, label: true, platform: true, clientId: true },
        }),
      ),
    )

    await logAuditAction({
      userId: String(auth.userId),
      action: "BULK_IMPORT",
      entityType: "Credential",
      entityId: created.map((c) => c.id).join(",").slice(0, 2000),
      newValues: JSON.stringify({ imported: created.length, skipped: errors.length }),
      ipAddress: clientIp(request.headers) || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({ success: true, count: created.length, errors }, { status: 201 })
  } catch (error) {
    console.error("[credentials] bulk import failed:", error instanceof Error ? error.message : "unknown error")
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
