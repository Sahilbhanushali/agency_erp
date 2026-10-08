import { useState, useRef, useEffect } from "react";
import { getMediaUrl } from "@/lib/utils";

interface Asset {
  id: string;
  filename: string;
  url: string;
  contentType?: string;
}

interface MediaRendererProps {
  asset: Asset;
  controls?: boolean;
  onPlay?: (assetId: string) => void;
  onError?: (error: any) => void;
  onLoad?: () => void;
  className?: string;
  crossOrigin?: "anonymous" | "use-credentials" | "";
  loading?: "eager" | "lazy";
  "data-video-id"?: string;
  onImageClick?: (url: string, filename: string) => void;
  objectFit?: 'contain' | 'cover' | 'fill' | 'scale-down' | 'none';
  showFitControl?: boolean; // New prop to show fit control outside fullscreen
}

export default function MediaRenderer({
  asset,
  controls = true,
  onPlay,
  onError,
  onLoad,
  className = "",
  crossOrigin,
  loading,
  onImageClick,
  objectFit: initialObjectFit = 'contain',
  showFitControl = true, // Default to true to always show fit control
  ...props
}: MediaRendererProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentObjectFit, setCurrentObjectFit] = useState<'contain' | 'cover' | 'fill' | 'scale-down' | 'none'>(initialObjectFit);
  const [showFitOptions, setShowFitOptions] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const isVideo = asset.contentType?.startsWith("video/") ||
                  asset.contentType?.includes('video') ||
                  /\.(mp4|mov|webm|avi|mkv|m4v|ogv|flv|wmv|3gp|mpeg|mpg|m2v|mts|m2ts|ts|vob|f4v|asf|qt)$/i.test(asset.filename);
  
  const getVideoType = (filename: string, contentType?: string): string => {
    if (contentType?.startsWith('video/')) return contentType;
    
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'mp4': 'video/mp4',
      'm4v': 'video/mp4',
      'webm': 'video/webm',
      'ogv': 'video/ogg',
      'ogg': 'video/ogg',
      'mov': 'video/quicktime',
      'qt': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'wmv': 'video/x-ms-wmv',
      'flv': 'video/x-flv',
      'mkv': 'video/x-matroska',
      '3gp': 'video/3gpp',
      'mpeg': 'video/mpeg',
      'mpg': 'video/mpeg',
      'ts': 'video/mp2t',
      'mts': 'video/mp2t',
      'm2ts': 'video/mp2t'
    };
    
    return mimeTypes[ext || ''] || 'video/mp4';
  };
  
  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);
  
  const handleError = (e: any) => {
    console.warn("Media loading error:", e);
    const videoType = getVideoType(asset.filename, asset.contentType);
    setError(`Unable to play this video format. Your browser may not support ${videoType}. Try converting to MP4 (H.264) for best compatibility.`);
    if (onError) onError(e);
  };
  
  const handleLoad = () => {
    setError(null);
    if (onLoad) onLoad();
  };
  
  const handlePlay = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsPlaying(true);
    if (onPlay) onPlay(asset.id);
  };
  
  const handlePause = () => {
    setIsPlaying(false);
  };
  
  const handleImageClick = () => {
    if (!isVideo && onImageClick) {
      onImageClick(formatUrl(asset.url), asset.filename);
    }
  };
  
  const formatUrl = (url: string) => {
    return getMediaUrl(url);
  };
  
  const changeFit = (fit: typeof currentObjectFit) => {
    setCurrentObjectFit(fit);
    setShowFitOptions(false);
  };
  
  const fitOptions: Array<{value: typeof currentObjectFit, label: string, desc: string}> = [
    { value: 'contain', label: 'Fit', desc: 'Show entire video' },
    { value: 'cover', label: 'Fill', desc: 'Fill screen (crop)' },
    { value: 'fill', label: 'Stretch', desc: 'Stretch to fit' },
    { value: 'scale-down', label: 'Scale Down', desc: 'Smaller of fit/actual' },
    { value: 'none', label: 'Original', desc: 'Original size' }
  ];
  
  const formattedUrl = formatUrl(asset.url);
  const videoType = getVideoType(asset.filename, asset.contentType);
  const mediaClassName = `w-full h-full rounded ${className} object-${currentObjectFit}`;
  
  return (
    <div ref={containerRef} className="w-full h-full relative bg-black rounded">
      {error ? (
        <div className="flex flex-col items-center justify-center w-full h-full bg-gray-900 text-gray-300 text-sm p-4 rounded">
          <svg className="w-12 h-12 mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-center">{error}</p>
          <p className="text-xs text-gray-500 mt-2">File: {asset.filename}</p>
        </div>
      ) : isVideo ? (
        <div className="relative w-full h-full group">
          <video
            ref={videoRef}
            src={formattedUrl}
            controls={controls}
            className={mediaClassName}
            onError={handleError}
            onLoadedData={handleLoad}
            onCanPlay={handleLoad}
            onPlay={handlePlay}
            onPause={handlePause}
            preload="metadata"
            playsInline
            crossOrigin={crossOrigin}
            {...props}
          >
            <source src={formattedUrl} type={videoType} />
            Your browser does not support the video tag. Supported formats: MP4 (H.264/H.265), WebM (VP8/VP9), and OGV (Theora).
          </video>
          
          {/* Fit Control Button (shows when enabled) */}
          {(showFitControl || isFullscreen) && (
            <div className={`absolute ${isFullscreen ? 'top-4 right-4' : 'top-2 right-2'} z-50`}>
              <button
                onClick={() => setShowFitOptions(!showFitOptions)}
                className={`bg-black/70 hover:bg-black/90 text-white ${
                  isFullscreen ? 'px-4 py-2' : 'px-3 py-1.5'
                } rounded-lg flex items-center gap-2 transition-all backdrop-blur-sm border border-white/20`}
              >
                <svg className={`${isFullscreen ? 'w-5 h-5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span className={`font-medium ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                  {fitOptions.find(o => o.value === currentObjectFit)?.label}
                </span>
              </button>
              
              {/* Fit Options Dropdown */}
              {showFitOptions && (
                <div className={`absolute top-full ${isFullscreen ? 'right-0 mt-2' : 'right-0 mt-1'} bg-black/90 backdrop-blur-md rounded-lg overflow-hidden shadow-2xl border border-white/20 ${
                  isFullscreen ? 'min-w-[200px]' : 'min-w-[180px]'
                } z-[60]`}>
                  {fitOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => changeFit(option.value)}
                      className={`w-full text-left ${
                        isFullscreen ? 'px-4 py-3' : 'px-3 py-2'
                      } hover:bg-white/10 transition-colors border-b border-white/10 last:border-b-0 ${
                        currentObjectFit === option.value ? 'bg-white/20' : ''
                      }`}
                    >
                      <div className={`text-white font-medium ${isFullscreen ? 'text-sm' : 'text-xs'}`}>{option.label}</div>
                      <div className={`text-gray-400 ${isFullscreen ? 'text-sm' : 'text-xs'}`}>{option.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Video Info Overlay (appears on hover, not in fullscreen) */}
          {!isFullscreen && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <p className="text-white text-xs truncate">{asset.filename}</p>
              <p className="text-gray-300 text-xs">{videoType}</p>
            </div>
          )}
        </div>
      ) : (
        <img
          className={`${mediaClassName} cursor-pointer hover:opacity-90 transition-opacity`}
          src={formattedUrl}
          alt={asset.filename}
          onError={handleError}
          onLoad={handleLoad}
          onClick={handleImageClick}
          crossOrigin={crossOrigin}
          loading={loading}
        />
      )}
    </div>
  );
}