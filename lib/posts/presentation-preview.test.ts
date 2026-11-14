// Run: npm run test:presentation (Node strips the types; no extra tooling)
import { test } from "node:test"
import assert from "node:assert/strict"
import JSZip from "jszip"
import {
  openPresentation,
  presentationImage,
  slideParagraphs,
  summarizePresentation,
} from "./presentation-preview.ts"

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
)

const slide = (title: string, body: string[]) => `<?xml version="1.0"?>
<p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp>
  <p:sp><p:txBody>${body.map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`).join("")}<a:p></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`

async function buildDeck(): Promise<Buffer> {
  const zip = new JSZip()
  zip.file("[Content_Types].xml", "<Types/>")
  zip.file("ppt/presentation.xml", "<p:presentation/>")
  zip.file("docProps/thumbnail.jpeg", Buffer.from([0xff, 0xd8, 0xff]))
  // slide10 before slide2 alphabetically: order must follow the number.
  zip.file("ppt/slides/slide1.xml", slide("Campaign &amp; Concept", ["Bold colours", "Summer drop"]))
  zip.file("ppt/slides/slide2.xml", slide("Palette", ["#FF6600"]))
  zip.file("ppt/slides/slide10.xml", slide("Thanks", []))
  zip.file(
    "ppt/slides/_rels/slide2.xml.rels",
    `<Relationships><Relationship Id="r1" Type="http://schemas/relationships/image" Target="../media/image1.png"/></Relationships>`,
  )
  zip.file("ppt/media/image1.png", PNG)
  return zip.generateAsync({ type: "nodebuffer" })
}

test("summarizes slides in numeric order with titles, text and images", async () => {
  const zip = await openPresentation(await buildDeck())
  assert.ok(zip)
  const summary = await summarizePresentation(zip)
  assert.equal(summary.slideCount, 3)
  assert.equal(summary.hasThumbnail, true)
  assert.deepEqual(summary.slides.map((s) => s.title), ["Campaign & Concept", "Palette", "Thanks"])
  assert.deepEqual(summary.slides[0].paragraphs, ["Campaign & Concept", "Bold colours", "Summer drop"])
  assert.deepEqual(summary.slides.map((s) => s.hasImage), [false, true, false])
})

test("returns the thumbnail and a slide's picture with their types", async () => {
  const zip = await openPresentation(await buildDeck())
  assert.ok(zip)
  assert.equal((await presentationImage(zip, { kind: "thumbnail" }))?.contentType, "image/jpeg")
  const picture = await presentationImage(zip, { kind: "slide", index: 2 })
  assert.equal(picture?.contentType, "image/png")
  assert.deepEqual(picture?.bytes, PNG)
  assert.equal(await presentationImage(zip, { kind: "slide", index: 1 }), null)
  assert.equal(await presentationImage(zip, { kind: "slide", index: 99 }), null)
})

test("rejects files that are not presentations", async () => {
  assert.equal(await openPresentation(Buffer.from("not a zip")), null)
  const other = new JSZip()
  other.file("word/document.xml", "<w/>")
  assert.equal(await openPresentation(await other.generateAsync({ type: "nodebuffer" })), null)
})

test("decodes entities and skips empty paragraphs", () => {
  assert.deepEqual(
    slideParagraphs("<a:p><a:r><a:t>A &lt;b&gt; &#8364;5</a:t></a:r></a:p><a:p><a:r><a:t>  </a:t></a:r></a:p>"),
    ["A <b> €5"],
  )
})
