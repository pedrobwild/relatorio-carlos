import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ZoomIn, ZoomOut, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ZoomLevel } from "./types";

interface GanttHeaderProps {
  startDate: Date;
  endDate: Date;
  editable: boolean;
  showFullChart: boolean;
  onToggleFullChart: () => void;
  zoomLevel: ZoomLevel;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

export function GanttHeader({
  startDate,
  endDate,
  editable,
  showFullChart,
  onToggleFullChart,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
}: GanttHeaderProps) {
  return (
    <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="font-semibold text-sm shrink-0">Gráfico de Gantt</h3>
        <span
          key={`${format(startDate, "yyyyMM")}-${format(endDate, "yyyyMM")}`}
          className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded hidden sm:inline-flex items-center gap-1 animate-fade-in"
        >
          <span className="capitalize">
            {format(startDate, "MMM yyyy", { locale: ptBR })}
          </span>
          <span>→</span>
          <span className="capitalize">
            {format(endDate, "MMM yyyy", { locale: ptBR })}
          </span>
        </span>
        {editable && (
          <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded hidden md:inline">
            Arraste para editar
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 min-h-[44px] text-xs gap-1 px-2"
          onClick={onToggleFullChart}
        >
          {showFullChart ? (
            <>
              <Minimize2 className="h-3 w-3" />
              <span className="hidden sm:inline">45 dias</span>
            </>
          ) : (
            <>
              <Maximize2 className="h-3 w-3" />
              <span className="hidden sm:inline">Ver tudo</span>
            </>
          )}
        </Button>

        <div className="h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 min-h-[44px]"
          onClick={onZoomIn}
          disabled={!canZoomIn}
          aria-label="Aumentar zoom"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground capitalize">
          {zoomLevel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 min-h-[44px]"
          onClick={onZoomOut}
          disabled={!canZoomOut}
          aria-label="Diminuir zoom"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
