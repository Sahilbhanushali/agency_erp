import type { Metadata } from "next"
import { CanvasList } from "@/components/canvas/canvas-list"

export const metadata: Metadata = { title: "Canvas & Mood Boards" }

export default function CanvasPage() {
  return <CanvasList />
}
