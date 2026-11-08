"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { Loader2, Upload, FileImage, PenTool, Check, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface DocumentBrandingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  companyName: string
  currentLetterhead?: string | null
  currentSignature?: string | null
  onSuccess?: () => void
}

export function DocumentBrandingModal({
  open,
  onOpenChange,
  companyId,
  companyName,
  currentLetterhead,
  currentSignature,
  onSuccess,
}: DocumentBrandingModalProps) {
  const router = useRouter()
  const [letterhead, setLetterhead] = useState<string>(currentLetterhead || "")
  const [signature, setSignature] = useState<string>(currentSignature || "")
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const letterheadRef = useRef<HTMLInputElement>(null)
  const signatureRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File, type: "letterhead" | "signature") => {
    setUploadingField(type)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", type)

      const response = await fetch("/api/companies/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error || "Failed to upload image")
        return
      }

      if (type === "letterhead") {
        setLetterhead(data.url)
      } else {
        setSignature(data.url)
      }
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded!`)
    } catch {
      toast.error("Network error while uploading")
    } finally {
      setUploadingField(null)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          letterhead: letterhead || "",
          signature: signature || "",
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error || "Failed to update branding")
        return
      }

      toast.success("Document template branding updated!")
      onOpenChange(false)
      onSuccess?.()
      router.refresh()
    } catch {
      toast.error("Network error saving branding")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileImage className="size-4 text-primary" />
            Letterhead &amp; Signature Settings
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure header letterhead and authorised signature for {companyName}. This template automatically applies to all quotations and invoices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Letterhead Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <FileImage className="size-3.5 text-primary" />
                Letterhead Banner
              </Label>
              {letterhead && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setLetterhead("")}
                  className="text-xs text-destructive hover:bg-destructive/10"
                >
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Displays as the official header across the top of quotation and invoice pages.
            </p>

            {letterhead ? (
              <div className="relative rounded-lg border border-border bg-muted/20 p-2 overflow-hidden">
                <img
                  src={letterhead}
                  alt="Letterhead preview"
                  className="w-full h-20 object-contain rounded bg-white"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => letterheadRef.current?.click()}
                  disabled={uploadingField === "letterhead"}
                  className="mt-2 w-full text-xs"
                >
                  {uploadingField === "letterhead" ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : null}
                  Replace Letterhead
                </Button>
              </div>
            ) : (
              <div
                onClick={() => letterheadRef.current?.click()}
                className="flex flex-col items-center justify-center p-4 rounded-lg border border-dashed border-border bg-card/60 hover:bg-card cursor-pointer transition-colors"
              >
                {uploadingField === "letterhead" ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <>
                    <Upload className="size-5 text-muted-foreground mb-1" />
                    <p className="text-xs font-medium text-foreground">Click to upload Letterhead</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG or WEBP (1200x200px recommended)</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={letterheadRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file, "letterhead")
              }}
            />
          </div>

          {/* Authorised Signature Upload */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <PenTool className="size-3.5 text-primary" />
                Authorised Signature
              </Label>
              {signature && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setSignature("")}
                  className="text-xs text-destructive hover:bg-destructive/10"
                >
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Printed in the footer above &quot;Authorised Signatory&quot;.
            </p>

            {signature ? (
              <div className="relative rounded-lg border border-border bg-muted/20 p-2 overflow-hidden text-center">
                <img
                  src={signature}
                  alt="Signature preview"
                  className="h-14 w-auto object-contain mx-auto bg-white/60 rounded p-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => signatureRef.current?.click()}
                  disabled={uploadingField === "signature"}
                  className="mt-2 w-full text-xs"
                >
                  {uploadingField === "signature" ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : null}
                  Replace Signature
                </Button>
              </div>
            ) : (
              <div
                onClick={() => signatureRef.current?.click()}
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-border bg-card/60 hover:bg-card cursor-pointer transition-colors"
              >
                {uploadingField === "signature" ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <>
                    <PenTool className="size-4 text-muted-foreground mb-1" />
                    <p className="text-xs font-medium text-foreground">Click to upload Signature</p>
                    <p className="text-xs text-muted-foreground">Transparent PNG recommended</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={signatureRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file, "signature")
              }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !!uploadingField}>
            {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Check className="size-3.5 mr-1.5" />}
            Save Branding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
