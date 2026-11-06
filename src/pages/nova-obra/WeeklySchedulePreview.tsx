import { useEffect, useMemo, type ReactNode } from "react";
import { AlertTriangle, CalendarRange, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import type { ProjectTemplate } from "@/hooks/useProjectTemplates";
import {
  fmtBR,
  generateWeeklyPlan,
  weekClientDescription,
  type PlannedItem,
  type WeeklyPlan,
  type WeeklyTemplateActivity,
} from "@/lib/schedule/weeklySchedule";
import type { FormData } from "./types";

interface Props {
  template: ProjectTemplate;
  formData: FormData;
  onChange: (field: keyof FormData, value: string | boolean) => void;
  conditions: Record<string, string>;
  useSlack: boolean;
  onUseSlackChange: (v: boolean) => void;
  plan: WeeklyPlan | null;
  onPlanChange: (plan: WeeklyPlan | null) => void;
  /** Ações extras (ex.: Exportar PDF). */
  actions?: ReactNode;
}

/** Prévia editável do cronograma gerado a partir de um template semanal. */
export function WeeklySchedulePreview({
  template,
  formData,
  onChange,
  conditions,
  useSlack,
  onUseSlackChange,
  plan,
  onPlanChange,
  actions,
}: Props) {
  const days = parseInt(formData.business_days_duration, 10) || 0;
  const start = formData.planned_start_date;
  const condKey = JSON.stringify(conditions);

  useEffect(() => {
    if (!template.schedule_model || !start || days <= 0) {
      onPlanChange(null);
      return;
    }
    const next = generateWeeklyPlan(
      template.schedule_model as Parameters<typeof generateWeeklyPlan>[0],
      (template.default_activities ?? []) as WeeklyTemplateActivity[],
      {
        start: new Date(`${start}T00:00:00`),
        contractBusinessDays: days,
        useSlack,
        conditions,
      },
    );
    onPlanChange(next);
    if (next.delivery && next.delivery !== formData.planned_end_date) {
      onChange("planned_end_date", next.delivery);
    }
    // Regera só quando as entradas mudam (as edições da prévia ficam no plano).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, start, days, useSlack, condKey]);

  const updateItems = (fn: (items: PlannedItem[]) => PlannedItem[]) => {
    if (!plan) return;
    onPlanChange({ ...plan, items: fn(plan.items) });
  };

  const weekOptions = useMemo(() => plan?.weeks ?? [], [plan]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="h-4 w-4" /> Cronograma por semana
        </CardTitle>
        <CardDescription>
          Gerado pelo {template.name}. Revise as semanas antes de cadastrar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="weekly-start">Data de início</Label>
            <Input
              id="weekly-start"
              type="date"
              value={start}
              onChange={(e) => onChange("planned_start_date", e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="weekly-days">Prazo do contrato (dias úteis)</Label>
            <Input
              id="weekly-days"
              type="number"
              min={1}
              value={formData.business_days_duration}
              onChange={(e) =>
                onChange("business_days_duration", e.target.value)
              }
              className="min-h-[44px]"
            />
          </div>
        </div>

        {!plan ? (
          <EmptyState
            icon={CalendarRange}
            title="Informe início e prazo"
            description="Com a data de início e o prazo em dias úteis, as semanas aparecem aqui."
          />
        ) : (
          <>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
              <p>
                Fim pelo contrato: <strong>{fmtBR(plan.contractEnd)}</strong>
                {plan.delivery && (
                  <>
                    {" · "}Entrega prevista:{" "}
                    <strong>{fmtBR(plan.delivery)}</strong>
                  </>
                )}
              </p>
              {plan.slackAvailable > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <span>
                    Cabem {plan.slackAvailable}{" "}
                    {plan.slackAvailable === 1 ? "semana" : "semanas"} de folga
                    para repasses e atrasos
                  </span>
                  <Switch
                    checked={useSlack}
                    onCheckedChange={onUseSlackChange}
                    aria-label="Usar semanas de folga"
                  />
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Não cabem semanas de folga dentro do prazo do contrato.
                </p>
              )}
            </div>

            {plan.alerts.map((a) => (
              <div
                key={a.kind}
                role="alert"
                className={`flex gap-2 rounded-lg border p-3 text-sm ${
                  a.blocking
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-warning/40 bg-warning/10"
                }`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{a.message}</span>
              </div>
            ))}

            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}

            <ol className="space-y-3">
              {plan.weeks.map((w) => {
                const items = plan.items.filter((i) => i.week === w.index);
                return (
                  <li key={w.index} className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">
                        {w.label}
                        {w.isSlack && (
                          <Badge variant="outline" className="ml-2">
                            Folga
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {fmtBR(w.calStart)} a {fmtBR(w.calEnd)} ·{" "}
                        {w.businessDays}{" "}
                        {w.businessDays === 1 ? "dia útil" : "dias úteis"}
                        {w.holidays.length > 0 &&
                          ` · feriado ${w.holidays.map((h) => fmtBR(h).slice(0, 5)).join(", ")}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cliente vê: {weekClientDescription(plan, w.index)}
                    </p>
                    {items.length > 0 && (
                      <ul className="space-y-2">
                        {items.map((it) => (
                          <li
                            key={it.id}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <Input
                              value={it.description}
                              aria-label="Nome da atividade"
                              onChange={(e) =>
                                updateItems((all) =>
                                  all.map((x) =>
                                    x.id === it.id
                                      ? { ...x, description: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                              className="h-11 min-w-0 flex-1 basis-48 text-sm"
                            />
                            {it.kind === "marco" && (
                              <Badge variant="secondary">interno</Badge>
                            )}
                            <Select
                              value={String(it.week)}
                              onValueChange={(v) => {
                                const target = Number(v);
                                updateItems((all) =>
                                  all.map((x) =>
                                    x.id === it.id
                                      ? {
                                          ...x,
                                          week: target,
                                          weekEnd: Math.min(
                                            weekOptions.length,
                                            target + (x.weekEnd - x.week),
                                          ),
                                        }
                                      : x,
                                  ),
                                );
                              }}
                            >
                              <SelectTrigger
                                className="h-11 w-32"
                                aria-label="Mover para semana"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {weekOptions.map((o) => (
                                  <SelectItem key={o.index} value={String(o.index)}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 text-destructive"
                              aria-label="Remover atividade"
                              onClick={() =>
                                updateItems((all) =>
                                  all.filter((x) => x.id !== it.id),
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </CardContent>
    </Card>
  );
}
