/**
 * Hoje — Fase 3 da reformulação do processo core.
 *
 * O que estava programado para o dia em cada obra, com confirmação em um
 * toque: Feito / Não feito (com motivo) / foto opcional. Pensada para o
 * celular, na obra. Interna: o cliente nunca vê esta tela nem estes dados.
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarCheck, ChevronLeft, ChevronRight, ClipboardList, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader, EmptyState } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { useOpsDay, useOpsReadiness, useSetAssignmentOutcome } from "@/hooks/useOps";
import { useStudioInfo } from "@/hooks/useStudioInfo";
import {
  canConfirmOn,
  countDay,
  dayLabel,
  groupByObra,
  longDayLabel,
  normalizeDateParam,
  progressPhrase,
  shiftISODate,
  todayISO,
  whoLabel,
  type ObraDayGroup,
} from "@/lib/hojeDia";
import { workWindowToday } from "@/lib/fichaObra";
import type { OpsBlockReason, OpsDayAssignment } from "@/infra/repositories/ops.repository";
import { AssignmentCard } from "@/components/gestao/hoje/AssignmentCard";
import { NaoFeitoSheet } from "@/components/gestao/hoje/NaoFeitoSheet";
import { AddToDaySheet } from "@/components/gestao/hoje/AddToDaySheet";
import { FichaObraSheet } from "@/components/gestao/ficha/FichaObraSheet";

export default function Hoje() {
  const [params, setParams] = useSearchParams();
  const date = normalizeDateParam(params.get("data"));
  const obraFilter = params.get("obra");
  const isToday = date === todayISO();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const goTo = (iso: string) => setParam("data", iso === todayISO() ? null : iso);

  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: staff = [] } = useStaffUsers();
  const staffNameById = useMemo(() => new Map(staff.map((s) => [s.id, s.nome])), [staff]);

  const { data: items = [], isLoading, isError, refetch, isFetching } = useOpsDay(date);
  const activityIds = useMemo(
    () => [...new Set(items.map((i) => i.activity_id))],
    [items],
  );
  const { data: readiness = [] } = useOpsReadiness(activityIds);
  const missingByActivity = useMemo(
    () => new Map(readiness.map((r) => [r.id as string, Number(r.materials_missing ?? 0)])),
    [readiness],
  );

  const allGroups = useMemo(() => groupByObra(items), [items]);
  // O filtro de obra acompanha a navegação entre dias. Num dia em que a obra
  // filtrada não tem nada, o filtro é ignorado: senão a tela diria "Nada
  // programado" escondendo o trabalho das outras obras, sem ter como limpar.
  const activeFilter = obraFilter && allGroups.some((g) => g.projectId === obraFilter) ? obraFilter : null;
  const groups = activeFilter ? allGroups.filter((g) => g.projectId === activeFilter) : allGroups;
  const counts = countDay(groups.flatMap((g) => g.items));
  const confirmable = canConfirmOn(date);

  const setOutcome = useSetAssignmentOutcome();
  const [notDoneFor, setNotDoneFor] = useState<OpsDayAssignment | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [fichaFor, setFichaFor] = useState<{ id: string; name: string } | null>(null);

  const markDone = (a: OpsDayAssignment) => {
    setOutcome.mutate(
      { id: a.id, outcome: "feito" },
      {
        onSuccess: () =>
          toast.success("Marcado como feito", {
            action: { label: "Desfazer", onClick: () => setOutcome.mutate({ id: a.id, outcome: null }) },
          }),
        onError: () => toast.error("Não foi possível salvar. Confira a conexão e tente de novo."),
      },
    );
  };

  const confirmNotDone = (reason: OpsBlockReason, notes: string | null) => {
    if (!notDoneFor) return;
    const a = notDoneFor;
    setOutcome.mutate(
      { id: a.id, outcome: "nao_feito", reason, notes },
      {
        onSuccess: () => {
          setNotDoneFor(null);
          toast.success("Registrado como não feito");
        },
        onError: () => toast.error("Não foi possível salvar. Confira a conexão e tente de novo."),
      },
    );
  };

  const undo = (a: OpsDayAssignment) =>
    setOutcome.mutate(
      { id: a.id, outcome: null },
      { onError: () => toast.error("Não foi possível desfazer. Tente de novo.") },
    );

  return (
    <PageContainer>
      <PageHeader
        eyebrow={isToday ? longDayLabel(date) : undefined}
        title={dayLabel(date)}
        description={isLoading ? "Carregando…" : progressPhrase(counts)}
        actions={
          <Button type="button" className="min-h-[44px]" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar ao dia
          </Button>
        }
      />

      <nav aria-label="Escolher dia" className="mt-4 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11"
          onClick={() => goTo(shiftISODate(date, -1))}
          aria-label="Dia anterior"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant={isToday ? "secondary" : "outline"}
          className="min-h-[44px]"
          onClick={() => goTo(todayISO())}
          disabled={isToday}
        >
          Hoje
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11"
          onClick={() => goTo(shiftISODate(date, 1))}
          aria-label="Próximo dia"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </Button>
        {!isToday && <span className="ml-1 text-sm text-muted-foreground">{longDayLabel(date)}</span>}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto h-11 w-11"
          onClick={() => refetch()}
          aria-label="Atualizar"
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" />
        </Button>
      </nav>

      {counts.total > 0 && (
        <div className="mt-4">
          <Progress
            value={(100 * (counts.done + counts.notDone)) / counts.total}
            aria-label={progressPhrase(counts)}
            className="h-2"
          />
        </div>
      )}

      {allGroups.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por obra">
          <FilterChip active={!activeFilter} onClick={() => setParam("obra", null)} pending={countDay(items).pending}>
            Todas
          </FilterChip>
          {allGroups.map((g) => (
            <FilterChip
              key={g.projectId}
              active={activeFilter === g.projectId}
              onClick={() => setParam("obra", g.projectId)}
              pending={g.pending}
            >
              {g.projectName}
            </FilterChip>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-8 pb-24">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={RefreshCw}
            title="Não foi possível carregar o dia"
            description="Confira a conexão e tente de novo."
            action={{ label: "Tentar de novo", onClick: () => refetch() }}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="Nada programado para este dia"
            description="Adicione o que cada equipe vai fazer. Depois, é só marcar Feito ou Não feito."
            action={{ label: "Adicionar ao dia", onClick: () => setAddOpen(true), icon: Plus }}
          />
        ) : (
          groups.map((g) => (
            <section key={g.projectId} aria-labelledby={`obra-${g.projectId}`}>
              <ObraGroupHeader
                group={g}
                date={date}
                onOpenFicha={() => setFichaFor({ id: g.projectId, name: g.projectName })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {g.items.map((a) => (
                  <AssignmentCard
                    key={a.id}
                    assignment={a}
                    who={whoLabel(a, staffNameById)}
                    doneByName={a.done_by ? staffNameById.get(a.done_by) ?? null : null}
                    materialsMissing={missingByActivity.get(a.activity_id) ?? 0}
                    canConfirm={confirmable}
                    busy={setOutcome.isPending && setOutcome.variables?.id === a.id}
                    onDone={() => markDone(a)}
                    onNotDone={() => setNotDoneFor(a)}
                    onUndo={() => undo(a)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <NaoFeitoSheet
        open={!!notDoneFor}
        onOpenChange={(o) => !o && setNotDoneFor(null)}
        activityTitle={notDoneFor?.activity?.title ?? ""}
        saving={setOutcome.isPending}
        onConfirm={confirmNotDone}
      />
      <AddToDaySheet
        open={addOpen}
        onOpenChange={setAddOpen}
        date={date}
        userId={userId}
        defaultProjectId={obraFilter}
      />
      <FichaObraSheet
        open={!!fichaFor}
        onOpenChange={(o) => !o && setFichaFor(null)}
        projectId={fichaFor?.id}
        projectName={fichaFor?.name}
      />
    </PageContainer>
  );
}

/**
 * Cabeçalho da obra no dia: nome, horário que o condomínio permite e o
 * atalho para a ficha (endereço, chaves, senha, contatos).
 */
