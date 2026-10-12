/**
 * Gaveta da obra — seção "Fase de projeto".
 *
 * As seis etapas antes da obra, na ordem, cada uma com responsável, prazo e
 * conclusão. Substitui o seletor livre de etapa enquanto a obra está em fase
 * de projeto: a etapa do Painel, as datas de aprovação e o início oficial
 * (5 dias úteis depois da aprovação do condomínio) são calculados pelo banco
 * a partir do que é registrado aqui.
 *
 * Grava campo a campo (`useSaveProjectPhaseStep`), com os mesmos cuidados do
 * resto da gaveta:
 * - o que foi digitado fica no campo enquanto a gravação está em andamento,
 *   mesmo que uma releitura chegue no meio com o valor antigo;
 * - Enter seguido de sair do campo não grava duas vezes;
 * - os campos de data não são desabilitados durante a gravação (quem tabula
 *   não perde o foco); botões e seletores, sim;
 * - a lista continua montada durante as releituras.
 * O aviso de erro é o global das mutações.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/hojeDia";
import {
  OFFICIAL_START_BUSINESS_DAYS,
  officialStartText,
  phaseState,
  phaseVerdict,
  type PhaseStepKey,
  type PhaseStepState,
} from "@/lib/faseProjeto";
import { RESPONSAVEL_FORA_DA_EQUIPE, stepVerdict } from "@/lib/painelNovo";
import { useProjectPhaseSteps, useSaveProjectPhaseStep } from "@/hooks/useProjectPhase";
import type { StaffUser } from "@/hooks/useStaffUsers";
import { FaseChip } from "@/components/gestao/obras/FaseChip";

const NONE = "__none__";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** "yyyy-mm-dd" → "dd/mm/aaaa". */
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const APROVACAO: PhaseStepKey = "aprovacao_condominio";

/** Campos que a seção grava (um por vez). */
type StepPatch = { due_date?: string | null; done_at?: string | null; responsible_user_id?: string | null };

export interface FaseProjetoSectionProps {
  projectId: string;
  /** Equipe ativa (todos os perfis internos), para o responsável de cada etapa. */
  staff: readonly StaffUser[];
  /** Tem 'projectPhase:edit'. Sem isto a seção é só leitura. */
  canEdit: boolean;
  /** Início oficial calculado pelo banco (`projects.date_official_start`). */
  officialStart: string | null;
  /** Início previsto do cronograma, para avisar quando difere do início oficial. */
  scheduleStart?: string | null;
  /** Aviso curto no topo da seção (ex.: por que a gaveta abriu a partir do Kanban). */
  notice?: string | null;
  /**
   * Etapa atual do card no Painel. Etapas antes dela contam como concluídas
   * mesmo sem registro (obras de antes do fluxo por etapas).
   */
  painelEtapa?: string | null;
}

export function FaseProjetoSection({
  projectId,
  staff,
  canEdit,
  officialStart,
  scheduleStart,
  notice,
  painelEtapa,
}: FaseProjetoSectionProps) {
  const stepsQ = useProjectPhaseSteps(projectId);
  const { mutateAsync } = useSaveProjectPhaseStep();
  /** Gravações em andamento (botões e seletores esperam; campos de data não). */
  const [pending, setPending] = useState(0);

  const rows = stepsQ.data;
  const state = useMemo(() => (rows ? phaseState(rows, todayISO(), painelEtapa) : null), [rows, painelEtapa]);

  /** Grava um campo de uma etapa. Devolve se deu certo (o aviso de erro é global). */
  const save = async (step: PhaseStepKey, patch: StepPatch, ok: string): Promise<boolean> => {
    setPending((n) => n + 1);
    try {
      await mutateAsync({ project_id: projectId, step, ...patch });
      toast.success(ok);
      return true;
    } catch {
      return false;
    } finally {
      setPending((n) => n - 1);
    }
  };

  const verdict = state ? phaseVerdict(state) : null;
  const approvalDone = !!state?.steps.find((s) => s.key === APROVACAO)?.done;
  const startText = approvalDone ? officialStartText(officialStart) : null;
  const start = startText && officialStart ? officialStart.slice(0, 10) : null;
  const scheduleDiffers = !!start && !!scheduleStart && scheduleStart.slice(0, 10) !== start;

  return (
    <section aria-label="Fase de projeto" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Fase de projeto</h3>
        {state && verdict && (
          <span className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
            {state.doneCount} de {state.steps.length} concluídas
            <FaseChip verdict={verdict} />
          </span>
        )}
      </div>

      {notice && (
        <p role="status" className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          {notice}
        </p>
      )}

      {!state ? (
        stepsQ.isError ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm text-foreground">Não deu para carregar as etapas desta obra.</p>
            <Button type="button" variant="outline" size="sm" className="min-h-[40px]" onClick={() => void stepsQ.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <div className="space-y-2" aria-busy="true" aria-label="Carregando as etapas">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )
      ) : (
        <ol className="space-y-2">
          {state.steps.map((step, index) => (
            <li key={step.key}>
              <StepItem
                step={step}
                index={index}
                staff={staff}
                canEdit={canEdit}
                busy={pending > 0}
                save={(patch, ok) => save(step.key, patch, ok)}
              >
                {step.key === APROVACAO && startText && (
                  <div className="mt-2 space-y-1 border-t border-border pt-2">
                    <p className="text-sm font-medium text-foreground">{startText}</p>
                    {scheduleDiffers && scheduleStart && (
                      <p className="text-xs text-warning">
                        O cronograma começa em {dataBR(scheduleStart.slice(0, 10))}.{" "}
                        <Link
                          to={`/obra/${projectId}/cronograma`}
                          className="rounded-sm font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Ajuste o cronograma
                        </Link>{" "}
                        para o início oficial.
                      </p>
                    )}
                  </div>
                )}
              </StepItem>
            </li>
          ))}
        </ol>
      )}

      {!canEdit && (
        <p className="text-xs text-muted-foreground">Você não tem permissão para alterar a fase de projeto.</p>
      )}
    </section>
  );
}

