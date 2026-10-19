/**
 * Pixel dimensions of a PNG or JPEG, read straight from the file header.
 *
 * Deliberately dependency-free. The one thing this is needed for is refusing a logo too
 * large to embed in a PDF: jsPDF stores images as raw pixels, so a 1500×1500 PNG — only
 * 55KB on disk — becomes 1500 × 1500 × 4 = 9MB inside the document. A payslip that size
 * is rejected by most mail servers, so the limit has to be enforced on dimensions
 * rather than file size.
 *
 * Returns null when the format is not recognised; callers decide what that means.
 */
export function imageDimensions(buffer: Buffer): { width: number; height: number } | null {
  // PNG: 8-byte signature, then the IHDR chunk whose width/height are big-endian u32.
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }

  // JPEG: walk the segment markers to the start-of-frame, which carries the size.
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++
        continue
      }
      const marker = buffer[offset + 1]
      // SOF0..SOF3 and SOF5..SOF15, excluding the non-frame markers in that range.
      const isStartOfFrame =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      if (isStartOfFrame) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        }
      }
      const segmentLength = buffer.readUInt16BE(offset + 2)
      if (segmentLength < 2) return null
      offset += 2 + segmentLength
    }
  }

  return null
}
