"use client";

import { Dialog, DialogContent, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { X, Download, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { getMediaUrl, getGoogleDriveEmbedUrl } from "@/lib/utils";

interface MediaPopupProps {
  isOpen: boolean;
  onClose: () => void;
  asset: {
    url: string;
    filename: string;
    type: string;
  } | null;
}

export default function MediaPopup({ isOpen, onClose, asset }: MediaPopupProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // Reset image error when asset changes
    setImageError(false);
  }, [asset]);

  if (!asset) return null;

  const mediaUrl = getMediaUrl(asset.url);
  const embedUrl = asset.type === 'link' ? getGoogleDriveEmbedUrl(asset.url) : null;

  const cleanUrl = (asset.url || "").split("?")[0].split("#")[0];
  const urlExt = cleanUrl.toLowerCase().split(".").pop() || "";
  const fnExt = (asset.filename || "").toLowerCase().split(".").pop() || "";

  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"];
  const videoExtensions = ["mp4", "mov", "avi", "mkv", "webm", "ogv"];

  const isImage =
    asset.type === "image" ||
    asset.type === "IMAGE" ||
    asset.type?.startsWith("image/") ||
    imageExtensions.includes(fnExt) ||
    imageExtensions.includes(urlExt);

  const isVideo =
    asset.type === "video" ||
    asset.type === "VIDEO" ||
    asset.type?.startsWith("video/") ||
    videoExtensions.includes(fnExt) ||
    videoExtensions.includes(urlExt);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 border-0 bg-transparent">
        <DialogTitle className="sr-only">Media Popup</DialogTitle>
        <div className="relative bg-gray-400 rounded-lg overflow-hidden flex flex-col justify-center min-h-[40vh]">
          <div className="absolute top-2 right-2 flex space-x-2 z-10">
            <a
              href={asset.type === 'link' ? asset.url : mediaUrl}
              download={asset.type !== 'link' ? asset.filename : undefined}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white hover:bg-gray-800 transition-colors"
              title={asset.type === 'link' ? "Open Link" : "Download asset"}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="w-6 h-6" />
            </a>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:text-white hover:bg-gray-800"
              >
                <X className="w-6 h-6" />
              </Button>
            </DialogClose>
          </div>

          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-[80vh] border-0"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title={asset.filename || "Google Drive Embed"}
            />
          ) : asset.type === 'link' ? (
            <div className="flex flex-col items-center justify-center h-[50vh] bg-gray-800 text-white">
              <LinkIcon className="h-16 w-16 text-blue-400 mb-4" />
              <span className="text-lg font-medium">{asset.filename || "External Link"}</span>
              <a 
                href={asset.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-semibold transition-colors"
              >
                Open Link in New Tab
              </a>
            </div>
          ) : isImage && !imageError ? (
            <img
              src={mediaUrl}
              alt={asset.filename}
              className="w-full h-auto max-h-[80vh] object-contain"
              onError={() => setImageError(true)}
            />
          ) : isImage && imageError ? (
            <div className="flex items-center justify-center h-[80vh] bg-gray-800 text-white">
              <span className="text-sm">Image Failed to Load</span>
            </div>
          ) : isVideo ? (
            <video
              controls
              autoPlay
              className="w-full h-auto max-h-[80vh] object-contain"
            >
              <source src={mediaUrl} type={`video/${asset.filename.split(".").pop()?.toLowerCase()}`} />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="flex items-center justify-center h-[80vh] bg-gray-800 text-white">
              <span className="text-sm">Unsupported Media Type</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}