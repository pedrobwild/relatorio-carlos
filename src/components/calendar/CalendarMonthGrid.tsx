/**
 * CalendarMonthGrid — Google-Calendar style month view.
 * Renders a 7-col grid (Mon-Sun) for the visible month. Each activity becomes
 * a colored bar spanning its [planned_start, planned_end] interval, clipped
 * to each week row. Up to 3 lanes per row by default; clicking"+N mais"
 * expands the entire week inline so every lane is visible without leaving
 * the month view.
 *
 * Layout uses fixed pixel tokens (DAY_NUMBER_AREA + LANE_HEIGHT * lanes +
 * FOOTER_AREA) so the overlay grid always aligns with the day columns
 * regardless of how many lanes are shown.
 */
import { useMemo, useState } from "react";
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
} from "date-fns";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  CalendarDays,
  CheckCircle2,
  PlayCircle,
  Clock,
  AlertTriangle,
  UserRound,
  CalendarClock,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getProjectColor } from "@/lib/taskUtils";
import { parseLocalDate, getTodayLocal } from "@/lib/activityStatus";
import type { WeekActivity } from "@/hooks/useWeekActivities";
import type { PurchaseCalendarEvent } from "@/hooks/usePurchasesByCreationRange";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ptBR } from "date-fns/locale";

/**
 * Determina o status visual de uma atividade para exibir no tooltip:
 * -"Concluída": tem actual_end
 * -"Em andamento": tem actual_start mas não actual_end
 * -"Atrasada (não concluída)": planned_end < hoje e não foi concluída
 * -"Atrasada (não iniciada)": planned_start <= hoje, sem actual_start, e ainda não venceu
 * -"Planejada": ainda não iniciada e dentro do prazo
 */
function getActivityStatus(a: WeekActivity): {
  label: string;
  Icon: typeof CheckCircle2;
  className: string;
} {
  const today = getTodayLocal();
  if (a.actual_end) {
    return {
      label: "Concluída",
      Icon: CheckCircle2,
      className: "text-emerald-600",
    };
  }
  if (a.actual_start) {
    return {
      label: "Em andamento",
      Icon: PlayCircle,
      className: "text-blue-600",
    };
  }
  const plannedStart = parseLocalDate(a.planned_start);
  const plannedEnd = parseLocalDate(a.planned_end);
  if (plannedEnd < today) {
    return {
      label: "Atrasada — não concluída",
      Icon: AlertTriangle,
      className: "text-destructive",
    };
  }
  if (plannedStart <= today) {
    return {
      label: "Atrasada — não iniciada",
      Icon: AlertTriangle,
      className: "text-destructive",
    };
  }
  return {
    label: "Planejada",
    Icon: Clock,
    className: "text-muted-foreground",
  };
}

interface Props {
  refDate: Date;
  activities: WeekActivity[];
  onActivityClick: (a: WeekActivity) => void;
  /**
   * Informações sobre obras com etapas anteriores à semana visível ainda
   * não concluídas. Inclui o conjunto de IDs e a data (planned_end) MAIS
   * RECENTE entre as pendências, usada para enriquecer o CTA do tooltip.
   */
  projectsWithOverduePrevious?: {
    ids: Set<string>;
    latestByProject: Map<string, string>;
  };
  /** Callback para navegar até a edição do cronograma daquela obra. */
  onReplanSchedule?: (projectId: string) => void;
  /**
   * Mapa YYYY-MM-DD → solicitações de compra criadas naquele dia.
   * Renderizado como badge no canto superior direito de cada célula do mês.
   */
  purchasesByDay?: Map<string, PurchaseCalendarEvent[]>;
}

// Layout tokens (px). Keeping these fixed guarantees lanes never overlap and
// stay perfectly aligned with the day columns underneath them.
const MAX_BARS_PER_ROW = 3;
const DAY_NUMBER_AREA = 30; // top space reserved for the day number chip
const LANE_HEIGHT = 30; // 26px bar (2 linhas) + ~4px vertical gap
const LANE_GAP = 4; // visual gap between lanes
const FOOTER_AREA = 24; // bottom space for"+N mais" / Expandir / Recolher
const ROW_BASE_PADDING = 8;
const EXPANDED_BOTTOM_PADDING = 16; // extra breathing room below last lane when expanded
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface BarSegment {
  activity: WeekActivity;
  startCol: number; // 0..6
  span: number; // 1..7
  startsBefore: boolean;
  endsAfter: boolean;
}

