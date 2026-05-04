/**
 * PredecessorMiniGantt — visualização compacta das predecessoras.
 *
 * Cockpit do Cronograma (Bloco 4): em vez de exibir IDs, mostra um SVG
 * de ~200×40 com as barras das predecessoras + a barra atual. O eixo
 * temporal é escalado pelo intervalo total cobrado por todas as barras.
 *
 * Não depende de libs externas (Gantt full é overkill aqui).
 */
import { useMemo } from "react";
import { differenceInCalendarDays } from "date-fns";
import { parseLocalDate } from "@/lib/activityStatus";
import { cn } from "@/lib/utils";

export interface MiniGanttBar {
  id: string;
  label: string;
  start: string;
  end: string;
  /** When true, rendered with the "current activity" highlight. */
  current?: boolean;
}

export interface PredecessorMiniGanttProps {
  predecessors: MiniGanttBar[];
  current: Omit<MiniGanttBar, "current">;
  width?: number;
  className?: string;
}

const ROW_HEIGHT = 10;
const ROW_GAP = 2;
const PADDING_X = 4;

export function PredecessorMiniGantt({
  predecessors,
  current,
  width = 200,
  className,
}: PredecessorMiniGanttProps) {
  const bars = useMemo<MiniGanttBar[]>(
    () => [...predecessors, { ...current, current: true }],
    [predecessors, current],
  );

  const { startMs, totalDays } = useMemo(() => {
    if (bars.length === 0) return { startMs: 0, totalDays: 1 };
    const startMsLocal = bars
      .map((b) => parseLocalDate(b.start).getTime())
      .reduce((min, ms) => Math.min(min, ms), Number.POSITIVE_INFINITY);
    const endMsLocal = bars
      .map((b) => parseLocalDate(b.end).getTime())
      .reduce((max, ms) => Math.max(max, ms), Number.NEGATIVE_INFINITY);
    const total = Math.max(
      1,
      differenceInCalendarDays(new Date(endMsLocal), new Date(startMsLocal)) +
        1,
    );
    return { startMs: startMsLocal, totalDays: total };
  }, [bars]);

  const innerWidth = width - PADDING_X * 2;
  const height = bars.length * (ROW_HEIGHT + ROW_GAP) + ROW_GAP;

  if (bars.length <= 1) {
    return (
      <div
        className={cn(
          "text-xs text-muted-foreground italic px-1 py-2",
          className,
        )}
      >
        Sem predecessoras
      </div>
    );
  }

  return (
    <svg
      role="img"
      aria-label="Linha do tempo de predecessoras"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block", className)}
    >
      {bars.map((bar, index) => {
        const start = parseLocalDate(bar.start).getTime();
        const end = parseLocalDate(bar.end).getTime();
        const offsetDays = Math.max(
          0,
          differenceInCalendarDays(new Date(start), new Date(startMs)),
        );
        const spanDays = Math.max(
          1,
          differenceInCalendarDays(new Date(end), new Date(start)) + 1,
        );
        const x = PADDING_X + (offsetDays / totalDays) * innerWidth;
        const w = Math.max(2, (spanDays / totalDays) * innerWidth);
        const y = ROW_GAP + index * (ROW_HEIGHT + ROW_GAP);
        return (
          <g key={bar.id}>
            <title>{`${bar.label} · ${bar.start} → ${bar.end}`}</title>
            <rect
              x={x}
              y={y}
              width={w}
              height={ROW_HEIGHT}
              rx={2}
              className={cn(
                bar.current ? "fill-primary" : "fill-muted-foreground/40",
              )}
            />
          </g>
        );
      })}
    </svg>
  );
}
