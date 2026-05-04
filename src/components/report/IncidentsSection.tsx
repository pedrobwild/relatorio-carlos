import { Incident, IncidentPhoto } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertOctagon,
  ChevronDown,
  Camera,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface IncidentsSectionProps {
  incidents: Incident[];
}

function safeFormatDate(dateStr: string, fmt: string): string {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr || "—"
      : format(d, fmt, { locale: ptBR });
  } catch {
    return dateStr || "—";
  }
}

const getStatusConfig = (status: Incident["status"]) => {
  switch (status) {
    case "resolvido":
      return { label: "Resolvido", className: "bg-success/10 text-success" };
    case "em andamento":
      return { label: "Em andamento", className: "bg-warning/10 text-warning" };
    case "aberto":
    default:
      return {
        label: "Aberto",
        className: "bg-destructive/10 text-destructive",
      };
  }
};

const IncidentItem = ({
  incident,
  animationDelay = 0,
}: {
  incident: Incident;
  animationDelay?: number;
}) => {
  const statusConfig = getStatusConfig(incident.status);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(
    null,
  );

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
        className="px-5 py-3 sm:px-6 sm:py-4 space-y-2.5"
        style={{
          animationDelay: `${animationDelay}ms`,
          animation:
            animationDelay > 0 ? "fade-in 0.3s ease-out forwards" : undefined,
          opacity: animationDelay > 0 ? 0 : 1,
        }}
      >
        <div className="flex items-center">
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${statusConfig.className}`}
          >
            {statusConfig.label}
          </span>
        </div>

        <div className="space-y-1 text-sm text-foreground/75">
          <p className="leading-[1.6]">
            <span className="font-semibold text-foreground/90">Data:</span>{" "}
            {safeFormatDate(incident.occurrenceDate, "dd/MM")}
          </p>
          <p className="leading-[1.6]">
            <span className="font-semibold text-foreground/90">Previsão:</span>{" "}
            {safeFormatDate(incident.expectedResolutionDate, "dd/MM")}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-start gap-1.5">
            <AlertOctagon className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">
              Ocorrência
            </p>
          </div>
          <p className="text-sm text-foreground/80 leading-[1.6] ml-5">
            {incident.occurrence}
          </p>
        </div>

        {photos.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-bold text-foreground uppercase tracking-wide">
                Fotos
              </p>
              <span className="text-xs text-muted-foreground">
                ({photos.length})
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 ml-5">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhotoIndex(index)}
                  className="relative aspect-video rounded overflow-hidden border border-border hover:border-primary/50 transition-colors group"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || "Foto da intercorrência"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-secondary rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">
            Causa
          </p>
          <p className="text-sm text-foreground/80 leading-[1.6]">
            {incident.cause}
          </p>
        </div>

        <div className="bg-secondary rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">
            Ação
          </p>
          <p className="text-sm text-foreground/80 leading-[1.6]">
            {incident.action}
          </p>
        </div>

        <div className="bg-secondary rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">
            Impacto
          </p>
          <p className="text-sm text-foreground/80 leading-[1.6]">
            {incident.impact}
          </p>
        </div>
      </div>

      <Dialog
        open={selectedPhotoIndex !== null}
        onOpenChange={() => setSelectedPhotoIndex(null)}
      >
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <VisuallyHidden>
            <DialogTitle>
              {selectedPhotoIndex !== null
                ? photos[selectedPhotoIndex]?.caption || "Foto"
                : "Foto"}
            </DialogTitle>
          </VisuallyHidden>

          {selectedPhotoIndex !== null && photos[selectedPhotoIndex] && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                onClick={() => setSelectedPhotoIndex(null)}
              >
                <X className="w-5 h-5" />
              </Button>

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

              <div className="flex items-center justify-center min-h-[60vh] p-8">
                <img
                  src={photos[selectedPhotoIndex].url}
                  alt={photos[selectedPhotoIndex].caption || "Foto"}
                  className="max-w-full max-h-[70vh] object-contain rounded"
                />
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
                {photos[selectedPhotoIndex].caption && (
                  <p className="text-white text-caption font-medium">
                    {photos[selectedPhotoIndex].caption}
                  </p>
                )}
                {photos.length > 1 && (
                  <p className="text-white/70 text-tiny mt-1">
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
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2.5 bg-primary-dark">
        <h3 className="text-base font-semibold text-white tracking-tight">
          Intercorrências de Obra
        </h3>
      </div>

      <div className="hidden sm:block divide-y divide-border">
        {incidents.map((incident) => (
          <IncidentItem key={incident.id} incident={incident} />
        ))}
      </div>

      <div className="sm:hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="divide-y divide-border">
            {firstIncident && <IncidentItem incident={firstIncident} />}

            <CollapsibleContent className="divide-y divide-border overflow-hidden">
              {remainingIncidents.map((incident, index) => (
                <IncidentItem
                  key={incident.id}
                  incident={incident}
                  animationDelay={isOpen ? (index + 1) * 50 : 0}
                />
              ))}
            </CollapsibleContent>
          </div>

          {remainingIncidents.length > 0 && (
            <CollapsibleTrigger asChild>
              <button className="w-full py-2 px-3 border-t border-border flex items-center justify-center gap-1.5 text-tiny font-medium text-primary hover:bg-primary/5 transition-colors">
                <span>{isOpen ? "Ver menos" : "Ver mais"}</span>
                {!isOpen && (
                  <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-tiny font-semibold">
                    +{remainingIncidents.length}
                  </span>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
          )}
        </Collapsible>
      </div>
    </div>
  );
};

export default IncidentsSection;
