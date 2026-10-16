/**
 * "Fechar semana": confirma os dias que ficaram sem Feito / Não feito, mostra
 * o PPC (dias feitos ÷ dias marcados) e grava o fechamento da semana.
 *
 * O gestor não digita indicador: só confirma os dias. Cada toque em Feito /
 * Não feito já fica salvo (igual à tela Hoje); "Fechar semana" só registra o
 * retrato, que é calculado no banco.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toLocalISODate } from "@/lib/localDate";
import { OPS_REASON_LABEL } from "@/lib/opsLabels";
import { shortWho } from "@/lib/semanaPlan";
import {
  closingIsStale,
  ddmmOf,
  doneOfPlannedLabel,
  ppcLabel,
  ppcOf,
  reasonCounts,
  reasonsText,
  shortDayLabel,
  weekClosingState,
} from "@/lib/semanaFechamento";
import { useCloseOpsWeek, useReopenOpsWeek, useSetAssignmentOutcome } from "@/hooks/useOps";
import { trackAmplitude } from "@/lib/amplitude";
import type { ReportActivity } from "@/lib/semanaRelatorio";
import { WeekAmendmentsSection } from "./WeekAmendmentsSection";
import { WeekReportDraftSection } from "./WeekReportDraftSection";
import type {
  OpsAssignment,
  OpsAssignmentOutcome,
  OpsBlockReason,
  OpsStageOption,
  OpsWeekClosing,
} from "@/infra/repositories/ops.repository";

const REASONS = Object.keys(OPS_REASON_LABEL) as OpsBlockReason[];
const NONE_ASG: ReadonlyArray<OpsAssignment> = [];
const NONE_STAGES: ReadonlyArray<OpsStageOption> = [];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Segunda-feira da semana. */
  monday: string;
  weekText: string;
  today: string;
  /** Alocações da semana (seg–dom). */
  assignments: ReadonlyArray<OpsAssignment>;
  activities: ReadonlyArray<ReportActivity>;
  /** Dias marcados na semana seguinte (seg–dom), para o texto do relatório. */
  nextAssignments?: ReadonlyArray<OpsAssignment>;
  /** Etapas do cronograma interno, para o texto do relatório quando a semana seguinte não foi planejada. */
  stages?: ReadonlyArray<OpsStageOption>;
  staffNameById: ReadonlyMap<string, string>;
  /** Fechamento já gravado desta semana, se houver. */
  closing: OpsWeekClosing | null;
  /** Fechamentos anteriores da obra (mais recente primeiro), para comparar. */
  history: ReadonlyArray<OpsWeekClosing>;
}

