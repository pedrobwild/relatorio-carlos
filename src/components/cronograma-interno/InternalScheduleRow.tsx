/**
 * Linha de um item do Cronograma interno (item de primeiro nível ou
 * micro-etapa). Pensada para o celular primeiro: tudo empilha; no desktop
 * as datas ficam lado a lado.
 *
 * Edição rápida na própria linha: datas previstas, início/término real e os
 * atalhos "Iniciou hoje" / "Concluiu hoje". O resto abre na gaveta.
 */
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/hojeDia";
import type { InternalScheduleItemWithRefs, InternalSchedulePatch } from "@/infra/repositories/internalSchedule.repository";
import { compareWithClient, ddmm, validateItemDates, type ClientDatesLike } from "@/lib/internalSchedule";

type DateField = "planned_start" | "planned_end" | "actual_start" | "actual_end";

const DATE_LABEL: Record<DateField, string> = {
  planned_start: "Início previsto",
  planned_end: "Fim previsto",
  actual_start: "Início real",
  actual_end: "Término real",
};

interface Props {
  item: InternalScheduleItemWithRefs;
  isChild?: boolean;
  clientById: ReadonlyMap<string, ClientDatesLike>;
  /** As datas do cliente chegaram (sem isso, não marca "Só interno"). */
  clientLoaded: boolean;
  canEdit: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPatch: (id: string, patch: InternalSchedulePatch, ok?: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onOpen: (item: InternalScheduleItemWithRefs) => void;
  onAddChild?: (item: InternalScheduleItemWithRefs) => void;
  onDelete: (item: InternalScheduleItemWithRefs) => void;
}

export function InternalScheduleRow({
  item,
  isChild = false,
  clientById,
  clientLoaded,
  canEdit,
  canMoveUp,
  canMoveDown,
  onPatch,
  onMove,
  onOpen,
  onAddChild,
  onDelete,
}: Props) {
  const [dates, setDates] = useState<Record<DateField, string>>({
    planned_start: item.planned_start,
    planned_end: item.planned_end,
    actual_start: item.actual_start ?? "",
    actual_end: item.actual_end ?? "",
  });
  // Os campos seguem o que está gravado (inclusive depois de um erro).
  useEffect(() => {
    setDates({
      planned_start: item.planned_start,
      planned_end: item.planned_end,
      actual_start: item.actual_start ?? "",
      actual_end: item.actual_end ?? "",
    });
  }, [item.planned_start, item.planned_end, item.actual_start, item.actual_end]);

  const current = (f: DateField) => (item[f] ?? "") as string;

  const commit = (field: DateField) => {
    const raw = dates[field];
    if (raw === current(field)) return;
    if ((field === "planned_start" || field === "planned_end") && !raw) {
      toast.error("As datas previstas são obrigatórias.");
      setDates((d) => ({ ...d, [field]: current(field) }));
      return;
    }
    const next = {
      planned_start: item.planned_start,
      planned_end: item.planned_end,
      actual_start: item.actual_start,
      actual_end: item.actual_end,
      [field]: raw || null,
    } as { planned_start: string; planned_end: string; actual_start: string | null; actual_end: string | null };
    const error = validateItemDates(next);
    if (error) {
      toast.error(error);
      setDates((d) => ({ ...d, [field]: current(field) }));
      return;
    }
    onPatch(item.id, { [field]: raw || null }, raw ? `${DATE_LABEL[field]} salvo` : `${DATE_LABEL[field]} removido`);
  };

  const startedToday = () => onPatch(item.id, { actual_start: todayISO() }, "Início real registrado");
  const finishedToday = () => {
    const today = todayISO();
    onPatch(
      item.id,
      { actual_end: today, ...(item.actual_start ? {} : { actual_start: today }) },
      "Término real registrado",
    );
  };

  const cmp = compareWithClient(item, clientById);
  const done = !!item.actual_end;
  const started = !!item.actual_start;

  const dateInput = (field: DateField) => (
    <Input
      type="date"
      aria-label={`${DATE_LABEL[field]} de ${item.description}`}
      value={dates[field]}
      disabled={!canEdit}
      max={field === "actual_start" || field === "actual_end" ? todayISO() : undefined}
      onChange={(e) => setDates((d) => ({ ...d, [field]: e.target.value }))}
      onBlur={() => commit(field)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(field);
      }}
      className="h-11 min-w-0 px-2 text-sm tabular-nums sm:h-9"
    />
  );

  return (
    <li
      className={cn(
        "rounded-lg border border-border bg-card p-3",
        isChild && "ml-4 border-l-4 border-l-primary/30 sm:ml-8",
        done && "bg-muted/30",
      )}
      data-testid={`internal-item-${item.id}`}
    >
      <div className="flex items-start gap-2">
        {canEdit && (
          <div className="flex shrink-0 flex-col">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!canMoveUp}
              onClick={() => onMove(item.id, "up")}
              aria-label={`Mover “${item.description}” para cima`}
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!canMoveDown}
              onClick={() => onMove(item.id, "down")}
              aria-label={`Mover “${item.description}” para baixo`}
            >
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() => onOpen(item)}
              className={cn(
                "min-h-[32px] text-left text-sm font-semibold leading-snug text-foreground hover:underline",
                done && "text-muted-foreground line-through decoration-muted-foreground/50",
              )}
            >
              {isChild && <span className="sr-only">Micro-etapa: </span>}
              {item.description}
            </button>
            {done ? (
              <Badge variant="secondary" className="font-normal">
                Concluído
              </Badge>
            ) : started ? (
              <Badge variant="outline" className="border-primary/40 font-normal text-primary">
                Em andamento
              </Badge>
            ) : null}
            {cmp.kind === "diferente" && (
              <Badge variant="outline" className="border-warning/40 bg-warning/10 font-normal tabular-nums text-warning">
                {cmp.label}
              </Badge>
            )}
            {cmp.kind === "so_interno" && clientLoaded && (
              <Badge variant="outline" className="font-normal text-muted-foreground">
                Só interno
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Início previsto</span>
              {dateInput("planned_start")}
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Fim previsto</span>
              {dateInput("planned_end")}
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Início real</span>
              {canEdit && !started ? (
                <Button type="button" variant="outline" className="h-11 w-full gap-1.5 sm:h-9" onClick={startedToday}>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Iniciou hoje
                </Button>
              ) : (
                dateInput("actual_start")
              )}
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Término real</span>
              {canEdit && !done ? (
                <Button type="button" variant="outline" className="h-11 w-full gap-1.5 sm:h-9" onClick={finishedToday}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Concluiu hoje
                </Button>
              ) : (
                dateInput("actual_end")
              )}
            </div>
          </div>

          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="tabular-nums">Peso {Number(item.weight).toLocaleString("pt-BR")}%</span>
            <span>{item.responsible?.nome ?? "Sem responsável"}</span>
            <span>{item.fornecedor?.nome ? `Prestador: ${item.fornecedor.nome}` : "Sem prestador"}</span>
            {item.actual_start && !done && <span className="tabular-nums">Iniciou {ddmm(item.actual_start)}</span>}
          </p>

          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-9 gap-1.5" onClick={() => onOpen(item)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {canEdit ? "Editar" : "Detalhes"}
            </Button>
            {canEdit && onAddChild && (
              <Button type="button" variant="ghost" size="sm" className="h-9 gap-1.5" onClick={() => onAddChild(item)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Micro-etapa
              </Button>
            )}
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(item)}
                aria-label={`Excluir “${item.description}”`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Excluir
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
