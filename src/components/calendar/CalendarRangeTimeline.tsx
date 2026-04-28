/**
 * CalendarRangeTimeline — horizontal timeline (Gantt-like) for an arbitrary
 * date range. Each project is a row; activities are bars positioned by their
 * planned interval clipped to the range. Click a bar to open detail dialog.
 */
import { useMemo, useRef, useEffect, useState, useId } from 'react';
import { differenceInCalendarDays, eachDayOfInterval, format, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Building2, CalendarDays, Split, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProjectColor } from '@/lib/taskUtils';
import type { WeekActivity } from '@/hooks/useWeekActivities';
import { EmptyState } from '@/components/ui/states';
import { computeEffectiveStatus, type ActivityStatus } from '@/lib/activityStatus';

const MIN_DAY_WIDTH = 28;     // px
const ROW_BASE_PADDING = 12;  // py-1.5 * 2 dentro do container
const LANE_HEIGHT = 28;       // 24px da barra (h-6) + 4px de gap (mb-1)
const MIN_LANES = 1;          // mínimo de faixas mesmo quando a obra não tem atividades no range
const PROJECT_LABEL_WIDTH = 200;

/**
 * Estilo visual por status efetivo da atividade/micro-etapa.
 * Usa tokens semânticos (success/info/warning/destructive) já definidos
 * em index.css — sem cores hard-coded.
 */
const STATUS_BAR_STYLE: Record<ActivityStatus, { bar: string; icon: typeof CheckCircle2; icon_color: string }> = {
  completed: {
    bar: 'bg-success/15 border-success/40 text-success-foreground',
    icon: CheckCircle2,
    icon_color: 'text-success',
  },
  'in-progress': {
    bar: 'bg-info/15 border-info/40 text-info-foreground',
    icon: Clock,
    icon_color: 'text-info',
  },
  delayed: {
    bar: 'bg-destructive/15 border-destructive/45 text-destructive',
    icon: AlertTriangle,
    icon_color: 'text-destructive',
  },
  pending: {
    bar: '',
    icon: Clock,
    icon_color: 'text-muted-foreground',
  },
};

const STATUS_LABEL: Record<ActivityStatus, string> = {
  completed: 'Concluído',
  'in-progress': 'Em andamento',
  delayed: 'Atrasado',
  pending: 'Previsto',
};

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

  // Ordenação determinística: dia de início → parent antes de child →
  // planned_start exato → maior duração primeiro → descrição → id.
  // Isso garante que micro-etapas filhas apareçam sempre na mesma ordem,
  // mesmo quando há sobreposição no mesmo dia.
  const parentOrder = new Map<string, number>();
  segs.forEach((s, idx) => {
    if (!s.activity.parent_activity_id) parentOrder.set(s.activity.id, idx);
  });
  const getGroupKey = (s: BarSegment) =>
    s.activity.parent_activity_id ?? s.activity.id;
  const getParentRank = (s: BarSegment) => {
    const key = getGroupKey(s);
    return parentOrder.get(key) ?? Number.MAX_SAFE_INTEGER;
  };

  const lanes: BarSegment[][] = [];
  segs
    .slice()
    .sort((a, b) => {
      if (a.startOffset !== b.startOffset) return a.startOffset - b.startOffset;
      // Agrupa parent + filhos juntos
      const pa = getParentRank(a);
      const pb = getParentRank(b);
      if (pa !== pb) return pa - pb;
      // Dentro do grupo, parent vem antes dos filhos
      const aIsChild = a.activity.parent_activity_id ? 1 : 0;
      const bIsChild = b.activity.parent_activity_id ? 1 : 0;
      if (aIsChild !== bIsChild) return aIsChild - bIsChild;
      // Ordena por planned_start exato (string ISO ordena lexicograficamente)
      if (a.activity.planned_start !== b.activity.planned_start) {
        return a.activity.planned_start < b.activity.planned_start ? -1 : 1;
      }
      // Maior duração primeiro (barra mais longa em cima)
      if (a.span !== b.span) return b.span - a.span;
      // Fallback estável por descrição e id
      const da = a.activity.description ?? '';
      const db = b.activity.description ?? '';
      if (da !== db) return da.localeCompare(db);
      return a.activity.id.localeCompare(b.activity.id);
    })
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
  /**
   * Marcação rápida do status de uma micro-etapa (filha) direto na timeline.
   * Recebe o status-alvo: 'in-progress' inicia (define actual_start),
   * 'completed' conclui (define actual_end), 'pending' reseta as datas reais.
   */
  onQuickToggle?: (a: WeekActivity, next: 'pending' | 'in-progress' | 'completed') => void;
}

