"use client"

import { useState } from "react"
import useSWR from "swr"
import { AlertCircle, Download, Eye, ImageOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { getMediaUrl } from "@/lib/utils"
import type { PresentationSummary } from "@/lib/posts/presentation-preview"

type PreviewResponse = PresentationSummary | { previewable: false; reason: string }

const fetcher = async (url: string): Promise<PreviewResponse> => {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? "Could not load the preview")
  return body as PreviewResponse
}

/**
 * Slide-by-slide preview of a .pptx for reviewers: the deck's own thumbnail, then each
 * slide's title, text and first picture. Fetched only when opened.
 */
export function PresentationPreviewButton({
  postId,
  asset,
}: {
  postId: string
  asset: { id: string; url: string; filename?: string | null }
}) {
  const [open, setOpen] = useState(false)
  const base = `/api/posts/${postId}/assets/${asset.id}/preview`
  const { data, error, isLoading, mutate } = useSWR(open ? `${base}?part=summary` : null, fetcher, {
    revalidateOnFocus: false,
  })
  const name = asset.filename ?? "Presentation"

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="min-h-9 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
        aria-label={`Preview slides of ${name}`}
      >
        <Eye className="size-3.5" aria-hidden="true" />
        Preview
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-all pr-6">{name}</DialogTitle>
            <DialogDescription>
              {data && data.previewable
                ? `${data.slideCount} slide${data.slideCount === 1 ? "" : "s"} · text and pictures from each slide. Download the file for the full design.`
                : "Slide preview"}
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="space-y-3" aria-busy="true" aria-label="Loading preview">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {error && (
            <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
              <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
              <p className="text-sm text-foreground">{error.message}</p>
              <Button size="sm" variant="outline" onClick={() => mutate()}>Try again</Button>
            </div>
          )}

          {data && !data.previewable && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/40 p-6 text-center">
              <ImageOff className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-foreground">{data.reason}</p>
            </div>
          )}

          {data && data.previewable && (
            <div className="space-y-4">
              {data.hasThumbnail && (
                // eslint-disable-next-line @next/next/no-img-element -- authenticated API image, not a static asset
                <img
                  src={`${base}?part=thumbnail`}
                  alt={`First slide of ${name}`}
                  className="w-full rounded-lg border border-border bg-muted object-contain"
                />
              )}
              {data.slideCount === 0 ? (
                <p className="text-sm text-muted-foreground">This presentation has no slides.</p>
              ) : (
                <ol className="space-y-3">
                  {data.slides.map((slide) => (
                    <li key={slide.index} className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Slide {slide.index}
                      </p>
                      {slide.title && <p className="mt-1 font-medium text-foreground">{slide.title}</p>}
                      {slide.hasImage && (
                        // eslint-disable-next-line @next/next/no-img-element -- authenticated API image, not a static asset
                        <img
                          src={`${base}?part=slide&slide=${slide.index}`}
                          alt={`Picture on slide ${slide.index}`}
                          loading="lazy"
                          className="mt-2 max-h-56 rounded-md border border-border object-contain"
                        />
                      )}
                      {slide.paragraphs.filter((p) => p !== slide.title).length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-foreground/90">
                          {slide.paragraphs
                            .filter((p) => p !== slide.title)
                            .map((paragraph, i) => (
                              <li key={i} className="whitespace-pre-wrap break-words">{paragraph}</li>
                            ))}
                        </ul>
                      ) : (
                        !slide.hasImage && !slide.title && (
                          <p className="mt-1 text-xs text-muted-foreground">No text on this slide.</p>
                        )
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button asChild variant="outline" size="sm" className="min-h-9 gap-1.5">
              <a href={getMediaUrl(asset.url)} download={name}>
                <Download className="size-3.5" aria-hidden="true" />
                Download
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
