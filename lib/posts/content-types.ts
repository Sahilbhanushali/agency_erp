/**
 * Post content types, shared by the API and the UI so the two can never disagree.
 * Values match the Prisma `PostType` enum.
 */

export const POST_CONTENT_TYPES = [
  { value: "PHOTO", label: "Photo" },
  { value: "REEL", label: "Reel" },
  { value: "STORY", label: "Story" },
  { value: "CAROUSEL", label: "Carousel" },
  { value: "BLOG", label: "LinkedIn / Article" },
  { value: "PPT", label: "PPT (Presentation)" },
  { value: "CUSTOM", label: "Custom" },
] as const

export type PostContentType = (typeof POST_CONTENT_TYPES)[number]["value"] | "UNKNOWN"

export const contentTypeLabel = (type: string) =>
  POST_CONTENT_TYPES.find((t) => t.value === type)?.label ?? type.charAt(0) + type.slice(1).toLowerCase()

/**
 * Presentations are an internal marketing deliverable, not a social format: they go
 * through approval like everything else but are never handed to a platform publisher.
 */
export const isSocialPublishable = (type: string) => type !== "PPT"

export const PRESENTATION_MIME_TYPES = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const

export const PRESENTATION_EXTENSIONS = [".ppt", ".pptx"] as const

/** Browsers often send .ppt/.pptx as application/octet-stream, so the extension counts too. */
export function isPresentationFile(file: { name: string; type: string }) {
  const name = file.name.toLowerCase()
  return (
    (PRESENTATION_MIME_TYPES as readonly string[]).includes(file.type) ||
    PRESENTATION_EXTENSIONS.some((ext) => name.endsWith(ext))
  )
}

export const isPresentationUrl = (url: string) =>
  PRESENTATION_EXTENSIONS.some((ext) => url.toLowerCase().split("?")[0].endsWith(ext))