export function CalendarRangeTimeline({ rangeStart, rangeEnd, byProject, onActivityClick, canBreak, onBreak, onQuickToggle }: Props) {

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const legendId = useId();
  const legendTitleId = `${legendId}-title`;
  const gridId = `${legendId}-grid`;
  const statusItemId = (s: ActivityStatus) => `${legendId}-status-${s}`;

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
      {/* Legenda de status — visível sempre, não rola com o eixo X.
          Cada item tem id único, referenciado por aria-describedby nas barras
          da timeline para vincular semanticamente status ↔ legenda. */}
      <div
        id={legendId}
        role="group"
        aria-labelledby={legendTitleId}
        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 border-b bg-muted/30 text-[11px] text-muted-foreground"
      >
        <span id={legendTitleId} className="sr-only">
          Legenda de status das atividades
        </span>
        {(['pending', 'in-progress', 'completed', 'delayed'] as ActivityStatus[]).map((s) => {
          const style = STATUS_BAR_STYLE[s];
          const Icon = style.icon;
          return (
            <span
              key={s}
              id={statusItemId(s)}
              role="note"
              aria-label={`Status ${STATUS_LABEL[s]}`}
              className="inline-flex items-center gap-1.5"
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center h-3.5 w-3.5 rounded-sm border',
                  s === 'pending' ? 'bg-muted border-border' : style.bar,
                )}
                aria-hidden="true"
              >
                <Icon className={cn('h-2.5 w-2.5', style.icon_color)} />
              </span>
              <span>{STATUS_LABEL[s]}</span>
            </span>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <div
          id={gridId}
          role="grid"
          aria-labelledby={legendTitleId}
          aria-describedby={legendId}
          aria-rowcount={byProject.length}
          style={{ minWidth: PROJECT_LABEL_WIDTH + totalWidth }}
        >
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
                      canBreak={canBreak}
                      onBreak={onBreak}
                      onQuickToggle={onQuickToggle}
                      statusItemId={statusItemId}
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
  canBreak,
  onBreak,
  onQuickToggle,
  statusItemId,
}: {
  lanes: BarSegment[][];
  dayWidth: number;
  colorClass: string;
  borderClass: string;
  onActivityClick: (a: WeekActivity) => void;
  canBreak?: boolean;
  onBreak?: (a: WeekActivity) => void;
  onQuickToggle?: (a: WeekActivity, next: 'pending' | 'in-progress' | 'completed') => void;
  statusItemId?: (s: ActivityStatus) => string;
}) {
  return (
    <div className="absolute inset-0 py-1.5">
      {lanes.map((lane, laneIdx) => (
        <div key={laneIdx} className="relative h-6 mb-1 last:mb-0">
          {lane.map((seg) => {
            const isChild = !!seg.activity.parent_activity_id;
            const showBreak = canBreak && !!onBreak && !isChild;
            const barWidth = seg.span * dayWidth - 4;
            const { status } = computeEffectiveStatus({
              plannedStart: seg.activity.planned_start,
              plannedEnd: seg.activity.planned_end,
              actualStart: seg.activity.actual_start,
              actualEnd: seg.activity.actual_end,
            });
            const statusStyle = STATUS_BAR_STYLE[status];
            const StatusIcon = statusStyle.icon;
            const statusLabel = STATUS_LABEL[status];
            // Quick-toggle disponível apenas para micro-etapas (filhas).
            // Ciclo: pending → in-progress → completed → pending.
            const showQuickToggle = isChild && !!onQuickToggle && barWidth >= 28;
            const nextStatus: 'pending' | 'in-progress' | 'completed' =
              status === 'completed' ? 'pending'
              : status === 'in-progress' ? 'completed'
              : 'in-progress';
            const nextLabel =
              nextStatus === 'in-progress' ? 'Marcar como em andamento'
              : nextStatus === 'completed' ? 'Marcar como concluído'
              : 'Reabrir (limpar datas reais)';
            return (
              <div
                key={seg.activity.id}
                className="group absolute"
                style={{
                  left: seg.startOffset * dayWidth + 2,
                  width: barWidth,
                  top: 0,
                  height: '100%',
                }}
              >
                <button
                  type="button"
                  onClick={() => onActivityClick(seg.activity)}
                  title={(() => {
                    const fmt = (iso: string) => format(parseISO(iso), 'dd/MM/yyyy');
                    const planned = `Previsto: ${fmt(seg.activity.planned_start)} → ${fmt(seg.activity.planned_end)}`;
                    const as = seg.activity.actual_start;
                    const ae = seg.activity.actual_end;
                    let real = '';
                    if (as && ae) real = `\nReal: ${fmt(as)} → ${fmt(ae)}`;
                    else if (as) real = `\nReal: ${fmt(as)} → em andamento`;
                    else if (ae) real = `\nReal: concluído em ${fmt(ae)}`;
                    const tag = isChild ? ' (micro-etapa)' : '';
                    return `${seg.activity.description}${tag}\n${statusLabel}\n${planned}${real}`;
                  })()}
                  className={cn(
                    'w-full h-full rounded-sm border text-[10.5px] px-1.5 leading-6 truncate text-left',
                    'hover:ring-2 hover:ring-primary/40 transition-shadow',
                    'flex items-center gap-1',
                    // Cor base por projeto só quando não há status acionável (pendente)
                    status === 'pending' ? cn(colorClass, borderClass) : statusStyle.bar,
                    isChild && 'border-l-2 border-l-primary/70 border-dashed opacity-95',
                    status === 'completed' && 'opacity-80',
                    seg.startsBefore && 'rounded-l-none border-l-0',
                    seg.endsAfter && 'rounded-r-none border-r-0',
                  )}
                >
                  <StatusIcon
                    className={cn('h-3 w-3 shrink-0', statusStyle.icon_color)}
                    aria-label={statusLabel}
                  />
                  {isChild && <span className="text-primary/80 shrink-0">└</span>}
                  <span className={cn('truncate', status === 'completed' && 'line-through decoration-1')}>
                    {seg.activity.description}
                  </span>
                </button>
                {showQuickToggle && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickToggle!(seg.activity, nextStatus);
                    }}
                    title={`${statusLabel} • Clique para: ${nextLabel.toLowerCase()}`}
                    aria-label={nextLabel}
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 left-0.5',
                      'inline-flex items-center justify-center h-5 w-5 rounded',
                      'bg-background/95 border border-border shadow-sm',
                      'hover:scale-110 hover:border-primary focus:border-primary',
                      'transition-transform',
                    )}
                  >
                    <StatusIcon className={cn('h-3 w-3', statusStyle.icon_color)} />
                  </button>
                )}
                {showBreak && barWidth >= 60 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBreak!(seg.activity);
                    }}
                    title="Quebrar em micro-etapas"
                    aria-label={`Quebrar atividade ${seg.activity.description} em micro-etapas`}
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 right-1',
                      'opacity-0 group-hover:opacity-100 focus:opacity-100',
                      'inline-flex items-center justify-center h-5 w-5 rounded',
                      'bg-background/90 border border-border shadow-sm',
                      'text-foreground hover:bg-primary hover:text-primary-foreground',
                      'transition-opacity',
                    )}
                  >
                    <Split className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