export function CalendarMonthGrid({
  refDate,
  activities,
  onActivityClick,
  projectsWithOverduePrevious,
  onReplanSchedule,
  purchasesByDay,
}: Props) {
  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const today = getTodayLocal();

  // Confirmação antes de navegar para o cronograma — evita cliques acidentais
  // dentro do tooltip que poderiam tirar o usuário do contexto do calendário.
  const [replanTarget, setReplanTarget] = useState<{
    projectId: string;
    projectName: string;
  } | null>(null);

  const weeks = useMemo(() => {
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const w: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) w.push(days.slice(i, i + 7));
    return w;
  }, [gridStart.getTime(), gridEnd.getTime()]);

  // O WeekRow recebe um handler que apenas abre o dialog de confirmação.
  // A navegação real só acontece após o usuário confirmar.
  const handleRequestReplan = onReplanSchedule
    ? (projectId: string, projectName: string) =>
        setReplanTarget({ projectId, projectName })
    : undefined;

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
              projectsWithOverduePrevious={projectsWithOverduePrevious}
              onRequestReplan={handleRequestReplan}
              purchasesByDay={purchasesByDay}
            />
          ))}
        </div>
      </div>

      <AlertDialog
        open={!!replanTarget}
        onOpenChange={(open) => {
          if (!open) setReplanTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replanejar cronograma?</AlertDialogTitle>
            <AlertDialogDescription>
              Você sairá do calendário e abrirá o cronograma da obra
              {replanTarget ? `"${replanTarget.projectName}"` : ""} para revisar
              etapas anteriores ainda não concluídas. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (replanTarget && onReplanSchedule) {
                  onReplanSchedule(replanTarget.projectId);
                }
                setReplanTarget(null);
              }}
            >
              Abrir cronograma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

