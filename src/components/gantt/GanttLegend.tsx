import { cn } from "@/lib/utils";

interface GanttLegendProps {
  hasAnyBaseline: boolean;
  baselineVisible: boolean;
  onToggleBaseline: () => void;
  hasDependencies: boolean;
  debugMode: boolean;
  onToggleDebug: () => void;
}

export function GanttLegend({
  hasAnyBaseline,
  baselineVisible,
  onToggleBaseline,
  hasDependencies,
  debugMode,
  onToggleDebug,
}: GanttLegendProps) {
  return (
    <div className="flex items-center gap-4 px-3 py-2 border-b border-border text-xs flex-wrap">
      {hasAnyBaseline && (
        <button
          onClick={onToggleBaseline}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded transition-colors",
            baselineVisible
              ? "bg-muted-foreground/20"
              : "bg-muted hover:bg-muted/80",
          )}
        >
          <div className="w-3 h-1 bg-muted-foreground rounded-full" />
          <span
            className={
              baselineVisible ? "text-foreground" : "text-muted-foreground"
            }
          >
            Baseline {baselineVisible ? "✓" : ""}
          </span>
        </button>
      )}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-primary/30 border border-primary/50" />
        <span className="text-muted-foreground">Previsto</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-success" />
        <span className="text-muted-foreground">Concluído</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-primary" />
        <span className="text-muted-foreground">Em andamento</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-destructive" />
        <span className="text-muted-foreground">Atrasado</span>
      </div>
      {hasDependencies && (
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 border-t-2 border-dashed border-primary" />
          <span className="text-muted-foreground">Dependência</span>
        </div>
      )}
      <div className="ml-auto">
        <button
          onClick={onToggleDebug}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded transition-colors font-mono text-[10px]",
            debugMode
              ? "bg-warning/20 text-[hsl(var(--warning))]"
              : "bg-muted hover:bg-muted/80 text-muted-foreground",
          )}
        >
          🐛 Debug {debugMode ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