interface StepItemProps {
  step: PhaseStepState;
  index: number;
  staff: readonly StaffUser[];
  canEdit: boolean;
  /** Há gravação em andamento na seção. */
  busy: boolean;
  save: (patch: StepPatch, ok: string) => Promise<boolean>;
  children?: React.ReactNode;
}

function StepItem({ step, index, staff, canEdit, busy, save, children }: StepItemProps) {
  const today = todayISO();
  const isApproval = step.key === APROVACAO;
  const idBase = `fase-${step.key}`;

  // Prazo: o que está digitado vale sobre o que vem do banco até a gravação
  // terminar (uma releitura no meio não desfaz o que a pessoa escreveu).
  const [dueDraft, setDueDraft] = useState<string | null>(null);
  /** Valor do prazo que está sendo gravado agora (undefined = nenhum). */
  const dueInFlight = useRef<string | null | undefined>(undefined);
  const dueValue = dueDraft ?? step.dueDate ?? "";

  // Depois de gravar, o rascunho só sai quando o banco já mostra o mesmo valor:
  // soltar antes faria o campo piscar com o prazo antigo.
  const savedDue = step.dueDate ?? "";
  useEffect(() => {
    setDueDraft((draft) => (draft === savedDue ? null : draft));
  }, [savedDue, dueDraft]);

  // Concluir: abre um formulário curto com a data (hoje, por padrão).
  const [completing, setCompleting] = useState(false);
  const [doneDraft, setDoneDraft] = useState(today);
  /** A conclusão já foi gravada; falta só a etapa aparecer concluída. */
  const [confirmed, setConfirmed] = useState(false);
  /** Reabrir a aprovação do condomínio pede confirmação: apaga a data que define o início oficial. */
  const [reopening, setReopening] = useState(false);
  useEffect(() => {
    // Concluída (ou reaberta depois): nenhum formulário fica aberto esperando.
    setCompleting(false);
    setConfirmed(false);
    setReopening(false);
  }, [step.done]);

  const commitDue = async () => {
    if (dueDraft == null) return;
    const value = dueDraft === "" ? null : dueDraft;
    if (value === (step.dueDate ?? null)) {
      setDueDraft(null);
      return;
    }
    if (dueInFlight.current !== undefined && dueInFlight.current === value) return; // já está gravando este valor
    if (value != null && (!ISO_DATE.test(value) || value < "2000-01-01")) {
      toast.error("Data inválida.");
      setDueDraft(null);
      return;
    }
    dueInFlight.current = value;
    const ok = await save({ due_date: value }, value ? "Prazo salvo" : "Prazo removido");
    if (dueInFlight.current === value) dueInFlight.current = undefined;
    // Não gravou: o campo volta ao que está no banco — a menos que a pessoa já
    // tenha digitado outra coisa enquanto esta gravação andava.
    if (!ok) setDueDraft((draft) => (draft === (value ?? "") ? null : draft));
  };

  const confirmDone = async () => {
    if (!ISO_DATE.test(doneDraft) || doneDraft < "2000-01-01") {
      toast.error("Informe a data de conclusão.");
      return;
    }
    if (doneDraft > today) {
      toast.error("A data de conclusão não pode ser no futuro.");
      return;
    }
    if (confirmed) return;
    // O formulário fecha quando a etapa aparece concluída (efeito acima); até
    // lá fica travado, para um segundo toque não gravar de novo.
    if (await save({ done_at: doneDraft }, "Etapa concluída")) setConfirmed(true);
  };

  const situation = stepVerdict(step);
  const showSituation = situation && (situation.verdict === "atrasada" || situation.verdict === "vence_logo");
  const responsibleName = step.responsibleUserId
    ? (staff.find((u) => u.id === step.responsibleUserId)?.nome ?? RESPONSAVEL_FORA_DA_EQUIPE)
    : null;
  const responsibleMissing = !!step.responsibleUserId && !staff.some((u) => u.id === step.responsibleUserId);
  const doneLabel = isApproval ? "Data em que a aprovação chegou" : "Data de conclusão";

  return (
    <div
      role="group"
      aria-label={step.label}
      aria-current={step.isCurrent ? "step" : undefined}
      className={cn("rounded-lg border p-3", step.isCurrent ? "border-primary bg-primary/5" : "border-border")}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
            step.done
              ? "bg-success/15 text-success"
              : step.isCurrent
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
          )}
        >
          {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-foreground">{step.label}</p>
          {step.implied ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Concluída antes do registro por etapas</p>
          ) : step.done && step.doneAt ? (
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              Concluída em {dataBR(step.doneAt)}
              {responsibleName && ` · ${responsibleName}`}
            </p>
          ) : (
            (step.isCurrent || showSituation) && (
              <p className="mt-1 flex flex-wrap items-center gap-1">
                {step.isCurrent && (
                  <span className="rounded-full border border-primary/30 bg-background px-2 py-0.5 text-xs font-medium text-primary">
                    Etapa atual
                  </span>
                )}
                {showSituation && situation && <FaseChip verdict={situation} />}
              </p>
            )
          )}
        </div>
        {canEdit &&
          (step.done ? (
            !reopening &&
            !step.implied && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-[40px] shrink-0 text-muted-foreground"
                disabled={busy}
                onClick={() => (isApproval ? setReopening(true) : void save({ done_at: null }, "Etapa reaberta"))}
              >
                Reabrir
              </Button>
            )
          ) : (
            !completing && (
              <Button
                type="button"
                variant={step.isCurrent ? "default" : "outline"}
                size="sm"
                className="min-h-[40px] shrink-0"
                disabled={busy}
                onClick={() => {
                  setDoneDraft(today);
                  setCompleting(true);
                }}
              >
                Concluir
              </Button>
            )
          ))}
      </div>

      {canEdit && step.done && reopening && (
        <div className="mt-3 space-y-2 rounded-md border border-border bg-background p-3">
          <p className="text-sm text-foreground">
            Reabrir apaga a data em que a aprovação chegou{step.doneAt ? ` (${dataBR(step.doneAt)})` : ""} e o início
            oficial calculado a partir dela.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[40px]"
              disabled={busy}
              onClick={() => void save({ done_at: null }, "Etapa reaberta")}
            >
              Reabrir mesmo assim
            </Button>
            <Button type="button" variant="ghost" size="sm" className="min-h-[40px]" disabled={busy} onClick={() => setReopening(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {canEdit && !step.done && completing && (
        <div className="mt-3 space-y-2 rounded-md border border-border bg-background p-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${idBase}-conclusao`}>{doneLabel}</Label>
            <Input
              id={`${idBase}-conclusao`}
              type="date"
              value={doneDraft}
              max={today}
              onChange={(e) => setDoneDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy && !confirmed) void confirmDone();
              }}
            />
            {isApproval && (
              <p className="text-xs text-muted-foreground">
                O início oficial da obra conta {OFFICIAL_START_BUSINESS_DAYS} dias úteis a partir desta data. Confira o dia
                em que o e-mail do condomínio chegou.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="min-h-[40px]"
              disabled={busy || confirmed}
              onClick={() => void confirmDone()}
            >
              Confirmar conclusão
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[40px]"
              disabled={busy || confirmed}
              onClick={() => setCompleting(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!step.done &&
        (canEdit ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${idBase}-prazo`}>Prazo</Label>
              <Input
                id={`${idBase}-prazo`}
                type="date"
                value={dueValue}
                onChange={(e) => setDueDraft(e.target.value)}
                onBlur={() => void commitDue()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitDue();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${idBase}-responsavel`}>Responsável</Label>
              <Select
                value={step.responsibleUserId ?? NONE}
                disabled={busy}
                onValueChange={(v) =>
                  void save(
                    { responsible_user_id: v === NONE ? null : v },
                    v === NONE ? "Responsável removido" : "Responsável salvo",
                  )
                }
              >
                <SelectTrigger id={`${idBase}-responsavel`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem responsável</SelectItem>
                  {/* Quem saiu da equipe continua aparecendo na etapa que já era dele. */}
                  {responsibleMissing && step.responsibleUserId && (
                    <SelectItem value={step.responsibleUserId}>{RESPONSAVEL_FORA_DA_EQUIPE}</SelectItem>
                  )}
                  {staff.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <dl className="mt-2 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Prazo</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-foreground">
                {step.dueDate ? dataBR(step.dueDate) : "Sem prazo"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Responsável</dt>
              <dd className="mt-0.5 font-medium text-foreground">{responsibleName ?? "Sem responsável"}</dd>
            </div>
          </dl>
        ))}

      {children}
    </div>
  );
}
