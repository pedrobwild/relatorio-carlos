import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { format, parseISO, differenceInDays, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  User,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PrestadorEntry {
  id: string;
  fornecedor_id: string;
  fornecedor_nome: string;
  project_id: string;
  project_name: string;
  item_name: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

// Color palette for different projects
const PROJECT_COLORS = [
  "bg-primary/70 border-primary",
  "bg-blue-500/70 border-blue-500",
  "bg-emerald-500/70 border-emerald-500",
  "bg-amber-500/70 border-amber-500",
  "bg-violet-500/70 border-violet-500",
  "bg-rose-500/70 border-rose-500",
  "bg-cyan-500/70 border-cyan-500",
  "bg-orange-500/70 border-orange-500",
];

export function PrestadorCalendar({ onNew }: { onNew?: () => void } = {}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const baseDate = useMemo(() => {
    const now = new Date();
    return weekOffset === 0 ? now : addWeeks(now, weekOffset);
  }, [weekOffset]);

  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
  // Show 3 weeks for broader view
  const viewStart = subWeeks(weekStart, 0);
  const viewEnd = addWeeks(weekEnd, 2);
  const days = eachDayOfInterval({ start: viewStart, end: viewEnd });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: [
      "prestador-calendar",
      viewStart.toISOString(),
      viewEnd.toISOString(),
    ],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_purchases")
        .select(
          "id, fornecedor_id, supplier_name, project_id, item_name, start_date, end_date, status, created_at, projects!inner(name), fornecedores(nome)",
        )
        .eq("purchase_type", "prestador")
        .neq("status", "cancelled")
        .not("start_date", "is", null)
        .not("end_date", "is", null)
        .lte("start_date", format(viewEnd, "yyyy-MM-dd"))
        .gte("end_date", format(viewStart, "yyyy-MM-dd"));

      if (error) throw error;

      return (data || []).map((d: any) => ({
        id: d.id,
        fornecedor_id: d.fornecedor_id || d.id,
        fornecedor_nome: d.fornecedores?.nome || d.supplier_name || "Sem nome",
        project_id: d.project_id,
        project_name: (d.projects as any)?.name || "Projeto",
        item_name: d.item_name,
        start_date: d.start_date,
        end_date: d.end_date,
        status: d.status,
        created_at: d.created_at,
      })) as PrestadorEntry[];
    },
  });

  // Group entries by fornecedor
  const grouped = useMemo(() => {
    const map = new Map<string, { nome: string; entries: PrestadorEntry[] }>();
    entries.forEach((e) => {
      const key = e.fornecedor_id;
      if (!map.has(key)) map.set(key, { nome: e.fornecedor_nome, entries: [] });
      map.get(key)!.entries.push(e);
    });
    return Array.from(map.entries()).sort((a, b) =>
      a[1].nome.localeCompare(b[1].nome),
    );
  }, [entries]);

  // Map project IDs to colors
  const projectColorMap = useMemo(() => {
    const uniqueProjects = [...new Set(entries.map((e) => e.project_id))];
    const map = new Map<string, string>();
    uniqueProjects.forEach((pid, i) =>
      map.set(pid, PROJECT_COLORS[i % PROJECT_COLORS.length]),
    );
    return map;
  }, [entries]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Carregando calendário...
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center space-y-3">
        <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Nenhum prestador com período de execução definido nesta faixa de
          datas.
        </p>
        {onNew && (
          <Button size="sm" onClick={onNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Prestador
          </Button>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Header controls */}
        <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Agenda de Prestadores</h3>
            <span className="text-xs text-muted-foreground">
              ({grouped.length} prestadores)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setWeekOffset(0)}
            >
              Hoje
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset((w) => w + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {onNew && (
              <Button size="sm" className="h-7 text-xs ml-2" onClick={onNew}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Novo Prestador
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div
              className="grid border-b bg-muted/20"
              style={{
                gridTemplateColumns: `140px repeat(${days.length}, 1fr)`,
              }}
            >
              <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground border-r">
                Prestador
              </div>
              {days.map((day, i) => {
                const isToday = isSameDay(day, today);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div
                    key={i}
                    className={cn(
                      "px-0.5 py-1.5 text-center border-r last:border-r-0",
                      isToday && "bg-primary/10",
                      isWeekend && "bg-muted/40",
                    )}
                  >
                    <div className="text-[9px] text-muted-foreground uppercase">
                      {format(day, "EEE", { locale: ptBR })}
                    </div>
                    <div
                      className={cn(
                        "text-[11px] font-medium",
                        isToday && "text-primary font-bold",
                      )}
                    >
                      {format(day, "dd")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            {grouped.map(([fornecedorId, { nome, entries: fEntries }]) => (
              <div
                key={fornecedorId}
                className="grid border-b last:border-b-0 hover:bg-muted/10 transition-colors"
                style={{
                  gridTemplateColumns: `140px repeat(${days.length}, 1fr)`,
                }}
              >
                <div className="px-2 py-2 border-r flex items-center gap-1.5 min-h-[40px]">
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium truncate">{nome}</span>
                </div>
                {days.map((day, dayIdx) => {
                  const isToday = isSameDay(day, today);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                  // Find entries that cover this day
                  const activeEntries = fEntries.filter((e) => {
                    const start = parseISO(e.start_date);
                    const end = parseISO(e.end_date);
                    return isWithinInterval(day, { start, end });
                  });

                  if (activeEntries.length === 0) {
                    return (
                      <div
                        key={dayIdx}
                        className={cn(
                          "border-r last:border-r-0 min-h-[40px]",
                          isToday && "bg-primary/5",
                          isWeekend && "bg-muted/20",
                        )}
                      />
                    );
                  }

                  // Check if this is the first day of a block
                  const entry = activeEntries[0];
                  const entryStart = parseISO(entry.start_date);
                  const isBlockStart = isSameDay(day, entryStart);
                  const entryEnd = parseISO(entry.end_date);
                  const colorClass =
                    projectColorMap.get(entry.project_id) || PROJECT_COLORS[0];

                  return (
                    <Tooltip key={dayIdx}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "border-r last:border-r-0 min-h-[40px] flex items-center",
                            isToday && "bg-primary/5",
                            activeEntries.length > 1 &&
                              "ring-1 ring-[hsl(var(--warning))] ring-inset",
                          )}
                        >
                          <div
                            className={cn(
                              "h-6 w-full border-y",
                              colorClass,
                              isBlockStart && "rounded-l ml-0.5",
                              isSameDay(day, entryEnd) && "rounded-r mr-0.5",
                            )}
                          >
                            {isBlockStart && (
                              <span className="text-[9px] text-white font-medium px-1 truncate block leading-6">
                                {entry.project_name.slice(0, 12)}
                              </span>
                            )}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px]">
                        {activeEntries.map((e, i) => (
                          <div
                            key={i}
                            className={cn(
                              "text-xs",
                              i > 0 && "mt-1 pt-1 border-t",
                            )}
                          >
                            <p className="font-semibold">{e.fornecedor_nome}</p>
                            <p className="text-muted-foreground">
                              {e.item_name}
                            </p>
                            <p className="text-muted-foreground">
                              {e.project_name}
                            </p>
                            <p className="text-muted-foreground">
                              {format(parseISO(e.start_date), "dd/MM")} –{" "}
                              {format(parseISO(e.end_date), "dd/MM")}
                            </p>
                            <p className="text-muted-foreground/80 text-[10px] mt-0.5">
                              Solicitado em{" "}
                              {format(parseISO(e.created_at), "dd/MM/yyyy", {
                                locale: ptBR,
                              })}
                            </p>
                            {activeEntries.length > 1 && i === 0 && (
                              <p className="text-[hsl(var(--warning))] font-medium mt-0.5">
                                ⚠ Conflito de agenda
                              </p>
                            )}
                          </div>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="border-t px-3 py-2 flex flex-wrap gap-3">
          {Array.from(projectColorMap.entries()).map(([pid, colorClass]) => {
            const projectName =
              entries.find((e) => e.project_id === pid)?.project_name || "";
            return (
              <div key={pid} className="flex items-center gap-1.5">
                <div className={cn("h-3 w-3 rounded-sm border", colorClass)} />
                <span className="text-[10px] text-muted-foreground">
                  {projectName}
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="h-3 w-3 rounded-sm ring-1 ring-[hsl(var(--warning))]" />
            <span className="text-[10px] text-muted-foreground">Conflito</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
