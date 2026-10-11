/**
 * "Planejar semana": a semana já vem preenchida. O gestor só confere quem
 * faz e quais dias, desmarca o que não vai acontecer e confirma.
 *
 * Fontes (em ordem): o que sobrou da semana passada · o que está em
 * execução · atividades ainda sem dia · etapas do cronograma previstas para
 * a semana sem atividade (vira uma atividade com o nome da etapa).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  PROPOSAL_KIND_LABEL,
  parseWho,
  whoText,
  type ProposalKind,
  type WeekDay,
  type WeekProposal,
} from "@/lib/semanaPlan";
import { useCreateOpsActivity, useCreateOpsAssignments } from "@/hooks/useOps";
import { WhoInput } from "./WhoInput";

interface RowState {
  selected: boolean;
  who: string;
  days: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekText: string;
  proposals: WeekProposal[];
  days: WeekDay[];
  projectId: string;
  staff: ReadonlyArray<{ id: string; nome: string }>;
  staffNameById: ReadonlyMap<string, string>;
  suggestions: readonly string[];
}

const KINDS: ProposalKind[] = ["sobrou", "continua", "sem_dia", "cronograma"];

export function PlanWeekSheet({
  open,
  onOpenChange,
  weekText,
  proposals,
  days,
  projectId,
  staff,
  staffNameById,
  suggestions,
}: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);
  const createActivity = useCreateOpsActivity();
  const createAssignments = useCreateOpsAssignments();

  // Preenche ao abrir. Enquanto está aberto, as sugestões mudam (dados que
  // chegam depois, refetch a cada item salvo): as linhas em que a pessoa não
  // mexeu acompanham; o que ela já desmarcou ou editou não é desfeito por baixo.
  const wasOpen = useRef(false);
  const touched = useRef(new Set<string>());
  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (!wasOpen.current) touched.current = new Set();
    wasOpen.current = true;
    setRows((current) => {
      const next: Record<string, RowState> = {};
      for (const p of proposals) {
        const kept = touched.current.has(p.key) ? current[p.key] : undefined;
        next[p.key] = kept ?? { selected: true, who: whoText(p.who, staffNameById), days: p.days };
      }
      return next;
    });
  }, [open, proposals, staffNameById]);

  const set = (key: string, patch: Partial<RowState>) => {
    touched.current.add(key);
    setRows((r) => ({ ...r, [key]: { ...r[key], ...patch } }));
  };

  const chosen = proposals.filter((p) => rows[p.key]?.selected);
  const invalid = chosen.filter((p) => !parseWho(rows[p.key]?.who ?? "", staff) || (rows[p.key]?.days.length ?? 0) === 0);
  const totalDays = chosen.reduce((n, p) => n + (rows[p.key]?.days.length ?? 0), 0);

  const grouped = useMemo(
    () => KINDS.map((k) => ({ kind: k, items: proposals.filter((p) => p.kind === k) })).filter((g) => g.items.length > 0),
    [proposals],
  );

  const save = async () => {
    if (invalid.length > 0 || chosen.length === 0) return;
    setSaving(true);
    let created = 0;
    try {
      for (const p of chosen) {
        const st = rows[p.key];
        const who = parseWho(st.who, staff);
        if (!who) continue;
        let activityId = p.activityId;
        const sortedDays = [...st.days].sort();
        if (!activityId) {
          const act = await createActivity.mutateAsync({
            project_id: projectId,
            stage_id: p.stageId,
            title: p.title,
            planned_start: sortedDays[0],
            planned_end: sortedDays[sortedDays.length - 1],
          });
          activityId = act.id;
        }
        await createAssignments.mutateAsync(sortedDays.map((d) => ({ activity_id: activityId as string, work_date: d, ...who })));
        created += 1;
      }
      toast.success(created === 1 ? "1 atividade marcada na semana" : `${created} atividades marcadas na semana`);
      onOpenChange(false);
    } catch {
      toast.error(
        created > 0
          ? `${created} salvas. As demais não foram salvas; confira e tente de novo.`
          : "Não foi possível salvar o planejamento. Tente de novo.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-5 text-left">
          <SheetTitle>Planejar semana</SheetTitle>
          <SheetDescription>
            {weekText}. Já veio preenchido: confira quem faz e os dias, desmarque o que não vai acontecer.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {proposals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nada a sugerir: não sobrou nada da semana passada e não há etapa do cronograma prevista para esta
              semana sem dia marcado. Use “+” na grade para marcar à mão.
            </p>
          ) : (
            grouped.map((g) => (
              <section key={g.kind} aria-labelledby={`kind-${g.kind}`} className="space-y-3">
                <h3 id={`kind-${g.kind}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {PROPOSAL_KIND_LABEL[g.kind]} · {g.items.length}
                </h3>
                {g.items.map((p) => {
                  const st = rows[p.key];
                  if (!st) return null;
                  const missingWho = st.selected && !parseWho(st.who, staff);
                  return (
                    <div
                      key={p.key}
                      className={cn(
                        "space-y-3 rounded-xl border p-3 transition-colors",
                        st.selected ? "border-border bg-card" : "border-dashed border-border bg-muted/30 opacity-70",
                      )}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <Checkbox
                          checked={st.selected}
                          onCheckedChange={(v) => set(p.key, { selected: v === true })}
                          className="mt-0.5 h-5 w-5"
                          aria-label={`Incluir ${p.title}`}
                        />
                        <span className="min-w-0">
                          <span className="block text-xs text-muted-foreground">{p.stageName}</span>
                          <span className="block font-medium text-foreground">{p.title}</span>
                          {p.kind === "cronograma" && (
                            <span className="block text-xs text-muted-foreground">Vira uma atividade desta etapa.</span>
                          )}
                        </span>
                      </label>
                      {st.selected && (
                        <>
                          <div role="group" aria-label={`Dias de ${p.title}`} className="flex flex-wrap gap-1.5">
                            {days.map((d) => {
                              const on = st.days.includes(d.iso);
                              return (
                                <button
                                  key={d.iso}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() =>
                                    set(p.key, { days: on ? st.days.filter((x) => x !== d.iso) : [...st.days, d.iso] })
                                  }
                                  className={cn(
                                    "min-h-[40px] min-w-[64px] rounded-lg border px-2 text-xs font-medium transition-colors",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    on
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border bg-card text-foreground hover:bg-muted",
                                    d.holiday && !on && "text-muted-foreground",
                                  )}
                                >
                                  {d.label}
                                  {d.holiday ? " · feriado" : ""}
                                </button>
                              );
                            })}
                          </div>
                          <div>
                            <WhoInput
                              value={st.who}
                              onChange={(v) => set(p.key, { who: v })}
                              suggestions={suggestions}
                              label={`Quem faz ${p.title}`}
                              className={cn(missingWho && "border-warning")}
                            />
                            {missingWho && <p className="mt-1 text-xs font-medium text-warning">Informe quem vai fazer.</p>}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </div>

        <SheetFooter className="flex-row items-center gap-2 border-t border-border p-4 sm:justify-between">
          <p className="hidden text-sm text-muted-foreground sm:block">
            {chosen.length} atividade{chosen.length === 1 ? "" : "s"} · {totalDays} dia{totalDays === 1 ? "" : "s"}
          </p>
          <div className="flex flex-1 gap-2 sm:flex-none">
            <Button type="button" variant="outline" className="min-h-[48px] flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="min-h-[48px] flex-1"
              disabled={saving || chosen.length === 0 || invalid.length > 0}
              onClick={save}
            >
              Marcar na semana
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
