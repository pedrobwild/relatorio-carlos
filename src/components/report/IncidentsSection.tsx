import { Incident, IncidentPhoto } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertOctagon, ChevronDown, Camera, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

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

const IncidentItem = ({ incident, animationDelay = 0 }: { incident: Incident; animationDelay?: number }) => {
  const statusConfig = getStatusConfig(incident.status);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  
  const photos = incident.photos || [];
  
  const handlePrevious = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1);
    }
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
        <div className="flex items-center">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${statusConfig.className}`}>
            {statusConfig.label}
          </span>
        </div>

        {/* Datas */}
        <div className="space-y-1.5 text-sm sm:text-base text-foreground/80">
          <p className="leading-relaxed"><span className="font-semibold">Data da ocorrência:</span> {format(new Date(incident.occurrenceDate), "dd/MM", { locale: ptBR })}</p>
          <p className="leading-relaxed"><span className="font-semibold">Previsão para resolução:</span> {format(new Date(incident.expectedResolutionDate), "dd/MM", { locale: ptBR })}</p>
        </div>

        {/* Ocorrência */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <AlertOctagon className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-foreground uppercase tracking-wide">Ocorrência</p>
          </div>
          <p className="text-sm sm:text-base text-foreground/80 leading-relaxed ml-5.5">{incident.occurrence}</p>
        </div>

        {/* Photos */}
        {photos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-bold text-foreground uppercase tracking-wide">
                Registro Fotográfico
              </p>
              <span className="text-sm text-muted-foreground">({photos.length} foto{photos.length > 1 ? 's' : ''})</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 ml-5.5">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhotoIndex(index)}
                  className="relative aspect-video rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors group"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || "Foto da intercorrência"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
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
        <div className="bg-secondary rounded-lg p-2.5 sm:p-3 space-y-2">
          <p className="text-sm font-bold text-foreground">Causa</p>
          <p className="text-sm sm:text-base text-foreground/80 leading-relaxed">{incident.cause}</p>
        </div>

        {/* Ação */}
        <div className="bg-secondary rounded-lg p-2.5 sm:p-3 space-y-2">
          <p className="text-sm font-bold text-foreground">Ação</p>
          <p className="text-sm sm:text-base text-foreground/80 leading-relaxed">{incident.action}</p>
        </div>

        {/* Impacto */}
        <div className="bg-secondary rounded-lg p-2.5 sm:p-3 space-y-2">
          <p className="text-sm font-bold text-foreground">Impacto</p>
          <p className="text-sm sm:text-base text-foreground/80 leading-relaxed">{incident.impact}</p>
        </div>
      </div>

      {/* Photo Lightbox - Same pattern as PhotoGallery */}
      <Dialog open={selectedPhotoIndex !== null} onOpenChange={() => setSelectedPhotoIndex(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <VisuallyHidden>
            <DialogTitle>
              {selectedPhotoIndex !== null ? (photos[selectedPhotoIndex]?.caption || "Foto da intercorrência") : "Foto"}
            </DialogTitle>
          </VisuallyHidden>
          
          {selectedPhotoIndex !== null && photos[selectedPhotoIndex] && (
            <div className="relative">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                onClick={() => setSelectedPhotoIndex(null)}
              >
                <X className="w-5 h-5" />
              </Button>

              {/* Navigation */}
              {selectedPhotoIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
              )}
              {selectedPhotoIndex < photos.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={handleNext}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              )}

              {/* Image */}
              <div className="flex items-center justify-center min-h-[60vh] p-8">
                <img
                  src={photos[selectedPhotoIndex].url}
                  alt={photos[selectedPhotoIndex].caption || "Foto da intercorrência"}
                  className="max-w-full max-h-[70vh] object-contain rounded"
                />
              </div>

              {/* Caption */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
                {photos[selectedPhotoIndex].caption && (
                  <p className="text-white text-sm font-medium">{photos[selectedPhotoIndex].caption}</p>
                )}
                {photos.length > 1 && (
                  <p className="text-white/70 text-xs mt-1">
                    {selectedPhotoIndex + 1} / {photos.length}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
