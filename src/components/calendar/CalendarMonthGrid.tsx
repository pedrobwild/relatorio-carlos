/**
 * CalendarMonthGrid — Google-Calendar style month view.
 * Renders a 7-col grid (Mon-Sun) for the visible month, with each activity
 * shown as a colored bar spanning its [planned_start, planned_end] interval,
 * clipped to each week row. Up to 3 bars per day; "+N mais" expands the
 * entire week row inline so all bars become visible without leaving the view.
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
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProjectColor } from '@/lib/taskUtils';
import type { WeekActivity } from '@/hooks/useWeekActivities';

interface Props {
  refDate: Date;
  activities: WeekActivity[];
  onActivityClick: (a: WeekActivity) => void;
}

const MAX_BARS_PER_ROW = 3;
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
  // Inline expansion: show every lane (no "+N mais" cap) for this row.
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
    segs.sort((x, y) => {
      if (y.span !== x.span) return y.span - x.span;
      return x.activity.planned_start.localeCompare(y.activity.planned_start);
    });
    return segs;
  }, [activities, weekStart.getTime(), weekEnd.getTime()]);

  // Greedy lane packing
  const lanes: BarSegment[][] = [];
  for (const seg of segments) {
    let placed = false;
    for (const lane of lanes) {
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
    if (!placed) lanes.push([seg]);
  }

  const overflow = lanes.length > MAX_BARS_PER_ROW;
  const visibleLanes = expanded ? lanes : lanes.slice(0, MAX_BARS_PER_ROW);
  const hiddenLaneCount = Math.max(0, lanes.length - MAX_BARS_PER_ROW);

  // Per-column hidden counts (used only when collapsed).
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

  // Row height adapts to expansion: header + lanes*24 + footer.
  const laneHeight = 22; // px
  const baseTop = 28; // header (day numbers) area
  const lanesRendered = visibleLanes.length;
  const footer = (!expanded && hiddenCountByCol.some((n) => n > 0)) || (expanded && overflow) ? 22 : 6;
  const minHeight = Math.max(110, baseTop + lanesRendered * laneHeight + footer);

  const handleExpand = () => setExpanded(true);
  const handleCollapse = () => setExpanded(false);

  return (
    <div className="relative grid grid-cols-7" style={{ minHeight }}>
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

      {/* Bar overlay */}
      <div className="absolute inset-x-0 top-7 bottom-0 grid grid-cols-7 gap-y-1 px-1 pointer-events-none">
        <div className="col-span-7 grid grid-cols-7 gap-x-1 gap-y-1 content-start pointer-events-auto">
          {visibleLanes.map((lane, laneIdx) =>
            lane.map((seg) => {
              const color = getProjectColor(seg.activity.project_id);
              return (
                <button
                  key={`${laneIdx}-${seg.activity.id}`}
                  type="button"
                  onClick={() => onActivityClick(seg.activity)}
                  title={`${seg.activity.project_name} — ${seg.activity.description}`}
                  style={{
                    gridColumn: `${seg.startCol + 1} / span ${seg.span}`,
                    gridRow: laneIdx + 1,
                  }}
                  className={cn(
                    'h-5 truncate text-[10.5px] leading-5 px-1.5 text-left rounded-sm border',
                    'hover:ring-2 hover:ring-primary/40 transition-shadow',
                    color.bg,
                    color.border,
                    seg.startsBefore && 'rounded-l-none border-l-0',
                    seg.endsAfter && 'rounded-r-none border-r-0',
                  )}
                >
                  <span className="font-medium">{seg.activity.project_name}</span>
                  <span className="opacity-70"> · {seg.activity.description}</span>
                </button>
              );
            }),
          )}

          {/* "+N mais" per column (only when collapsed) — expands the whole row */}
          {!expanded &&
            hiddenCountByCol.map((n, col) =>
              n > 0 ? (
                <button
                  key={`more-${col}`}
                  type="button"
                  onClick={handleExpand}
                  style={{ gridColumn: `${col + 1} / span 1`, gridRow: MAX_BARS_PER_ROW + 1 }}
                  className="text-[10px] text-primary hover:underline text-left px-1.5 leading-4"
                  title={`Mostrar todas as ${lanes.length} faixas desta semana`}
                >
                  +{n} mais
                </button>
              ) : null,
            )}
        </div>
      </div>

      {/* Expand / collapse footer for the whole row */}
      {(overflow || expanded) && (
        <div className="absolute bottom-1 right-2 pointer-events-auto">
          {expanded ? (
            <button
              type="button"
              onClick={handleCollapse}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              title="Recolher esta semana"
            >
              <ChevronsDownUp className="h-3 w-3" />
              Recolher
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExpand}
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
