/**
 * ProjectCalendar — componente reutilizável de calendário do Portal BWild.
 *
 * Abstração entity-agnostic exigida pelo Bloco 4.4 da issue #21:
 *
 *   <ProjectCalendar
 *     entities={purchases}
 *     toEvent={(p) => ({ id: p.id, start: p.required_by_date, end: p.required_by_date, entity: p })}
 *     renderEvent={(e) => <PurchaseChip purchase={e.entity} />}
 *     legend={[{ label: 'Atrasada', color: 'hsl(var(--destructive))' }, ...]}
 *     onEventClick={(e) => openDetail(e.entity)}
 *     view={view}
 *     onViewChange={setView}
 *     referenceDate={refDate}
 *     onReferenceDateChange={setRefDate}
 *   />
 *
 * Modos de exibição:
 *   - `month`:  grid 7 colunas (segunda-domingo) com barras recortadas por semana.
 *   - `agenda`: lista vertical do mês com eventos agrupados por dia.
 *
 * Não substitui ainda o `CalendarMonthGrid` específico de atividades de obra
 * (que tem regras de "etapa anterior atrasada", replanejamento etc). Esses
 * casos podem migrar incrementalmente — esta API é o ponto comum.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isWeekend,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { getTodayLocal } from '@/lib/activityStatus';
import {
  buildMonthWeeks,
  buildWeekLanes,
  eventsOnDay,
  parseLocal,
  type BarSegment,
  type ProjectCalendarEvent,
} from './projectCalendarLayout';

export type ProjectCalendarView = 'month' | 'agenda';

export interface ProjectCalendarLegendItem {
  label: string;
  /** Pode ser uma cor literal (hsl/hex) ou className tailwind para aplicar como bg */
  color: string;
}

export interface ProjectCalendarProps<T> {
  /** Entidades brutas do domínio (compras, atividades, ...). */
  entities: T[];
  /**
   * Mapeia uma entidade para um evento de calendário; retorne `null` para omitir
   * (ex.: compra sem `required_by_date`).
   */
  toEvent: (entity: T) => ProjectCalendarEvent<T> | null;
  /** Render do bloco do evento — receba liberdade total de cor/icon/label. */
  renderEvent: (event: ProjectCalendarEvent<T>) => ReactNode;
  /** Itens da legenda renderizados abaixo do calendário. */
  legend?: ProjectCalendarLegendItem[];
  onEventClick?: (event: ProjectCalendarEvent<T>) => void;
  view: ProjectCalendarView;
  onViewChange?: (view: ProjectCalendarView) => void;
  referenceDate: Date;
  onReferenceDateChange?: (date: Date) => void;
  /** Texto exibido quando não há eventos no período. */
  emptyMessage?: string;
  /** Esconde o switcher de view (útil quando a página fixa um modo). */
  hideViewSwitcher?: boolean;
}

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function ProjectCalendar<T>({
  entities,
  toEvent,
  renderEvent,
  legend,
  onEventClick,
  view,
  onViewChange,
  referenceDate,
  onReferenceDateChange,
  emptyMessage = 'Nenhum evento no período',
  hideViewSwitcher,
}: ProjectCalendarProps<T>) {
  const events = useMemo(() => {
    return entities
      .map(toEvent)
      .filter((e): e is ProjectCalendarEvent<T> => e !== null);
  }, [entities, toEvent]);

  const navigateMonth = (delta: number) => {
    if (!onReferenceDateChange) return;
    onReferenceDateChange(delta > 0 ? addMonths(referenceDate, 1) : subMonths(referenceDate, 1));
  };

  const goToday = () => {
    if (!onReferenceDateChange) return;
    onReferenceDateChange(getTodayLocal());
  };

  return (
    <div className="space-y-3">
      <Header
        referenceDate={referenceDate}
        view={view}
        onViewChange={onViewChange}
        hideViewSwitcher={hideViewSwitcher}
        onPrev={() => navigateMonth(-1)}
        onNext={() => navigateMonth(1)}
        onToday={goToday}
        navigationDisabled={!onReferenceDateChange}
      />

      {view === 'month' ? (
        <MonthGrid
          referenceDate={referenceDate}
          events={events}
          renderEvent={renderEvent}
          onEventClick={onEventClick}
          emptyMessage={emptyMessage}
        />
      ) : (
        <Agenda
          referenceDate={referenceDate}
          events={events}
          renderEvent={renderEvent}
          onEventClick={onEventClick}
          emptyMessage={emptyMessage}
        />
      )}

      {legend && legend.length > 0 && <Legend items={legend} />}
    </div>
  );
}

