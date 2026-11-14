import { useState } from "react";
import { AlertCircle, Link as LinkIcon } from "lucide-react";
import MediaRenderer from "@/components/MediaRenderer";
import { PresentationFileCard, isPresentationAsset } from "@/components/posts/presentation-file-card";
import { getMediaUrl, getGoogleDriveEmbedUrl } from "@/lib/utils";

interface MediaWithFallbackProps {
  asset: any;
  isVideo: boolean;
  onPlay?: () => void;
  className?: string;
  onImageClick?: (url: string, filename: string) => void;
}

export default function MediaWithFallback({
  asset,
  isVideo,
  onPlay,
  className = "",
  onImageClick,
}: MediaWithFallbackProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = (error: any) => {
    console.error(`Failed to load media for ${asset.url}:`, error);
    setHasError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const formatUrl = (url: string) => {
    return getMediaUrl(url);
  };

  const formattedUrl = `${formatUrl(asset.url)}?t=${asset.createdAt ? new Date(asset.createdAt).getTime() : Date.now()}`;

  if (asset.type === 'link') {
    const embedUrl = getGoogleDriveEmbedUrl(asset.url);
    if (embedUrl) {
      return (
        <div className="flex flex-col w-full h-full border border-border rounded overflow-hidden">
          <div className="flex-1 relative">
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full border-0 object-cover"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title={asset.filename || "Google Drive Video"}
            />
          </div>
          <div className="bg-muted/50 p-2 border-t border-border flex items-center gap-2 shrink-0">
            <LinkIcon className="h-4 w-4 text-blue-500 shrink-0" />
            <a 
              href={asset.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline truncate"
              title={asset.url}
            >
              {asset.filename || "Google Drive Link"}
            </a>
          </div>
        </div>
      );
    }

    return (
      <a 
        href={asset.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex flex-col items-center justify-center h-full w-full bg-muted/30 hover:bg-muted/50 transition-colors border border-border rounded p-4 group"
      >
        <LinkIcon className="h-10 w-10 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
        <span className="text-blue-600 text-sm font-medium text-center break-words line-clamp-2 w-full px-2">
          {asset.filename || "External Link"}
        </span>
      </a>
    );
  }

  // Presentations have no in-browser renderer: show the file with a download link
  // (and never the "Loading..." overlay, which would wait forever for an onLoad).
  if (isPresentationAsset(asset)) {
    return <PresentationFileCard asset={asset} className={className} />;
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-destructive/5 to-destructive/10 border border-border rounded">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <span className="text-destructive text-sm font-medium">Failed to load media</span>
        <span className="text-destructive/80 text-xs mt-1">{asset.filename}</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
          <div className="text-muted-foreground text-sm">Loading...</div>
        </div>
      )}
      <MediaRenderer
        asset={{ ...asset, url: formattedUrl }}
        controls={isVideo}
        onError={handleError}
        onLoad={handleLoad}
        onImageClick={onImageClick}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        crossOrigin="anonymous"
        loading="lazy"
      />
    </div>
  );
}
