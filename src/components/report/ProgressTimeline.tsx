import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Camera, Check, Hammer, Box, ArrowLeftRight, X, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";
import { RoomProgress, TimelinePhoto } from "@/types/weeklyReport";

interface ProgressTimelineProps {
  rooms: RoomProgress[];
}

const PhaseCard = ({ 
  phase, 
  photo, 
  label, 
  isActive,
  onClick
}: { 
  phase: "render3D" | "before" | "during" | "after"; 
  photo?: TimelinePhoto; 
  label: string;
  isActive: boolean;
  onClick?: () => void;
}) => {
  const phaseConfig = {
    render3D: { 
      icon: Box, 
      color: "bg-blue-500/10 text-blue-600",
      borderColor: "border-blue-500/50",
      ringColor: "ring-blue-500/50"
    },
    before: { 
      icon: Camera, 
      color: "bg-muted text-muted-foreground",
      borderColor: "border-muted-foreground/30",
      ringColor: "ring-muted-foreground/50"
    },
    during: { 
      icon: Hammer, 
      color: "bg-amber-500/10 text-amber-600",
      borderColor: "border-amber-500/50",
      ringColor: "ring-amber-500/50"
    },
    after: { 
      icon: Check, 
      color: "bg-emerald-500/10 text-emerald-600",
      borderColor: "border-emerald-500/50",
      ringColor: "ring-emerald-500/50"
    },
  };
  
  const config = phaseConfig[phase];
  const Icon = config.icon;
  
  if (!photo) {
    return (
      <div className={cn(
        "flex-1 aspect-[4/3] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5",
        config.borderColor,
        "bg-muted/30"
      )}>
        <Icon className="w-5 h-5 text-muted-foreground/50" />
        <span className="text-tiny text-muted-foreground/50">{label}</span>
        <span className="text-tiny text-muted-foreground/30">Em breve</span>
      </div>
    );
  }
  
  return (
    <button 
      onClick={onClick}
      className="flex-1 relative group text-left"
    >
      <div className={cn(
        "aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all",
        isActive ? config.borderColor : "border-transparent",
        isActive ? `ring-2 ring-offset-2 ring-offset-background ${config.ringColor}` : "",
        "hover:opacity-90 cursor-pointer"
      )}>
        <img
          src={photo.url}
          alt={photo.caption}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className={cn(
          "absolute top-2 left-2 px-2 py-0.5 rounded-full text-tiny font-medium flex items-center gap-1",
          config.color
        )}>
          <Icon className="w-3 h-3" />
          {label}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-tiny text-white line-clamp-2">{photo.caption}</p>
        </div>
      </div>
    </button>
  );
};

