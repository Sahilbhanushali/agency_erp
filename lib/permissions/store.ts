import { prisma } from "@/lib/prisma"
import { allPermissions } from "@/lib/permissions/catalog"

/**
 * Resolves canonical permission names to their row ids, creating any the database does
 * not have yet.
 *
 * `lib/permissions/catalog.ts` is the source of truth for which permissions exist. The
 * `permissions` table is a projection of it that only changes when a seed or migration
 * script runs, so the two drift apart on any server seeded before the catalog grew — or
 * never seeded at all.
 *
 * That drift used to be silent. The save endpoint looked the names up, dropped the ones
 * it could not resolve, and still answered 200 "Permissions updated": an administrator
 * ticked ten boxes, was told it saved, and saw none of it afterwards. Creating the
 * missing rows here makes a save work on any database regardless of seed state, and
 * `created` reports the drift so it can be logged rather than hidden.
 */
export async function ensurePermissionIds(
  names: string[],
): Promise<{ idByName: Map<string, number>; created: string[] }> {
  const wanted = Array.from(new Set(names))
  if (wanted.length === 0) return { idByName: new Map(), created: [] }

  const found = await prisma.permission.findMany({
    where: { name: { in: wanted } },
    select: { id: true, name: true },
  })
  const idByName = new Map(found.map((row) => [row.name, row.id]))

  const missing = wanted.filter((name) => !idByName.has(name))
  if (missing.length === 0) return { idByName, created: [] }

  // Only names the catalog defines are ever created, so a caller cannot invent a
  // permission by asking for one to be saved.
  const catalog = new Map(allPermissions().map((p) => [p.name, p]))
  const creatable = missing.flatMap((name) => {
    const entry = catalog.get(name)
    return entry ? [entry] : []
  })

  const unknown = missing.filter((name) => !catalog.has(name))
  if (unknown.length > 0) {
    console.error(`[permissions] not in the catalog, refusing to create: ${unknown.join(", ")}`)
  }

  if (creatable.length === 0) return { idByName, created: [] }

  console.warn(
    `[permissions] the permissions table was missing ${creatable.length} catalog ` +
      `entr${creatable.length === 1 ? "y" : "ies"} (${creatable.map((p) => p.name).join(", ")}) ` +
      `— creating them now. Run "node prisma/seed.mjs" on this database to keep it in step.`,
  )

  await prisma.permission.createMany({
    data: creatable.map((p) => ({
      name: p.name,
      module: p.module,
      action: p.action,
      label: p.label,
      description: p.description,
    })),
    skipDuplicates: true,
  })

  const now = await prisma.permission.findMany({
    where: { name: { in: creatable.map((p) => p.name) } },
    select: { id: true, name: true },
  })
  for (const row of now) idByName.set(row.name, row.id)

  return { idByName, created: creatable.map((p) => p.name) }
}
