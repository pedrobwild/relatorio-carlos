/**
 * "Adicionar ao dia": coloca uma atividade na programação de um dia.
 * Obra → etapa do cronograma → atividade (existente ou nova) → quem faz.
 *
 * É o planejamento mínimo para a tela Hoje gerar dado real desde o primeiro
 * dia, antes da tela Semana (Fase 4) existir.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { longDayLabel } from "@/lib/hojeDia";
import { isOpsActivityClosed } from "@/lib/opsLabels";
import { useObraDeadlines } from "@/hooks/useContractDeadline";
import {
  useCreateOpsActivity,
  useCreateOpsAssignment,
  useOpsActivities,
  useOpsStages,
} from "@/hooks/useOps";

const NEW_ACTIVITY = "__nova__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  userId: string | null;
  defaultProjectId?: string | null;
}

export function AddToDaySheet({ open, onOpenChange, date, userId, defaultProjectId }: Props) {
  const [projectId, setProjectId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [activityId, setActivityId] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [whoMode, setWhoMode] = useState<"eu" | "outro">("outro");
  const [workerName, setWorkerName] = useState("");

  useEffect(() => {
    if (!open) return;
    setProjectId(defaultProjectId ?? "");
    setStageId("");
    setActivityId("");
    setNewTitle("");
    setWhoMode("outro");
    setWorkerName("");
  }, [open, defaultProjectId]);

  const { data: obras = [] } = useObraDeadlines();
  const obraOptions = useMemo(
    () =>
      obras
        .filter((o) => o.project_id && (o.status === "active" || o.project_id === defaultProjectId))
        .map((o) => ({ id: o.project_id as string, name: o.project_name ?? "Obra" }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [obras, defaultProjectId],
  );

  const { data: stages = [], isLoading: stagesLoading } = useOpsStages(projectId || undefined);
  const { data: activities = [] } = useOpsActivities(projectId || undefined);
  const stageActivities = useMemo(
    () =>
      activities.filter(
        (a) => a.stage_id === stageId && a.status && !isOpsActivityClosed(a.status),
      ),
    [activities, stageId],
  );

  const createActivity = useCreateOpsActivity();
  const createAssignment = useCreateOpsAssignment();
  const saving = createActivity.isPending || createAssignment.isPending;

  const isNew = activityId === NEW_ACTIVITY || (stageId !== "" && stageActivities.length === 0);
  const hasActivity = isNew ? newTitle.trim().length > 0 : activityId !== "";
  const hasWho = whoMode === "eu" ? !!userId : workerName.trim().length > 0;
  const canSave = !!projectId && !!stageId && hasActivity && hasWho && !saving;

  const save = async () => {
    try {
      let actId = activityId;
      if (isNew) {
        const created = await createActivity.mutateAsync({
          project_id: projectId,
          stage_id: stageId,
          title: newTitle.trim(),
          responsible_user_id: userId,
          planned_start: date,
          planned_end: date,
        });
        actId = created.id;
      }
      await createAssignment.mutateAsync({
        activity_id: actId,
        work_date: date,
        user_id: whoMode === "eu" ? userId : null,
        worker_name: whoMode === "outro" ? workerName.trim() : null,
      });
      toast.success("Adicionado ao dia");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível adicionar. Confira os campos e tente de novo.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto w-full max-w-lg rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Adicionar ao dia</SheetTitle>
          <SheetDescription>{longDayLabel(date)}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-obra">Obra</Label>
            <Select
              value={projectId}
              onValueChange={(v) => {
                setProjectId(v);
                setStageId("");
                setActivityId("");
              }}
            >
              <SelectTrigger id="add-obra" className="min-h-[48px]">
                <SelectValue placeholder="Escolha a obra" />
              </SelectTrigger>
              <SelectContent>
                {obraOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-etapa">Etapa do cronograma</Label>
            <Select
              value={stageId}
              onValueChange={(v) => {
                setStageId(v);
                setActivityId("");
              }}
              disabled={!projectId}
            >
              <SelectTrigger id="add-etapa" className="min-h-[48px]">
                <SelectValue
                  placeholder={
                    !projectId ? "Escolha a obra primeiro" : stagesLoading ? "Carregando…" : "Escolha a etapa"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projectId && !stagesLoading && stages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Esta obra ainda não tem cronograma. Cadastre as etapas na obra antes de programar o dia.
              </p>
            )}
          </div>

          {stageId && stageActivities.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="add-atividade">Atividade</Label>
              <Select value={activityId} onValueChange={setActivityId}>
                <SelectTrigger id="add-atividade" className="min-h-[48px]">
                  <SelectValue placeholder="Escolha ou crie uma atividade" />
                </SelectTrigger>
                <SelectContent>
                  {stageActivities.map((a) => (
                    <SelectItem key={a.id as string} value={a.id as string}>
                      {a.title}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_ACTIVITY}>Nova atividade…</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {stageId && isNew && (
            <div className="space-y-1.5">
              <Label htmlFor="add-titulo">O que será feito</Label>
              <Input
                id="add-titulo"
                className="min-h-[48px]"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex.: Passar conduíte do quarto"
                maxLength={160}
              />
            </div>
          )}

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Quem vai fazer</legend>
            <div role="radiogroup" aria-label="Quem vai fazer" className="grid grid-cols-2 gap-2">
              {(
                [
                  ["outro", "Outra pessoa"],
                  ["eu", "Eu"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={whoMode === value}
                  onClick={() => setWhoMode(value)}
                  className={cn(
                    "min-h-[48px] rounded-lg border px-3 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    whoMode === value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {whoMode === "outro" && (
              <Input
                aria-label="Nome de quem vai fazer"
                className="min-h-[48px]"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                placeholder="Nome (ex.: João eletricista)"
                maxLength={120}
              />
            )}
          </fieldset>
        </div>

        <SheetFooter className="mt-5 flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-[48px] flex-1 sm:flex-none"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" className="min-h-[48px] flex-1 sm:flex-none" disabled={!canSave} onClick={save}>
            Adicionar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
