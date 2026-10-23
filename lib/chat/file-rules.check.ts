import assert from "node:assert/strict"
import path from "node:path"
import {
  AttachmentRuleError,
  MAX_BYTES,
  detectType,
  extensionOf,
  safeDisplayName,
  validateAttachment,
} from "./file-rules"
import { CHAT_STORAGE_ROOT, newStorageKey, pathForKey } from "./storage"

/**
 * Run with: npm run check:chat
 *
 * The cases that matter are the refusals. An attachment is served from this app's own
 * origin to other staff, so a file that lies about its type is an attack, not a typo.
 */

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(64).fill(0x20)])
const text = (s: string) => new TextEncoder().encode(s)
const refuses = (fn: () => unknown, because: string) => assert.throws(fn, AttachmentRuleError, `should refuse: ${because}`)

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0)
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
const PDF = text("%PDF-1.7\n%....")
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04)
const OLE = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
const MP4 = new Uint8Array([0, 0, 0, 0x20, ...text("ftypisom"), ...new Array(32).fill(0)])
const MOV = new Uint8Array([0, 0, 0, 0x14, ...text("ftypqt  "), ...new Array(32).fill(0)])

// --- detection from bytes ------------------------------------------------------
assert.equal(detectType(JPEG, "a.jpg")?.mime, "image/jpeg")
assert.equal(detectType(PNG, "a.png")?.mime, "image/png")
assert.equal(detectType(text("GIF89a......"), "a.gif")?.mime, "image/gif")
assert.equal(detectType(text("RIFF\0\0\0\0WEBPVP8 "), "a.webp")?.mime, "image/webp")
assert.equal(detectType(MP4, "a.mp4")?.mime, "video/mp4")
assert.equal(detectType(MOV, "a.mov")?.mime, "video/quicktime")
assert.equal(detectType(bytes(0x1a, 0x45, 0xdf, 0xa3), "a.webm")?.mime, "video/webm")
assert.equal(detectType(PDF, "a.pdf")?.mime, "application/pdf")
assert.equal(detectType(ZIP, "report.docx")?.ext, "docx", "ZIP + .docx is a Word document")
assert.equal(detectType(ZIP, "sheet.xlsx")?.ext, "xlsx")
assert.equal(detectType(ZIP, "deck.pptx")?.ext, "pptx")
assert.equal(detectType(ZIP, "bundle.zip")?.ext, "zip")
assert.equal(detectType(OLE, "old.doc")?.ext, "doc")
assert.equal(detectType(OLE, "old.xls")?.ext, "xls")
assert.equal(detectType(text("name,amount\nA,1\n"), "data.csv")?.mime, "text/csv")
assert.equal(detectType(text("hello ✓ world"), "note.txt")?.mime, "text/plain", "UTF-8 text is fine")

// --- things that must never be accepted ----------------------------------------
assert.equal(detectType(text("<svg onload=alert(1)>"), "x.svg"), null, "SVG runs script")
assert.equal(detectType(text("<html><script>"), "x.html"), null, "HTML runs script")
assert.equal(detectType(bytes(0x4d, 0x5a, 0x90, 0x00), "setup.exe"), null, "executables")
assert.equal(detectType(OLE, "mystery.msi"), null, "an OLE file that is not a known Office type")
assert.equal(detectType(new Uint8Array([0x68, 0x69, 0x00, 0x21]), "a.txt"), null, "text with a NUL byte is binary")
assert.equal(detectType(new Uint8Array([0xc3, 0x28, 0x41]), "a.txt"), null, "invalid UTF-8")
assert.equal(detectType(text("<script>alert(1)</script>"), "evil.js"), null, "script under its own extension")

// A UTF-8 character cut off by the sample window is not invalid text.
assert.ok(detectType(new Uint8Array([...text("café "), 0xe2, 0x9c]), "a.txt"), "truncated multibyte char at end")

// --- the name must agree with the bytes ----------------------------------------
refuses(() => validateAttachment(PDF, "invoice.jpg", 1000), "PDF bytes named .jpg")
refuses(() => validateAttachment(JPEG, "photo.pdf", 1000), "JPEG bytes named .pdf")
refuses(() => validateAttachment(JPEG, "noextension", 1000), "no extension at all")
refuses(() => validateAttachment(text("<svg/>"), "logo.png", 100), "SVG renamed to .png")
assert.equal(validateAttachment(JPEG, "Photo.JPEG", 1000).ext, "jpg", "extension check is case-insensitive")

// --- size ----------------------------------------------------------------------
refuses(() => validateAttachment(JPEG, "a.jpg", 0), "empty file")
refuses(() => validateAttachment(JPEG, "a.jpg", MAX_BYTES.IMAGE + 1), "image over the limit")
assert.doesNotThrow(() => validateAttachment(JPEG, "a.jpg", MAX_BYTES.IMAGE), "image exactly at the limit")
assert.doesNotThrow(() => validateAttachment(MP4, "a.mp4", MAX_BYTES.VIDEO), "video gets the larger limit")
try {
  validateAttachment(JPEG, "a.jpg", MAX_BYTES.IMAGE + 1)
} catch (e) {
  assert.equal((e as AttachmentRuleError).status, 413, "oversize answers 413")
}

// --- names are display strings, never paths -------------------------------------
assert.equal(extensionOf("../../etc/passwd.PDF"), "pdf")
assert.equal(extensionOf(".bashrc"), "", "a dotfile has no extension")
assert.equal(safeDisplayName("../../etc/passwd"), "passwd", "path segments are stripped")
assert.equal(safeDisplayName("C:\\Users\\x\\report.pdf"), "report.pdf", "Windows paths too")
// What matters for Content-Disposition: no CR, LF or quote survives to end the header early.
assert.doesNotMatch(safeDisplayName('a"b\r\nSet-Cookie: x=1.pdf'), /["\r\n]/, "no header injection")
assert.equal(safeDisplayName('a"b\r\nSet-Cookie: x=1.pdf'), "abSet-Cookie: x=1.pdf")
assert.equal(safeDisplayName(""), "file")
assert.equal(safeDisplayName("x".repeat(500)).length, 200)

// --- storage keys cannot escape the storage root -------------------------------
const key = newStorageKey("pdf")
assert.match(key, /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/, "generated keys are yyyy/mm/uuid.ext")
assert.ok(pathForKey(key).startsWith(CHAT_STORAGE_ROOT + path.sep))
assert.throws(() => pathForKey("../../../etc/passwd"), /escapes/, "relative traversal")
assert.throws(() => pathForKey("/etc/passwd"), /escapes/, "absolute path")
assert.throws(() => pathForKey("2026/../../outside"), /escapes/, "traversal hidden mid-key")
assert.ok(!newStorageKey("../x").includes(".."), "extension cannot smuggle a traversal")

console.log("chat file rules: all checks passed")
