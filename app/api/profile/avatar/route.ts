import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

/** Image types only — anything else here would be written into a public directory. */
const ALLOWED = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
])

const MAX_BYTES = 3 * 1024 * 1024

/**
 * Upload the signed-in user's own profile picture.
 *
 * Scoped to the session and takes no user id, so there is nothing to tamper with — this
 * endpoint can only ever change the caller's own avatar. `PUT /api/profile` already
 * accepted an `avatar` string, but nothing could produce one: there was no upload path
 * and no control in the UI, so the field was unreachable.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const current = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { avatar: true },
    })
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get("avatar")

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose an image to upload" }, { status: 422 })
    }

    // The extension comes from the declared type, never the client's filename.
    const extension = ALLOWED.get(file.type)
    if (!extension) {
      return NextResponse.json(
        { error: "Profile picture must be a PNG, JPEG or WebP image" },
        { status: 422 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Profile picture must be 3MB or smaller" }, { status: 422 })
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars")
    await fs.mkdir(uploadDir, { recursive: true })

    const filename = `user-${auth.userId}-${Date.now()}${extension}`
    await fs.writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()))
    const avatar = `/uploads/avatars/${filename}`

    await prisma.user.update({ where: { id: auth.userId }, data: { avatar } })

    // Clear away the picture this one replaced. Best effort: a leftover file is
    // untidy, but failing to delete it must not fail the upload.
    if (current.avatar?.startsWith("/uploads/avatars/")) {
      await fs.unlink(path.join(process.cwd(), "public", current.avatar)).catch(() => undefined)
    }

    return NextResponse.json({ avatar })
  } catch (error) {
    console.error("[profile/avatar] upload failed:", error)
    return NextResponse.json({ error: "Could not upload the picture" }, { status: 500 })
  }
}

/** Remove the caller's profile picture. */
export async function DELETE() {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  try {
    const current = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { avatar: true },
    })
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.user.update({ where: { id: auth.userId }, data: { avatar: null } })

    if (current.avatar?.startsWith("/uploads/avatars/")) {
      await fs.unlink(path.join(process.cwd(), "public", current.avatar)).catch(() => undefined)
    }

    return NextResponse.json({ removed: true })
  } catch (error) {
    console.error("[profile/avatar] remove failed:", error)
    return NextResponse.json({ error: "Could not remove the picture" }, { status: 500 })
  }
}