function ObraGroupHeader({
  group,
  date,
  onOpenFicha,
}: {
  group: ObraDayGroup;
  /** Dia que a tela está mostrando (não necessariamente hoje). */
  date: string;
  onOpenFicha: () => void;
}) {
  // Complemento da tela: enquanto a ficha não chega (ou se a consulta falhar),
  // o cabeçalho só não mostra o horário. O dia nunca espera por ela.
  const { data: info } = useStudioInfo(group.projectId);
  const workWindow = workWindowToday(info, date);

  return (
    <header className="mb-3 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 id={`obra-${group.projectId}`} className="truncate text-base font-semibold text-foreground">
          {group.projectName}
        </h2>
        {workWindow && (
          <p className={cn("text-sm", workWindow.kind === "proibido" ? "font-medium text-warning" : "text-muted-foreground")}>
            {workWindow.text}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm tabular-nums text-muted-foreground">
          {group.done + group.notDone} de {group.total}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[40px]"
          onClick={onOpenFicha}
          aria-label={`Ficha da obra ${group.projectName}`}
        >
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Ficha
        </Button>
      </div>
    </header>
  );
}

function FilterChip({
  active,
  onClick,
  pending,
  children,
}: {
  active: boolean;
  onClick: () => void;
  /** Quantas ainda faltam confirmar (bolinha; some quando zera). */
  pending: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      <span>{children}</span>
      {pending > 0 && (
        <span
          className={cn(
            "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
            active ? "bg-primary-foreground text-primary" : "bg-muted text-foreground",
          )}
        >
          {pending}
          <span className="sr-only"> {pending === 1 ? "pendente" : "pendentes"}</span>
        </span>
      )}
    </button>
  );
}