// Fullscreen Comparison Modal with Pinch-to-Zoom
const ComparisonModal = ({ 
  isOpen, 
  onClose, 
  render3D, 
  realPhoto, 
  roomName 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  render3D?: TimelinePhoto; 
  realPhoto?: TimelinePhoto;
  roomName: string;
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchRef = useRef<{ x: number; y: number; distance: number } | null>(null);
  
  const resetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);
  
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, 4));
  };
  
  const handleZoomOut = () => {
    setScale(prev => {
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
      } catch (err) {
        // Fallback for iOS Safari
        setIsFullscreen(true);
      }
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      resetView();
      setIsFullscreen(false);
      setSliderPosition(50);
    }
  }, [isOpen, resetView]);
  
  // Touch handlers for pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      lastTouchRef.current = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
        distance
      };
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      lastTouchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        distance: 0
      };
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchRef.current) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      
      const scaleDelta = distance / lastTouchRef.current.distance;
      const newScale = Math.min(Math.max(scale * scaleDelta, 1), 4);
      
      setScale(newScale);
      lastTouchRef.current.distance = distance;
      
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1 && lastTouchRef.current) {
      const deltaX = e.touches[0].clientX - lastTouchRef.current.x;
      const deltaY = e.touches[0].clientY - lastTouchRef.current.y;
      
      setPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      lastTouchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        distance: 0
      };
    }
  };
  
  const handleTouchEnd = () => {
    lastTouchRef.current = null;
    setIsDragging(false);
  };
  
  // Mouse wheel zoom for desktop
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.min(Math.max(scale + delta, 1), 4);
    setScale(newScale);
    if (newScale === 1) setPosition({ x: 0, y: 0 });
  };
  
  if (!render3D || !realPhoto) return null;
  
  const comparisonContent = (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden touch-none",
        isFullscreen ? "fixed inset-0 z-50 bg-black" : "aspect-video"
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      <div
        style={{
          transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
        className="w-full h-full"
      >
        {/* Real Photo (Background) */}
        <img
          src={realPhoto.url}
          alt={realPhoto.caption}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        
        {/* 3D Render (Foreground with clip) */}
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
      
      {/* Slider Line - only show when not zoomed */}
      {scale === 1 && (
        <>
          <div 
            className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize z-10"
            style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-foreground" />
            </div>
          </div>
          
          {/* Slider Control */}
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
      
      {/* Labels */}
      <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-blue-500/90 text-white rounded-full text-tiny font-medium flex items-center gap-1.5 z-30">
        <Box className="w-3.5 h-3.5" />
        Projeto 3D
      </div>
      <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-emerald-500/90 text-white rounded-full text-tiny font-medium flex items-center gap-1.5 z-30">
        <Camera className="w-3.5 h-3.5" />
        Foto Real
      </div>
      
      {/* Controls overlay */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-30">
        {scale > 1 && (
          <Button 
            variant="secondary" 
            size="icon" 
            className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0"
            onClick={resetView}
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
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button 
          variant="secondary" 
          size="icon" 
          className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>
        {isFullscreen && (
          <Button 
            variant="secondary" 
            size="icon" 
            className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {/* Zoom hint for mobile */}
      {scale === 1 && (
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/50 text-white rounded-full text-tiny flex items-center gap-1.5 z-30 sm:hidden">
          <ZoomIn className="w-3.5 h-3.5" />
          Pinça para zoom
        </div>
      )}
    </div>
  );
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "p-0 bg-card border-border overflow-hidden",
        isFullscreen ? "max-w-full h-full" : "max-w-4xl"
      )}>
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
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        
        {comparisonContent}
        
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
};

const RoomCard = ({ room }: { room: RoomProgress }) => {
  const [showComparison, setShowComparison] = useState(false);
  
  const statusConfig = {
    "concluído": { label: "Concluído", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
    "em andamento": { label: "Em andamento", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    "pendente": { label: "Pendente", color: "bg-muted text-muted-foreground border-border" },
  };
  
  const config = statusConfig[room.status];
  const activePhase = room.status === "concluído" ? "after" : 
                      room.status === "em andamento" ? "during" : "before";
  
  const hasComparison = room.render3D && room.after;
  
  return (
    <>
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
          <h4 className="text-body font-semibold truncate">{room.name}</h4>
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasComparison && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 text-tiny gap-1 px-2"
                onClick={() => setShowComparison(true)}
              >
                <ArrowLeftRight className="w-3 h-3" />
                <span className="hidden sm:inline">3D vs Real</span>
              </Button>
            )}
            <Badge variant="outline" className={cn("text-tiny whitespace-nowrap", config.color)}>
              {config.label}
            </Badge>
          </div>
        </div>
        
        <div className="p-3">
          {/* Timeline connector */}
          <div className="flex items-center gap-1 mb-3">
            {room.render3D && (
              <div className={cn(
                "flex-1 h-1 rounded-full transition-colors",
                room.render3D ? "bg-blue-500/50" : "bg-muted"
              )} />
            )}
            <div className={cn(
              "flex-1 h-1 rounded-full transition-colors",
              room.before ? "bg-muted-foreground/50" : "bg-muted"
            )} />
            <div className={cn(
              "flex-1 h-1 rounded-full transition-colors",
              room.during ? "bg-amber-500/50" : "bg-muted"
            )} />
            <div className={cn(
              "flex-1 h-1 rounded-full transition-colors",
              room.after ? "bg-emerald-500/50" : "bg-muted"
            )} />
          </div>
          
          {/* Photos */}
          <div className="flex gap-2">
            {room.render3D && (
              <PhaseCard 
                phase="render3D" 
                photo={room.render3D} 
                label="3D"
                isActive={false}
                onClick={() => hasComparison && setShowComparison(true)}
              />
            )}
            <PhaseCard 
              phase="before" 
              photo={room.before} 
              label="Antes"
              isActive={activePhase === "before"}
            />
            <PhaseCard 
              phase="during" 
              photo={room.during} 
              label="Durante"
              isActive={activePhase === "during"}
            />
            <PhaseCard 
              phase="after" 
              photo={room.after} 
              label="Depois"
              isActive={activePhase === "after"}
              onClick={() => hasComparison && setShowComparison(true)}
            />
          </div>
        </div>
      </div>
      
      <ComparisonModal
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
        render3D={room.render3D}
        realPhoto={room.after}
        roomName={room.name}
      />
    </>
  );
};

const ProgressTimeline = ({ rooms }: ProgressTimelineProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : rooms.length - 1));
  };
  
  const handleNext = () => {
    setCurrentIndex((prev) => (prev < rooms.length - 1 ? prev + 1 : 0));
  };
  
  if (rooms.length === 0) return null;
  
  const completedCount = rooms.filter(r => r.status === "concluído").length;
  const progressPercent = Math.round((completedCount / rooms.length) * 100);
  
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-h2">Evolução por Ambiente</h3>
            <p className="text-tiny text-muted-foreground">
              {completedCount} de {rooms.length} ambientes concluídos ({progressPercent}%)
            </p>
          </div>
          
          {/* Desktop navigation */}
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevious}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-tiny text-muted-foreground min-w-[60px] text-center">
              {currentIndex + 1} / {rooms.length}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Desktop: Show all rooms in grid */}
      <div className="hidden sm:block p-3">
        <div className="grid grid-cols-2 gap-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      </div>
      
      {/* Mobile: Carousel */}
      <div className="sm:hidden">
        <div className="p-3">
          <RoomCard room={rooms[currentIndex]} />
        </div>
        
        {/* Mobile navigation */}
        <div className="flex items-center justify-between px-3 pb-3">
          <Button variant="outline" size="sm" onClick={handlePrevious} className="h-8">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>
          
          {/* Dots indicator */}
          <div className="flex gap-1.5">
            {rooms.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  index === currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          
          <Button variant="outline" size="sm" onClick={handleNext} className="h-8">
            Próximo
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProgressTimeline;
