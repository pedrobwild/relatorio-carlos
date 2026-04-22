/**
 * CalendarMonthGrid — Google-Calendar style month view.
 * Renders a 7-col grid (Mon-Sun) for the visible month. Each activity becomes
 * a colored bar spanning its [planned_start, planned_end] interval, clipped
 * to each week row. Up to 3 lanes per row by default; clicking "+N mais"
 * expands the entire week inline so every lane is visible without leaving
 * the month view.
 *
 * Layout uses fixed pixel tokens (DAY_NUMBER_AREA + LANE_HEIGHT * lanes +
 * FOOTER_AREA) so the overlay grid always aligns with the day columns
 * regardless of how many lanes are shown.
 */
import { useMemo, useState } from 'react';
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronsDownUp, ChevronsUpDown, CalendarDays, CheckCircle2, PlayCircle, Clock, AlertTriangle, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProjectColor } from '@/lib/taskUtils';
import { parseLocalDate, getTodayLocal } from '@/lib/activityStatus';
import type { WeekActivity } from '@/hooks/useWeekActivities';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ptBR } from 'date-fns/locale';

/**
 * Determina o status visual de uma atividade para exibir no tooltip:
 * - "Concluída": tem actual_end
 * - "Em andamento": tem actual_start mas não actual_end
 * - "Atrasada": planned_end < hoje e ainda não foi concluída
 * - "Planejada": ainda não iniciada
 */
