"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * The only interactive thing on the public document page, so `"use client"` stays on
 * this leaf rather than the whole page. Export is the browser's own print-to-PDF.
 */
export default function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  )
}