function WeekRow({
  week,
  monthStart,
  today,
  activities,
  onActivityClick,
  projectsWithOverduePrevious,
  onRequestReplan,
  purchasesByDay,
}: {
  week: Date[];
  monthStart: Date;
  today: Date;
  activities: WeekActivity[];
  onActivityClick: (a: WeekActivity) => void;
  projectsWithOverduePrevious?: {
    ids: Set<string>;
    latestByProject: Map<string, string>;
  };
  /** Pede confirmação ao usuário antes de navegar para o cronograma. */
  onRequestReplan?: (projectId: string, projectName: string) => void;
  purchasesByDay?: Map<string, PurchaseCalendarEvent[]>;
}) {
  // Inline expansion: when true, render every lane (no cap) for this row.
  const [expanded, setExpanded] = useState(false);
  const weekStart = week[0];
  const weekEnd = week[6];

  const segments: BarSegment[] = useMemo(() => {
    const segs: BarSegment[] = [];
    for (const a of activities) {
      const aStart = parseLocalDate(a.planned_start);
      const aEnd = parseLocalDate(a.planned_end);
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
            !(
              seg.startCol + seg.span - 1 < other.startCol ||
              seg.startCol > other.startCol + other.span - 1
            ),
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

  const showsFooter = overflow; // either"Expandir" (collapsed) or"Recolher" (expanded)
  // When collapsed, reserve a thin strip for the per-column"+N mais" markers
  // so they don't collide with the footer toggle.
  const moreStripHeight = !expanded && overflow ? 18 : 0;
  const lanesArea =
    visibleLanes.length * LANE_HEIGHT +
    Math.max(0, visibleLanes.length - 1) * LANE_GAP;
  // The week row must always reserve enough vertical space to render every
  // visible lane + day number + optional"+N mais" strip + optional footer
  // toggle, so bars never spill into the next week row. When expanded, add
  // extra bottom padding so the last bar never visually collides with the
  //"Recolher" toggle anchored to the row's bottom-right.
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
    <div
      className="relative grid grid-cols-7"
      style={{ minHeight: finalHeight }}
    >
      {/* Day cells (background + day number + purchase badge) */}
      {week.map((day, di) => {
        const inMonth = isSameMonth(day, monthStart);
        const isToday = isSameDay(day, today);
        const dayKey = format(day, "yyyy-MM-dd");
        const dayPurchases = purchasesByDay?.get(dayKey) ?? [];
        return (
          <div
            key={di}
            className={cn(
              "relative border-r last:border-r-0 px-1.5 pt-1 pb-1",
              !inMonth && "bg-muted/20 text-muted-foreground/60",
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <div
                className={cn(
                  "inline-flex items-center justify-center h-6 min-w-6 text-xs rounded-full",
                  isToday &&
                    "bg-primary text-primary-foreground font-semibold px-1.5",
                  !isToday && "font-medium",
                )}
              >
                {format(day, "d")}
              </div>
              {dayPurchases.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30 px-1.5 h-5 text-[10px] font-semibold leading-none hover:bg-amber-500/25 transition-colors pointer-events-auto"
                      aria-label={`${dayPurchases.length} solicitação(ões) de compra criada(s) neste dia`}
                    >
                      <ShoppingCart className="h-2.5 w-2.5" />
                      {dayPurchases.length}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="end"
                    sideOffset={6}
                    collisionPadding={12}
                    className="w-[min(320px,calc(100vw-24px))] p-0 overflow-hidden shadow-xl"
                  >
                    <div className="px-3 py-2 border-b bg-amber-500/10">
                      <div className="text-[11px] font-semibold flex items-center gap-1.5">
                        <ShoppingCart className="h-3 w-3" />
                        {dayPurchases.length} compra(s) solicitada(s)
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {format(day, "dd'de' MMM'de' yyyy", { locale: ptBR })}
                      </div>
                    </div>
                    <div className="max-h-[260px] overflow-y-auto divide-y">
                      {dayPurchases.slice(0, 8).map((p) => (
                        <div key={p.id} className="px-3 py-2 text-[11px]">
                          <div className="font-medium truncate">
                            {p.item_name}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {p.project_name}
                            {p.supplier_name && (
                              <span> · {p.supplier_name}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {dayPurchases.length > 8 && (
                        <div className="px-3 py-1.5 text-[10px] text-muted-foreground italic">
                          +{dayPurchases.length - 8} outra(s)…
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
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
                const startDate = parseLocalDate(seg.activity.planned_start);
                const endDate = parseLocalDate(seg.activity.planned_end);
                const sameDay = isSameDay(startDate, endDate);
                const durationDays =
                  differenceInCalendarDays(endDate, startDate) + 1;
                // Estados visuais da barra:
                // -"completed": atividade concluída (actual_end) → mantém cor original com leve fade
                // -"overdue": data planejada já passou e não foi concluída → cinza + badge de alerta
                // -"past": já passou e foi concluída → acinzentada (passado)
                // -"current/future": mantém cor cheia
                // Usa o"hoje" local (mesmo cálculo do restante da grade) para
                // evitar divergência entre datas-só-data (sem fuso) e Date()
                // (com fuso do navegador).
                const isCompleted = !!seg.activity.actual_end;
                const isStarted = !!seg.activity.actual_start;
                const isPastEnd = endDate < today;
                const isOverdueEnd = isPastEnd && !isCompleted;
                // Não iniciada no prazo: já passou (ou é) a data de início planejada,
                // não foi marcada como iniciada e ainda não venceu o prazo final.
                const isOverdueStart =
                  !isStarted &&
                  !isCompleted &&
                  startDate <= today &&
                  !isPastEnd;
                const isOverdue = isOverdueEnd || isOverdueStart;
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
                          "relative h-full overflow-hidden px-1.5 py-[1px] mx-[1px] text-left rounded-sm border flex flex-col justify-center",
                          "hover:ring-2 hover:ring-primary/40 transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/40",
                          // Cor padrão (em andamento / futura / atrasada-não-iniciada mantém cor da obra)
                          !isPastEnd && [color.bg, color.border],
                          // Concluída no passado: cinza neutro
                          isPastDone &&
                            "bg-muted/60 border-muted-foreground/20 text-muted-foreground",
                          // Atrasada (passou o fim sem concluir): cinza com borda vermelha
                          isOverdueEnd &&
                            "bg-muted/70 border-destructive/50 text-muted-foreground",
                          // Atrasada por não ter iniciado: mantém cor da obra mas adiciona contorno destrutivo
                          isOverdueStart &&
                            "ring-1 ring-destructive/60 border-destructive/60",
                          seg.startsBefore && "rounded-l-none border-l-0",
                          seg.endsAfter && "rounded-r-none border-r-0",
                        )}
                      >
                        {isOverdue && (
                          <span
                            className="absolute -top-1 -right-1 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold leading-none shadow-sm ring-1 ring-background z-10"
                            title={
                              isOverdueStart
                                ? "Atividade atrasada — não iniciada"
                                : "Atividade atrasada — não concluída"
                            }
                            aria-label="Atrasada"
                          >
                            !
                          </span>
                        )}
                        {/* Layout em duas linhas: atividade (destaque) + condomínio/cliente (contexto) */}
                        <span
                          className={cn(
                            "block truncate text-[10.5px] leading-[11px] font-semibold",
                            isPastDone && "line-through opacity-80",
                          )}
                          title={seg.activity.description}
                        >
                          {seg.activity.description}
                        </span>
                        <span
                          className="block truncate text-[9px] leading-[10px] opacity-70 mt-[1px]"
                          title={[
                            seg.activity.project_name,
                            seg.activity.client_name,
                          ]
                            .filter(Boolean)
                            .join(" ·")}
                        >
                          {seg.activity.project_name}
                          {seg.activity.client_name && (
                            <span className="opacity-80">
                              {" "}
                              · {seg.activity.client_name}
                            </span>
                          )}
                        </span>
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
                        <div
                          className={cn(
                            "px-3 py-2 border-b",
                            color.bg,
                            color.border,
                          )}
                        >
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
                              Etapa:{" "}
                              <span className="font-medium text-foreground">
                                {seg.activity.etapa}
                              </span>
                            </div>
                          )}

                          <div className="flex items-start gap-1.5 text-[10.5px] text-muted-foreground">
                            <CalendarDays className="h-3 w-3 mt-0.5 shrink-0" />
                            <div className="flex flex-col gap-0.5 min-w-0">
                              {sameDay ? (
                                <span>
                                  <span className="text-foreground font-medium">
                                    {format(startDate, "dd'de' MMM", {
                                      locale: ptBR,
                                    })}
                                  </span>
                                  {""}· 1 dia
                                </span>
                              ) : (
                                <>
                                  <span>
                                    <span className="text-foreground font-medium">
                                      {format(startDate, "dd'de' MMM", {
                                        locale: ptBR,
                                      })}
                                    </span>
                                    {" →"}
                                    <span className="text-foreground font-medium">
                                      {format(endDate, "dd'de' MMM", {
                                        locale: ptBR,
                                      })}
                                    </span>
                                  </span>
                                  <span className="opacity-80">
                                    {durationDays}{" "}
                                    {durationDays === 1 ? "dia" : "dias"}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {(seg.activity.actual_start ||
                            seg.activity.actual_end) && (
                            <div className="text-[10.5px] text-muted-foreground border-t pt-1.5">
                              {seg.activity.actual_start && (
                                <div>
                                  Iniciada em{""}
                                  <span className="text-foreground font-medium">
                                    {format(
                                      parseLocalDate(seg.activity.actual_start),
                                      "dd/MM/yyyy",
                                      { locale: ptBR },
                                    )}
                                  </span>
                                </div>
                              )}
                              {seg.activity.actual_end && (
                                <div>
                                  Concluída em{""}
                                  <span className="text-foreground font-medium">
                                    {format(
                                      parseLocalDate(seg.activity.actual_end),
                                      "dd/MM/yyyy",
                                      { locale: ptBR },
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Status + Responsável em linhas separadas para não truncar */}
                          <div className="flex flex-col gap-1.5 pt-1.5 border-t">
                            <div
                              className={cn(
                                "flex items-center gap-1.5 text-[10.5px] font-medium",
                                status.className,
                              )}
                            >
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

                          {/* CTA: Replanejar cronograma — aparece quando esta obra
 tem alguma atividade anterior à semana visível ainda
 não concluída (sinal forte de que o cronograma está
 fora do plano e precisa ser revisto). */}
                          {(() => {
                            if (
                              !projectsWithOverduePrevious?.ids.has(
                                seg.activity.project_id,
                              ) ||
                              !onRequestReplan
                            ) {
                              return null;
                            }
                            const latestIso =
                              projectsWithOverduePrevious.latestByProject.get(
                                seg.activity.project_id,
                              );
                            const latestLabel = latestIso
                              ? format(
                                  parseLocalDate(latestIso),
                                  "dd/MM/yyyy",
                                  {
                                    locale: ptBR,
                                  },
                                )
                              : null;
                            return (
                              <div className="pt-2 border-t">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRequestReplan(
                                      seg.activity.project_id,
                                      seg.activity.project_name,
                                    );
                                  }}
                                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-destructive text-destructive-foreground text-[11px] font-semibold px-2.5 py-1.5 hover:bg-destructive/90 transition-colors shadow-sm text-center"
                                  title={
                                    latestLabel
                                      ? `Há etapas anteriores a ${latestLabel} ainda não concluídas. Abrir o cronograma para replanejar.`
                                      : "Esta obra tem etapas anteriores não concluídas. Abrir o cronograma para replanejar."
                                  }
                                >
                                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">
                                    {latestLabel
                                      ? `Replanejar — pendência anterior a ${latestLabel}`
                                      : "Replanejar cronograma"}
                                  </span>
                                </button>
                                <p className="text-[9.5px] text-muted-foreground mt-1 leading-snug">
                                  {latestLabel
                                    ? `Etapa pendente fora desta semana (anterior a ${latestLabel}).`
                                    : "Há etapas anteriores desta obra ainda não concluídas."}
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}

        {/* Per-column"+N mais" indicators (only when collapsed) */}
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
