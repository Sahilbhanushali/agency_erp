import { useState, useRef, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, PenTool, Eraser, Download, Save, Type } from "lucide-react";
import toast from "react-hot-toast";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt: string;
  postId?: string;
  assetId?: string;
  onSaveSuccess?: () => void;
  onCustomerSave?: (annotatedImageData: string) => Promise<void> | void;
}

export default function ImageModal({ 
  isOpen, 
  onClose, 
  src, 
  alt, 
  postId, 
  assetId, 
  onSaveSuccess,
  onCustomerSave
}: ImageModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(5);
  const [isErasing, setIsErasing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [fontSize, setFontSize] = useState(24);
  const [textColor, setTextColor] = useState("#000000");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    
    if (!canvas || !image) return;

    const setupCanvas = () => {
      // Set canvas to match image natural dimensions
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.imageSmoothingEnabled = true;
      }
    };

    if (image.complete) {
      setupCanvas();
    } else {
      image.addEventListener('load', setupCanvas);
      return () => image.removeEventListener('load', setupCanvas);
    }
  }, [src]);

  if (!isOpen) return null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => prev + 90);
  
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setIsErasing(false);
    setIsTextMode(false);
    setTextInput("");
    setBrushColor("#ff0000");
    setBrushSize(5);
    setTextColor("#000000");
    setFontSize(24);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    
    // Support both mouse and touch events
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    // Calculate coordinates relative to the canvas
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e && e.cancelable) {
      e.preventDefault();
    }
    
    // If in text mode, add text at click position
    if (isTextMode && textInput.trim()) {
      const coords = getCanvasCoordinates(e);
      const canvas = canvasRef.current;
      if (canvas && coords) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = textColor;
          ctx.font = `${fontSize}px Arial`;
          ctx.textBaseline = "top";
          ctx.fillText(textInput, coords.x, coords.y);
        }
      }
      return;
    }
    
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const coords = getCanvasCoordinates(e);
    if (canvas && coords) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (isErasing) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
          ctx.lineWidth = brushSize * 2;
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = brushColor;
          ctx.lineWidth = brushSize;
        }
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        lastPointRef.current = coords;
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e && e.cancelable) {
      e.preventDefault();
    }
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const coords = getCanvasCoordinates(e);
    if (canvas && coords && lastPointRef.current) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (isErasing) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = brushColor;
        }
        
        ctx.beginPath();
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        lastPointRef.current = coords;
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const handleSave = async () => {
    if (onCustomerSave) {
      const canvas = canvasRef.current;
      const image = imageRef.current;
      if (!canvas || !image) {
        toast.error("Cannot save: Image not loaded");
        return;
      }

      try {
        setIsSaving(true);
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = image.naturalWidth;
        tempCanvas.height = image.naturalHeight;
        const ctx = tempCanvas.getContext("2d");

        if (!ctx) {
          throw new Error("Failed to get canvas context");
        }

        ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(canvas, 0, 0);

        const imageData = tempCanvas.toDataURL("image/png");
        await onCustomerSave(imageData);
        // NOTE: onClose is intentionally NOT called here.
        // The parent's onCustomerSave handler closes the modal itself
        // before opening the change-request dialog.
      } catch (error) {
        console.error("Error saving annotation:", error);
        toast.error(error instanceof Error ? error.message : "Failed to save annotation");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!postId || !assetId) {
      toast.error("Cannot save: Missing post or asset information");
      return;
    }

    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) {
      toast.error("Cannot save: Image not loaded");
      return;
    }

    try {
      setIsSaving(true);

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = image.naturalWidth;
      tempCanvas.height = image.naturalHeight;
      const ctx = tempCanvas.getContext("2d");

      if (!ctx) {
        throw new Error("Failed to get canvas context");
      }

      ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(canvas, 0, 0);

      const imageData = tempCanvas.toDataURL("image/png");

      const response = await fetch(`/api/posts/${postId}/save-edited-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageData,
          originalAssetId: assetId,
          filename: alt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save image");
      }

      toast.success("Image saved successfully!");
      
      if (onSaveSuccess) {
        onSaveSuccess();
      }
      
      onClose();
    } catch (error) {
      console.error("Error saving image:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save image");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (canvas && image) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = image.naturalWidth;
      tempCanvas.height = image.naturalHeight;
      const ctx = tempCanvas.getContext("2d");
      if (ctx) {
        ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(canvas, 0, 0);
        const link = document.createElement("a");
        link.download = "edited-image.png";
        link.href = tempCanvas.toDataURL("image/png");
        link.click();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      {/* Controls */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex gap-1.5 sm:gap-2 z-10 flex-wrap max-w-[95vw] sm:max-w-3xl justify-end">
        <button
          onClick={handleZoomOut}
          className="px-3 py-2 bg-white text-black hover:bg-white/80 rounded-md transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomIn}
          className="px-3 py-2 bg-white text-black hover:bg-white/80 rounded-md transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            setIsTextMode(false);
            setIsErasing(false);
          }}
          className={`px-3 py-2 text-black hover:bg-white/80 rounded-md transition-colors ${
            !isErasing && !isTextMode ? 'bg-blue-400' : 'bg-white'
          }`}
          title="Draw"
        >
          <PenTool className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            setIsErasing(true);
            setIsTextMode(false);
          }}
          className={`px-3 py-2 text-black hover:bg-white/80 rounded-md transition-colors ${
            isErasing ? 'bg-blue-400' : 'bg-white'
          }`}
          title="Eraser"
        >
          <Eraser className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            setIsTextMode(true);
            setIsErasing(false);
            setIsDrawing(false);
          }}
          className={`px-3 py-2 text-black hover:bg-white/80 rounded-md transition-colors ${
            isTextMode ? 'bg-blue-400' : 'bg-white'
          }`}
          title="Add Text"
        >
          <Type className="h-4 w-4" />
        </button>
        <input
          type="color"
          value={brushColor}
          onChange={(e) => setBrushColor(e.target.value)}
          className="w-10 h-10 cursor-pointer rounded-md border-2 border-white"
          disabled={isErasing || isTextMode}
          title="Brush Color"
        />
        <div className="flex items-center gap-2 bg-white rounded-md px-3 py-2">
          <label className="text-black text-sm font-medium">
            {isErasing ? 'Eraser:' : 'Brush:'}
          </label>
          <input
            type="range"
            min="1"
            max="30"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20"
            disabled={isTextMode}
          />
          <span className="text-black text-sm font-medium min-w-[35px]">
            {isErasing ? `${brushSize * 2}px` : `${brushSize}px`}
          </span>
        </div>
        
        {/* Text input controls */}
        {isTextMode && (
          <>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text..."
              className="px-3 py-2 rounded-md border-2 border-white bg-white text-black text-sm"
              style={{ minWidth: '200px' }}
            />
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              className="w-10 h-10 cursor-pointer rounded-md border-2 border-white"
              title="Text Color"
            />
            <div className="flex items-center gap-2 bg-white rounded-md px-3 py-2">
              <label className="text-black text-sm font-medium">Size:</label>
              <input
                type="range"
                min="12"
                max="72"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-black text-sm font-medium min-w-[35px]">{fontSize}px</span>
            </div>
          </>
        )}
        {(onCustomerSave || (postId && assetId)) && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-md transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            title={onCustomerSave ? "Save Annotations as Feedback" : "Save to Database"}
          >
            {isSaving ? (
              <>
                <span className="animate-spin">⏳</span>
                <span className="text-sm">Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span className="text-sm">Save</span>
              </>
            )}
          </button>
        )}
        <button
          onClick={handleDownload}
          className="px-3 py-2 bg-green-500 text-white hover:bg-green-600 rounded-md transition-colors"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded-md transition-colors"
          title="Reset"
        >
          Reset
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 bg-red-500 text-white hover:bg-red-600 rounded-md transition-colors"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Image and Canvas Container */}
      <div 
        ref={containerRef}
        className="relative flex items-center justify-center"
        style={{ 
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          transition: 'transform 0.2s'
        }}
      >
        <div className="relative">
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            className="max-w-[90vw] max-h-[90vh] object-contain block"
            draggable={false}
            style={{ display: 'block' }}
            crossOrigin="anonymous"
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0"
            style={{
              width: '100%',
              height: '100%',
              touchAction: 'none',
              cursor: isTextMode ? 'text' : 'crosshair'
            }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
      </div>

      {/* Background click to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
      />
    </div>
  );
}   