export function CloseWeekSheet({
  open,
  onOpenChange,
  projectId,
  monday,
  weekText,
  today,
  assignments,
  activities,
  staffNameById,
  closing,
  history,
  nextAssignments = NONE_ASG,
  stages = NONE_STAGES,
}: Props) {
  const setOutcome = useSetAssignmentOutcome();
  const closeWeek = useCloseOpsWeek();
  const reopenWeek = useReopenOpsWeek();
  /** Dia em que a pessoa tocou "Não feito" e ainda falta escolher o motivo. */
  const [askingId, setAskingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [bulk, setBulk] = useState(false);
  /**
   * Respostas dadas aqui, aplicadas na hora por cima dos dados: o dia sai da
   * lista no toque, sem esperar a recarga (e sem dar tempo de tocar duas vezes).
   */
  const [answered, setAnswered] = useState<
    Record<string, { outcome: OpsAssignmentOutcome; not_done_reason: OpsBlockReason | null }>
  >({});

  /** Respostas ainda sendo gravadas: não dá para fechar antes de o banco confirmar. */
  const [inFlight, setInFlight] = useState(0);
  const notesTouched = useRef(false);

  useEffect(() => {
    if (!open) return;
    setAskingId(null);
    setAnswered({});
    notesTouched.current = false;
    // Só ao abrir: não apaga o que a pessoa está digitando quando os dados recarregam.
  }, [open]);
  // A observação acompanha o fechamento gravado (que pode chegar depois de a
  // folha abrir) enquanto a pessoa não mexeu no campo.
  const savedNotes = closing?.notes ?? "";
  useEffect(() => {
    if (open && !notesTouched.current) setNotes(savedNotes);
  }, [open, savedNotes]);

  const effective = useMemo(
    () => assignments.map((a) => (answered[a.id] ? { ...a, ...answered[a.id] } : a)),
    [assignments, answered],
  );
  const state = useMemo(() => weekClosingState(effective, monday, today), [effective, monday, today]);
  const reasons = useMemo(() => reasonCounts(state.notDoneItems), [state.notDoneItems]);
  const activityById = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);
  const titleOf = useCallback((id: string) => activityById.get(id)?.title ?? "Atividade", [activityById]);
  const stale = closing ? closingIsStale(closing, state) : false;
  const previous = history.filter((c) => c.week_start < monday).slice(0, 4);

  const describe = (a: OpsAssignment) => {
    const act = activityById.get(a.activity_id);
    return {
      day: shortDayLabel(a.work_date),
      title: act?.title ?? "Atividade",
      stage: act?.stage_name ?? null,
      who: shortWho(a, staffNameById),
    };
  };

  /** Grava a resposta de um dia; se o banco recusar, o dia volta para a lista. */
  const answer = async (a: OpsAssignment, outcome: OpsAssignmentOutcome, reason: OpsBlockReason | null) => {
    setAskingId(null);
    setAnswered((m) => ({ ...m, [a.id]: { outcome, not_done_reason: reason } }));
    setInFlight((n) => n + 1);
    try {
      await setOutcome.mutateAsync({ id: a.id, outcome, reason });
      trackAmplitude("ops_day_confirmed", { outcome, reason, screen: "fechar_semana" });
      return true;
    } catch {
      // O aviso de erro vem de quem grava.
      setAnswered((m) => {
        const { [a.id]: _dropped, ...rest } = m;
        return rest;
      });
      return false;
    } finally {
      setInFlight((n) => n - 1);
    }
  };
  const markDone = (a: OpsAssignment) => void answer(a, "feito", null);
  const markNotDone = (a: OpsAssignment, reason: OpsBlockReason) => void answer(a, "nao_feito", reason);
  const markAllDone = async () => {
    setBulk(true);
    try {
      // Um por vez: se um falhar, para ali e os já salvos continuam salvos.
      for (const a of state.pending) {
        if (!(await answer(a, "feito", null))) break;
      }
    } finally {
      setBulk(false);
    }
  };

  const saving = closeWeek.isPending || reopenWeek.isPending;
  const confirm = async () => {
    try {
      const saved = await closeWeek.mutateAsync({ project_id: projectId, week_start: monday, notes: notes.trim() || null });
      const ppc = ppcOf(saved.done, saved.planned);
      trackAmplitude("ops_week_closed", {
        ppc,
        planned: saved.planned,
        done: saved.done,
        not_done: saved.not_done,
        update: !!closing,
      });
      toast.success(`Semana fechada · PPC ${ppcLabel(ppc)}`);
      onOpenChange(false);
    } catch {
      // O aviso de erro vem de quem grava.
    }
  };
  const reopen = async () => {
    if (!closing) return;
    try {
      await reopenWeek.mutateAsync(closing.id);
      toast.success("Semana reaberta");
      onOpenChange(false);
    } catch {
      // O aviso de erro vem de quem grava.
    }
  };

  const blocker =
    state.planned === 0
      ? "Nada foi marcado nesta semana: não há o que fechar."
      : state.pending.length > 0
        ? `Falta confirmar ${state.pending.length} ${state.pending.length === 1 ? "dia" : "dias"}.`
        : state.future.length > 0
          ? `Ainda ${state.future.length === 1 ? "há 1 dia marcado" : `há ${state.future.length} dias marcados`} para frente (${[
              ...new Set(state.future.map((a) => shortDayLabel(a.work_date))),
            ].join(", ")}). Dá para fechar depois do último dia marcado.`
          : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-5 text-left">
          <SheetTitle>{closing ? "Fechamento da semana" : "Fechar semana"}</SheetTitle>
          <SheetDescription>
            {weekText}. Confirme o que ficou sem resposta; o PPC sai sozinho do Feito / Não feito de cada dia.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* PPC: calculado, nunca digitado */}
          <section aria-label="PPC da semana" className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              PPC{state.pending.length + state.future.length > 0 ? " até agora" : ""}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{ppcLabel(state.ppc)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {state.planned === 0 ? "Nenhum dia marcado na semana" : doneOfPlannedLabel(state.done, state.planned)}
              {state.notDone > 0 ? ` · ${state.notDone} não ${state.notDone === 1 ? "feito" : "feitos"}` : ""}
            </p>
            {previous.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Semanas anteriores:{" "}
                {previous.map((c) => `${ddmmOf(c.week_start)} ${ppcLabel(ppcOf(c.done, c.planned))}`).join(" · ")}
              </p>
            )}
            {closing && (
              <p className="mt-2 text-xs text-muted-foreground">
                Fechada em {ddmmOf(toLocalISODate(new Date(closing.closed_at)))}
                {closing.closed_by && staffNameById.get(closing.closed_by)
                  ? ` por ${staffNameById.get(closing.closed_by)}`
                  : ""}{" "}
                com PPC {ppcLabel(ppcOf(closing.done, closing.planned))}.
                {stale && <span className="font-medium text-warning"> Os dias mudaram depois do fechamento.</span>}
              </p>
            )}
          </section>

          {state.pending.length > 0 && (
            <section aria-labelledby="fechar-pendentes" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="fechar-pendentes" className="text-sm font-semibold text-foreground">
                  Falta confirmar · {state.pending.length}
                </h3>
                {state.pending.length > 1 && (
                  <Button type="button" variant="outline" size="sm" className="min-h-[40px]" disabled={bulk} onClick={markAllDone}>
                    Marcar os {state.pending.length} como feitos
                  </Button>
                )}
              </div>
              <ul className="space-y-2">
                {state.pending.map((a) => {
                  const d = describe(a);
                  const asking = askingId === a.id;
                  return (
                    <li key={a.id} className="rounded-xl border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">
                        {d.day} · {d.who}
                        {d.stage ? ` · ${d.stage}` : ""}
                      </p>
                      <p className="font-medium text-foreground">{d.title}</p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          className="min-h-[44px] flex-1"
                          disabled={bulk}
                          aria-label={`Feito: ${d.title}, ${d.day}`}
                          onClick={() => markDone(a)}
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                          Feito
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-[44px] flex-1"
                          disabled={bulk}
                          aria-expanded={asking}
                          aria-label={`Não feito: ${d.title}, ${d.day}`}
                          onClick={() => setAskingId(asking ? null : a.id)}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                          Não feito
                        </Button>
                      </div>
                      {asking && (
                        <div role="group" aria-label={`Motivo de ${d.title} não ter sido feito`} className="mt-2 flex flex-wrap gap-1.5">
                          {REASONS.map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => markNotDone(a, r)}
                              className="min-h-[40px] rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {OPS_REASON_LABEL[r]}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {state.notDoneItems.length > 0 && (
            <section aria-labelledby="fechar-nao-feitos" className="space-y-3">
              <h3 id="fechar-nao-feitos" className="text-sm font-semibold text-foreground">
                Não feitos · {state.notDoneItems.length}
              </h3>
              {reasons.length > 0 && <p className="text-sm text-muted-foreground">{reasonsText(reasons)}</p>}
              <ul className="space-y-2">
                {state.notDoneItems.map((a) => {
                  const d = describe(a);
                  return (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {d.day} · {d.who}
                        </p>
                        <p className="truncate font-medium text-foreground">{d.title}</p>
                      </div>
                      <Select
                        value={a.not_done_reason ?? undefined}
                        onValueChange={(v) => markNotDone(a, v as OpsBlockReason)}
                      >
                        <SelectTrigger aria-label={`Motivo de ${d.title}, ${d.day}`} className="min-h-[40px] w-full sm:w-[230px]">
                          <SelectValue placeholder="Motivo" />
                        </SelectTrigger>
                        <SelectContent>
                          {REASONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {OPS_REASON_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {state.notDoneItems.length > 0 && (
            <WeekAmendmentsSection
              projectId={projectId}
              monday={monday}
              notDoneItems={state.notDoneItems}
              titleOf={titleOf}
            />
          )}

          {state.planned > 0 && state.pending.length === 0 && (
            <WeekReportDraftSection
              projectId={projectId}
              monday={monday}
              assignments={effective}
              nextAssignments={nextAssignments}
              activities={activities}
              stages={stages}
            />
          )}

          {state.planned > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="fechar-observacao">Observação da semana (opcional)</Label>
              <Textarea
                id="fechar-observacao"
                value={notes}
                onChange={(e) => {
                  notesTouched.current = true;
                  setNotes(e.target.value);
                }}
                rows={3}
                maxLength={1000}
                placeholder="O que explica a semana, em uma frase."
              />
            </div>
          )}
        </div>

        <SheetFooter className="flex-col gap-2 border-t border-border p-4 sm:flex-col sm:space-x-0">
          {blocker && (
            <p role="status" className="text-sm text-muted-foreground">
              {blocker}
            </p>
          )}
          <div className="flex gap-2">
            {closing ? (
              <Button type="button" variant="outline" className="min-h-[48px] flex-1" disabled={saving} onClick={reopen}>
                Reabrir semana
              </Button>
            ) : (
              <Button type="button" variant="outline" className="min-h-[48px] flex-1" onClick={() => onOpenChange(false)}>
                Agora não
              </Button>
            )}
            <Button type="button" className="min-h-[48px] flex-1" disabled={saving || bulk || inFlight > 0 || !state.canClose} onClick={confirm}>
              {closing ? "Atualizar fechamento" : "Fechar semana"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
