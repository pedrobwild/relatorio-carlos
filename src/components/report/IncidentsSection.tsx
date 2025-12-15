import { Incident, IncidentPhoto } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertOctagon, Calendar, ChevronDown, Clock, Camera, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useState, useCallback } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface IncidentsSectionProps {
  incidents: Incident[];
}

const getStatusConfig = (status: Incident['status']) => {
  switch (status) {
    case 'resolvido':
      return { label: 'Resolvido', className: 'bg-green-100 text-green-800' };
    case 'em andamento':
      return { label: 'Em andamento', className: 'bg-yellow-100 text-yellow-800' };
    case 'aberto':
    default:
      return { label: 'Aberto', className: 'bg-red-100 text-red-800' };
  }
};

interface PhotoLightboxProps {
  photos: IncidentPhoto[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const PhotoLightbox = ({ photos, currentIndex, onClose, onNavigate }: PhotoLightboxProps) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const currentPhoto = photos[currentIndex];
  const hasMultiplePhotos = photos.length > 1;

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) setPosition({ x: 0, y: 0 });
      return newZoom;
    });
  }, []);

  const handlePrevious = useCallback(() => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
    onNavigate(currentIndex === 0 ? photos.length - 1 : currentIndex - 1);
  }, [currentIndex, photos.length, onNavigate]);

  const handleNext = useCallback(() => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
    onNavigate(currentIndex === photos.length - 1 ? 0 : currentIndex + 1);
  }, [currentIndex, photos.length, onNavigate]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') onClose();
    if (e.key === '+' || e.key === '=') handleZoomIn();
    if (e.key === '-') handleZoomOut();
  }, [handlePrevious, handleNext, onClose, handleZoomIn, handleZoomOut]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-4">
          {hasMultiplePhotos && (
            <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
              {currentIndex + 1} / {photos.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1}
            className="p-2 rounded-full hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Diminuir zoom"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-sm min-w-[3rem] text-center">{Math.round(zoomLevel * 100)}%</span>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 3}
            className="p-2 rounded-full hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Aumentar zoom"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-white/30 mx-2" />
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div 
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {/* Navigation Arrows */}
        {hasMultiplePhotos && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-4 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              title="Foto anterior"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              title="Próxima foto"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Image */}
        <img
          src={currentPhoto.url}
          alt={currentPhoto.caption || "Foto da intercorrência"}
          className="max-h-[calc(100vh-180px)] max-w-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${position.y / zoomLevel}px)`,
          }}
          draggable={false}
        />
      </div>

      {/* Footer with Caption */}
      {currentPhoto.caption && (
        <div className="p-4 bg-black/80 text-white text-center">
          <p className="text-sm">{currentPhoto.caption}</p>
        </div>
      )}

      {/* Thumbnail Navigation */}
      {hasMultiplePhotos && (
        <div className="p-4 bg-black/80 flex justify-center gap-2 overflow-x-auto">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => {
                setZoomLevel(1);
                setPosition({ x: 0, y: 0 });
                onNavigate(index);
              }}
              className={`w-16 h-12 rounded-md overflow-hidden border-2 transition-colors flex-shrink-0 ${
                index === currentIndex ? 'border-primary' : 'border-transparent hover:border-white/50'
              }`}
            >
              <img
                src={photo.url}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const IncidentItem = ({ incident, animationDelay = 0 }: { incident: Incident; animationDelay?: number }) => {
  const statusConfig = getStatusConfig(incident.status);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  const openLightbox = (index: number) => {
    setCurrentPhotoIndex(index);
    setLightboxOpen(true);
  };
  
  return (
    <>
      <div 
        className="p-4 sm:p-5 space-y-3"
        style={{ 
          animationDelay: `${animationDelay}ms`,
          animation: animationDelay > 0 ? 'fade-in 0.3s ease-out forwards' : undefined,
          opacity: animationDelay > 0 ? 0 : 1
        }}
      >
        {/* Header com Status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${statusConfig.className}`}>
            {statusConfig.label}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground bg-primary/10 px-2 py-0.5 rounded-md">
            <Calendar className="w-3 h-3" />
            {format(new Date(incident.occurrenceDate), "dd/MM/yyyy", { locale: ptBR })}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            Previsão: {format(new Date(incident.expectedResolutionDate), "dd/MM", { locale: ptBR })}
          </span>
        </div>

        {/* Ocorrência */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <AlertOctagon className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">Ocorrência</p>
          </div>
          <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed ml-5.5">{incident.occurrence}</p>
        </div>

        {/* Photos */}
        {incident.photos && incident.photos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-bold text-foreground uppercase tracking-wide">
                Registro Fotográfico
              </p>
              <span className="text-xs text-muted-foreground">({incident.photos.length} foto{incident.photos.length > 1 ? 's' : ''})</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 ml-5.5">
              {incident.photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => openLightbox(index)}
                  className="relative aspect-video rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors group"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || "Foto da intercorrência"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                      <p className="text-[10px] text-white line-clamp-1">{photo.caption}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Causa */}
        <div className="bg-secondary rounded-lg p-2.5 sm:p-3 space-y-1.5">
          <p className="text-xs font-bold text-foreground">Causa</p>
          <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">{incident.cause}</p>
        </div>

        {/* Ação */}
        <div className="bg-secondary rounded-lg p-2.5 sm:p-3 space-y-1.5">
          <p className="text-xs font-bold text-foreground">Ação</p>
          <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">{incident.action}</p>
        </div>

        {/* Impacto */}
        <div className="bg-secondary rounded-lg p-2.5 sm:p-3 space-y-1.5">
          <p className="text-xs font-bold text-foreground">Impacto</p>
          <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">{incident.impact}</p>
        </div>
      </div>

      {/* Photo Lightbox */}
      {lightboxOpen && incident.photos && (
        <PhotoLightbox
          photos={incident.photos}
          currentIndex={currentPhotoIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setCurrentPhotoIndex}
        />
      )}
    </>
  );
};

const IncidentsSection = ({ incidents }: IncidentsSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!incidents || incidents.length === 0) {
    return null;
  }

  const firstIncident = incidents[0];
  const remainingIncidents = incidents.slice(1);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-4 sm:p-5 bg-primary-dark">
          <h3 className="text-sm sm:text-base font-semibold text-white">Intercorrências de Obra</h3>
        </div>
        
        {/* Desktop: Always show all */}
        <div className="hidden sm:block divide-y divide-border">
          {incidents.map((incident) => (
            <IncidentItem key={incident.id} incident={incident} />
          ))}
        </div>

        {/* Mobile: Collapsible */}
        <div className="sm:hidden">
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="divide-y divide-border">
              {firstIncident && <IncidentItem incident={firstIncident} />}
              
              <CollapsibleContent className="divide-y divide-border overflow-hidden">
                {remainingIncidents.map((incident, index) => (
                  <IncidentItem key={incident.id} incident={incident} animationDelay={isOpen ? (index + 1) * 50 : 0} />
                ))}
              </CollapsibleContent>
            </div>
            
            {remainingIncidents.length > 0 && (
              <CollapsibleTrigger asChild>
                <button className="w-full py-3 px-4 border-t border-border flex items-center justify-center gap-2 text-xs font-medium text-primary hover:bg-primary/5 transition-colors">
                  <span>{isOpen ? "Ver menos" : "Ver mais"}</span>
                  {!isOpen && <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-[10px] font-semibold">+{remainingIncidents.length}</span>}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
            )}
          </Collapsible>
        </div>
      </div>
    </div>
  );
};

export default IncidentsSection;
