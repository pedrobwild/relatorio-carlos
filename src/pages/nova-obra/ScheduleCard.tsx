import { useEffect, useRef, useCallback, useState } from "react";
import {
  Calendar,
  Plus,
  Trash2,
  LayoutTemplate,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  GripVertical,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { addBusinessDays, isHoliday } from "@/lib/businessDays";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { FormData } from "./types";

interface ScheduleTemplateEntry {
  description: string;
  weight: number;
}

interface ScheduleTemplate {
  id: string;
  name: string;
  entries: ScheduleTemplateEntry[];
}

const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    id: "padrao",
    name: "Template padrão",
    entries: [
      {
        description:
          "Mobilização de mão de obra, medições e alinhamento com o projeto executivo",
        weight: 8,
      },
      {
        description:
          "Instalação de fechadura eletrônica, adequações elétricas e execução da infra de ar-condicionado",
        weight: 10,
      },
      {
        description:
          "Demolições, instalação de luminárias e instalação de backsplash",
        weight: 8,
      },
      { description: "Nivelamento e instalação de piso vinílico", weight: 10 },
      {
        description:
          "Medição de marcenaria, início da produção das peças e instalação do box e espelhos",
        weight: 8,
      },
      {
        description:
          "Fechamento de shaft do ar-condicionado, drywall e instalação de metais",
        weight: 10,
      },
      {
        description:
          "Instalação de ar-condicionado e primeira demão de pintura",
        weight: 8,
      },
      { description: "Instalação de marcenaria", weight: 10 },
      {
        description:
          "Ajustes de marcenaria, instalação de rodapé e acabamentos de civil",
        weight: 8,
      },
      {
        description:
          "Segunda demão de pintura, acabamentos elétricos e instalação de acessórios",
        weight: 10,
      },
      {
        description:
          "Instalação de cortinas, recebimento e instalação de eletros e móveis",
        weight: 8,
      },
      {
        description:
          "Vistoria Bwild, limpeza fina e vistoria cliente para entrega da unidade",
        weight: 2,
      },
    ],
  },
  {
    id: "troca-bancadas",
    name: "Cronograma Troca de Bancadas",
    entries: [
      {
        description:
          "Mobilização de mão de obra, medições e alinhamento com o projeto executivo",
        weight: 8,
      },
      {
        description:
          "Instalação de fechadura eletrônica, adequações elétricas, execução de infra de ar-condicionado e demolição de bancadas",
        weight: 10,
      },
      { description: "Instalação de bancadas, cubas e luminárias", weight: 8 },
      {
        description:
          "Instalação de backsplash, nivelamento e instalação de piso vinílico",
        weight: 10,
      },
      {
        description:
          "Medição de marcenaria, início da produção das peças e instalação do box e espelhos",
        weight: 8,
      },
      {
        description:
          "Fechamento de shaft do ar-condicionado, drywall e instalação de metais",
        weight: 10,
      },
      {
        description:
          "Instalação de ar-condicionado e primeira demão de pintura",
        weight: 8,
      },
      { description: "Instalação de marcenaria", weight: 10 },
      {
        description:
          "Ajustes de marcenaria, instalação de rodapé e acabamentos de civil",
        weight: 8,
      },
      {
        description:
          "Segunda demão de pintura, acabamentos elétricos e instalação de acessórios",
        weight: 10,
      },
      {
        description:
          "Instalação de cortinas, recebimento e instalação de eletros e móveis",
        weight: 8,
      },
      {
        description:
          "Vistoria Bwild, limpeza fina e vistoria cliente para entrega da unidade",
        weight: 2,
      },
    ],
  },
];

export interface ScheduleActivity {
  id: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  weight: string;
}

const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getFridayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  // If it's Saturday (6) or Sunday (0), there's no Friday "this week"
  if (dayOfWeek === 0) {
    // Sunday: advance to next Friday
    d.setDate(d.getDate() + 5);
  } else if (dayOfWeek === 6) {
    // Saturday: advance to next Friday
    d.setDate(d.getDate() + 6);
  } else {
    // Mon-Fri: go to Friday of this week
    d.setDate(d.getDate() + (5 - dayOfWeek));
  }

  // If Friday is a holiday, move to the previous non-holiday business day
  while (isHoliday(d)) {
    d.setDate(d.getDate() - 1);
  }

  // Ensure result is not before the input date
  if (d < date) return new Date(date);
  return d;
};

const getNextMonday = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(monday.getDate() + daysUntilMonday);
  return monday;
};

