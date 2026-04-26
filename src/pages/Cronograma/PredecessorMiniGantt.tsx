/**
 * Mini-Gantt SVG (200x40) para visualizar predecessoras de uma atividade.
 *
 * Substitui a "lista de IDs" por uma timeline compartilhada onde cada barra
 * mostra o intervalo `plannedStart..plannedEnd` da predecessora; a atividade
 * atual é destacada na faixa inferior.
 *
 * Renderiza nada quando não há predecessoras com datas válidas.
 */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ActivityFormData } from './types';

interface PredecessorMiniGanttProps {
  activity: ActivityFormData;
  /** Conjunto de atividades do cronograma (para resolver os IDs em datas) */
  allActivities: ActivityFormData[];
  width?: number;
  height?: number;
}

interface ResolvedBar {
  id: string;
  label: string;
  start: number;
  end: number;
  isCurrent: boolean;
}

function parseDay(d: string): number | null {
  if (!d) return null;
  const date = new Date(d + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function formatBR(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function PredecessorMiniGantt({
  activity,
  allActivities,
  width = 200,
  height = 40,
}: PredecessorMiniGanttProps) {
  const predIds = activity.predecessorIds ?? [];
  if (predIds.length === 0) return null;

  const byId = new Map(allActivities.map((a) => [a.id, a]));
  const bars: ResolvedBar[] = [];

  predIds.forEach((id, idx) => {
    const a = byId.get(id);
    if (!a) return;
    const s = parseDay(a.plannedStart);
    const e = parseDay(a.plannedEnd);
    if (s == null || e == null || e < s) return;
    bars.push({
      id: a.id,
      label: a.description.trim() || `Predecessora ${idx + 1}`,
      start: s,
      end: e,
      isCurrent: false,
    });
  });

  const currentStart = parseDay(activity.plannedStart);
  const currentEnd = parseDay(activity.plannedEnd);
  if (currentStart != null && currentEnd != null && currentEnd >= currentStart) {
    bars.push({
      id: activity.id,
      label: activity.description.trim() || 'Atividade atual',
      start: currentStart,
      end: currentEnd,
      isCurrent: true,
    });
  }

  if (bars.length === 0) return null;

  const min = Math.min(...bars.map((b) => b.start));
  const max = Math.max(...bars.map((b) => b.end));
  const span = Math.max(1, max - min);

  const PADDING_X = 4;
  const innerWidth = width - PADDING_X * 2;
  const trackHeight = Math.max(4, Math.floor(height / Math.max(2, bars.length)) - 2);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="inline-flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Predecessoras
        </span>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Linha do tempo das predecessoras"
          className="rounded border border-border/60 bg-muted/30"
        >
          {bars.map((bar, i) => {
            const x = PADDING_X + ((bar.start - min) / span) * innerWidth;
            const w = Math.max(2, ((bar.end - bar.start) / span) * innerWidth);
            const y = i * (trackHeight + 2) + 2;
            const fill = bar.isCurrent
              ? 'hsl(var(--primary))'
              : 'hsl(var(--muted-foreground) / 0.55)';
            return (
              <Tooltip key={bar.id}>
                <TooltipTrigger asChild>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={trackHeight}
                    rx={2}
                    fill={fill}
                    className="cursor-default"
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="font-medium">{bar.label}</div>
                  <div className="text-muted-foreground">
                    {formatBR(bar.start)} – {formatBR(bar.end)}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </svg>
      </div>
    </TooltipProvider>
  );
}
