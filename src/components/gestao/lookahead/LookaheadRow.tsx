/**
 * LookaheadRow — linha de um item do CRONOGRAMA INTERNO na janela lookahead.
 *
 * Ações rápidas inline (staff), gravadas no cronograma interno — e, quando o
 * item é de primeiro nível e veio do cliente, também na atividade do cliente
 * (é assim que o cronograma do cliente sempre foi preenchido daqui):
 *   - Atribuir responsável (Select com staff users) — atualização otimista.
 *   - Iniciar / Concluir — grava `actual_start`/`actual_end` do item interno.
 *   - Avanço físico — a medição é da atividade do cliente de onde o item veio
 *     (`client_activity_id`); item só interno não tem o botão.
 *
 * Toque mínimo 44px em botões/gatilhos. Cores semânticas para atraso/sem
 * responsável.
 */
import { useState } from "react";
import { toLocalISODate } from "@/lib/localDate";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Play,
  TrendingUp,
  UserPlus,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { invalidateInternalScheduleQueries, queryKeys } from "@/lib/queryKeys";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import type { LookaheadActivity } from "@/hooks/useLookahead";
import {
  internalScheduleErrorMessage,
  updateInternalMirroringClient,
  type MirrorChange,
} from "@/hooks/useInternalSchedule";
import { useActivityMeasurements } from "@/hooks/useActivityProgress";
import { finishTodayChange, startTodayChange } from "@/lib/internalScheduleActions";
import { RegistrarAvancoDialog } from "@/components/gestao/avanco/RegistrarAvancoDialog";

const UNASSIGNED = "__unassigned__";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

interface Props {
  activity: LookaheadActivity;
  windowDays: number;
}

export function LookaheadRow({ activity, windowDays }: Props) {
  const queryClient = useQueryClient();
  const { data: staff = [] } = useStaffUsers();
  const [assignOpen, setAssignOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  // Avanço físico é medido na atividade do cliente de onde o item veio.
  const progressActivityId = activity.client_activity_id;
  const { data: measurements = [] } = useActivityMeasurements(
    progressOpen && progressActivityId ? progressActivityId : undefined,
  );
  const latestPct = measurements[0]?.progress_pct ?? null;

  // Início / término real do item interno.
  const datesMutation = useMutation({
    // Item de primeiro nível ligado ao cliente: grava também na atividade do
    // cliente (como o Lookahead sempre fez). Micro-etapa / só interno: só interno.
    mutationFn: async (change: MirrorChange) => updateInternalMirroringClient(activity, change),
    onError: (err) => {
      toast.error(internalScheduleErrorMessage(err) || "Não foi possível salvar a data.");
    },
    onSettled: () => invalidateInternalScheduleQueries(queryClient),
  });
  const isUpdating = datesMutation.isPending;
  const updateActivity = async (change: MirrorChange) => {
    try {
      await datesMutation.mutateAsync(change);
      return true;
    } catch {
      return false;
    }
  };

  // Atribuição de responsável — atualização otimista sobre o cache do lookahead.
  const assignMutation = useMutation({
    mutationFn: async (userId: string | null) => {
      await updateInternalMirroringClient(activity, { responsible_user_id: userId });
      return userId;
    },
    onMutate: async (userId) => {
      const key = queryKeys.lookahead.list(windowDays);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LookaheadActivity[]>(key);
      const staffName = userId
        ? (staff.find((u) => u.id === userId)?.nome ?? null)
        : null;
      queryClient.setQueryData<LookaheadActivity[]>(key, (rows) =>
        (rows ?? []).map((r) =>
          r.id === activity.id
            ? {
                ...r,
                responsible_user_id: userId,
                responsible_name: staffName,
                hasResponsible: !!userId,
              }
            : r,
        ),
      );
      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous);
      toast.error("Não foi possível atribuir o responsável.");
    },
    onSuccess: () => {
      toast.success("Responsável atualizado.");
      invalidateInternalScheduleQueries(queryClient);
    },
  });

  const handleAssign = (value: string) => {
    setAssignOpen(false);
    const userId = value === UNASSIGNED ? null : value;
    if (userId === activity.responsible_user_id) return;
    assignMutation.mutate(userId);
  };

  const handleStart = async () => {
    if (activity.actual_start) return;
    const today = toLocalISODate(new Date());
    // "Iniciar" só marca o início de quem ainda não começou — em cada linha.
    const ok = await updateActivity(startTodayChange(today));
    if (ok) toast.success("Atividade marcada como iniciada.");
  };

  const handleComplete = async () => {
    const today = toLocalISODate(new Date());
    // Mantém o início que a linha já tem (o do cliente para o cliente, o do
    // interno para o interno); sem início, hoje.
    const ok = await updateActivity(finishTodayChange(today, "today"));
    if (ok) toast.success("Atividade concluída.");
  };

  const overdue = activity.isOverdue;
  const missingResp = !activity.hasResponsible;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-3 sm:p-4 sm:flex-row sm:items-center",
        overdue
          ? "border-destructive/30"
          : missingResp
            ? "border-warning/30"
            : "border-border-subtle",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <Link
            to={`/obra/${activity.project_id}/cronograma-interno`}
            className="text-[11px] font-medium text-foreground/80 bg-muted/60 hover:bg-muted px-1.5 py-0.5 rounded truncate max-w-[220px]"
            title={activity.project_name}
          >
            {activity.project_name}
          </Link>
          {overdue && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/10 border border-destructive/25 rounded px-1.5 py-0.5">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Atrasada
            </span>
          )}
          {missingResp && !overdue && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning bg-warning/10 border border-warning/25 rounded px-1.5 py-0.5">
              <UserX className="h-3 w-3" aria-hidden />
              Sem responsável
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground line-clamp-2">
          {activity.description}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
          <span>
            Início {formatDate(activity.planned_start)}
            {activity.planned_end
              ? ` · Fim ${formatDate(activity.planned_end)}`
              : ""}
          </span>
          {activity.responsible_name && (
            <span className="truncate max-w-[200px]">
              · {activity.responsible_name}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:justify-end shrink-0">
        <Select
          open={assignOpen}
          onOpenChange={setAssignOpen}
          value={activity.responsible_user_id ?? UNASSIGNED}
          onValueChange={handleAssign}
        >
          <SelectTrigger
            aria-label="Atribuir responsável"
            className="h-11 min-w-[44px] w-auto gap-1.5 px-2.5 text-xs"
          >
            {assignMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden />
            )}
            <SelectValue placeholder="Atribuir" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={UNASSIGNED}>Sem responsável</SelectItem>
            {staff.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!activity.actual_start ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStart}
            disabled={isUpdating}
            className="h-11 gap-1.5"
            aria-label="Marcar atividade como iniciada"
          >
            <Play className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Iniciar</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleComplete}
            disabled={isUpdating}
            className="h-11 gap-1.5"
            aria-label="Concluir atividade"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Concluir</span>
          </Button>
        )}

        {progressActivityId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setProgressOpen(true)}
            className="h-11 gap-1.5"
            aria-label="Registrar avanço físico"
          >
            <TrendingUp className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Avanço</span>
          </Button>
        )}

        <Link
          to={`/obra/${activity.project_id}/cronograma-interno`}
          aria-label="Abrir cronograma interno da obra"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border-subtle text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {progressActivityId && (
      <RegistrarAvancoDialog
        open={progressOpen}
        onOpenChange={setProgressOpen}
        activityId={progressActivityId}
        projectId={activity.project_id}
        activityDescription={activity.description}
        currentProgress={latestPct}
      />
      )}
    </div>
  );
}