function normalizeActivitiesWithDates(
  activities: ScheduleActivity[],
  plannedStartDate: string,
): ScheduleActivity[] | null {
  if (activities.length === 0) return null;

  let changed = false;
  const normalized: ScheduleActivity[] = [];

  for (let index = 0; index < activities.length; index += 1) {
    const activity = activities[index];
    let next = activity;

    if (index === 0) {
      if (!next.plannedStart && plannedStartDate) {
        const start = new Date(plannedStartDate + "T00:00:00");
        next = {
          ...next,
          plannedStart: plannedStartDate,
          plannedEnd: next.plannedEnd || toISO(getFridayOfWeek(start)),
        };
        changed = true;
      } else if (next.plannedStart && !next.plannedEnd) {
        const start = new Date(next.plannedStart + "T00:00:00");
        next = { ...next, plannedEnd: toISO(getFridayOfWeek(start)) };
        changed = true;
      }

      normalized.push(next);
      continue;
    }

    const previous = normalized[index - 1] ?? activities[index - 1];

    if (!next.plannedStart && previous?.plannedEnd) {
      const previousEnd = new Date(previous.plannedEnd + "T00:00:00");
      const nextMonday = getNextMonday(previousEnd);
      next = {
        ...next,
        plannedStart: toISO(nextMonday),
        plannedEnd: next.plannedEnd || toISO(getFridayOfWeek(nextMonday)),
      };
      changed = true;
    } else if (next.plannedStart && !next.plannedEnd) {
      const start = new Date(next.plannedStart + "T00:00:00");
      next = { ...next, plannedEnd: toISO(getFridayOfWeek(start)) };
      changed = true;
    }

    normalized.push(next);
  }

  return changed ? normalized : null;
}

// eslint-disable-next-line react-refresh/only-export-components
export const createEmptyActivity = (): ScheduleActivity => ({
  id: crypto.randomUUID(),
  description: "",
  plannedStart: "",
  plannedEnd: "",
  weight: "0",
});

interface ScheduleCardProps {
  formData: FormData;
  onChange: (field: keyof FormData, value: string | boolean) => void;
  activities: ScheduleActivity[];
  onActivitiesChange: (activities: ScheduleActivity[]) => void;
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "0px";
      ref.current.style.height = `${Math.max(36, ref.current.scrollHeight)}px`;
    }
  }, [value]);

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className="min-h-[36px] resize-none overflow-hidden py-2 px-2.5 text-sm leading-snug"
    />
  );
}

