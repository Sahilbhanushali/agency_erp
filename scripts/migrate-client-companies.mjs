#!/usr/bin/env node
/**
 * Gives every client that has a company name its first ClientCompany row (carrying the
 * client's GSTIN, PAN and address), and points that client's projects at it.
 *
 *   node scripts/migrate-client-companies.mjs            # dry run: lists what would change
 *   node scripts/migrate-client-companies.mjs --confirm  # does it
 *
 * Safe to re-run: an existing company of the same name is reused, and projects that
 * already name a company are left alone. Run after `prisma db push`.
 */
import { PrismaClient } from "@prisma/client"

const CONFIRM = process.argv.includes("--confirm")
const prisma = new PrismaClient()

const clients = await prisma.client.findMany({
  where: { company: { not: null } },
  select: {
    id: true, name: true, company: true, website: true, industry: true, gstin: true, panNumber: true,
    address: true, city: true, state: true, country: true, postalCode: true, avatar: true,
    _count: { select: { projects: { where: { clientCompanyId: null } } } },
  },
})
let made = 0, linked = 0
for (const c of clients) {
  const name = c.company.trim()
  if (!name) continue
  console.log(`  ${c.name}: "${name}" (${c._count.projects} project(s) to link)`)
  linked += c._count.projects
  if (!CONFIRM) { made++; continue }
  const company = await prisma.clientCompany.upsert({
    where: { clientId_name: { clientId: c.id, name } },
    update: {},
    create: {
      clientId: c.id, name, website: c.website, industry: c.industry, gstin: c.gstin, panNumber: c.panNumber,
      address: c.address, city: c.city, state: c.state, country: c.country, postalCode: c.postalCode, logo: c.avatar,
    },
  })
  made++
  await prisma.project.updateMany({ where: { clientId: c.id, clientCompanyId: null }, data: { clientCompanyId: company.id } })
}
console.log(`\n${CONFIRM ? "Done" : "Dry run"}: ${made} compan${made === 1 ? "y" : "ies"}, ${linked} project(s) linked.${CONFIRM ? "" : " Re-run with --confirm."}`)
await prisma.$disconnect()
