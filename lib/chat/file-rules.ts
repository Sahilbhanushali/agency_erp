/**
 * What may be attached to a chat message, decided from the file's own bytes.
 *
 * Free of imports so it can be compiled and run on its own — see file-rules.check.ts.
 *
 * The client's filename and Content-Type are not trusted for anything: the type comes
 * from magic bytes, the stored name is generated, and the original name survives only
 * as a sanitised display string. An extension that disagrees with the bytes is refused,
 * which stops a script renamed to .pdf from being served as one.
 *
 * Deliberately absent: SVG and HTML. Both execute script when opened in a browser, and
 * an attachment is served from this app's own origin.
 */

export type AttachmentKind = "IMAGE" | "VIDEO" | "DOCUMENT" | "FILE"

export interface DetectedType {
  mime: string
  /** Extension we store under — derived from the bytes, never from the upload. */
  ext: string
  kind: AttachmentKind
  /** Extensions a person may have named this file with. */
  accepts: string[]
}

export class AttachmentRuleError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message)
    this.name = "AttachmentRuleError"
  }
}

const MB = 1024 * 1024
export const MAX_BYTES: Record<AttachmentKind, number> = {
  IMAGE: 10 * MB,
  VIDEO: 50 * MB,
  DOCUMENT: 25 * MB,
  FILE: 25 * MB,
}

const startsWith = (buf: Uint8Array, bytes: number[], offset = 0) =>
  bytes.every((b, i) => buf[offset + i] === b)

const ascii = (buf: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...buf.subarray(start, end))

/** The part after the last dot, lower-cased; "" when there is none. */
export function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ""
  const dot = base.lastIndexOf(".")
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ""
}

/**
 * Looks at the first bytes of the file. `name` is used only to tell apart formats that
 * share a container — a .docx and a .xlsx are both ZIP files.
 */
export function detectType(head: Uint8Array, name: string): DetectedType | null {
  const ext = extensionOf(name)

  if (startsWith(head, [0xff, 0xd8, 0xff]))
    return { mime: "image/jpeg", ext: "jpg", kind: "IMAGE", accepts: ["jpg", "jpeg"] }
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: "image/png", ext: "png", kind: "IMAGE", accepts: ["png"] }
  if (ascii(head, 0, 6) === "GIF87a" || ascii(head, 0, 6) === "GIF89a")
    return { mime: "image/gif", ext: "gif", kind: "IMAGE", accepts: ["gif"] }
  if (ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 12) === "WEBP")
    return { mime: "image/webp", ext: "webp", kind: "IMAGE", accepts: ["webp"] }

  if (ascii(head, 4, 8) === "ftyp") {
    const brand = ascii(head, 8, 12)
    if (brand.startsWith("qt"))
      return { mime: "video/quicktime", ext: "mov", kind: "VIDEO", accepts: ["mov"] }
    return { mime: "video/mp4", ext: "mp4", kind: "VIDEO", accepts: ["mp4", "m4v"] }
  }
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3]))
    return { mime: "video/webm", ext: "webm", kind: "VIDEO", accepts: ["webm"] }

  if (ascii(head, 0, 5) === "%PDF-")
    return { mime: "application/pdf", ext: "pdf", kind: "DOCUMENT", accepts: ["pdf"] }

  // ZIP container: modern Office documents, or a plain archive.
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
    const office: Record<string, DetectedType> = {
      docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx", kind: "DOCUMENT", accepts: ["docx"] },
      xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx", kind: "DOCUMENT", accepts: ["xlsx"] },
      pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ext: "pptx", kind: "DOCUMENT", accepts: ["pptx"] },
    }
    if (office[ext]) return office[ext]
    return { mime: "application/zip", ext: "zip", kind: "FILE", accepts: ["zip"] }
  }

  // OLE compound file: legacy .doc / .xls / .ppt.
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    const legacy: Record<string, DetectedType> = {
      doc: { mime: "application/msword", ext: "doc", kind: "DOCUMENT", accepts: ["doc"] },
      xls: { mime: "application/vnd.ms-excel", ext: "xls", kind: "DOCUMENT", accepts: ["xls"] },
      ppt: { mime: "application/vnd.ms-powerpoint", ext: "ppt", kind: "DOCUMENT", accepts: ["ppt"] },
    }
    return legacy[ext] ?? null
  }

  // Plain text has no signature. Accept it only under a text extension and only when
  // the sample really is text: no NUL bytes, and valid UTF-8.
  if (ext === "txt" || ext === "csv") {
    if (head.includes(0)) return null
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(head.subarray(0, trimToCharBoundary(head)))
    } catch {
      return null
    }
    return ext === "csv"
      ? { mime: "text/csv", ext: "csv", kind: "DOCUMENT", accepts: ["csv"] }
      : { mime: "text/plain", ext: "txt", kind: "DOCUMENT", accepts: ["txt"] }
  }

  return null
}

/** A sample cut mid-character is not invalid UTF-8; drop a trailing partial sequence. */
function trimToCharBoundary(buf: Uint8Array): number {
  let end = buf.length
  for (let i = 0; i < 4 && end > 0; i++) {
    const b = buf[end - 1]
    if ((b & 0x80) === 0) break // ASCII byte: boundary is fine
    end--
    if ((b & 0xc0) === 0xc0) break // lead byte of the cut-off sequence: drop it too
  }
  return end
}

/** Validates an upload and returns what it really is. Throws a readable error otherwise. */
export function validateAttachment(head: Uint8Array, name: string, size: number): DetectedType {
  if (size <= 0) throw new AttachmentRuleError("That file is empty.")

  const type = detectType(head, name)
  if (!type) {
    throw new AttachmentRuleError(
      "That file type cannot be shared. Send images, videos, PDFs, Office documents, text, CSV or ZIP files.",
    )
  }

  const ext = extensionOf(name)
  if (!type.accepts.includes(ext)) {
    throw new AttachmentRuleError(
      `"${safeDisplayName(name)}" is named .${ext || "?"} but its contents are ${type.ext.toUpperCase()}. Rename it or send the original file.`,
    )
  }

  if (size > MAX_BYTES[type.kind]) {
    throw new AttachmentRuleError(
      `That ${type.kind.toLowerCase()} is ${(size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_BYTES[type.kind] / 1024 / 1024} MB.`,
      413,
    )
  }
  return type
}

/**
 * The original name, made safe to show and to put in a Content-Disposition header:
 * no path, no control characters, no quotes, bounded length.
 */
export function safeDisplayName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f\u007f"]/g, "").trim()
  return (base || "file").slice(0, 200)
}
