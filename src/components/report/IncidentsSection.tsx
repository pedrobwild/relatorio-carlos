import { Incident } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertOctagon, Calendar, ChevronDown, Clock, Camera, X } from "lucide-react";
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
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; caption?: string } | null>(null);
  
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
              {incident.photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="relative aspect-video rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors group"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || "Foto da intercorrência"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
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
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/95">
          <DialogTitle className="sr-only">Visualização da foto</DialogTitle>
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          {selectedPhoto && (
            <div className="flex flex-col">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.caption || "Foto da intercorrência"}
                className="w-full h-auto max-h-[70vh] object-contain"
              />
              {selectedPhoto.caption && (
                <div className="p-4 bg-black text-white">
                  <p className="text-sm">{selectedPhoto.caption}</p>
                </div>
              )}
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
