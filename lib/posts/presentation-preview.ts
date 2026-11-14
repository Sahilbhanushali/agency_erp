import JSZip from "jszip"

/**
 * Server-side preview of a .pptx: its embedded first-slide thumbnail, and each slide's
 * text and first picture. There is no slide renderer on the server (no LibreOffice), so
 * this is what can be shown faithfully without one. Legacy binary .ppt is not a zip and
 * is offered as a download only.
 */

export const MAX_PREVIEW_BYTES = 100 * 1024 * 1024
const MAX_SLIDES = 200
const MAX_TEXT_PER_SLIDE = 2_000

export interface SlideSummary {
  index: number
  title: string | null
  paragraphs: string[]
  hasImage: boolean
}

export interface PresentationSummary {
  previewable: true
  slideCount: number
  hasThumbnail: boolean
  slides: SlideSummary[]
}

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
}

export const imageContentType = (name: string) => IMAGE_TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ?? null

const decodeXml = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")

/** Paragraphs of visible text in one slide's XML, in document order. */
export function slideParagraphs(xml: string): string[] {
  const paragraphs: string[] = []
  let total = 0
  for (const para of xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? []) {
    const runs = [...para.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1]))
    const line = runs.join("").trim()
    if (!line) continue
    total += line.length
    if (total > MAX_TEXT_PER_SLIDE) break
    paragraphs.push(line)
  }
  return paragraphs
}

/** The slide's title placeholder text, if it has one. */
function slideTitle(xml: string): string | null {
  for (const shape of xml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) ?? []) {
    if (/<p:ph\b[^>]*type="(?:title|ctrTitle)"/.test(shape)) {
      const text = slideParagraphs(shape).join(" ").trim()
      if (text) return text
    }
  }
  return null
}

/** Slide part names in presentation order (slide2 before slide10). */
function slidePaths(zip: JSZip): string[] {
  return Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)?.[1]) - Number(b.match(/(\d+)\.xml$/)?.[1]))
    .slice(0, MAX_SLIDES)
}

/** Zip path of the first web-displayable picture a slide references. */
async function firstSlideImage(zip: JSZip, slidePath: string): Promise<string | null> {
  const relsPath = slidePath.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels")
  const rels = await zip.file(relsPath)?.async("string")
  if (!rels) return null
  for (const match of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const tag = match[0]
    if (!/Type="[^"]*\/image"/.test(tag) || /TargetMode="External"/.test(tag)) continue
    const target = tag.match(/Target="([^"]+)"/)?.[1]
    if (!target) continue
    // Targets are relative to ppt/slides/; resolve "../media/x.png" to "ppt/media/x.png".
    const resolved = new URL(target, "zip://pkg/ppt/slides/").pathname.replace(/^\//, "")
    if (imageContentType(resolved) && zip.file(resolved)) return resolved
  }
  return null
}

export async function openPresentation(buffer: Buffer): Promise<JSZip | null> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    return zip.file("[Content_Types].xml") && zip.file("ppt/presentation.xml") ? zip : null
  } catch {
    return null
  }
}

export async function summarizePresentation(zip: JSZip): Promise<PresentationSummary> {
  const paths = slidePaths(zip)
  const slides = await Promise.all(
    paths.map(async (slidePath, i) => {
      const xml = (await zip.file(slidePath)?.async("string")) ?? ""
      return {
        index: i + 1,
        title: slideTitle(xml),
        paragraphs: slideParagraphs(xml),
        hasImage: (await firstSlideImage(zip, slidePath)) !== null,
      }
    }),
  )
  return {
    previewable: true,
    slideCount: paths.length,
    hasThumbnail: !!zip.file("docProps/thumbnail.jpeg"),
    slides,
  }
}

/** The embedded thumbnail, or one slide's first picture (1-based), with its MIME type. */
export async function presentationImage(
  zip: JSZip,
  part: { kind: "thumbnail" } | { kind: "slide"; index: number },
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (part.kind === "thumbnail") {
    const file = zip.file("docProps/thumbnail.jpeg")
    return file ? { bytes: await file.async("nodebuffer"), contentType: "image/jpeg" } : null
  }
  const slidePath = slidePaths(zip)[part.index - 1]
  if (!slidePath) return null
  const imagePath = await firstSlideImage(zip, slidePath)
  const type = imagePath ? imageContentType(imagePath) : null
  const file = imagePath ? zip.file(imagePath) : null
  return file && type ? { bytes: await file.async("nodebuffer"), contentType: type } : null
}
