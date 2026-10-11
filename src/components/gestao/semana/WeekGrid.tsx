/**
 * Grade da Semana: etapas do cliente → atividades × dias.
 *
 * - Célula vazia: "+" marca a atividade naquele dia (quem faz já vem do
 *   último dia marcado).
 * - Chip da alocação: toque abre ajuste (quem / dia / remover). No
 *   computador, dá para arrastar o chip para outro dia da mesma linha.
 * - ⚠ = marcado depois da data-limite da atividade (ou do fim previsto da etapa).
 */
import { useState } from "react";
import { AlertTriangle, Check, Flame, HelpCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { OPS_REASON_LABEL, OPS_STATUS_LABEL } from "@/lib/opsLabels";
import { longDayLabel, parseISODate } from "@/lib/hojeDia";
import {
  isAfterLimit,
  parseWho,
  shortWho,
  whoText,
  type ActivityWeekRow,
  type StageWeekSection,
  type WeekDay,
} from "@/lib/semanaPlan";
import type { OpsActivityView, OpsAssignment } from "@/infra/repositories/ops.repository";
import {
  useCreateOpsActivity,
  useCreateOpsAssignment,
  useDeleteOpsAssignment,
  useUpdateAssignmentPlan,
} from "@/hooks/useOps";
import { WhoInput } from "./WhoInput";

export interface WeekGridProps {
  sections: StageWeekSection[];
  days: WeekDay[];
  staff: ReadonlyArray<{ id: string; nome: string }>;
  staffNameById: ReadonlyMap<string, string>;
  suggestions: readonly string[];
  /** Último "quem" usado em cada atividade (para pré-preencher). */
  lastWhoByActivity: ReadonlyMap<string, Pick<OpsAssignment, "user_id" | "worker_name">>;
  today: string;
  projectId: string;
  onOpenActivity: (activityId: string) => void;
}

const ddmm = (iso: string) => {
  const d = parseISODate(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function WeekGrid(props: WeekGridProps) {
  const { sections, days } = props;
  const [dragging, setDragging] = useState<{ id: string; activityId: string } | null>(null);
  const move = useUpdateAssignmentPlan();

  const onDrop = (activityId: string, iso: string) => {
    if (!dragging || dragging.activityId !== activityId) return;
    const id = dragging.id;
    setDragging(null);
    move.mutate(
      { id, patch: { work_date: iso } },
      { onError: () => toast.error("Não foi possível mover. Tente de novo.") },
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <caption className="sr-only">Programação da semana por etapa e atividade</caption>
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th
              scope="col"
              className="sticky left-0 z-10 w-[240px] min-w-[200px] bg-muted/40 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur"
            >
              Atividade
            </th>
            {days.map((d) => (
              <th
                key={d.iso}
                scope="col"
                className={cn(
                  "min-w-[112px] px-2 py-2 text-left text-xs font-semibold",
                  d.isToday ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="block">{d.label}</span>
                {d.holiday && <span className="block text-[11px] font-normal text-warning">Feriado</span>}
                {d.isToday && !d.holiday && <span className="block text-[11px] font-normal">Hoje</span>}
              </th>
            ))}
          </tr>
        </thead>
        {sections.map((sec) => (
          <StageBlock
            key={sec.stageId ?? "sem"}
            section={sec}
            {...props}
            dragging={dragging}
            setDragging={setDragging}
            onDrop={onDrop}
          />
        ))}
      </table>
    </div>
  );
}

function StageBlock({
  section,
  days,
  projectId,
  dragging,
  setDragging,
  onDrop,
  ...rest
}: WeekGridProps & {
  section: StageWeekSection;
  dragging: { id: string; activityId: string } | null;
  setDragging: (d: { id: string; activityId: string } | null) => void;
  onDrop: (activityId: string, iso: string) => void;
}) {
  const st = section.stage;
  return (
    <tbody className="border-b border-border last:border-b-0">
      <tr className="bg-muted/20">
        <th
          scope="rowgroup"
          colSpan={days.length + 1}
          className="px-3 py-2 text-left"
        >
          <div className="sticky left-3 inline-flex max-w-[calc(100vw-4rem)] flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-semibold text-foreground">{section.stageName}</span>
            {st && (
              <span className="text-xs font-normal text-muted-foreground">
                Cronograma: {ddmm(st.planned_start)} a {ddmm(st.planned_end)}
              </span>
            )}
            {section.stageId && (
              <NewActivityButton stageId={section.stageId} projectId={projectId} stageName={section.stageName} />
            )}
          </div>
        </th>
      </tr>
      {section.rows.length === 0 ? (
        <tr>
          <td colSpan={days.length + 1} className="px-3 py-3 text-sm text-muted-foreground">
            <span className="sticky left-3 inline-block max-w-[calc(100vw-4rem)]">Prevista no cronograma para esta semana, sem atividade ainda. Use “Planejar semana” ou “+ Atividade”.</span>
          </td>
        </tr>
      ) : (
        section.rows.map((row) => (
          <ActivityRowView
            key={row.activity.id ?? ""}
            row={row}
            days={days}
            projectId={projectId}
            dragging={dragging}
            setDragging={setDragging}
            onDrop={onDrop}
            {...rest}
          />
        ))
      )}
    </tbody>
  );
}

function ActivityRowView({
  row,
  days,
  dragging,
  setDragging,
  onDrop,
  onOpenActivity,
  ...rest
}: Omit<WeekGridProps, "sections"> & {
  row: ActivityWeekRow;
  dragging: { id: string; activityId: string } | null;
  setDragging: (d: { id: string; activityId: string } | null) => void;
  onDrop: (activityId: string, iso: string) => void;
}) {
  const a = row.activity;
  const id = a.id ?? "";
  const status = a.status ?? "planejada";
  const missing = Number(a.materials_missing ?? 0);
  const canDropHere = dragging?.activityId === id;

  return (
    <tr className="border-t border-border/60 align-top">
      <th scope="row" className="sticky left-0 z-[1] bg-card px-3 py-2 text-left font-normal">
        <button
          type="button"
          onClick={() => onOpenActivity(id)}
          className="group block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-start gap-1.5">
            {a.is_critical && <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Crítica" />}
            <span className="font-medium text-foreground group-hover:underline">{a.title}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            {status !== "planejada" && (
              <span>
                {OPS_STATUS_LABEL[status]}
                {status === "bloqueada" && a.blocked_reason ? `: ${OPS_REASON_LABEL[a.blocked_reason]}` : ""}
              </span>
            )}
            {row.limit && <span>Limite {ddmm(row.limit)}</span>}
            {missing > 0 && (
              <span className="font-medium text-warning">
                {missing === 1 ? "1 material faltando" : `${missing} materiais faltando`}
              </span>
            )}
          </span>
        </button>
      </th>
      {days.map((d) => {
        const list = row.cells[d.iso] ?? [];
        return (
          <td
            key={d.iso}
            className={cn(
              "group/cell px-1.5 py-1.5",
              d.isToday && "bg-primary/[0.04]",
              d.holiday && "bg-muted/40",
              canDropHere && "outline-dashed outline-1 -outline-offset-2 outline-primary/50",
            )}
            onDragOver={(e) => {
              if (canDropHere) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(id, d.iso);
            }}
          >
            <div className="flex flex-col gap-1">
              {list.map((asg) => (
                <AssignmentChip
                  key={asg.id}
                  assignment={asg}
                  activity={a}
                  afterLimit={isAfterLimit(asg.work_date, row.limit)}
                  days={days}
                  onDragStart={() => setDragging({ id: asg.id, activityId: id })}
                  onDragEnd={() => setDragging(null)}
                  onOpenActivity={onOpenActivity}
                  {...rest}
                />
              ))}
              {!["aprovada", "refazer"].includes(status) && (
                <AddCellButton activity={a} day={d} subtle={list.length > 0} {...rest} />
              )}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

function AssignmentChip({
  assignment: asg,
  activity,
  afterLimit,
  days,
  staff,
  staffNameById,
  suggestions,
  today,
  onDragStart,
  onDragEnd,
  onOpenActivity,
}: Pick<WeekGridProps, "staff" | "staffNameById" | "suggestions" | "today" | "onOpenActivity"> & {
  assignment: OpsAssignment;
  activity: OpsActivityView;
  afterLimit: boolean;
  days: WeekDay[];
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("");
  const [day, setDay] = useState(asg.work_date);
  const update = useUpdateAssignmentPlan();
  const remove = useDeleteOpsAssignment();
  const name = shortWho(asg, staffNameById);
  const confirmed = asg.outcome != null;
  const unconfirmedPast = !confirmed && asg.work_date <= today;

  const state = asg.outcome === "feito" ? "Feito" : asg.outcome === "nao_feito" ? "Não feito" : unconfirmedPast ? "Sem confirmação" : "Planejado";
  const Icon = asg.outcome === "feito" ? Check : asg.outcome === "nao_feito" ? X : unconfirmedPast ? HelpCircle : null;

  const save = () => {
    const parsed = parseWho(who, staff);
    if (!parsed) {
      toast.error("Informe quem vai fazer.");
      return;
    }
    update.mutate(
      { id: asg.id, patch: { ...parsed, work_date: day } },
      {
        onSuccess: () => setOpen(false),
        onError: () => toast.error("Não foi possível salvar. Tente de novo."),
      },
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setWho(whoText(asg, staffNameById));
          setDay(asg.work_date);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          draggable={!confirmed}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", asg.id);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          aria-label={`${name}, ${longDayLabel(asg.work_date)}: ${state}${afterLimit ? ", depois da data-limite" : ""}`}
          className={cn(
            "flex min-h-[36px] w-full items-center gap-1 rounded-md border px-2 text-left text-xs font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            asg.outcome === "feito" && "border-success/40 bg-success/10 text-success",
            asg.outcome === "nao_feito" && "border-warning/50 bg-warning/10 text-warning",
            !confirmed && !unconfirmedPast && "border-border bg-background text-foreground hover:bg-muted",
            unconfirmedPast && "border-dashed border-muted-foreground/40 bg-background text-muted-foreground",
            afterLimit && !confirmed && "border-warning text-foreground",
            !confirmed && "cursor-grab active:cursor-grabbing",
          )}
        >
          <span className="truncate">{name}</span>
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          {afterLimit && <AlertTriangle className="ml-auto h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div>
          <p className="text-sm font-semibold text-foreground">{activity.title}</p>
          <p className="text-xs text-muted-foreground">
            {longDayLabel(asg.work_date)} · {state}
            {asg.outcome === "nao_feito" && asg.not_done_reason ? ` · ${OPS_REASON_LABEL[asg.not_done_reason]}` : ""}
          </p>
          {afterLimit && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-warning">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Depois da data-limite
            </p>
          )}
        </div>
        {confirmed ? (
          <p className="text-xs text-muted-foreground">
            Já confirmado. Para corrigir, use “Desfazer” na tela Hoje.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Quem faz</Label>
              <WhoInput value={who} onChange={setWho} suggestions={suggestions} onEnter={save} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dia</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger aria-label="Dia" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {days.map((d) => (
                    <SelectItem key={d.iso} value={d.iso}>
                      {longDayLabel(d.iso)}
                      {d.holiday ? " (feriado)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] flex-1"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(asg.id, {
                    onSuccess: () => setOpen(false),
                    onError: () => toast.error("Não foi possível remover."),
                  })
                }
              >
                Tirar do dia
              </Button>
              <Button type="button" className="min-h-[44px] flex-1" disabled={update.isPending} onClick={save}>
                Salvar
              </Button>
            </div>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => {
            setOpen(false);
            if (activity.id) onOpenActivity(activity.id);
          }}
        >
          Abrir atividade
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function AddCellButton({
  activity,
  day,
  staff,
  staffNameById,
  suggestions,
  lastWhoByActivity,
  subtle = false,
  labelled = false,
}: Pick<WeekGridProps, "staff" | "staffNameById" | "suggestions" | "lastWhoByActivity"> & {
  activity: OpsActivityView;
  day: WeekDay;
  /** Célula já tem alguém: o "+" só aparece ao passar o mouse ou focar. */
  subtle?: boolean;
  /** Versão com texto (lista do celular). */
  labelled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("");
  const create = useCreateOpsAssignment();

  const add = () => {
    const parsed = parseWho(who, staff);
    if (!parsed || !activity.id) {
      toast.error("Informe quem vai fazer.");
      return;
    }
    create.mutate(
      { activity_id: activity.id, work_date: day.iso, ...parsed },
      {
        onSuccess: () => setOpen(false),
        onError: () => toast.error("Não foi possível marcar. Tente de novo."),
      },
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setWho(whoText(activity.id ? lastWhoByActivity.get(activity.id) : null, staffNameById));
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Marcar ${activity.title} em ${longDayLabel(day.iso)}`}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed transition-colors",
            "focus-visible:border-border focus-visible:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            labelled
              ? "min-h-[44px] border-border text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              : "min-h-[32px] border-transparent text-muted-foreground/60 hover:border-border hover:bg-muted hover:text-foreground",
            subtle && !labelled && "min-h-[24px] opacity-0 group-hover/cell:opacity-100",
          )}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {labelled && <span>{subtle ? "Mais alguém" : "Marcar neste dia"}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div>
          <p className="text-sm font-semibold text-foreground">{activity.title}</p>
          <p className="text-xs text-muted-foreground">
            {longDayLabel(day.iso)}
            {day.holiday ? " · feriado" : ""}
          </p>
        </div>
        <WhoInput value={who} onChange={setWho} suggestions={suggestions} autoFocus onEnter={add} />
        <Button type="button" className="min-h-[44px] w-full" disabled={create.isPending} onClick={add}>
          Marcar no dia
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function NewActivityButton({ stageId, projectId, stageName }: { stageId: string; projectId: string; stageName: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const create = useCreateOpsActivity();
  const add = () => {
    const t = title.trim();
    if (!t) return;
    create.mutate(
      { project_id: projectId, stage_id: stageId, title: t },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
        },
        onError: () => toast.error("Não foi possível criar a atividade."),
      },
    );
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" aria-label={`Nova atividade em ${stageName}`}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Atividade
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <Label htmlFor={`nova-${stageId}`} className="text-sm font-semibold">
          Nova atividade em {stageName}
        </Label>
        <Input
          id={`nova-${stageId}`}
          value={title}
          autoFocus
          maxLength={160}
          placeholder="Ex.: Passar conduíte do quarto"
          className="min-h-[44px]"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" className="min-h-[44px] w-full" disabled={!title.trim() || create.isPending} onClick={add}>
          Criar
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Celular: um dia por vez. Mesmas ações da grade (marcar, ajustar, abrir a
 * atividade), sem rolagem lateral.
 */
export function MobileWeekList(props: WeekGridProps) {
  const { sections, days, today, onOpenActivity } = props;
  const initial = days.find((d) => d.iso === today && !d.holiday)?.iso ?? days.find((d) => !d.holiday)?.iso ?? days[0]?.iso;
  const [day, setDay] = useState(initial);
  const current = days.find((d) => d.iso === day) ?? days[0];
  if (!current) return null;
  const countFor = (iso: string) =>
    sections.reduce((n, s) => n + s.rows.reduce((m, r) => m + (r.cells[iso]?.length ?? 0), 0), 0);

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Dia da semana"
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((d) => {
          const n = countFor(d.iso);
          const on = d.iso === current.iso;
          return (
            <button
              key={d.iso}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setDay(d.iso)}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center rounded-lg border text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
                !on && d.holiday && "text-muted-foreground",
              )}
            >
              <span>{d.label}</span>
              <span className={cn("text-[11px] font-normal", on ? "text-primary-foreground" : "text-muted-foreground")}>
                {d.holiday ? "Feriado" : n === 0 ? "—" : `${n} ${n === 1 ? "pessoa" : "pessoas"}`}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={longDayLabel(current.iso)} className="space-y-5">
        {sections.map((sec) => (
          <section key={sec.stageId ?? "sem"} aria-labelledby={`m-${sec.stageId ?? "sem"}`} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id={`m-${sec.stageId ?? "sem"}`} className="text-sm font-semibold text-foreground">
                {sec.stageName}
              </h3>
              {sec.stageId && <NewActivityButton stageId={sec.stageId} projectId={props.projectId} stageName={sec.stageName} />}
            </div>
            {sec.rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                Prevista no cronograma, sem atividade ainda.
              </p>
            ) : (
              sec.rows.map((row) => {
                const a = row.activity;
                const list = row.cells[current.iso] ?? [];
                const status = a.status ?? "planejada";
                return (
                  <div key={a.id ?? ""} className="space-y-2 rounded-xl border border-border bg-card p-3">
                    <button
                      type="button"
                      onClick={() => a.id && onOpenActivity(a.id)}
                      className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-start gap-1.5">
                        {a.is_critical && <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Crítica" />}
                        <span className="font-medium text-foreground">{a.title}</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        {status !== "planejada" && <span>{OPS_STATUS_LABEL[status]}</span>}
                        {row.limit && <span>Limite {ddmm(row.limit)}</span>}
                        {Number(a.materials_missing ?? 0) > 0 && (
                          <span className="font-medium text-warning">Material faltando</span>
                        )}
                      </span>
                    </button>
                    {list.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {list.map((asg) => (
                          <AssignmentChip
                            key={asg.id}
                            {...props}
                            assignment={asg}
                            activity={a}
                            afterLimit={isAfterLimit(asg.work_date, row.limit)}
                            onDragStart={() => undefined}
                            onDragEnd={() => undefined}
                          />
                        ))}
                      </div>
                    )}
                    {!["aprovada", "refazer"].includes(status) && (
                      <AddCellButton {...props} activity={a} day={current} labelled subtle={list.length > 0} />
                    )}
                  </div>
                );
              })
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
