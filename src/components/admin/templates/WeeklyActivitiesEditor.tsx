import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  parseShowIf,
  serializeShowIf,
  validateShowIf,
  type ShowIfClause,
} from "@/lib/schedule/showIf";
import type { ActivityItem, FormState } from "./types";

interface Props {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}

const NO_FIELD = "__sem__";

/** Editor de atividades agrupadas por semana (template semanal). */
export function WeeklyActivitiesEditor({ form, setForm }: Props) {
  const weeks = Math.max(1, parseInt(form.weeks, 10) || 1);
  const selectFields = form.custom_fields.filter(
    (f) => f.type === "select" && f.key.trim(),
  );

  const update = (idx: number, patch: Partial<ActivityItem>) =>
    setForm((p) => ({
      ...p,
      custom_activities: p.custom_activities.map((a, i) =>
        i === idx ? { ...a, ...patch } : a,
      ),
    }));

  const remove = (idx: number) =>
    setForm((p) => ({
      ...p,
      custom_activities: p.custom_activities.filter((_, i) => i !== idx),
    }));

  const add = (week: number) =>
    setForm((p) => ({
      ...p,
      custom_activities: [
        ...p.custom_activities,
        { description: "", durationDays: 5, weight: 0, week, kind: "execucao" },
      ],
    }));

  const moveWeek = (idx: number, delta: number) => {
    const a = form.custom_activities[idx];
    const w = Math.min(weeks, Math.max(1, (a.week ?? 1) + delta));
    const span = Math.max(0, (a.weekEnd ?? a.week ?? 1) - (a.week ?? 1));
    update(idx, {
      week: w,
      weekEnd: span > 0 ? Math.min(weeks, w + span) : undefined,
    });
  };

  const onDropWeek = (e: React.DragEvent, week: number) => {
    e.preventDefault();
    const idx = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(idx)) return;
    const a = form.custom_activities[idx];
    if (!a) return;
    moveWeek(idx, week - (a.week ?? 1));
  };

  const setClause = (idx: number, ci: number, patch: Partial<ShowIfClause>) => {
    const clauses = parseShowIf(form.custom_activities[idx].showIf);
    clauses[ci] = { ...clauses[ci], ...patch };
    update(idx, { showIf: serializeShowIf(clauses) || undefined });
  };

  const indexed = form.custom_activities.map((a, i) => ({ a, i }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="tpl-weeks">Semanas do modelo</Label>
          <Input
            id="tpl-weeks"
            type="number"
            min={1}
            max={104}
            value={form.weeks}
            onChange={(e) => setForm((p) => ({ ...p, weeks: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tpl-contract">Prazo padrão (dias úteis)</Label>
          <Input
            id="tpl-contract"
            type="number"
            min={1}
            value={form.default_contract_business_days}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                default_contract_business_days: e.target.value,
              }))
            }
          />
        </div>
      </div>
      {selectFields.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Para usar condições, crie campos do tipo Seleção (ex.: bancada,
          marcenaria) em Campos customizados.
        </p>
      )}

      {Array.from({ length: weeks }, (_, w) => w + 1).map((week) => {
        const rows = indexed.filter(({ a }) => (a.week ?? 1) === week);
        return (
          <div
            key={week}
            className="rounded-lg border"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDropWeek(e, week)}
          >
            <div className="flex items-center justify-between bg-muted/40 px-3 py-2">
              <span className="text-sm font-semibold">Semana {week}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1"
                onClick={() => add(week)}
              >
                <Plus className="h-3.5 w-3.5" /> Atividade
              </Button>
            </div>
            {rows.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Sem atividades nesta semana.
              </p>
            ) : (
              <ul className="divide-y">
                {rows.map(({ a, i }) => {
                  const clauses = parseShowIf(a.showIf);
                  const errors = validateShowIf(a.showIf, form.custom_fields);
                  return (
                    <li
                      key={i}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text/plain", String(i))
                      }
                      className="space-y-2 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <Input
                          value={a.description}
                          onChange={(e) =>
                            update(i, { description: e.target.value })
                          }
                          placeholder="Descrição da atividade"
                          className="h-9 flex-1 text-sm"
                          aria-label="Descrição"
                        />
                        {a.kind === "marco" && (
                          <Badge variant="secondary" className="mt-2 shrink-0">
                            Marco
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => moveWeek(i, -1)}
                          disabled={(a.week ?? 1) <= 1}
                          aria-label="Semana anterior"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => moveWeek(i, 1)}
                          disabled={(a.week ?? 1) >= weeks}
                          aria-label="Próxima semana"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-destructive"
                          onClick={() => remove(i)}
                          aria-label="Apagar atividade"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label className="text-[11px]">Semana</Label>
                          <Input
                            type="number"
                            min={1}
                            max={weeks}
                            value={a.week ?? 1}
                            onChange={(e) =>
                              update(i, {
                                week: Math.min(
                                  weeks,
                                  Math.max(1, parseInt(e.target.value, 10) || 1),
                                ),
                              })
                            }
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Até semana</Label>
                          <Input
                            type="number"
                            min={a.week ?? 1}
                            max={weeks}
                            value={a.weekEnd ?? ""}
                            placeholder={String(a.week ?? 1)}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              update(i, {
                                weekEnd:
                                  v && v > (a.week ?? 1)
                                    ? Math.min(weeks, v)
                                    : undefined,
                              });
                            }}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Tipo</Label>
                          <Select
                            value={a.kind ?? "execucao"}
                            onValueChange={(v) =>
                              update(i, { kind: v as "execucao" | "marco" })
                            }
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="execucao">Execução</SelectItem>
                              <SelectItem value="marco">Marco interno</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Nota</Label>
                          <Input
                            value={a.note ?? ""}
                            onChange={(e) =>
                              update(i, { note: e.target.value || undefined })
                            }
                            className="h-9 text-sm"
                            placeholder="Opcional"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Condição</Label>
                        {clauses.map((c, ci) => {
                          const field = selectFields.find((f) => f.key === c.key);
                          return (
                            <div key={ci} className="flex flex-wrap gap-1">
                              <Select
                                value={c.key || NO_FIELD}
                                onValueChange={(v) =>
                                  setClause(i, ci, {
                                    key: v === NO_FIELD ? "" : v,
                                    value: "",
                                  })
                                }
                              >
                                <SelectTrigger className="h-9 w-32 text-sm">
                                  <SelectValue placeholder="Campo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NO_FIELD} disabled>
                                    Campo
                                  </SelectItem>
                                  {selectFields.map((f) => (
                                    <SelectItem key={f.key} value={f.key}>
                                      {f.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={c.op}
                                onValueChange={(v) =>
                                  setClause(i, ci, { op: v as "=" | "!=" })
                                }
                              >
                                <SelectTrigger className="h-9 w-28 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="=">igual a</SelectItem>
                                  <SelectItem value="!=">diferente de</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select
                                value={c.value || undefined}
                                onValueChange={(v) => setClause(i, ci, { value: v })}
                              >
                                <SelectTrigger className="h-9 w-32 text-sm">
                                  <SelectValue placeholder="Valor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(field?.options ?? [])
                                    .filter(Boolean)
                                    .map((o) => (
                                      <SelectItem key={o} value={o}>
                                        {o}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                aria-label="Remover condição"
                                onClick={() => {
                                  const next = clauses.filter((_, j) => j !== ci);
                                  update(i, {
                                    showIf: serializeShowIf(next) || undefined,
                                  });
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                        {selectFields.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 gap-1 text-xs"
                            onClick={() => {
                              const f = selectFields[0];
                              const next = [
                                ...clauses,
                                {
                                  key: f.key,
                                  op: "=" as const,
                                  value: f.options?.find(Boolean) ?? "",
                                },
                              ];
                              update(i, { showIf: serializeShowIf(next) });
                            }}
                          >
                            <Plus className="h-3 w-3" /> Condição
                          </Button>
                        )}
                        {errors.map((e) => (
                          <p key={e} className="text-xs text-destructive">
                            {e}
                          </p>
                        ))}
                        {a.purchases && a.purchases.length > 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            {a.purchases.length}{" "}
                            {a.purchases.length === 1
                              ? "item de compra"
                              : "itens de compra"}{" "}
                            preservado(s)
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
