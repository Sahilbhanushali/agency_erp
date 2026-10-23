import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { AttachmentRuleError, detectType, extensionOf, safeDisplayName } from "@/lib/chat/file-rules"
import { deleteLocalFile } from "@/lib/storage"
import { prisma } from "@/lib/prisma"
import { namesSatisfying } from "@/lib/permissions/catalog"

/**
 * Employee documents — ID proofs, bank and tax papers, contracts.
 *
 * They used to be written to public/uploads/users, which /api/uploads serves to anyone
 * with no session at all; the file name (doc-<userId>-<timestamp>-<name>) was the only
 * protection. They now live outside public/ and are served only by
 * /api/users/[id]/documents/[docId]/file, which checks who is asking.
 *
 * Each file is stored under its document's id, so replacing a file keeps the same URL.
 * Rows from before the move still point at /uploads/users/...; the file route reads
 * those from their old place, and /api/uploads refuses that folder.
 */
export const HR_DOCS_ROOT = path.resolve(
  process.env.HR_DOCS_STORAGE_DIR || path.join(process.cwd(), "storage", "hr-documents"),
)

const LEGACY_PREFIX = "/uploads/users/"
const LEGACY_ROOT = path.resolve(process.cwd(), "public", "uploads", "users")

export const MAX_DOC_BYTES = 25 * 1024 * 1024
const ALLOWED_EXTS = new Set(["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "xls", "xlsx", "csv"])

/** The authorized URL for a document; `version` busts the browser cache after a replace. */
export const documentFileUrl = (userId: number, docId: string, version?: Date | number) =>
  `/api/users/${userId}/documents/${docId}/file${version ? `?v=${+version}` : ""}`

/**
 * Checks the bytes, not the name: a renamed executable is refused even when called
 * "passport.pdf". Returns the real MIME type to store and serve.
 */
export async function validateDocument(file: File): Promise<{ mime: string }> {
  if (file.size <= 0) throw new AttachmentRuleError(`"${safeDisplayName(file.name)}" is empty.`, 400)
  if (file.size > MAX_DOC_BYTES) throw new AttachmentRuleError(`"${safeDisplayName(file.name)}" exceeds the 25MB limit.`, 413)
  const ext = extensionOf(file.name)
  const head = new Uint8Array(await file.slice(0, 4100).arrayBuffer())
  const type = ALLOWED_EXTS.has(ext) ? detectType(head, file.name) : null
  if (!type || !type.accepts.includes(ext)) {
    throw new AttachmentRuleError(
      `"${safeDisplayName(file.name)}" is not a valid PDF, image (PNG, JPG, WebP), Word, Excel or CSV file.`,
      400,
    )
  }
  return { mime: type.mime }
}

export async function saveDocumentFile(docId: string, file: File) {
  await mkdir(HR_DOCS_ROOT, { recursive: true })
  await writeFile(storedPath(docId), Buffer.from(await file.arrayBuffer()))
}

/** Where a document's bytes are on disk, or null when the row points somewhere unexpected. */
export function documentDiskPath(doc: { id: string; fileUrl: string }): string | null {
  const url = doc.fileUrl.split("?")[0]
  if (url.startsWith(LEGACY_PREFIX)) {
    const full = path.resolve(LEGACY_ROOT, path.basename(url))
    return full.startsWith(LEGACY_ROOT + path.sep) ? full : null
  }
  return storedPath(doc.id)
}

export async function removeDocumentFile(doc: { id: string; fileUrl: string }) {
  if (doc.fileUrl.startsWith(LEGACY_PREFIX)) {
    await deleteLocalFile(doc.fileUrl)
    return
  }
  await rm(storedPath(doc.id), { force: true }).catch((error) =>
    console.error("[hr-documents] could not delete", doc.id, error),
  )
}

/** Where verifiers work through what is waiting. */
export const PENDING_DOCUMENTS_HREF = "/dashboard/documents"

/** Everyone who may verify documents: ADMIN, plus any active role holding users:approve. */
export async function documentVerifierIds(): Promise<number[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: {
        OR: [
          { name: "ADMIN" },
          { permissions: { some: { permission: { name: { in: namesSatisfying("users", "approve") } } } } },
        ],
      },
    },
    select: { id: true },
  })
  return users.map((u) => u.id)
}

/**
 * Tells every verifier that documents are waiting. Without this nobody learnt of an
 * upload unless they happened to open that employee's vault.
 * Never fails the upload: the documents are saved either way.
 */
export async function notifyVerifiers(ownerId: number, actorId: number, titles: string[]) {
  if (titles.length === 0) return
  try {
    const [owner, verifiers] = await Promise.all([
      prisma.user.findUnique({ where: { id: ownerId }, select: { name: true } }),
      documentVerifierIds(),
    ])
    const recipients = verifiers.filter((id) => id !== actorId)
    if (recipients.length === 0) return
    const what = titles.length === 1 ? `"${titles[0]}"` : `${titles.length} documents`
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        title: "Document waiting for verification",
        message: `${owner?.name ?? "An employee"} uploaded ${what}.`,
        link: PENDING_DOCUMENTS_HREF,
      })),
    })
  } catch (error) {
    console.error("[hr-documents] could not notify verifiers", error)
  }
}

/** Tells the employee their document was verified or rejected. */
export async function notifyOwner(
  doc: { userId: number; title: string },
  actorId: number,
  status: string,
  reason?: string | null,
) {
  if (doc.userId === actorId || (status !== "VERIFIED" && status !== "REJECTED")) return
  try {
    await prisma.notification.create({
      data: {
        userId: doc.userId,
        title: status === "VERIFIED" ? "Document verified" : "Document rejected",
        message:
          status === "VERIFIED"
            ? `"${doc.title}" was verified.`
            : `"${doc.title}" was rejected${reason ? `: ${reason}` : ""}. Upload a corrected file from your documents.`,
      },
    })
  } catch (error) {
    console.error("[hr-documents] could not notify owner", error)
  }
}

function storedPath(docId: string) {
  // cuid ids are alphanumeric; anything else is not one of ours.
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(docId)) throw new Error("Invalid document id")
  return path.join(HR_DOCS_ROOT, docId)
}