interface HeaderProps {
  referenceDate: Date;
  view: ProjectCalendarView;
  onViewChange?: (v: ProjectCalendarView) => void;
  hideViewSwitcher?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  navigationDisabled: boolean;
}

function Header({
  referenceDate,
  view,
  onViewChange,
  hideViewSwitcher,
  onPrev,
  onNext,
  onToday,
  navigationDisabled,
}: HeaderProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev} disabled={navigationDisabled} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext} disabled={navigationDisabled} aria-label="Próximo mês">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onToday} disabled={navigationDisabled}>
          Hoje
        </Button>
      </div>
      <h2 className="text-base font-semibold capitalize tabular-nums">
        {format(referenceDate, "MMMM 'de' yyyy", { locale: ptBR })}
      </h2>
      {!hideViewSwitcher && onViewChange && (
        <Tabs value={view} onValueChange={(v) => onViewChange(v as ProjectCalendarView)} className="ml-auto">
          <TabsList className="h-8">
            <TabsTrigger value="month" className="gap-1.5 text-xs h-7">
              <CalendarDays className="h-3.5 w-3.5" />
              Mês
            </TabsTrigger>
            <TabsTrigger value="agenda" className="gap-1.5 text-xs h-7">
              <List className="h-3.5 w-3.5" />
              Agenda
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
    </div>
  );
}

const MAX_LANES_DEFAULT = 3;

interface MonthGridProps<T> {
  referenceDate: Date;
  events: ProjectCalendarEvent<T>[];
  renderEvent: (event: ProjectCalendarEvent<T>) => ReactNode;
  onEventClick?: (event: ProjectCalendarEvent<T>) => void;
  emptyMessage: string;
}

