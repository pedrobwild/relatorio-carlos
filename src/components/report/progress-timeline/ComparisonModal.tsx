import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowLeftRight,
  Box,
  Camera,
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";
import { TimelinePhoto } from "@/types/weeklyReport";

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  render3D?: TimelinePhoto;
  realPhoto?: TimelinePhoto;
  roomName: string;
}

export function ComparisonModal({
  isOpen,
  onClose,
  render3D,
  realPhoto,
  roomName,
}: ComparisonModalProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchRef = useRef<{
    x: number;
    y: number;
    distance: number;
  } | null>(null);

  const resetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => {
    setScale((prev) => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await containerRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        setIsFullscreen(true);
      }
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetView();
      setIsFullscreen(false);
      setSliderPosition(50);
    }
  }, [isOpen, resetView]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0],
        t2 = e.touches[1];
      const distance = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY,
      );
      lastTouchRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
        distance,
      };
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      lastTouchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        distance: 0,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchRef.current) {
      e.preventDefault();
      const t1 = e.touches[0],
        t2 = e.touches[1];
      const distance = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY,
      );
      const scaleDelta = distance / lastTouchRef.current.distance;
      const newScale = Math.min(Math.max(scale * scaleDelta, 1), 4);
      setScale(newScale);
      lastTouchRef.current.distance = distance;
      if (newScale === 1) setPosition({ x: 0, y: 0 });
    } else if (
      e.touches.length === 1 &&
      isDragging &&
      scale > 1 &&
      lastTouchRef.current
    ) {
      const deltaX = e.touches[0].clientX - lastTouchRef.current.x;
      const deltaY = e.touches[0].clientY - lastTouchRef.current.y;
      setPosition((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      lastTouchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        distance: 0,
      };
    }
  };

  const handleTouchEnd = () => {
    lastTouchRef.current = null;
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.min(Math.max(scale + delta, 1), 4);
    setScale(newScale);
    if (newScale === 1) setPosition({ x: 0, y: 0 });
  };

  if (!render3D || !realPhoto) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "p-0 bg-card border-border overflow-hidden",
          isFullscreen ? "max-w-full h-full" : "max-w-4xl",
        )}
      >
        <VisuallyHidden>
          <DialogTitle>Comparativo 3D vs Real - {roomName}</DialogTitle>
        </VisuallyHidden>

        {!isFullscreen && (
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-h3 font-semibold">{roomName}</h3>
              <p className="text-tiny text-muted-foreground flex items-center gap-1">
                <ArrowLeftRight className="w-3 h-3" />
                Arraste para comparar • Pinça para zoom
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Fechar comparação"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div
          ref={containerRef}
          className={cn(
            "relative overflow-hidden touch-none",
            isFullscreen ? "fixed inset-0 z-50 bg-black" : "aspect-video",
          )}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <div
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
            className="w-full h-full"
          >
            <img
              src={realPhoto.url}
              alt={realPhoto.caption}
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              <img
                src={render3D.url}
                alt={render3D.caption}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
          </div>

          {scale === 1 && (
            <>
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize z-10"
                style={{
                  left: `${sliderPosition}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                  <ArrowLeftRight className="w-5 h-5 text-foreground" />
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPosition}
                onChange={(e) => setSliderPosition(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
              />
            </>
          )}

          <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-blue-500/90 text-white rounded-full text-tiny font-medium flex items-center gap-1.5 z-30">
            <Box className="w-3.5 h-3.5" />
            Projeto 3D
          </div>
          <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-emerald-500/90 text-white rounded-full text-tiny font-medium flex items-center gap-1.5 z-30">
            <Camera className="w-3.5 h-3.5" />
            Foto Real
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2 z-30">
            {scale > 1 && (
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0"
                onClick={resetView}
                aria-label="Resetar zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0"
              onClick={handleZoomOut}
              disabled={scale <= 1}
              aria-label="Diminuir zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-white text-tiny bg-black/50 px-2 py-1 rounded">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0"
              onClick={handleZoomIn}
              disabled={scale >= 4}
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Sair de tela cheia" : "Tela cheia"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
            {isFullscreen && (
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0"
                onClick={onClose}
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {scale === 1 && (
            <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/50 text-white rounded-full text-tiny flex items-center gap-1.5 z-30 sm:hidden">
              <ZoomIn className="w-3.5 h-3.5" />
              Pinça para zoom
            </div>
          )}
        </div>

        {!isFullscreen && (
          <div className="p-4 bg-muted/30 grid grid-cols-2 gap-4 text-tiny">
            <div>
              <span className="text-muted-foreground">Projeto 3D:</span>
              <p className="font-medium">{render3D.caption}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Foto Real:</span>
              <p className="font-medium">{realPhoto.caption}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
