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

type PhaseType = "render3D" | "before" | "during" | "after";

const phaseConfig: Record<PhaseType, { 
  icon: typeof Box; 
  color: string; 
  borderColor: string; 
  ringColor: string;
  label: string;
}> = {
  render3D: { 
    icon: Box, 
    color: "bg-blue-500/10 text-blue-600",
    borderColor: "border-blue-500/50",
    ringColor: "ring-blue-500/50",
    label: "Projeto 3D"
  },
  before: { 
    icon: Camera, 
    color: "bg-muted text-muted-foreground",
    borderColor: "border-muted-foreground/30",
    ringColor: "ring-muted-foreground/50",
    label: "Antes"
  },
  during: { 
    icon: Hammer, 
    color: "bg-amber-500/10 text-amber-600",
    borderColor: "border-amber-500/50",
    ringColor: "ring-amber-500/50",
    label: "Durante"
  },
  after: { 
    icon: Check, 
    color: "bg-emerald-500/10 text-emerald-600",
    borderColor: "border-emerald-500/50",
    ringColor: "ring-emerald-500/50",
    label: "Resultado"
  },
};

// Phase selector tabs for mobile
const PhaseSelector = ({ 
  phases, 
  activePhase, 
  onSelect,
  room
}: { 
  phases: PhaseType[];
  activePhase: PhaseType;
  onSelect: (phase: PhaseType) => void;
  room: RoomProgress;
}) => {
  return (
    <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
      {phases.map((phase) => {
        const config = phaseConfig[phase];
        const Icon = config.icon;
        const hasPhoto = room[phase];
        const isActive = activePhase === phase;
        
        return (
          <button
            key={phase}
            onClick={() => onSelect(phase)}
            disabled={!hasPhoto}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-tiny font-medium transition-all",
              isActive 
                ? "bg-card shadow-sm text-foreground" 
                : hasPhoto 
                  ? "text-muted-foreground hover:bg-card/50" 
                  : "text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// Single phase image display for mobile
const PhaseImage = ({ 
  photo, 
  phase,
  onClick,
  showCompareHint
}: { 
  photo?: TimelinePhoto;
  phase: PhaseType;
  onClick?: () => void;
  showCompareHint?: boolean;
}) => {
  const config = phaseConfig[phase];
  const Icon = config.icon;
  
  if (!photo) {
    return (
      <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-2">
        <Icon className="w-8 h-8 text-muted-foreground/30" />
        <span className="text-caption text-muted-foreground/50">{config.label}</span>
        <span className="text-tiny text-muted-foreground/30">Em breve</span>
      </div>
    );
  }
  
  return (
    <button 
      onClick={onClick}
      className="relative w-full aspect-[4/3] rounded-lg overflow-hidden group"
    >
      <img
        src={photo.url}
        alt={photo.caption}
        className="w-full h-full object-cover transition-transform group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      
      {/* Phase badge */}
      <div className={cn(
        "absolute top-3 left-3 px-2.5 py-1 rounded-full text-tiny font-medium flex items-center gap-1.5",
        config.color
      )}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </div>
      
      {/* Compare hint */}
      {showCompareHint && (
        <div className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 text-foreground rounded-full text-tiny font-medium flex items-center gap-1.5">
          <ArrowLeftRight className="w-3.5 h-3.5" />
          Comparar
        </div>
      )}
      
      {/* Caption */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-caption text-white font-medium line-clamp-2">{photo.caption}</p>
        <p className="text-tiny text-white/70 mt-0.5">{photo.date}</p>
      </div>
    </button>
  );
};

// Desktop grid view for phases
const DesktopPhaseGrid = ({ 
  room, 
  onCompare 
}: { 
  room: RoomProgress;
  onCompare: () => void;
}) => {
  const phases: PhaseType[] = room.render3D 
    ? ["render3D", "before", "during", "after"]
    : ["before", "during", "after"];
  
  const hasComparison = room.render3D && room.after;
  
  return (
    <div className={cn(
      "grid gap-2",
      room.render3D ? "grid-cols-4" : "grid-cols-3"
    )}>
      {phases.map((phase) => {
        const photo = room[phase];
        const config = phaseConfig[phase];
        const Icon = config.icon;
        const isClickable = (phase === "render3D" || phase === "after") && hasComparison;
        
        if (!photo) {
          return (
            <div 
              key={phase}
              className="aspect-[4/3] rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex flex-col items-center justify-center gap-1"
            >
              <Icon className="w-4 h-4 text-muted-foreground/30" />
              <span className="text-tiny text-muted-foreground/30">Em breve</span>
            </div>
          );
        }
        
        return (
          <button
            key={phase}
            onClick={isClickable ? onCompare : undefined}
            className={cn(
              "relative aspect-[4/3] rounded-lg overflow-hidden group",
              isClickable && "cursor-pointer"
            )}
          >
            <img
              src={photo.url}
              alt={photo.caption}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className={cn(
              "absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1",
              config.color
            )}>
              <Icon className="w-3 h-3" />
              {config.label}
            </div>
            <p className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] text-white line-clamp-2">{photo.caption}</p>
          </button>
        );
      })}
    </div>
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
  
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 4));
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
      } catch {
        setIsFullscreen(true);
      }
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
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
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, distance: 0 };
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
      if (newScale === 1) setPosition({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isDragging && scale > 1 && lastTouchRef.current) {
      const deltaX = e.touches[0].clientX - lastTouchRef.current.x;
      const deltaY = e.touches[0].clientY - lastTouchRef.current.y;
      setPosition(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, distance: 0 };
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
            <img src={realPhoto.url} alt={realPhoto.caption} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
              <img src={render3D.url} alt={render3D.caption} className="w-full h-full object-cover" draggable={false} />
            </div>
          </div>
          
          {scale === 1 && (
            <>
              <div className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize z-10" style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                  <ArrowLeftRight className="w-5 h-5 text-foreground" />
                </div>
              </div>
              <input type="range" min="0" max="100" value={sliderPosition} onChange={(e) => setSliderPosition(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20" />
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
              <Button variant="secondary" size="icon" className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0" onClick={resetView}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
            <Button variant="secondary" size="icon" className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0" onClick={handleZoomOut} disabled={scale <= 1}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-white text-tiny bg-black/50 px-2 py-1 rounded">{Math.round(scale * 100)}%</span>
            <Button variant="secondary" size="icon" className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0" onClick={handleZoomIn} disabled={scale >= 4}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            {isFullscreen && (
              <Button variant="secondary" size="icon" className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0" onClick={onClose}>
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
};

// Mobile room card with tab navigation
const MobileRoomCard = ({ room, onCompare }: { room: RoomProgress; onCompare: () => void }) => {
  const phases: PhaseType[] = room.render3D 
    ? ["render3D", "before", "during", "after"]
    : ["before", "during", "after"];
  
  const defaultPhase = room.status === "concluído" && room.after ? "after" : 
                       room.status === "em andamento" && room.during ? "during" : 
                       room.render3D ? "render3D" : "before";
  
  const [activePhase, setActivePhase] = useState<PhaseType>(defaultPhase);
  
  const hasComparison = room.render3D && room.after;
  const showCompareHint = hasComparison && (activePhase === "render3D" || activePhase === "after");
  
  const statusConfig = {
    "concluído": { label: "Concluído", color: "bg-emerald-500 text-white" },
    "em andamento": { label: "Em andamento", color: "bg-amber-500 text-white" },
    "pendente": { label: "Pendente", color: "bg-muted text-muted-foreground" },
  };
  
  const config = statusConfig[room.status];
  
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <h4 className="text-body font-semibold">{room.name}</h4>
        <Badge className={cn("text-tiny", config.color)}>
          {config.label}
        </Badge>
      </div>
      
      {/* Phase selector tabs */}
      <div className="p-2 border-b border-border">
        <PhaseSelector 
          phases={phases} 
          activePhase={activePhase} 
          onSelect={setActivePhase}
          room={room}
        />
      </div>
      
      {/* Main image */}
      <div className="p-3">
        <PhaseImage 
          photo={room[activePhase]} 
          phase={activePhase}
          onClick={showCompareHint ? onCompare : undefined}
          showCompareHint={showCompareHint}
        />
      </div>
      
      {/* Compare button */}
      {hasComparison && (
        <div className="px-3 pb-3">
          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={onCompare}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Comparar 3D vs Resultado
          </Button>
        </div>
      )}
    </div>
  );
};

// Desktop room card
const DesktopRoomCard = ({ room, onCompare }: { room: RoomProgress; onCompare: () => void }) => {
  const statusConfig = {
    "concluído": { label: "Concluído", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
    "em andamento": { label: "Em andamento", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    "pendente": { label: "Pendente", color: "bg-muted text-muted-foreground border-border" },
  };
  
  const config = statusConfig[room.status];
  const hasComparison = room.render3D && room.after;
  
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
        <h4 className="text-body font-semibold truncate">{room.name}</h4>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasComparison && (
            <Button variant="outline" size="sm" className="h-6 text-tiny gap-1 px-2" onClick={onCompare}>
              <ArrowLeftRight className="w-3 h-3" />
              3D vs Real
            </Button>
          )}
          <Badge variant="outline" className={cn("text-tiny whitespace-nowrap", config.color)}>
            {config.label}
          </Badge>
        </div>
      </div>
      
      <div className="p-2">
        <DesktopPhaseGrid room={room} onCompare={onCompare} />
      </div>
    </div>
  );
};

const ProgressTimeline = ({ rooms }: ProgressTimelineProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComparison, setShowComparison] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomProgress | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Haptic feedback helper
  const triggerHaptic = useCallback((pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);
  
  const handlePrevious = useCallback(() => {
    triggerHaptic(10);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : rooms.length - 1));
  }, [rooms.length, triggerHaptic]);
  
  const handleNext = useCallback(() => {
    triggerHaptic(10);
    setCurrentIndex((prev) => (prev < rooms.length - 1 ? prev + 1 : 0));
  }, [rooms.length, triggerHaptic]);
  
  const openComparison = (room: RoomProgress) => {
    triggerHaptic(15);
    setSelectedRoom(room);
    setShowComparison(true);
  };
  
  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
    setIsSwiping(true);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;
    
    // Only track horizontal swipes (ignore vertical scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setSwipeOffset(deltaX);
    }
  };
  
  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    
    const swipeThreshold = 50; // Minimum distance for swipe
    const swipeVelocityThreshold = 0.3; // Minimum velocity
    const timeDelta = Date.now() - touchStartRef.current.time;
    const velocity = Math.abs(swipeOffset) / timeDelta;
    
    if (Math.abs(swipeOffset) > swipeThreshold || velocity > swipeVelocityThreshold) {
      if (swipeOffset > 0) {
        handlePrevious();
      } else {
        handleNext();
      }
    }
    
    touchStartRef.current = null;
    setSwipeOffset(0);
    setIsSwiping(false);
  };
  
  if (rooms.length === 0) return null;
  
  const completedCount = rooms.filter(r => r.status === "concluído").length;
  const progressPercent = Math.round((completedCount / rooms.length) * 100);
  
  return (
    <>
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-h2">Evolução por Ambiente</h3>
              <p className="text-tiny text-muted-foreground">
                {completedCount} de {rooms.length} concluídos ({progressPercent}%)
              </p>
            </div>
            
            {/* Mobile navigation */}
            <div className="flex sm:hidden items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevious}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-tiny text-muted-foreground min-w-[40px] text-center">
                {currentIndex + 1}/{rooms.length}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNext}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        
        {/* Desktop: Grid view */}
        <div className="hidden sm:block p-3">
          <div className="grid grid-cols-2 gap-3">
            {rooms.map((room) => (
              <DesktopRoomCard 
                key={room.id} 
                room={room} 
                onCompare={() => openComparison(room)} 
              />
            ))}
          </div>
        </div>
        
        {/* Mobile: Single room with swipe navigation */}
        <div 
          ref={containerRef}
          className="sm:hidden overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div 
            className="p-3"
            style={{
              transform: `translateX(${swipeOffset * 0.3}px)`,
              transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
              opacity: 1 - Math.abs(swipeOffset) / 500
            }}
          >
            <MobileRoomCard 
              room={rooms[currentIndex]} 
              onCompare={() => openComparison(rooms[currentIndex])} 
            />
          </div>
          
          {/* Swipe hint */}
          {currentIndex === 0 && (
            <div className="flex items-center justify-center gap-1 text-tiny text-muted-foreground pb-2 animate-pulse">
              <ChevronLeft className="w-3 h-3" />
              <span>Deslize para navegar</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          )}
          
          {/* Room dots indicator */}
          <div className="flex justify-center gap-1.5 pb-3">
            {rooms.map((room, index) => (
              <button
                key={room.id}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  index === currentIndex 
                    ? "bg-primary w-6" 
                    : room.status === "concluído" 
                      ? "bg-emerald-500/50 w-2" 
                      : "bg-muted-foreground/30 w-2"
                )}
              />
            ))}
          </div>
        </div>
      </div>
      
      <ComparisonModal
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
        render3D={selectedRoom?.render3D}
        realPhoto={selectedRoom?.after}
        roomName={selectedRoom?.name || ""}
      />
    </>
  );
};

export default ProgressTimeline;