function MonthGrid<T>({
  referenceDate,
  events,
  renderEvent,
  onEventClick,
  emptyMessage,
}: MonthGridProps<T>) {
  const weeks = useMemo(() => buildMonthWeeks(referenceDate), [referenceDate]);
  const today = getTodayLocal();

  const hasAnyInMonth = events.some((e) => {
    const start = parseLocal(e.start);
    const end = parseLocal(e.end);
    return weeks.some((w) => start <= w[6] && end >= w[0]);
  });

  return (
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
            events={events}
            referenceDate={referenceDate}
            today={today}
            renderEvent={renderEvent}
            onEventClick={onEventClick}
          />
        ))}
      </div>

      {!hasAnyInMonth && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground border-t">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

interface WeekRowProps<T> {
  week: Date[];
  events: ProjectCalendarEvent<T>[];
  referenceDate: Date;
  today: Date;
  renderEvent: (event: ProjectCalendarEvent<T>) => ReactNode;
  onEventClick?: (event: ProjectCalendarEvent<T>) => void;
}

function WeekRow<T>({ week, events, referenceDate, today, renderEvent, onEventClick }: WeekRowProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const segMap = useMemo(() => buildWeekLanes(week, events), [week, events]);
  type Segment = BarSegment<T> & { lane?: number };
  const segments: Segment[] = Array.from(segMap.values()) as Segment[];

  const visibleSegments = expanded
    ? segments
    : segments.filter((s) => (s.lane ?? 0) < MAX_LANES_DEFAULT);
  const overflow = segments.length - visibleSegments.length;

  const lanesShown = Math.max(
    visibleSegments.reduce((m, s) => Math.max(m, (s.lane ?? 0) + 1), 0),
    1,
  );

  return (
    <div className="grid grid-cols-7 relative" style={{ minHeight: 72 + lanesShown * 26 }}>
      {week.map((day, di) => {
        const isOtherMonth = !isSameMonth(day, referenceDate);
        const isToday = isSameDay(day, today);
        return (
          <div
            key={di}
            className={cn(
              'border-r last:border-r-0 px-1.5 py-1.5',
              isOtherMonth && 'bg-muted/20 text-muted-foreground/60',
              isWeekend(day) && !isOtherMonth && 'bg-muted/10',
            )}
          >
            <div
              className={cn(
                'text-xs font-semibold tabular-nums',
                isToday && 'inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground',
              )}
            >
              {format(day, 'd')}
            </div>
          </div>
        );
      })}

      {/* Overlay com as barras */}
      <div className="absolute inset-x-0 top-7 bottom-6 px-1 pointer-events-none">
        {visibleSegments.map((seg, i) => (
          <button
            key={`${seg.event.id}-${i}`}
            type="button"
            onClick={() => onEventClick?.(seg.event)}
            className={cn(
              'absolute pointer-events-auto text-left rounded-md text-[11px] truncate px-1.5 py-0.5',
              'hover:ring-1 hover:ring-primary/40',
              seg.startsBefore && 'rounded-l-none',
              seg.endsAfter && 'rounded-r-none',
            )}
            style={{
              left: `calc(${(seg.startCol / 7) * 100}% + 2px)`,
              width: `calc(${(seg.span / 7) * 100}% - 4px)`,
              top: (seg.lane ?? 0) * 26,
              height: 22,
            }}
            aria-label={`Evento ${seg.event.id}`}
          >
            {renderEvent(seg.event)}
          </button>
        ))}
      </div>

      {overflow > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute right-2 bottom-1 text-[10px] text-primary hover:underline pointer-events-auto"
        >
          +{overflow} mais
        </button>
      )}
      {expanded && overflow === 0 && segments.length > MAX_LANES_DEFAULT && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="absolute right-2 bottom-1 text-[10px] text-muted-foreground hover:underline pointer-events-auto"
        >
          Recolher
        </button>
      )}
    </div>
  );
}

interface AgendaProps<T> {
  referenceDate: Date;
  events: ProjectCalendarEvent<T>[];
  renderEvent: (event: ProjectCalendarEvent<T>) => ReactNode;
  onEventClick?: (event: ProjectCalendarEvent<T>) => void;
  emptyMessage: string;
}

function Agenda<T>({ referenceDate, events, renderEvent, onEventClick, emptyMessage }: AgendaProps<T>) {
  const days = useMemo(() => {
    const weeks = buildMonthWeeks(referenceDate);
    return weeks.flat().filter((d) => isSameMonth(d, referenceDate));
  }, [referenceDate]);

  const today = getTodayLocal();
  const populated = days
    .map((day) => ({ day, dayEvents: eventsOnDay(events, day) }))
    .filter((entry) => entry.dayEvents.length > 0);

  if (populated.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card divide-y">
      {populated.map(({ day, dayEvents }) => (
        <div key={day.getTime()} className="px-4 py-3 flex gap-4">
          <div className="w-20 shrink-0">
            <div
              className={cn(
                'text-xs font-semibold uppercase tracking-wide tabular-nums',
                isSameDay(day, today) && 'text-primary',
              )}
            >
              {format(day, "EEE, d 'de' MMM", { locale: ptBR })}
            </div>
            <div className="text-[10px] text-muted-foreground">{dayEvents.length} evento(s)</div>
          </div>
          <div className="flex-1 space-y-1.5">
            {dayEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onEventClick?.(event)}
                className="w-full text-left rounded-md hover:bg-accent/40 transition-colors p-1"
              >
                {renderEvent(event)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Legend({ items }: { items: ProjectCalendarLegendItem[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ background: item.color }}
            aria-hidden
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
