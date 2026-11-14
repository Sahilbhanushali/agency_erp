import type { Metadata } from "next"
import { CanvasEditor } from "@/components/canvas/canvas-editor"

export const metadata: Metadata = { title: "Board" }

export default async function CanvasBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CanvasEditor canvasId={id} />
}
