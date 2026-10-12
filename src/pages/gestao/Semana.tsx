/**
 * Semana — Fase 4 da reformulação do processo core.
 *
 * "O que acontece nesta obra nesta semana, e quem faz." Planejar a próxima
 * semana em 30 minutos na sexta: a semana já vem preenchida (o que sobrou +
 * cronograma), o gestor ajusta quem e quais dias. Linhas agrupadas pela
 * ETAPA do cliente; a atividade abre em gaveta.
 *
 * Interna (StaffRoute + RLS da camada de Operação). O cliente não vê.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarRange, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, PackageCheck, Sparkles, Timer, CalendarCheck2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader, EmptyState } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { shiftISODate, todayISO, longDayLabel } from "@/lib/hojeDia";
import { deadlineHealth, DEADLINE_HEALTH_LABEL, type DeadlineHealth } from "@/lib/contractDeadline";
import {
  buildWeekGrid,
  hasSaturday,
  mondayOf,
  normalizeWeekParam,
  planningMonday,
  proposeWeek,
  weekCounts,
  weekDays,
  weekLabel,
  weekMaterialSummary,
  weekRange,
  whoSuggestions,
} from "@/lib/semanaPlan";
import {
  closingIsStale,
  doneOfPlannedLabel,
  ppcLabel,
  ppcOf,
  weekClosingState,
  weekHasStarted,
  weekIsOver,
} from "@/lib/semanaFechamento";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { useObraDeadlines, useProjectDeadline } from "@/hooks/useContractDeadline";
import {
  useOpsActivities,
  useOpsAssignments,
  useOpsProjectMaterials,
  useOpsStages,
  useOpsWeekClosings,
} from "@/hooks/useOps";
import type { OpsAssignment } from "@/infra/repositories/ops.repository";
import { MobileWeekList, WeekGrid } from "@/components/gestao/semana/WeekGrid";
import { useIsMobile } from "@/hooks/use-mobile";
import { ActivityDrawer } from "@/components/gestao/semana/ActivityDrawer";
import { PlanWeekSheet } from "@/components/gestao/semana/PlanWeekSheet";
import { CloseWeekSheet } from "@/components/gestao/semana/CloseWeekSheet";
import { FichaObraSheet } from "@/components/gestao/ficha/FichaObraSheet";

const LAST_OBRA_KEY = "bwild.semana.obra";

const HEALTH_TONE: Record<DeadlineHealth, string> = {
  sem_prazo: "text-muted-foreground",
  no_prazo: "text-success",
  atencao: "text-warning",
  atrasada: "text-destructive",
};

export default function Semana() {
  const [params, setParams] = useSearchParams();
  const monday = normalizeWeekParam(params.get("semana"));
  const thisMonday = mondayOf(todayISO());
  const defaultMonday = planningMonday();
  const obraParam = params.get("obra");

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  // Obra: URL → última usada neste aparelho.
  const { data: obras = [], isLoading: obrasLoading } = useObraDeadlines();
  const obraOptions = useMemo(
    () =>
      obras
        .filter((o) => o.project_id && (o.status === "active" || o.project_id === obraParam))
        .map((o) => ({ id: o.project_id as string, name: o.project_name ?? "Obra" }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [obras, obraParam],
  );
  useEffect(() => {
    if (obraParam || obraOptions.length === 0) return;
    let last: string | null = null;
    try {
      last = window.localStorage.getItem(LAST_OBRA_KEY);
    } catch {
      /* localStorage bloqueado: segue sem lembrar a última obra */
    }
    if (last && obraOptions.some((o) => o.id === last)) setParam({ obra: last });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraParam, obraOptions]);
  useEffect(() => {
    if (!obraParam) return;
    try {
      window.localStorage.setItem(LAST_OBRA_KEY, obraParam);
    } catch {
      /* sem armazenamento: só não lembra a última obra */
    }
  }, [obraParam]);
  const projectId = obraParam ?? undefined;
  const obraName = obraOptions.find((o) => o.id === projectId)?.name;

  // Dados
  const { from, to } = weekRange(monday);
  const prev = weekRange(shiftISODate(monday, -7));
  const { data: staff = [] } = useStaffUsers();
  const staffNameById = useMemo(() => new Map(staff.map((s) => [s.id, s.nome])), [staff]);
  const { data: stages = [], isLoading: stagesLoading } = useOpsStages(projectId);
  const { data: activities = [], isLoading: actsLoading } = useOpsActivities(projectId);
  const { data: weekAsg = [], isLoading: asgLoading } = useOpsAssignments(projectId, from, to);
  const { data: prevAsg = [], isLoading: prevLoading } = useOpsAssignments(projectId, prev.from, prev.to);
  const { data: materials = [] } = useOpsProjectMaterials(projectId);
  const { data: deadline } = useProjectDeadline(projectId);
  // Complemento da tela: não entra em `loading`. Enquanto não chega (ou se a
  // consulta falhar), a tela não oferece nem cobra o fechamento.
  const { data: closings = [], isSuccess: closingsReady } = useOpsWeekClosings(projectId, monday);
  // A semana anterior entra nas sugestões ("sobrou"): espera ela chegar para
  // não abrir o "Planejar semana" com uma lista que muda depois.
  const loading = !!projectId && (stagesLoading || actsLoading || asgLoading || prevLoading);

  const days = useMemo(
    () => weekDays(monday, { includeSaturday: hasSaturday(weekAsg, monday) }),
    [monday, weekAsg],
  );
  const sections = useMemo(
    () => buildWeekGrid({ stages, activities, assignments: weekAsg, days }),
    [stages, activities, weekAsg, days],
  );
  const lastWhoByActivity = useMemo(() => {
    const m = new Map<string, Pick<OpsAssignment, "user_id" | "worker_name">>();
    const all = [...prevAsg, ...weekAsg].sort((a, b) => a.work_date.localeCompare(b.work_date));
    for (const a of all) m.set(a.activity_id, { user_id: a.user_id, worker_name: a.worker_name });
    return m;
  }, [prevAsg, weekAsg]);
  const suggestions = useMemo(() => whoSuggestions(staff, [...prevAsg, ...weekAsg]), [staff, prevAsg, weekAsg]);

  const counts = weekCounts(weekAsg, days);
  const activityIdsInWeek = useMemo(() => new Set(weekAsg.map((a) => a.activity_id)), [weekAsg]);
  const mat = weekMaterialSummary(materials, activityIdsInWeek);
  const health = deadlineHealth(deadline);

  const workingDays = useMemo(
    () => days.filter((d) => !d.holiday && d.iso < shiftISODate(monday, 5)).map((d) => d.iso),
    [days, monday],
  );
  const planDays = useMemo(() => days.filter((d) => d.iso < shiftISODate(monday, 5)), [days, monday]);
  const proposals = useMemo(
    () => proposeWeek({ stages, activities, previous: prevAsg, current: weekAsg, workingDays }),
    [stages, activities, prevAsg, weekAsg, workingDays],
  );

  const isMobile = useIsMobile();
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const drawerActivity = activities.find((a) => a.id === drawerId) ?? null;
  const [planOpen, setPlanOpen] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);

  // Fechamento da semana e PPC: só para semana que já começou.
  const today = todayISO();
  const [closeOpen, setCloseOpen] = useState(false);
  const closing = useMemo(() => closings.find((c) => c.week_start === monday) ?? null, [closings, monday]);
  const closeState = useMemo(() => weekClosingState(weekAsg, monday, today), [weekAsg, monday, today]);
  const closingStale = closing ? closingIsStale(closing, closeState) : false;
  /** Semana que já terminou sem fechamento: o aviso (com o botão) aparece na faixa. */
  const overdueClosing = closingsReady && !closing && closeState.planned > 0 && weekIsOver(monday, today);
  // Botão do cabeçalho: quando há fechamento para ver, ou algo para confirmar /
  // fechar numa semana em andamento. Semana só com dias para frente não mostra.
  const canCloseWeek =
    !!projectId &&
    closingsReady &&
    weekHasStarted(monday, today) &&
    (!!closing || (!overdueClosing && (closeState.canClose || closeState.pending.length > 0)));

  const weekTitle =
    monday === thisMonday ? "Esta semana" : monday === shiftISODate(thisMonday, 7) ? "Próxima semana" : monday === shiftISODate(thisMonday, -7) ? "Semana passada" : "Semana";

  return (
    <PageContainer>
      <PageHeader
        eyebrow={obraName ?? "Semana"}
        title={`${weekTitle} · ${weekLabel(monday)}`}
        description="O que acontece em cada dia e quem faz. Toque numa atividade para ver material, dias e revisão."
        actions={
          projectId ? (
            <>
              <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setFichaOpen(true)}>
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                Ficha da obra
              </Button>
              {canCloseWeek && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => setCloseOpen(true)}
                  disabled={loading}
                >
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  {closing ? "Ver fechamento" : "Fechar semana"}
                </Button>
              )}
              <Button type="button" className="min-h-[44px]" onClick={() => setPlanOpen(true)} disabled={loading}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Planejar semana
                {proposals.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary-foreground px-1.5 text-xs font-semibold text-primary tabular-nums">
                    {proposals.length}
                  </span>
                )}
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Select value={projectId ?? ""} onValueChange={(v) => setParam({ obra: v })}>
          <SelectTrigger aria-label="Obra" className="min-h-[44px] w-full sm:w-[320px]">
            <SelectValue placeholder={obrasLoading ? "Carregando obras…" : "Escolha a obra"} />
          </SelectTrigger>
          <SelectContent>
            {obraOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <nav aria-label="Escolher semana" className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-label="Semana anterior"
            onClick={() => setParam({ semana: shiftISODate(monday, -7) })}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant={monday === defaultMonday ? "secondary" : "outline"}
            className="min-h-[44px]"
            disabled={monday === defaultMonday}
            onClick={() => setParam({ semana: null })}
          >
            Semana atual
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-label="Próxima semana"
            onClick={() => setParam({ semana: shiftISODate(monday, 7) })}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </nav>
      </div>

      {/* Fora do `loading`: a ficha abre mesmo enquanto a semana carrega. */}
      <FichaObraSheet open={fichaOpen} onOpenChange={setFichaOpen} projectId={projectId} projectName={obraName} />

      {!projectId ? (
        <div className="mt-6">
          <EmptyState
            icon={CalendarRange}
            title="Escolha a obra"
            description="A semana é planejada obra a obra. A última obra escolhida fica salva neste aparelho."
          />
        </div>
      ) : loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {(closing || overdueClosing) && (
            <div
              role="status"
              className={cn(
                "mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-4 py-3 text-sm",
                closing && !closingStale ? "border-border bg-muted/40" : "border-warning/40 bg-warning/10",
              )}
            >
              <p className="text-foreground">
                {closing ? (
                  <>
                    <span className="font-semibold">
                      Semana fechada · PPC {ppcLabel(ppcOf(closing.done, closing.planned))}
                    </span>
                    <span className="text-muted-foreground"> · {doneOfPlannedLabel(closing.done, closing.planned)}</span>
                    {closingStale && <span className="block">Os dias mudaram depois do fechamento.</span>}
                  </>
                ) : (
                  <span className="font-semibold">Esta semana terminou e ainda não foi fechada.</span>
                )}
              </p>
              {(closingStale || overdueClosing) && (
                <Button type="button" variant="outline" className="min-h-[40px]" onClick={() => setCloseOpen(true)}>
                  {closing ? "Atualizar fechamento" : "Fechar semana"}
                </Button>
              )}
            </div>
          )}

          <dl
            className="-mx-4 mt-5 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0"
            aria-label="Resumo da semana"
          >
            <SummaryTile icon={Timer} label="Prazo">
              <span className={cn("font-semibold", HEALTH_TONE[health])}>{DEADLINE_HEALTH_LABEL[health]}</span>
              {deadline?.current_deadline && (
                <span className="block text-xs text-muted-foreground">
                  {(deadline.business_days_late ?? 0) > 0
                    ? `${deadline.business_days_late} dias úteis de atraso`
                    : `${deadline.business_days_remaining ?? 0} dias úteis até ${longDayLabel(deadline.current_deadline)}`}
                </span>
              )}
            </SummaryTile>
            <SummaryTile icon={CalendarCheck2} label="Dias da semana">
              <span className="font-semibold">
                {counts.done + counts.notDone} de {counts.planned} confirmados
              </span>
              <span className="block text-xs text-muted-foreground">
                {counts.notDone > 0 ? `${counts.notDone} não feito${counts.notDone === 1 ? "" : "s"}` : "Nenhum não feito"}
                {counts.unconfirmed > 0 ? ` · ${counts.unconfirmed} sem confirmação` : ""}
              </span>
            </SummaryTile>
            <SummaryTile icon={PackageCheck} label="Material">
              {mat.total === 0 ? (
                <span className="font-semibold text-muted-foreground">Nenhum material cadastrado</span>
              ) : (
                <>
                  <span className={cn("font-semibold", mat.missing.length > 0 ? "text-warning" : "text-success")}>
                    {mat.onSite} de {mat.total} na obra
                  </span>
                  {mat.onTheWay > 0 && (
                    <span className="block text-xs text-muted-foreground">{mat.onTheWay} a caminho (comprado)</span>
                  )}
                  {mat.missing.length > 0 && (
                    <span className="block truncate text-xs text-muted-foreground">
                      Falta:{" "}
                      {mat.missing
                        .slice(0, 2)
                        .map((m) => `${m.description}${m.neededBy ? ` (${longDayLabel(m.neededBy).split(",")[0]})` : ""}`)
                        .join(", ")}
                      {mat.missing.length > 2 ? ` e mais ${mat.missing.length - 2}` : ""}
                    </span>
                  )}
                </>
              )}
            </SummaryTile>
          </dl>

          <div className="mt-5 pb-24">
            {stages.length === 0 ? (
              <EmptyState
                icon={CalendarRange}
                title="Esta obra ainda não tem cronograma"
                description="A semana é organizada pelas etapas do cronograma do cliente. Cadastre as etapas na obra para planejar."
              />
            ) : sections.length === 0 ? (
              <EmptyState
                icon={CalendarRange}
                title="Nada previsto para esta semana"
                description={
                  proposals.length > 0
                    ? "Há sugestões prontas a partir do que sobrou e do cronograma."
                    : "Nenhuma etapa do cronograma cai nesta semana e nada ficou pendente."
                }
                action={proposals.length > 0 ? { label: "Planejar semana", onClick: () => setPlanOpen(true), icon: Sparkles } : undefined}
              />
            ) : (
              (() => {
                const gridProps = {
                  sections,
                  days,
                  staff,
                  staffNameById,
                  suggestions,
                  lastWhoByActivity,
                  today,
                  projectId,
                  onOpenActivity: setDrawerId,
                };
                return isMobile ? (
                  <MobileWeekList key={`${projectId}-${monday}`} {...gridProps} />
                ) : (
                  <WeekGrid {...gridProps} />
                );
              })()
            )}
            {sections.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {isMobile
                  ? "⚠ marcado depois da data-limite · toque num nome para trocar o dia ou quem faz."
                  : "⚠ marcado depois da data-limite · arraste um nome para outro dia da mesma linha."}
              </p>
            )}
          </div>

          <ActivityDrawer
            activity={drawerActivity}
            open={!!drawerActivity}
            onOpenChange={(o) => !o && setDrawerId(null)}
            staffNameById={staffNameById}
          />
          <CloseWeekSheet
            open={closeOpen}
            onOpenChange={setCloseOpen}
            projectId={projectId}
            monday={monday}
            weekText={`Semana de ${weekLabel(monday)}`}
            today={today}
            assignments={weekAsg}
            activities={activities}
            staffNameById={staffNameById}
            closing={closing}
            history={closings}
          />
          <PlanWeekSheet
            open={planOpen}
            onOpenChange={setPlanOpen}
            weekText={`Semana de ${weekLabel(monday)}`}
            proposals={proposals}
            days={planDays}
            projectId={projectId}
            staff={staff}
            staffNameById={staffNameById}
            suggestions={suggestions}
          />
        </>
      )}
    </PageContainer>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-[240px] snap-start rounded-xl border border-border bg-card p-3 sm:min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}