function getActivityStatus(a: WeekActivity): {
  label: string;
  Icon: typeof CheckCircle2;
  className: string;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (a.actual_end) {
    return { label: 'Concluída', Icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' };
  }
  if (a.actual_start) {
    return { label: 'Em andamento', Icon: PlayCircle, className: 'text-blue-600 dark:text-blue-400' };
  }
  const plannedEnd = parseISO(a.planned_end);
  if (plannedEnd < today) {
    return { label: 'Atrasada', Icon: AlertTriangle, className: 'text-destructive' };
  }
  return { label: 'Planejada', Icon: Clock, className: 'text-muted-foreground' };
}

interface Props {
  refDate: Date;
  activities: WeekActivity[];
  onActivityClick: (a: WeekActivity) => void;
}

// Layout tokens (px). Keeping these fixed guarantees lanes never overlap and
// stay perfectly aligned with the day columns underneath them.
const MAX_BARS_PER_ROW = 3;
const DAY_NUMBER_AREA = 30;   // top space reserved for the day number chip
const LANE_HEIGHT = 22;       // 18px bar + ~4px vertical gap
const LANE_GAP = 4;           // visual gap between lanes
const FOOTER_AREA = 24;       // bottom space for "+N mais" / Expandir / Recolher
const ROW_BASE_PADDING = 8;
const EXPANDED_BOTTOM_PADDING = 16; // extra breathing room below last lane when expanded
const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

interface BarSegment {
  activity: WeekActivity;
  startCol: number; // 0..6
  span: number;     // 1..7
  startsBefore: boolean;
  endsAfter: boolean;
}

export function CalendarMonthGrid({ refDate, activities, onActivityClick }: Props) {
  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const today = new Date();

  const weeks = useMemo(() => {
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const w: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) w.push(days.slice(i, i + 7));
    return w;
  }, [gridStart.getTime(), gridEnd.getTime()]);

  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={50}>
      <div className="rounded-lg border overflow-hidden bg-card">
        <div className="grid grid-cols-7 bg-muted/40 border-b text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="px-2 py-2 text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="divide-y">
          {weeks.map((week, wi) => (
            <WeekRow
              key={wi}
              week={week}
              monthStart={monthStart}
              today={today}
              activities={activities}
              onActivityClick={onActivityClick}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

function WeekRow({
  week,
  monthStart,
  today,
  activities,
  onActivityClick,
}: {
  week: Date[];
  monthStart: Date;
  today: Date;
  activities: WeekActivity[];
  onActivityClick: (a: WeekActivity) => void;
}) {
  // Inline expansion: when true, render every lane (no cap) for this row.
  const [expanded, setExpanded] = useState(false);
  const weekStart = week[0];
  const weekEnd = week[6];

  const segments: BarSegment[] = useMemo(() => {
    const segs: BarSegment[] = [];
    for (const a of activities) {
      const aStart = parseISO(a.planned_start);
      const aEnd = parseISO(a.planned_end);
      if (aEnd < weekStart || aStart > weekEnd) continue;
      const clippedStart = aStart < weekStart ? weekStart : aStart;
      const clippedEnd = aEnd > weekEnd ? weekEnd : aEnd;
      const startCol = differenceInCalendarDays(clippedStart, weekStart);
      const span = differenceInCalendarDays(clippedEnd, clippedStart) + 1;
      segs.push({
        activity: a,
        startCol: Math.max(0, startCol),
        span: Math.max(1, Math.min(7 - Math.max(0, startCol), span)),
        startsBefore: aStart < weekStart,
        endsAfter: aEnd > weekEnd,
      });
    }
    // Sort: longer spans first so they get top rows; tie-break by start.
    segs.sort((x, y) => {
      if (y.span !== x.span) return y.span - x.span;
      return x.activity.planned_start.localeCompare(y.activity.planned_start);
    });
    return segs;
  }, [activities, weekStart.getTime(), weekEnd.getTime()]);

  // Greedy lane packing: each lane holds non-overlapping segments.
  const lanes: BarSegment[][] = useMemo(() => {
    const out: BarSegment[][] = [];
    for (const seg of segments) {
      let placed = false;
      for (const lane of out) {
        const conflict = lane.some(
          (other) =>
            !(seg.startCol + seg.span - 1 < other.startCol || seg.startCol > other.startCol + other.span - 1),
        );
        if (!conflict) {
          lane.push(seg);
          placed = true;
          break;
        }
      }
      if (!placed) out.push([seg]);
    }
    return out;
  }, [segments]);

  const overflow = lanes.length > MAX_BARS_PER_ROW;
  const visibleLanes = expanded ? lanes : lanes.slice(0, MAX_BARS_PER_ROW);
  const hiddenLaneCount = Math.max(0, lanes.length - MAX_BARS_PER_ROW);

  // Per-column hidden counts (only meaningful when collapsed and overflowing).
  const hiddenCountByCol: number[] = Array(7).fill(0);
  if (!expanded) {
    for (let i = MAX_BARS_PER_ROW; i < lanes.length; i++) {
      for (const seg of lanes[i]) {
        for (let c = seg.startCol; c < seg.startCol + seg.span; c++) {
          hiddenCountByCol[c]++;
        }
      }
    }
  }

  const showsFooter = overflow; // either "Expandir" (collapsed) or "Recolher" (expanded)
  // When collapsed, reserve a thin strip for the per-column "+N mais" markers
  // so they don't collide with the footer toggle.
  const moreStripHeight = !expanded && overflow ? 18 : 0;
  const lanesArea = visibleLanes.length * LANE_HEIGHT + Math.max(0, visibleLanes.length - 1) * LANE_GAP;
  // The week row must always reserve enough vertical space to render every
  // visible lane + day number + optional "+N mais" strip + optional footer
  // toggle, so bars never spill into the next week row. When expanded, add
  // extra bottom padding so the last bar never visually collides with the
  // "Recolher" toggle anchored to the row's bottom-right.
  const minHeight =
    DAY_NUMBER_AREA +
    lanesArea +
    moreStripHeight +
    (showsFooter ? FOOTER_AREA : 0) +
    (expanded ? EXPANDED_BOTTOM_PADDING : 0) +
    ROW_BASE_PADDING;

  // Default minimum so empty weeks don't collapse visually. When expanded the
  // row grows freely to fit every lane (no upper cap).
  const finalHeight = expanded ? minHeight : Math.max(110, minHeight);

  return (
    <div className="relative grid grid-cols-7" style={{ minHeight: finalHeight }}>
      {/* Day cells (background + day number) */}
      {week.map((day, di) => {
        const inMonth = isSameMonth(day, monthStart);
        const isToday = isSameDay(day, today);
        return (
          <div
            key={di}
            className={cn(
              'relative border-r last:border-r-0 px-1.5 pt-1 pb-1',
              !inMonth && 'bg-muted/20 text-muted-foreground/60',
            )}
          >
            <div
              className={cn(
                'inline-flex items-center justify-center h-6 min-w-6 text-xs rounded-full',
                isToday && 'bg-primary text-primary-foreground font-semibold px-1.5',
                !isToday && 'font-medium',
              )}
            >
              {format(day, 'd')}
            </div>
          </div>
        );
      })}

      {/* Lanes overlay — absolutely positioned bars aligned to day columns. */}
      <div
        className="absolute left-1 right-1 pointer-events-none"
        style={{ top: DAY_NUMBER_AREA, height: lanesArea }}
      >
        {visibleLanes.map((lane, laneIdx) => (
          <div
            key={laneIdx}
            className="absolute left-0 right-0 pointer-events-auto"
            style={{
              top: laneIdx * (LANE_HEIGHT + LANE_GAP),
              height: LANE_HEIGHT - 4,
            }}
          >
            {/* Per-lane day grid for accurate column placement */}
            <div className="grid grid-cols-7 h-full">
              {lane.map((seg) => {
                const color = getProjectColor(seg.activity.project_id);
                const status = getActivityStatus(seg.activity);
                const StatusIcon = status.Icon;
                const startDate = parseISO(seg.activity.planned_start);
                const endDate = parseISO(seg.activity.planned_end);
                const sameDay = isSameDay(startDate, endDate);
                const durationDays = differenceInCalendarDays(endDate, startDate) + 1;
                // Estados visuais da barra:
                // - "completed": atividade concluída (actual_end) → mantém cor original com leve fade
                // - "overdue": data planejada já passou e não foi concluída → cinza + badge de alerta
                // - "past": já passou e foi concluída → acinzentada (passado)
                // - "current/future": mantém cor cheia
                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);
                const isCompleted = !!seg.activity.actual_end;
                const isPastEnd = endDate < todayMidnight;
                const isOverdue = isPastEnd && !isCompleted;
                const isPastDone = isPastEnd && isCompleted;
                return (
                  <Tooltip key={seg.activity.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onActivityClick(seg.activity)}
                        style={{
                          gridColumn: `${seg.startCol + 1} / span ${seg.span}`,
                        }}
                        className={cn(
                          'relative h-full truncate text-[10.5px] leading-[18px] px-1.5 mx-[1px] text-left rounded-sm border',
                          'hover:ring-2 hover:ring-primary/40 transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/40',
                          // Cor padrão (em andamento / futura)
                          !isPastEnd && [color.bg, color.border],
                          // Concluída no passado: cinza neutro
                          isPastDone && 'bg-muted/60 border-muted-foreground/20 text-muted-foreground',
                          // Atrasada: cinza com borda vermelha sutil para chamar atenção
                          isOverdue && 'bg-muted/70 border-destructive/50 text-muted-foreground',
                          seg.startsBefore && 'rounded-l-none border-l-0',
                          seg.endsAfter && 'rounded-r-none border-r-0',
                        )}
                      >
                        {isOverdue && (
                          <span
                            className="absolute -top-1 -right-1 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold leading-none shadow-sm ring-1 ring-background"
                            title="Atividade atrasada — não concluída"
                            aria-label="Atrasada"
                          >
                            !
                          </span>
                        )}
                        <span className={cn('font-medium', isPastDone && 'line-through opacity-80')}>
                          {seg.activity.project_name}
                        </span>
                        {seg.activity.client_name && (
                          <span className="opacity-70"> · {seg.activity.client_name}</span>
                        )}
                        <span className="opacity-70"> · {seg.activity.description}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="center"
                      sideOffset={8}
                      collisionPadding={12}
                      avoidCollisions
                      className="w-[min(360px,calc(100vw-24px))] max-w-[360px] p-0 overflow-hidden shadow-xl"
                    >
                      <div className="flex flex-col">
                        {/* Header colorido com a cor da obra */}
                        <div className={cn('px-3 py-2 border-b', color.bg, color.border)}>
                          <div className="text-[11px] font-semibold leading-tight break-words">
                            {seg.activity.project_name}
                          </div>
                          {seg.activity.client_name && (
                            <div className="text-[10px] opacity-80 leading-tight mt-0.5 break-words">
                              {seg.activity.client_name}
                            </div>
                          )}
                        </div>

                        {/* Corpo */}
                        <div className="px-3 py-2 space-y-2 bg-popover text-popover-foreground">
                          <div className="text-xs font-medium leading-snug break-words">
                            {seg.activity.description}
                          </div>

                          {seg.activity.etapa && (
                            <div className="text-[10.5px] text-muted-foreground break-words">
                              Etapa: <span className="font-medium text-foreground">{seg.activity.etapa}</span>
                            </div>
                          )}

                          <div className="flex items-start gap-1.5 text-[10.5px] text-muted-foreground">
                            <CalendarDays className="h-3 w-3 mt-0.5 shrink-0" />
                            <div className="flex flex-col gap-0.5 min-w-0">
                              {sameDay ? (
                                <span>
                                  <span className="text-foreground font-medium">
                                    {format(startDate, "dd 'de' MMM", { locale: ptBR })}
                                  </span>{' '}
                                  · 1 dia
                                </span>
                              ) : (
                                <>
                                  <span>
                                    <span className="text-foreground font-medium">
                                      {format(startDate, "dd 'de' MMM", { locale: ptBR })}
                                    </span>
                                    {' → '}
                                    <span className="text-foreground font-medium">
                                      {format(endDate, "dd 'de' MMM", { locale: ptBR })}
                                    </span>
                                  </span>
                                  <span className="opacity-80">
                                    {durationDays} {durationDays === 1 ? 'dia' : 'dias'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {(seg.activity.actual_start || seg.activity.actual_end) && (
                            <div className="text-[10.5px] text-muted-foreground border-t pt-1.5">
                              {seg.activity.actual_start && (
                                <div>
                                  Iniciada em{' '}
                                  <span className="text-foreground font-medium">
                                    {format(parseISO(seg.activity.actual_start), "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                </div>
                              )}
                              {seg.activity.actual_end && (
                                <div>
                                  Concluída em{' '}
                                  <span className="text-foreground font-medium">
                                    {format(parseISO(seg.activity.actual_end), "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Status + Responsável em linhas separadas para não truncar */}
                          <div className="flex flex-col gap-1.5 pt-1.5 border-t">
                            <div className={cn('flex items-center gap-1.5 text-[10.5px] font-medium', status.className)}>
                              <StatusIcon className="h-3 w-3 shrink-0" />
                              <span>{status.label}</span>
                            </div>
                            <div className="flex items-start gap-1.5 text-[10.5px]">
                              <UserRound className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                              {seg.activity.responsible_name ? (
                                <span className="text-foreground font-medium break-words leading-snug">
                                  {seg.activity.responsible_name}
                                </span>
                              ) : (
                                <span className="italic text-muted-foreground/70">
                                  Sem responsável
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}

        {/* Per-column "+N mais" indicators (only when collapsed) */}
        {!expanded && (
          <div
            className="absolute left-0 right-0 grid grid-cols-7"
            style={{
              top: visibleLanes.length * (LANE_HEIGHT + LANE_GAP),
              height: 16,
            }}
          >
            {hiddenCountByCol.map((n, col) =>
              n > 0 ? (
                <button
                  key={`more-${col}`}
                  type="button"
                  onClick={() => setExpanded(true)}
                  style={{ gridColumn: `${col + 1} / span 1` }}
                  className="text-[10px] text-primary hover:underline text-left px-1.5 leading-4 pointer-events-auto truncate"
                  title={`Mostrar todas as ${lanes.length} faixas desta semana`}
                >
                  +{n} mais
                </button>
              ) : (
                <span key={`more-${col}`} />
              ),
            )}
          </div>
        )}
      </div>

      {/* Footer toggle (Expandir / Recolher) — anchored to row bottom-right */}
      {showsFooter && (
        <div className="absolute bottom-1 right-2 pointer-events-auto">
          {expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              title="Recolher esta semana"
            >
              <ChevronsDownUp className="h-3 w-3" />
              Recolher
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              title={`Expandir e mostrar ${hiddenLaneCount} faixa(s) ocultas`}
            >
              <ChevronsUpDown className="h-3 w-3" />
              Expandir semana ({hiddenLaneCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
