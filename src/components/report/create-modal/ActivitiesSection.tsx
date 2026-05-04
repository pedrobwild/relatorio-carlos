import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types/report";

interface ActivitiesSectionProps {
  activities: Activity[];
  setActivities: (a: Activity[]) => void;
}

export const ActivitiesSection = ({
  activities,
  setActivities,
}: ActivitiesSectionProps) => {
  const totalWeight = activities.reduce((sum, a) => sum + (a.weight || 0), 0);
  const [openDetails, setOpenDetails] = useState<Record<number, boolean>>({});

  const addActivity = () => {
    setActivities([
      ...activities,
      {
        id: crypto.randomUUID(),
        description: "",
        plannedStart: "",
        plannedEnd: "",
        actualStart: "",
        actualEnd: "",
        weight: 10,
      },
    ]);
  };

  const removeActivity = (index: number) => {
    if (activities.length > 1) {
      setActivities(activities.filter((_, i) => i !== index));
    }
  };

  const updateActivity = (
    index: number,
    field: keyof Activity,
    value: string | number,
  ) => {
    const updated = [...activities];
    updated[index] = { ...updated[index], [field]: value };
    setActivities(updated);
  };

  const toggleDetail = (index: number) => {
    setOpenDetails((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-h3 text-muted-foreground uppercase tracking-wider">
            Cronograma de Atividades
          </h3>
          <p
            className={cn(
              "text-tiny mt-0.5",
              totalWeight === 100
                ? "text-[hsl(var(--success))]"
                : "text-[hsl(var(--warning))]",
            )}
          >
            Peso total: {totalWeight}%{" "}
            {totalWeight !== 100 && "(deve somar 100%)"}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addActivity}>
          <Plus className="w-4 h-4 mr-1" />
          Adicionar
        </Button>
      </div>

      <div className="space-y-4">
        {activities.map((activity, index) => {
          const hasDetail = !!(activity as any).detailed_description;
          const isDetailOpen = openDetails[index] || false;

          return (
            <div
              key={index}
              className="p-4 border border-border rounded-lg bg-muted/30 space-y-3 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-tiny font-medium">
                  Atividade #{index + 1}
                </span>
                {activities.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] h-11 w-11 text-destructive hover:text-destructive"
                    onClick={() => removeActivity(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Descrição da atividade"
                  value={activity.description}
                  onChange={(e) =>
                    updateActivity(index, "description", e.target.value)
                  }
                  className="flex-1"
                />
                <div className="w-20 shrink-0">
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      placeholder="Peso"
                      value={activity.weight || ""}
                      onChange={(e) =>
                        updateActivity(
                          index,
                          "weight",
                          parseInt(e.target.value, 10) || 0,
                        )
                      }
                      className="text-sm pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-tiny text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-tiny">Início Prev.</Label>
                  <Input
                    placeholder="DD/MM"
                    value={activity.plannedStart}
                    onChange={(e) =>
                      updateActivity(index, "plannedStart", e.target.value)
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-tiny">Fim Prev.</Label>
                  <Input
                    placeholder="DD/MM"
                    value={activity.plannedEnd}
                    onChange={(e) =>
                      updateActivity(index, "plannedEnd", e.target.value)
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-tiny">Início Real</Label>
                  <Input
                    placeholder="DD/MM"
                    value={activity.actualStart}
                    onChange={(e) =>
                      updateActivity(index, "actualStart", e.target.value)
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-tiny">Fim Real</Label>
                  <Input
                    placeholder="DD/MM"
                    value={activity.actualEnd}
                    onChange={(e) =>
                      updateActivity(index, "actualEnd", e.target.value)
                    }
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Collapsible detailed description */}
              {hasDetail ? (
                <Collapsible
                  open={isDetailOpen}
                  onOpenChange={() => toggleDetail(index)}
                >
                  <CollapsibleTrigger className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                    {isDetailOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Descrição detalhada
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-1">
                    <Textarea
                      value={(activity as any).detailed_description || ""}
                      onChange={(e) =>
                        updateActivity(
                          index,
                          "detailed_description" as any,
                          e.target.value,
                        )
                      }
                      placeholder="Descrição detalhada da atividade..."
                      rows={2}
                      className="text-xs resize-none"
                    />
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    updateActivity(index, "detailed_description" as any, " ");
                    setOpenDetails((prev) => ({ ...prev, [index]: true }));
                  }}
                  className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-1"
                >
                  <Plus className="h-2.5 w-2.5" /> Adicionar descrição detalhada
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
