#!/usr/bin/env node
/**
 * Moves employee documents out of public/uploads/users (readable by anyone with the
 * URL) into private storage, and points their rows at the authorized route.
 *
 *   node scripts/migrate-hr-documents.mjs            # dry run: lists what would move
 *   node scripts/migrate-hr-documents.mjs --confirm  # moves them
 *
 * Safe to re-run: rows already moved are skipped. The app serves unmoved rows from the
 * old folder in the meantime, so the order of deploy and migration does not matter.
 * Must match lib/hr-documents.ts (HR_DOCS_ROOT, documentFileUrl).
 */
import { PrismaClient } from "@prisma/client"
import fs from "node:fs"
import path from "node:path"

const CONFIRM = process.argv.includes("--confirm")
const LEGACY_ROOT = path.resolve(process.cwd(), "public", "uploads", "users")
const ROOT = path.resolve(process.env.HR_DOCS_STORAGE_DIR || path.join(process.cwd(), "storage", "hr-documents"))
const prisma = new PrismaClient()

const docs = await prisma.userDocument.findMany({
  where: { fileUrl: { startsWith: "/uploads/users/" } },
  select: { id: true, userId: true, fileUrl: true },
})
let moved = 0, missing = 0
if (CONFIRM) fs.mkdirSync(ROOT, { recursive: true })
for (const doc of docs) {
  const from = path.resolve(LEGACY_ROOT, path.basename(doc.fileUrl.split("?")[0]))
  const url = `/api/users/${doc.userId}/documents/${doc.id}/file`
  if (!from.startsWith(LEGACY_ROOT + path.sep) || !fs.existsSync(from)) {
    missing++
    console.log(`  missing file, row left as is: ${doc.id} ${doc.fileUrl}`)
    continue
  }
  moved++
  console.log(`  ${doc.fileUrl} -> ${url}`)
  if (!CONFIRM) continue
  fs.copyFileSync(from, path.join(ROOT, doc.id))
  await prisma.$transaction([
    prisma.userDocument.update({ where: { id: doc.id }, data: { fileUrl: url } }),
    prisma.user.updateMany({ where: { offerLetterUrl: doc.fileUrl }, data: { offerLetterUrl: url } }),
  ])
  fs.rmSync(from)
}
console.log(`\n${CONFIRM ? "Moved" : "Would move"} ${moved} document(s); ${missing} row(s) have no file on disk.`)
if (!CONFIRM) console.log("Dry run — nothing changed. Re-run with --confirm.")
await prisma.$disconnect()
