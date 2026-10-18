import { NextResponse } from "next/server"
import { requireCan } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { permissionCatalogStatus, syncPermissionCatalog } from "@/lib/permissions/sync"

export const dynamic = "force-dynamic"

/**
 * Report, and repair, drift between the permission catalog in the code and the
 * `permissions` table.
 *
 *   GET   is the database in step with the catalog?
 *   POST  make it so
 *
 * This exists because `prisma/seed.mjs` compiles the catalog with `npx tsc`, and
 * `typescript` is a devDependency — so the seed cannot run on a server installed with
 * `npm ci --omit=dev`. A drifted table meant saving a role's permissions silently
 * dropped the grants it had no rows for.
 */
export async function GET() {
  const auth = await requireCan("roles", "read")
  if (!auth.ok) return auth.response

  try {
    return NextResponse.json(await permissionCatalogStatus())
  } catch (error) {
    console.error("[permissions/sync] status failed:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function POST() {
  const auth = await requireCan("roles", "update")
  if (!auth.ok) return auth.response

  try {
    const result = await syncPermissionCatalog()

    await logAudit({
      action: "UPDATE",
      userId: String(auth.userId),
      details:
        `Permission catalog synced: ${result.createdCanonical} module permission(s) and ` +
        `${result.createdLegacy} legacy name(s) added, ${result.totalPermissions} total`,
      metadata: result,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[permissions/sync] sync failed:", error)
    return NextResponse.json({ error: "Could not sync the permission catalog" }, { status: 500 })
  }
}
