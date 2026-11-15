/**
 * Re-seals every stored credential (password and notes) and SMTP password under
 * CREDENTIALS_ENCRYPTION_KEY
 * with AES-256-GCM. Rows still in lib/encryption.ts's old CBC format or in plaintext are
 * upgraded; rows already sealed are left alone. Safe to run more than once.
 *
 *   npm run credentials:reseal              # dry run: counts only
 *   npm run credentials:reseal -- --apply   # writes
 *
 * Needs the NEXTAUTH_SECRET the old rows were written under, once. Prints no secrets.
 */
import { createRequire } from "node:module"
import { PrismaClient } from "@prisma/client"
import { needsReseal, openSecret, sealSecret } from "../lib/credentials/vault.ts"

const apply = process.argv.includes("--apply")
const prisma = new PrismaClient()

async function main() {
  try {
    const rows = await prisma.credential.findMany({ select: { id: true, password: true, notes: true } })
    let upgraded = 0
    const failed: string[] = []
    for (const row of rows) {
      const stale = needsReseal(row.password) || (row.notes !== null && row.notes !== "" && needsReseal(row.notes))
      if (!stale) continue
      try {
        const password = openSecret(row.password, "password")
        const notes = row.notes ? openSecret(row.notes, "notes") : null
        if (apply) {
          await prisma.credential.update({
            where: { id: row.id },
            data: { password: sealSecret(password, "password"), notes: notes ? sealSecret(notes, "notes") : null },
          })
        }
        upgraded++
      } catch (error) {
        failed.push(`${row.id}: ${error instanceof Error ? error.message : "unknown error"}`)
      }
    }
    console.log(`${rows.length} credentials; ${upgraded} ${apply ? "re-sealed" : "would be re-sealed"}; ${failed.length} could not be read.`)

    // SMTP passwords: older crypto-js AES (under the configured or the published key)
    // and plaintext become vault-sealed. Read with the cron scripts' opener, which
    // handles the same formats as lib/smtp.ts without its app-only imports.
    const { openSmtpPassword } = createRequire(import.meta.url)("./smtp-password.js")
    const smtpRows = await prisma.smtpDetails.findMany({ select: { id: true, password: true } })
    let smtpUpgraded = 0
    for (const row of smtpRows) {
      if (!row.password || !needsReseal(row.password)) continue
      try {
        const plain = openSmtpPassword(row.password)
        if (apply) await prisma.smtpDetails.update({ where: { id: row.id }, data: { password: sealSecret(plain, "smtp") } })
        smtpUpgraded++
      } catch (error) {
        failed.push(`smtp ${row.id}: ${error instanceof Error ? error.message : "unknown error"}`)
      }
    }
    console.log(`${smtpRows.length} SMTP configs; ${smtpUpgraded} ${apply ? "re-sealed" : "would be re-sealed"}.`)
    for (const line of failed) console.log(`  ${line}`)
    if (!apply && upgraded > 0) console.log("Dry run. Re-run with --apply to write.")
    if (failed.length > 0) process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void main()
