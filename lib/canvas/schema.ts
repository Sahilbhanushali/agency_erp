import { z } from "zod"

/**
 * Everything a client may write to a board, validated before it is stored. Element
 * payloads are JSON in the database, so this is the only thing standing between a
 * request body and what other people's browsers render.
 */

export const ELEMENT_TYPES = ["IMAGE", "TEXT", "HEADING", "NOTE", "COLOR", "LINK", "SECTION"] as const
export type ElementType = (typeof ELEMENT_TYPES)[number]

const COORD = 20_000
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #1a2b3c")
const text = (max: number) => z.string().max(max)
/** http(s) only: no javascript:, data: or other schemes in anything rendered as a link. */
const webUrl = z
  .string()
  .trim()
  .max(2_000)
  .url("Enter a full link starting with https://")
  .refine((v) => /^https?:\/\//i.test(v), "Only http and https links are allowed")

export const elementDataSchemas = {
  IMAGE: z
    .object({
      /** Uploaded to private storage (served by /api/canvases/:id/images)… */
      storageKey: z.string().regex(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|gif|webp)$/).optional(),
      /** …or a public image on the web. */
      url: webUrl.optional(),
      alt: text(300).default(""),
      caption: text(300).default(""),
    })
    .strict()
    .refine((d) => !!d.storageKey !== !!d.url, "An image needs exactly one of an upload or a link"),
  TEXT: z
    .object({
      text: text(5_000).default(""),
      fontSize: z.number().int().min(10).max(72).default(16),
      color: hex.default("#0f172a"),
      align: z.enum(["left", "center", "right"]).default("left"),
      bold: z.boolean().default(false),
    })
    .strict(),
  HEADING: z
    .object({
      text: text(300).default("Heading"),
      fontSize: z.number().int().min(16).max(120).default(32),
      color: hex.default("#0f172a"),
    })
    .strict(),
  NOTE: z
    .object({
      text: text(2_000).default(""),
      color: hex.default("#fef08a"),
    })
    .strict(),
  COLOR: z
    .object({
      hex: hex,
      label: text(80).default(""),
    })
    .strict(),
  LINK: z
    .object({
      url: webUrl,
      title: text(200).default(""),
      description: text(500).default(""),
    })
    .strict(),
  SECTION: z
    .object({
      title: text(120).default("Section"),
      color: hex.default("#e2e8f0"),
    })
    .strict(),
} satisfies Record<ElementType, z.ZodTypeAny>

export const geometrySchema = z.object({
  x: z.number().finite().min(-COORD).max(COORD),
  y: z.number().finite().min(-COORD).max(COORD),
  width: z.number().finite().min(24).max(4_000),
  height: z.number().finite().min(24).max(4_000),
  z: z.number().int().min(-100_000).max(100_000),
})

export const createElementSchema = z
  .object({
    type: z.enum(ELEMENT_TYPES),
    data: z.record(z.unknown()),
  })
  .merge(geometrySchema.partial())
  .strict()

export const updateElementSchema = geometrySchema
  .partial()
  .extend({ data: z.record(z.unknown()).optional() })
  .strict()

export const batchGeometrySchema = z.object({
  elements: z.array(geometrySchema.partial().extend({ id: z.string().min(1).max(40) }).strict()).min(1).max(200),
})

/** Validates a payload for this element type, returning the normalized data or an error message. */
export function parseElementData(type: ElementType, data: unknown): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const result = elementDataSchemas[type].safeParse(data)
  if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? "Invalid element" }
  return { ok: true, data: result.data as Record<string, unknown> }
}

const linkIds = {
  clientId: z.string().max(40).nullable().optional(),
  projectId: z.string().max(40).nullable().optional(),
  postId: z.string().max(40).nullable().optional(),
}

export const createCanvasSchema = z
  .object({
    title: z.string().trim().min(1, "Give the board a title").max(160),
    description: z.string().trim().max(2_000).optional(),
    kind: z.enum(["CANVAS", "MOODBOARD"]).default("CANVAS"),
    ...linkIds,
  })
  .strict()

export const updateCanvasSchema = z
  .object({
    title: z.string().trim().min(1, "Give the board a title").max(160).optional(),
    description: z.string().trim().max(2_000).nullable().optional(),
    background: hex.optional(),
    ...linkIds,
  })
  .strict()

export const shareSchema = z
  .object({
    userId: z.number().int().positive(),
    role: z.enum(["VIEWER", "EDITOR"]).default("VIEWER"),
  })
  .strict()

export const commentSchema = z
  .object({
    body: z.string().trim().min(1, "Write a comment").max(2_000),
    elementId: z.string().max(40).nullable().optional(),
  })
  .strict()

/** Default size of a new element of each type. */
export const DEFAULT_SIZE: Record<ElementType, { width: number; height: number }> = {
  IMAGE: { width: 320, height: 240 },
  TEXT: { width: 280, height: 120 },
  HEADING: { width: 420, height: 70 },
  NOTE: { width: 220, height: 200 },
  COLOR: { width: 140, height: 160 },
  LINK: { width: 300, height: 120 },
  SECTION: { width: 700, height: 460 },
}

/**
 * The mood-board template: one titled section per part of the creative brief, laid out
 * in a grid, each with a note saying what belongs there.
 */
export const MOODBOARD_SECTIONS: { title: string; hint: string; color: string }[] = [
  { title: "Campaign theme & concept", hint: "The big idea in a sentence or two. What should people feel?", color: "#e0e7ff" },
  { title: "Visual direction", hint: "Mood, lighting, composition, photography vs illustration.", color: "#fce7f3" },
  { title: "Colour palette", hint: "Add colour swatches with their hex codes.", color: "#fef3c7" },
  { title: "Typography", hint: "Typefaces, weights and type pairings to use.", color: "#dcfce7" },
  { title: "Image inspiration", hint: "Drop reference images and photos here.", color: "#e0f2fe" },
  { title: "Design references", hint: "Layouts, past work and competitor examples worth learning from.", color: "#f3e8ff" },
  { title: "Creative style", hint: "Do's and don'ts: textures, motion, graphic elements.", color: "#ffedd5" },
  { title: "Content inspiration", hint: "Hooks, captions, formats and trends to try.", color: "#ccfbf1" },
  { title: "Notes & instructions", hint: "Brand guidelines, deadlines and anything the designer must know.", color: "#f1f5f9" },
]

export function moodboardElements(): { type: ElementType; x: number; y: number; width: number; height: number; z: number; data: Record<string, unknown> }[] {
  const cols = 3
  const w = 560
  const h = 420
  const gap = 40
  return MOODBOARD_SECTIONS.flatMap((section, i) => {
    const x = (i % cols) * (w + gap)
    const y = Math.floor(i / cols) * (h + gap)
    return [
      { type: "SECTION" as const, x, y, width: w, height: h, z: i * 2, data: { title: section.title, color: section.color } },
      {
        type: "NOTE" as const,
        x: x + 20,
        y: y + 56,
        width: 240,
        height: 140,
        z: i * 2 + 1,
        data: { text: section.hint, color: "#ffffff" },
      },
    ]
  })
}
