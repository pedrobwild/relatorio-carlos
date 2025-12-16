import { useState } from "react";
import { ChevronLeft, ChevronRight, Camera, Check, Clock, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RoomProgress, TimelinePhoto } from "@/types/weeklyReport";

interface ProgressTimelineProps {
  rooms: RoomProgress[];
}

const PhaseCard = ({ 
  phase, 
  photo, 
  label, 
  isActive 
}: { 
  phase: "before" | "during" | "after"; 
  photo?: TimelinePhoto; 
  label: string;
  isActive: boolean;
}) => {
  const phaseConfig = {
    before: { 
      icon: Camera, 
      color: "bg-muted text-muted-foreground",
      borderColor: "border-muted-foreground/30"
    },
    during: { 
      icon: Hammer, 
      color: "bg-amber-500/10 text-amber-600",
      borderColor: "border-amber-500/50"
    },
    after: { 
      icon: Check, 
      color: "bg-emerald-500/10 text-emerald-600",
      borderColor: "border-emerald-500/50"
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
    <div className="flex-1 relative group">
      <div className={cn(
        "aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all",
        isActive ? config.borderColor : "border-transparent",
        isActive ? "ring-2 ring-offset-2 ring-offset-background" : "",
        phase === "after" && isActive ? "ring-emerald-500/50" : "",
        phase === "during" && isActive ? "ring-amber-500/50" : "",
        phase === "before" && isActive ? "ring-muted-foreground/50" : ""
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
    </div>
  );
};

const RoomCard = ({ room }: { room: RoomProgress }) => {
  const statusConfig = {
    "concluído": { label: "Concluído", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
    "em andamento": { label: "Em andamento", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    "pendente": { label: "Pendente", color: "bg-muted text-muted-foreground border-border" },
  };
  
  const config = statusConfig[room.status];
  
  // Determine active phase based on status
  const activePhase = room.status === "concluído" ? "after" : 
                      room.status === "em andamento" ? "during" : "before";
  
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <h4 className="text-body font-semibold">{room.name}</h4>
        <Badge variant="outline" className={cn("text-tiny", config.color)}>
          {config.label}
        </Badge>
      </div>
      
      <div className="p-3">
        {/* Timeline connector */}
        <div className="flex items-center gap-1 mb-3">
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
          />
        </div>
      </div>
    </div>
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