export function ScheduleCard({
  formData,
  onChange,
  activities,
  onActivitiesChange,
}: ScheduleCardProps) {
  const { toast } = useToast();
  const skipNormalizeRef = useRef(false);
  const prevStartDateRef = useRef(formData.planned_start_date);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const safeSetActivities = useCallback(
    (acts: ScheduleActivity[]) => {
      skipNormalizeRef.current = true;
      onActivitiesChange(acts);
    },
    [onActivitiesChange],
  );

  const applyScheduleTemplate = (template: ScheduleTemplate) => {
    const startDate = formData.planned_start_date;
    const newActivities: ScheduleActivity[] = [];
    let currentStart: Date | null = startDate
      ? new Date(startDate + "T00:00:00")
      : null;

    for (const entry of template.entries) {
      const act: ScheduleActivity = {
        id: crypto.randomUUID(),
        description: entry.description,
        weight: entry.weight.toString(),
        plannedStart: "",
        plannedEnd: "",
      };

      if (currentStart) {
        act.plannedStart = toISO(currentStart);
        const friday = getFridayOfWeek(currentStart);
        act.plannedEnd = toISO(friday);
        currentStart = getNextMonday(friday);
      }

      newActivities.push(act);
    }

    safeSetActivities(newActivities);
    toast({
      title: `Template "${template.name}" aplicado com ${template.entries.length} etapas`,
    });
  };

  useEffect(() => {
    const days = parseInt(formData.business_days_duration, 10);
    if (formData.planned_start_date && days > 0) {
      const start = new Date(formData.planned_start_date + "T00:00:00");
      const end = addBusinessDays(start, days);
      const computed = toISO(end);
      if (formData.planned_end_date !== computed) {
        onChange("planned_end_date", computed);
      }
    }
  }, [formData.planned_start_date, formData.business_days_duration]);

  const recalculateAllDates = useCallback(
    (acts: ScheduleActivity[], startDate: string): ScheduleActivity[] => {
      if (!startDate || acts.length === 0) return acts;
      const result: ScheduleActivity[] = [];
      let currentStart: Date = new Date(startDate + "T00:00:00");

      for (let i = 0; i < acts.length; i++) {
        const friday = getFridayOfWeek(currentStart);
        result.push({
          ...acts[i],
          plannedStart: toISO(currentStart),
          plannedEnd: toISO(friday),
        });
        currentStart = getNextMonday(friday);
      }
      return result;
    },
    [],
  );

  useEffect(() => {
    if (skipNormalizeRef.current) {
      skipNormalizeRef.current = false;
      prevStartDateRef.current = formData.planned_start_date;
      return;
    }

    const startDateChanged =
      prevStartDateRef.current !== formData.planned_start_date;
    prevStartDateRef.current = formData.planned_start_date;

    if (
      startDateChanged &&
      formData.planned_start_date &&
      activities.length > 0 &&
      activities[0].plannedStart
    ) {
      safeSetActivities(
        recalculateAllDates(activities, formData.planned_start_date),
      );
      return;
    }

    const normalized = normalizeActivitiesWithDates(
      activities,
      formData.planned_start_date,
    );
    if (normalized) {
      safeSetActivities(normalized);
    }
  }, [
    activities,
    formData.planned_start_date,
    safeSetActivities,
    recalculateAllDates,
  ]);

  const isEndDateAutoCalculated = !!(
    formData.planned_start_date &&
    parseInt(formData.business_days_duration, 10) > 0
  );

  const totalWeight = activities.reduce(
    (sum, a) => sum + (parseFloat(a.weight) || 0),
    0,
  );

  const reorderActivities = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= activities.length ||
        toIndex >= activities.length
      ) {
        return;
      }

      const reordered = [...activities];
      const [movedActivity] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, movedActivity);

      const nextActivities = formData.planned_start_date
        ? recalculateAllDates(reordered, formData.planned_start_date)
        : reordered;

      safeSetActivities(nextActivities);
    },
    [
      activities,
      formData.planned_start_date,
      recalculateAllDates,
      safeSetActivities,
    ],
  );

  const moveActivity = useCallback(
    (index: number, direction: "up" | "down") => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      reorderActivities(index, targetIndex);
    },
    [reorderActivities],
  );

  const clearDragState = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLElement>, index: number) => {
      setDraggedIndex(index);
      setDragOverIndex(index);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        "text/plain",
        activities[index]?.id ?? String(index),
      );
    },
    [activities],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dragOverIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [dragOverIndex],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();

      if (draggedIndex === null) {
        clearDragState();
        return;
      }

      reorderActivities(draggedIndex, index);
      clearDragState();
    },
    [clearDragState, draggedIndex, reorderActivities],
  );

  const handleRecalculateDates = useCallback(() => {
    if (!formData.planned_start_date) {
      toast({
        title: "Defina a data de início primeiro",
        variant: "destructive",
      });
      return;
    }
    const recalculated = recalculateAllDates(
      activities,
      formData.planned_start_date,
    );
    safeSetActivities(recalculated);
    toast({ title: "Datas recalculadas com base na data de início" });
  }, [
    activities,
    formData.planned_start_date,
    recalculateAllDates,
    safeSetActivities,
    toast,
  ]);

  const updateActivity = (
    id: string,
    field: keyof ScheduleActivity,
    value: string,
  ) => {
    const updated = activities.map((a) => {
      if (a.id !== id) return a;
      const next = { ...a, [field]: value };

      if (field === "plannedStart" && value) {
        const startDate = new Date(value + "T00:00:00");
        if (!isNaN(startDate.getTime())) {
          next.plannedEnd = toISO(getFridayOfWeek(startDate));
        }
      }

      return next;
    });

    onActivitiesChange(updated);
  };

  const addActivity = () => {
    const newAct = createEmptyActivity();
    const lastActivity =
      activities.length > 0 ? activities[activities.length - 1] : null;

    if (lastActivity?.plannedEnd) {
      const prevEnd = new Date(lastActivity.plannedEnd + "T00:00:00");
      const nextMon = getNextMonday(prevEnd);
      newAct.plannedStart = toISO(nextMon);
      newAct.plannedEnd = toISO(getFridayOfWeek(nextMon));
    } else if (activities.length === 0 && formData.planned_start_date) {
      const start = new Date(formData.planned_start_date + "T00:00:00");
      newAct.plannedStart = formData.planned_start_date;
      newAct.plannedEnd = toISO(getFridayOfWeek(start));
    }

    onActivitiesChange([...activities, newAct]);
  };

  const removeActivity = (id: string) => {
    const filtered = activities.filter((a) => a.id !== id);
    if (formData.planned_start_date && filtered.length > 0) {
      safeSetActivities(
        recalculateAllDates(filtered, formData.planned_start_date),
      );
    } else {
      onActivitiesChange(filtered);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-body">
          <Calendar className="h-5 w-5" />
          Cronograma
        </CardTitle>
        <CardDescription>
          {formData.is_project_phase
            ? "Datas macro do projeto e assinatura do contrato"
            : "Datas previstas de início e término"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Context banner */}
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg space-y-1">
          {formData.is_project_phase ? (
            <p>
              Obra em fase de projeto. As datas podem ser definidas agora ou
              marcadas como "Em definição".
            </p>
          ) : formData.budget_uploaded ? (
            <p className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
              Orçamento anexado — o cronograma pode ser refinado com base nele
              após a criação.
            </p>
          ) : (
            <p>
              Defina as datas manualmente ou aplique um template de cronograma.
            </p>
          )}
        </div>

        {formData.is_project_phase && (
          <div className="space-y-2">
            <Label htmlFor="contract_signing_date">
              Data de Assinatura do Contrato
            </Label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="contract_date_undefined"
                checked={!formData.contract_signing_date}
                onChange={() =>
                  onChange(
                    "contract_signing_date",
                    formData.contract_signing_date
                      ? ""
                      : new Date().toISOString().split("T")[0],
                  )
                }
                className="h-4 w-4 rounded border-border"
              />
              <Label
                htmlFor="contract_date_undefined"
                className="text-caption cursor-pointer text-muted-foreground"
              >
                Em definição
              </Label>
            </div>
            {formData.contract_signing_date !== "" ? (
              <Input
                id="contract_signing_date"
                type="date"
                value={formData.contract_signing_date}
                onChange={(e) =>
                  onChange("contract_signing_date", e.target.value)
                }
              />
            ) : (
              <Input
                id="contract_signing_date"
                disabled
                placeholder="Em definição"
                value=""
              />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="planned_start_date">
              Data de Início {!formData.is_project_phase && "*"}
            </Label>
            {formData.is_project_phase && (
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="start_date_undefined"
                  checked={formData.planned_start_date === ""}
                  onChange={(e) =>
                    onChange("planned_start_date", e.target.checked ? "" : "")
                  }
                  className="h-4 w-4 rounded border-border"
                />
                <Label
                  htmlFor="start_date_undefined"
                  className="text-caption cursor-pointer text-muted-foreground"
                >
                  Em definição
                </Label>
              </div>
            )}
            {(!formData.is_project_phase ||
              formData.planned_start_date !== "") && (
              <Input
                id="planned_start_date"
                type="date"
                value={formData.planned_start_date}
                onChange={(e) => onChange("planned_start_date", e.target.value)}
                required={!formData.is_project_phase}
              />
            )}
            {formData.is_project_phase &&
              formData.planned_start_date === "" && (
                <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/50 text-muted-foreground text-sm">
                  Em definição
                </div>
              )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_days_duration">
              Dias Úteis de Execução
            </Label>
            <Input
              id="business_days_duration"
              type="number"
              min="1"
              placeholder="Ex: 60"
              value={formData.business_days_duration}
              onChange={(e) =>
                onChange("business_days_duration", e.target.value)
              }
            />
            <p className="text-xs text-muted-foreground">
              Exclui fins de semana e feriados de SP
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="planned_end_date">
              Data de Término {!formData.is_project_phase && "*"}
              {isEndDateAutoCalculated && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  (calculada)
                </span>
              )}
            </Label>
            {formData.is_project_phase && !isEndDateAutoCalculated && (
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="end_date_undefined"
                  checked={formData.planned_end_date === ""}
                  onChange={(e) =>
                    onChange("planned_end_date", e.target.checked ? "" : "")
                  }
                  className="h-4 w-4 rounded border-border"
                />
                <Label
                  htmlFor="end_date_undefined"
                  className="text-caption cursor-pointer text-muted-foreground"
                >
                  Em definição
                </Label>
              </div>
            )}
            {(!formData.is_project_phase ||
              formData.planned_end_date !== "") && (
              <Input
                id="planned_end_date"
                type="date"
                value={formData.planned_end_date}
                onChange={(e) => onChange("planned_end_date", e.target.value)}
                required={!formData.is_project_phase}
                disabled={isEndDateAutoCalculated}
                className={
                  isEndDateAutoCalculated
                    ? "bg-muted/50 cursor-not-allowed"
                    : ""
                }
              />
            )}
            {formData.is_project_phase &&
              formData.planned_end_date === "" &&
              !isEndDateAutoCalculated && (
                <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/50 text-muted-foreground text-sm">
                  Em definição
                </div>
              )}
          </div>
        </div>

        {/* Schedule Template Selector */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm">
            <LayoutTemplate className="h-4 w-4" />
            Template de Cronograma
          </Label>
          <Select
            onValueChange={(id) => {
              const tpl = SCHEDULE_TEMPLATES.find((t) => t.id === id);
              if (tpl) applyScheduleTemplate(tpl);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um template (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {SCHEDULE_TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} — {t.entries.length} etapas
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Activities / Etapas */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Etapas da Obra</h4>
              <p className="text-xs text-muted-foreground">
                Adicione as etapas do cronograma (opcional)
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activities.length > 0 && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={handleRecalculateDates}
                          disabled={!formData.planned_start_date}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Recalcular datas a partir do início
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      Math.abs(totalWeight - 100) < 0.05
                        ? "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    Peso: {totalWeight.toFixed(1)}%
                  </span>
                </>
              )}
            </div>
          </div>

          {activities.length > 0 && (
            <div className="space-y-3">
              {/* Header - desktop only */}
              <div className="hidden sm:grid grid-cols-[56px_1fr_130px_130px_70px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span />
                <span>Descrição</span>
                <span>Início Prev.</span>
                <span>Término Prev.</span>
                <span>Peso %</span>
                <span />
              </div>

              {activities.map((act, idx) => (
                <div
                  key={act.id}
                  onDragOver={(event) => handleDragOver(event, idx)}
                  onDrop={(event) => handleDrop(event, idx)}
                  className={cn(
                    "rounded-lg border bg-card p-3 transition-all sm:p-0 sm:border-0 sm:bg-transparent space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[56px_1fr_130px_130px_70px_40px] sm:gap-2 sm:items-start",
                    draggedIndex === idx && "opacity-60",
                    dragOverIndex === idx &&
                      draggedIndex !== idx &&
                      "bg-accent/40 ring-1 ring-border rounded-xl",
                  )}
                >
                  {/* Reorder controls */}
                  <div className="hidden sm:flex flex-col items-center gap-1 pt-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      draggable={activities.length > 1}
                      onDragStart={(event) => handleDragStart(event, idx)}
                      onDragEnd={clearDragState}
                      className="h-7 w-7 min-h-[28px] min-w-[28px] cursor-grab p-0 text-muted-foreground hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed"
                      disabled={activities.length < 2}
                      aria-label={`Arrastar etapa ${idx + 1}`}
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 min-h-[28px] min-w-[28px] p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => moveActivity(idx, "up")}
                      disabled={idx === 0}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 min-h-[28px] min-w-[28px] p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => moveActivity(idx, "down")}
                      disabled={idx === activities.length - 1}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Mobile label with reorder */}
                  <div className="flex items-center justify-between sm:hidden">
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        draggable={activities.length > 1}
                        onDragStart={(event) => handleDragStart(event, idx)}
                        onDragEnd={clearDragState}
                        className="h-7 w-7 cursor-grab p-0 text-muted-foreground hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed"
                        disabled={activities.length < 2}
                        aria-label={`Arrastar etapa ${idx + 1}`}
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-xs font-medium text-muted-foreground">
                        Etapa {idx + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveActivity(idx, "up")}
                        disabled={idx === 0}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveActivity(idx, "down")}
                        disabled={idx === activities.length - 1}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <AutoTextarea
                    value={act.description}
                    onChange={(v) => updateActivity(act.id, "description", v)}
                    placeholder={`Descrição da etapa ${idx + 1}`}
                  />

                  <div className="grid grid-cols-2 gap-2 sm:contents">
                    <div>
                      <Label className="text-xs sm:hidden">Início</Label>
                      <Input
                        type="date"
                        value={act.plannedStart}
                        onChange={(e) =>
                          updateActivity(act.id, "plannedStart", e.target.value)
                        }
                        className="text-sm h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs sm:hidden">Término</Label>
                      <Input
                        type="date"
                        value={act.plannedEnd}
                        onChange={(e) =>
                          updateActivity(act.id, "plannedEnd", e.target.value)
                        }
                        className="text-sm h-9"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:contents">
                    <div className="flex-1 sm:flex-none">
                      <Label className="text-xs sm:hidden">Peso %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={act.weight}
                        onChange={(e) =>
                          updateActivity(act.id, "weight", e.target.value)
                        }
                        className="text-sm h-9 text-center"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeActivity(act.id)}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addActivity}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Etapa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
