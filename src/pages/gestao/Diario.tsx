/**
 * /gestao/diario — Diário de obra (RDO), visão geral staff-only.
 *
 * Mostra, por obra ativa, quais dias do período têm RDO preenchido e
 * quais estão faltando. Padrão: últimos 10 dias úteis. Clique em uma
 * célula abre /gestao/diario/:projectId/:date para editar o dia.
 *
 * Guardrails: staff-only (rota StaffRoute + RLS). Nenhum componente
 * client-facing consome esta página.
 */
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader, EmptyState } from "@/components/ui-premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import {
  eachDateInclusive,
  useDailyLogCoverage,
} from "@/hooks/useDailyLogCoverage";
import {
  addBusinessDays,
  isNonBusinessDay,
} from "@/lib/businessDays";
import { cn } from "@/lib/utils";

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map((v) => Number(v));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function fmtShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtWeekday(d: Date): string {
  return d
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "");
}

/**
 * Janela padrão: hoje e 9 dias úteis anteriores (total: 10 dias úteis).
 * Devolve `startDate` (dia útil mais antigo) e `endDate` (hoje).
 */
function defaultWindow(): { start: string; end: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = addBusinessDays(today, -9);
  return { start: toIso(start), end: toIso(today) };
}

export default function Diario() {
  const [params, setParams] = useSearchParams();
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    new Set(),
  );

  const projectsQ = useProjectsQuery();
  const projects = useMemo(
    () =>
      (projectsQ.data ?? [])
        .filter((p) => p.status === "active")
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [projectsQ.data],
  );

  const activeIds = useMemo(() => {
    if (selectedProjects.size === 0) return projects.map((p) => p.id);
    return projects.filter((p) => selectedProjects.has(p.id)).map((p) => p.id);
  }, [projects, selectedProjects]);

  const defaults = defaultWindow();
  const startIso = params.get("start") ?? defaults.start;
  const endIso = params.get("end") ?? defaults.end;

  const setRange = (start: string, end: string) => {
    const next = new URLSearchParams(params);
    next.set("start", start);
    next.set("end", end);
    setParams(next, { replace: true });
  };

  const shiftDays = (deltaBusinessDays: number) => {
    const s = addBusinessDays(parseIso(startIso), deltaBusinessDays);
    const e = addBusinessDays(parseIso(endIso), deltaBusinessDays);
    setRange(toIso(s), toIso(e));
  };

  const resetWindow = () => setRange(defaults.start, defaults.end);

  const dates = useMemo(
    () => eachDateInclusive(parseIso(startIso), parseIso(endIso)),
    [startIso, endIso],
  );

  const coverageQ = useDailyLogCoverage(activeIds, startIso, endIso);

  const noProjects = !projectsQ.isLoading && projects.length === 0;

  const toggleProject = (id: string) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearProjectFilter = () => setSelectedProjects(new Set());

  return (
    <PageContainer>
      <PageHeader
        title="Diário de obra"
        description="RDO por obra × dia. Verde = preenchido, vazio = pendente. Toque para abrir o dia."
      />

      {noProjects ? (
        <EmptyState
          icon={BookOpenCheck}
          title="Sem obras ativas"
          description="Não há obras ativas no seu escopo para acompanhar o diário."
        />
      ) : (
        <div className="space-y-4">
          {/* Controles de período + filtro */}
          <Card>
            <CardContent className="p-3 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => shiftDays(-5)}
                  aria-label="Semana anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium tabular-nums">
                    {fmtShort(parseIso(startIso))} — {fmtShort(parseIso(endIso))}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => shiftDays(5)}
                  aria-label="Próxima semana"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9"
                  onClick={resetWindow}
                >
                  Últimos 10 dias úteis
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Obras:
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={selectedProjects.size === 0 ? "default" : "outline"}
                  className="h-8"
                  onClick={clearProjectFilter}
                >
                  Todas ({projects.length})
                </Button>
                {projects.map((p) => {
                  const active = selectedProjects.has(p.id);
                  return (
                    <Button
                      key={p.id}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className="h-8"
                      onClick={() => toggleProject(p.id)}
                    >
                      {p.name}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Grade obra × dia */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {coverageQ.isLoading || projectsQ.isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="sticky left-0 z-10 bg-muted/40 text-left px-3 py-2 font-medium text-xs uppercase tracking-wide text-muted-foreground min-w-[180px]">
                        Obra
                      </th>
                      {dates.map((iso) => {
                        const d = parseIso(iso);
                        const weekend = isNonBusinessDay(d);
                        return (
                          <th
                            key={iso}
                            className={cn(
                              "px-1.5 py-2 font-medium text-[11px] text-center min-w-[52px]",
                              weekend
                                ? "text-muted-foreground/60"
                                : "text-muted-foreground",
                            )}
                          >
                            <div className="uppercase">{fmtWeekday(d)}</div>
                            <div className="tabular-nums">{fmtShort(d)}</div>
                          </th>
                        );
                      })}
                      <th className="px-3 py-2 text-right font-medium text-xs uppercase tracking-wide text-muted-foreground min-w-[110px]">
                        Lacunas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects
                      .filter(
                        (p) =>
                          selectedProjects.size === 0 ||
                          selectedProjects.has(p.id),
                      )
                      .map((p) => {
                        const businessDates = dates.filter(
                          (iso) => !isNonBusinessDay(parseIso(iso)),
                        );
                        const gaps = businessDates.filter(
                          (iso) =>
                            !coverageQ.data?.filled.has(`${p.id}__${iso}`),
                        ).length;
                        return (
                          <tr
                            key={p.id}
                            className="border-b last:border-0 hover:bg-muted/20"
                          >
                            <td className="sticky left-0 bg-background hover:bg-muted/20 z-10 px-3 py-2 font-medium truncate max-w-[220px]">
                              {p.name}
                            </td>
                            {dates.map((iso) => {
                              const filled = coverageQ.data?.filled.has(
                                `${p.id}__${iso}`,
                              );
                              const weekend = isNonBusinessDay(parseIso(iso));
                              return (
                                <td
                                  key={iso}
                                  className="p-1 text-center align-middle"
                                >
                                  <Link
                                    to={`/gestao/diario/${p.id}/${iso}`}
                                    aria-label={`Abrir RDO de ${p.name} em ${iso}${filled ? " (preenchido)" : " (pendente)"}`}
                                    className={cn(
                                      "inline-flex items-center justify-center w-11 h-11 rounded-md border transition-colors",
                                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                      filled
                                        ? "bg-success/15 border-success/40 text-success hover:bg-success/25"
                                        : weekend
                                          ? "bg-muted/30 border-dashed border-border text-muted-foreground/60 hover:bg-muted/50"
                                          : "bg-background border-dashed border-warning/50 text-warning hover:bg-warning/10",
                                    )}
                                  >
                                    {filled ? (
                                      <Check className="h-4 w-4" />
                                    ) : (
                                      <span className="text-[10px] font-medium">
                                        {weekend ? "—" : "+"}
                                      </span>
                                    )}
                                  </Link>
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-right">
                              {gaps === 0 ? (
                                <Badge
                                  variant="outline"
                                  className="border-success/60 text-success"
                                >
                                  Em dia
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-warning/60 text-warning"
                                >
                                  {gaps} {gaps === 1 ? "dia" : "dias"} sem RDO
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Dias úteis considerados pelo calendário de SP (feriados excluídos).
            Fim de semana aparece esmaecido; sem obrigação de preenchimento.
          </p>
        </div>
      )}
    </PageContainer>
  );
}
