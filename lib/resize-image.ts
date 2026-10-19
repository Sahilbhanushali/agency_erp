/**
 * Downscale an image in the browser before uploading it.
 *
 * Why this exists: jsPDF embeds images as raw pixels, so a logo's *dimensions* decide
 * how big the payslip PDF becomes, not its file size. A 3605x3706 PNG — only 218KB on
 * disk — becomes roughly 53MB of pixel data, and the resulting payslip is far too large
 * to email. The server therefore refuses oversized images, but refusing is a poor
 * answer on its own: it asks the person to go and find an image editor.
 *
 * Resizing here means they simply pick their logo and it works. Canvas is a native
 * browser API, so this needs no dependency, and PNG output preserves the transparency a
 * logo relies on.
 *
 * The server keeps its own limit regardless — this runs on the client and client-side
 * checks are a convenience, never a guarantee.
 */
export async function resizeImageFile(
  file: File,
  maxEdge = 512,
): Promise<{ file: File; resized: boolean; from?: { width: number; height: number } }> {
  // Nothing to do for formats canvas cannot read back losslessly, or in a non-browser
  // context. Returning the original lets the caller upload it unchanged.
  if (typeof document === "undefined" || !file.type.startsWith("image/")) {
    return { file, resized: false }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // An unreadable image is the server's problem to report, with its proper message.
    return { file, resized: false }
  }

  const { width, height } = bitmap
  if (width <= maxEdge && height <= maxEdge) {
    bitmap.close()
    return { file, resized: false }
  }

  const scale = maxEdge / Math.max(width, height)
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = targetWidth
  canvas.height = targetHeight

  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    return { file, resized: false }
  }

  // Left transparent rather than filled: a logo drawn onto white would show a white
  // box on a dark payslip header.
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  )
  if (!blob) return { file, resized: false }

  const name = file.name.replace(/\.[^.]+$/, "") + ".png"
  return {
    file: new File([blob], name, { type: "image/png", lastModified: Date.now() }),
    resized: true,
    from: { width, height },
  }
}
