/**
 * Self-check for the mail header and text-alternative logic.
 *
 *   npx tsx lib/__tests__/mail.check.ts
 *
 * These are the two things that decided whether mail was delivered or filtered, so
 * they get the one runnable check in this area.
 */
import assert from "node:assert/strict"
import { formatFrom, htmlToText, fromEmailAddress } from "@/lib/smtp"

// A display name configured where an address belongs must not reach the From header.
// (@prisma/client loads .env on import, so set both variables explicitly.)
process.env.FROM_EMAIL = "itsmeDezino"
process.env.SMTP_USER = "itsmedezino@gmail.com"
assert.equal(
  fromEmailAddress(),
  "itsmedezino@gmail.com",
  "a brand name is skipped in favour of the authenticated mailbox",
)

delete process.env.SMTP_USER
assert.equal(fromEmailAddress(), null, "with nothing usable configured, no address is invented")
process.env.SMTP_USER = "itsmedezino@gmail.com"
assert.equal(
  formatFrom("itsmedezino@gmail.com"),
  '"itsmeDezino" <itsmedezino@gmail.com>',
  "the name becomes the display name, the authenticated mailbox the address",
)

process.env.FROM_EMAIL = "hello@itsmedigital.in"
assert.equal(fromEmailAddress(), "hello@itsmedigital.in", "a real address is accepted")

// Quotes and newlines in a name would let a caller inject extra headers.
assert.equal(
  formatFrom("a@b.co", 'Ac"me\r\nBcc: x@y.z'),
  '"AcmeBcc: x@y.z" <a@b.co>',
  "CR/LF and quotes are stripped from the display name",
)
assert.equal(formatFrom("a@b.co", "   "), "a@b.co", "an empty name yields a bare address")

// The text alternative has to be readable, and links have to survive it.
const text = htmlToText(`
  <style>.x{color:red}</style>
  <h1>Task assigned</h1>
  <p>Hello&nbsp;Priya &amp; team,</p>
  <ul><li>Design the carousel</li><li>Due tomorrow</li></ul>
  <a href="https://example.test/dashboard/tasks">Open the task</a>
`)
assert.ok(!text.includes("<"), "no tags survive")
assert.ok(!text.includes("color:red"), "stylesheets are dropped")
assert.ok(text.includes("Hello Priya & team,"), "entities are decoded")
assert.ok(text.includes("- Design the carousel"), "list items become bullets")
assert.ok(
  text.includes("Open the task (https://example.test/dashboard/tasks)"),
  "a link keeps its destination",
)
assert.ok(!/\n{3,}/.test(text), "no runs of blank lines")

// A link whose label already is the URL should not be printed twice.
assert.equal(
  htmlToText('<a href="https://example.test/x">https://example.test/x</a>'),
  "https://example.test/x",
)

console.log("mail checks passed")
