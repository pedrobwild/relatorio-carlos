/**
 * CalendarRangeTimeline — horizontal timeline (Gantt-like) for an arbitrary
 * date range. Each project is a row; activities are bars positioned by their
 * planned interval clipped to the range. Click a bar to open detail dialog.
 */
import { useMemo, useRef, useEffect, useState } from 'react';
import { differenceInCalendarDays, eachDayOfInterval, format, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Building2, CalendarDays, Split } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProjectColor } from '@/lib/taskUtils';
import type { WeekActivity } from '@/hooks/useWeekActivities';
import { EmptyState } from '@/components/ui/states';

const MIN_DAY_WIDTH = 28;     // px
const ROW_BASE_PADDING = 12;  // py-1.5 * 2 dentro do container
const LANE_HEIGHT = 28;       // 24px da barra (h-6) + 4px de gap (mb-1)
const MIN_LANES = 1;          // mínimo de faixas mesmo quando a obra não tem atividades no range
const PROJECT_LABEL_WIDTH = 200;

/**
 * Segmento de atividade já clipado ao range visível.
 */
interface BarSegment {
  activity: WeekActivity;
  startOffset: number;
  span: number;
  startsBefore: boolean;
  endsAfter: boolean;
}

/**
 * Regra de altura dinâmica:
 *   row_height = ROW_BASE_PADDING + max(MIN_LANES, lanes.length) * LANE_HEIGHT
 *
 * Onde `lanes.length` é o número real de faixas necessárias para renderizar
 * TODAS as atividades da obra dentro do período visível sem sobreposição.
 *
 * `computeLanes` é a fonte ÚNICA da verdade — é usada tanto para reservar
 * a altura da linha quanto para renderizar as barras em `ProjectBars`,
 * eliminando qualquer chance de corte ou desalinhamento.
 */
function computeLanes(
  items: WeekActivity[],
  rangeStart: Date,
  rangeEnd: Date,
): BarSegment[][] {
  const segs: BarSegment[] = items
    .map((a) => {
      const s = parseISO(a.planned_start);
      const e = parseISO(a.planned_end);
      if (e < rangeStart || s > rangeEnd) return null;
      const cs = s < rangeStart ? rangeStart : s;
      const ce = e > rangeEnd ? rangeEnd : e;
      return {
        activity: a,
        startOffset: differenceInCalendarDays(cs, rangeStart),
        span: differenceInCalendarDays(ce, cs) + 1,
        startsBefore: s < rangeStart,
        endsAfter: e > rangeEnd,
      } as BarSegment;
    })
    .filter(Boolean) as BarSegment[];

  const lanes: BarSegment[][] = [];
  segs
    .slice()
    .sort((a, b) => a.startOffset - b.startOffset)
    .forEach((seg) => {
      let placed = false;
      for (const lane of lanes) {
        const last = lane[lane.length - 1];
        if (last.startOffset + last.span <= seg.startOffset) {
          lane.push(seg);
          placed = true;
          break;
        }
      }
      if (!placed) lanes.push([seg]);
    });
  return lanes;
}

interface Props {
  rangeStart: Date;
  rangeEnd: Date;
  byProject: {
    project_id: string;
    project_name: string;
    client_name?: string | null;
    items: WeekActivity[];
  }[];
  onActivityClick: (a: WeekActivity) => void;
  /** Habilita ações inline de quebra em micro-etapas (Admin/Engineer). */
  canBreak?: boolean;
  /** Disparado ao clicar no atalho "Quebrar" exibido em hover sobre uma barra-mãe. */
  onBreak?: (a: WeekActivity) => void;
}

