/**
 * GerarDoCronogramaDialog — cria atividades internas a partir dos itens do
 * cronograma interno da obra, do mesmo jeito que o cronograma nasce do
 * modelo: a equipe só confere a lista e confirma.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { internalScheduleRepo } from "@/infra/repositories/internalSchedule.repository";
import { queryKeys } from "@/lib/queryKeys";
import { buildTaskCandidates, type TaskCandidate } from "@/lib/tasksFromSchedule";
import type { ObraTaskInput } from "@/hooks/useObraTasks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | undefined;
  existingTitles: string[];
  isSaving: boolean;
  onConfirm: (inputs: ObraTaskInput[]) => void;
}

const formatDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

export function GerarDoCronogramaDialog({
  open,
  onOpenChange,
  projectId,
  existingTitles,
  isSaving,
  onConfirm,
}: Props) {
  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.internalSchedule.byProject(projectId),
    queryFn: async () => {
      const res = await internalScheduleRepo.listByProject(projectId!);
      if (res.error) throw res.error;
      return res.data ?? [];
    },
    enabled: open && !!projectId,
  });

  const candidates = useMemo(
    () => buildTaskCandidates(items, existingTitles),
    [items, existingTitles],
  );
  const selectable = useMemo(
    () => candidates.filter((c) => !c.alreadyExists),
    [candidates],
  );

  // Padrão: tudo que ainda não virou atividade e não está concluído.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open) return;
    setSelected(
      new Set(selectable.filter((c) => !c.done).map((c) => c.sourceId)),
    );
  }, [open, selectable]);

  const groups = useMemo(() => {
    const map = new Map<string, TaskCandidate[]>();
    for (const c of candidates) {
      const list = map.get(c.group) ?? [];
      list.push(c);
      map.set(c.group, list);
    }
    return [...map.entries()];
  }, [candidates]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected =
    selectable.length > 0 && selected.size === selectable.length;

  const handleConfirm = () => {
    onConfirm(
      candidates
        .filter((c) => selected.has(c.sourceId))
        .map((c) => ({
          title: c.title,
          description: [`Etapa do cronograma: ${c.group}`, c.notes]
            .filter(Boolean)
            .join("\n"),
          start_date: c.start_date,
          due_date: c.due_date,
          responsible_user_id: c.responsible_user_id,
          status: c.done ? "concluido" : "pendente",
        })),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" aria-hidden />
            Gerar atividades do cronograma
          </DialogTitle>
          <DialogDescription>
            Cada item do cronograma interno vira uma atividade, com as datas
            previstas e o responsável do item. Desmarque o que não quiser.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Carregando cronograma…
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            Não foi possível carregar o cronograma desta obra.
          </p>
        ) : candidates.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Esta obra ainda não tem itens no cronograma interno. Monte o
            cronograma primeiro e volte aqui.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground tabular-nums">
                  {selected.size}
                </strong>{" "}
                de {selectable.length} selecionadas
                {candidates.length > selectable.length &&
                  ` · ${candidates.length - selectable.length} já existem`}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={selectable.length === 0}
                onClick={() =>
                  setSelected(
                    allSelected
                      ? new Set()
                      : new Set(selectable.map((c) => c.sourceId)),
                  )
                }
              >
                {allSelected ? "Desmarcar todas" : "Marcar todas"}
              </Button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
              {groups.map(([group, list]) => (
                <div key={group}>
                  <div className="sticky top-0 bg-muted px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </div>
                  <ul>
                    {list.map((c) => (
                      <li key={c.sourceId} className="border-t border-border">
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-accent/40 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                          <Checkbox
                            checked={selected.has(c.sourceId)}
                            disabled={c.alreadyExists}
                            onCheckedChange={() => toggle(c.sourceId)}
                            aria-label={c.title}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {c.title}
                          </span>
                          {c.alreadyExists ? (
                            <Badge variant="secondary">Já existe</Badge>
                          ) : (
                            c.done && <Badge variant="outline">Concluído</Badge>
                          )}
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {formatDay(c.start_date)} – {formatDay(c.due_date)}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={selected.size === 0 || isSaving}
          >
            {isSaving && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            )}
            Criar {selected.size > 0 ? selected.size : ""}{" "}
            {selected.size === 1 ? "atividade" : "atividades"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