export function CalendarRangeTimeline({ rangeStart, rangeEnd, byProject, onActivityClick, canBreak, onBreak }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart.getTime(), rangeEnd.getTime()],
  );
  const totalDays = days.length;
  const today = new Date();

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const availableWidth = Math.max(0, containerWidth - PROJECT_LABEL_WIDTH);
  const dayWidth = Math.max(MIN_DAY_WIDTH, availableWidth / totalDays);
  const totalWidth = dayWidth * totalDays;

  if (byProject.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nenhuma atividade no período"
        description={`Não há atividades planejadas entre ${format(rangeStart, 'dd/MM')} e ${format(rangeEnd, 'dd/MM/yyyy')}.`}
      />
    );
  }

  return (
    <div ref={containerRef} className="rounded-lg border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <div style={{ minWidth: PROJECT_LABEL_WIDTH + totalWidth }}>
          {/* Header row */}
          <div className="flex border-b bg-muted/40 sticky top-0 z-10">
            <div
              style={{ width: PROJECT_LABEL_WIDTH }}
              className="shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground border-r"
            >
              Obra
            </div>
            <div className="flex" style={{ width: totalWidth }}>
              {days.map((d, i) => {
                const isToday = isSameDay(d, today);
                const isMonthStart = d.getDate() === 1;
                return (
                  <div
                    key={i}
                    style={{ width: dayWidth }}
                    className={cn(
                      'shrink-0 text-center text-[10px] py-2 border-r last:border-r-0',
                      isToday && 'bg-primary/10 text-primary font-semibold',
                      isMonthStart && 'border-l border-l-foreground/20',
                    )}
                  >
                    <div className="font-medium">{format(d, 'd')}</div>
                    <div className="text-muted-foreground">{format(d, 'EEEEE', { locale: ptBR })}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project rows */}
          <div>
            {byProject.map((g) => {
              const color = getProjectColor(g.project_id);
              // Fonte única: as lanes calculadas aqui são reutilizadas em
              // ProjectBars, garantindo que a altura reservada == lanes
              // efetivamente renderizadas (zero corte / zero sobreposição).
              const lanes = computeLanes(g.items, rangeStart, rangeEnd);
              const laneCount = Math.max(MIN_LANES, lanes.length);
              const rowHeight = ROW_BASE_PADDING + laneCount * LANE_HEIGHT;
              return (
                <div key={g.project_id} className="flex border-b last:border-b-0 hover:bg-muted/20">
                  <div
                    style={{ width: PROJECT_LABEL_WIDTH }}
                    className="shrink-0 px-3 py-2 border-r flex items-center gap-2 min-w-0"
                  >
                    <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md shrink-0', color.bg)}>
                      <Building2 className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate" title={g.project_name}>
                        {g.project_name}
                      </div>
                      {g.client_name && (
                        <div
                          className="text-[10px] text-muted-foreground truncate"
                          title={g.client_name}
                        >
                          {g.client_name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className="relative"
                    style={{
                      width: totalWidth,
                      minHeight: rowHeight,
                    }}
                  >
                    {/* Day grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {days.map((d, i) => {
                        const isToday = isSameDay(d, today);
                        return (
                          <div
                            key={i}
                            style={{ width: dayWidth }}
                            className={cn(
                              'border-r last:border-r-0',
                              isToday && 'bg-primary/5',
                            )}
                          />
                        );
                      })}
                    </div>
                    {/* Bars — recebem as lanes já calculadas para alinhamento exato */}
                    <ProjectBars
                      lanes={lanes}
                      dayWidth={dayWidth}
                      colorClass={color.bg}
                      borderClass={color.border}
                      onActivityClick={onActivityClick}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectBars({
  lanes,
  dayWidth,
  colorClass,
  borderClass,
  onActivityClick,
}: {
  lanes: BarSegment[][];
  dayWidth: number;
  colorClass: string;
  borderClass: string;
  onActivityClick: (a: WeekActivity) => void;
}) {
  return (
    <div className="absolute inset-0 py-1.5">
      {lanes.map((lane, laneIdx) => (
        <div key={laneIdx} className="relative h-6 mb-1 last:mb-0">
          {lane.map((seg) => (
            <button
              key={seg.activity.id}
              type="button"
              onClick={() => onActivityClick(seg.activity)}
              title={`${seg.activity.description} — ${seg.activity.planned_start} → ${seg.activity.planned_end}`}
              style={{
                position: 'absolute',
                left: seg.startOffset * dayWidth + 2,
                width: seg.span * dayWidth - 4,
                top: 0,
                height: '100%',
              }}
              className={cn(
                'rounded-sm border text-[10.5px] px-1.5 leading-6 truncate text-left',
                'hover:ring-2 hover:ring-primary/40 transition-shadow',
                colorClass,
                borderClass,
                seg.startsBefore && 'rounded-l-none border-l-0',
                seg.endsAfter && 'rounded-r-none border-r-0',
              )}
            >
              {seg.activity.description}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
