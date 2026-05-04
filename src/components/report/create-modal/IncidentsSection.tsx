import { useState } from "react";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ReportIncident } from "@/types/report";

interface IncidentsSectionProps {
  incidents: ReportIncident[];
  setIncidents: (i: ReportIncident[]) => void;
}

export const IncidentsSection = ({
  incidents,
  setIncidents,
}: IncidentsSectionProps) => {
  const [open, setOpen] = useState(false);

  const addIncident = () => {
    const newIncident: ReportIncident = {
      id: `inc-${Date.now()}`,
      occurrence: "",
      occurrenceDate: format(new Date(), "yyyy-MM-dd"),
      cause: "",
      action: "",
      impact: "",
      status: "aberto",
      expectedResolutionDate: "",
    };
    setIncidents([...incidents, newIncident]);
    setOpen(true);
  };

  const removeIncident = (index: number) => {
    setIncidents(incidents.filter((_, i) => i !== index));
  };

  const updateIncident = (
    index: number,
    field: keyof ReportIncident,
    value: string,
  ) => {
    const updated = [...incidents];
    updated[index] = { ...updated[index], [field]: value };
    setIncidents(updated);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <AlertOctagon className="w-4 h-4 text-destructive" />
              Intercorrências de Obra
              {incidents.length > 0 && (
                <span className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded text-xs font-bold">
                  {incidents.length}
                </span>
              )}
              {open ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </CollapsibleTrigger>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addIncident}
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar
          </Button>
        </div>

        <CollapsibleContent className="space-y-4">
          {incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
              Nenhuma intercorrência registrada. Clique em "Adicionar" para
              registrar.
            </p>
          ) : (
            incidents.map((incident, index) => (
              <div
                key={incident.id}
                className="p-4 border border-destructive/20 rounded-lg bg-destructive/5 space-y-3 animate-fade-in"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-destructive flex items-center gap-1.5">
                    <AlertOctagon className="w-3.5 h-3.5" />
                    Intercorrência #{index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] h-11 w-11 text-destructive hover:text-destructive"
                    onClick={() => removeIncident(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Status
                    </Label>
                    <Select
                      value={incident.status}
                      onValueChange={(v) => updateIncident(index, "status", v)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aberto">Aberto</SelectItem>
                        <SelectItem value="em andamento">
                          Em andamento
                        </SelectItem>
                        <SelectItem value="resolvido">Resolvido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Data da Ocorrência
                    </Label>
                    <Input
                      type="date"
                      value={incident.occurrenceDate}
                      onChange={(e) =>
                        updateIncident(index, "occurrenceDate", e.target.value)
                      }
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Previsão de Resolução
                    </Label>
                    <Input
                      type="date"
                      value={incident.expectedResolutionDate}
                      onChange={(e) =>
                        updateIncident(
                          index,
                          "expectedResolutionDate",
                          e.target.value,
                        )
                      }
                      className="text-sm"
                    />
                  </div>
                </div>

                {(["occurrence", "cause", "action", "impact"] as const).map(
                  (field) => {
                    const labels: Record<
                      string,
                      { label: string; placeholder: string }
                    > = {
                      occurrence: {
                        label: "Ocorrência",
                        placeholder: "Descreva o que aconteceu...",
                      },
                      cause: {
                        label: "Causa",
                        placeholder: "Qual foi a causa do problema?",
                      },
                      action: {
                        label: "Ação",
                        placeholder: "Quais ações foram tomadas?",
                      },
                      impact: {
                        label: "Impacto",
                        placeholder: "Qual o impacto no projeto?",
                      },
                    };
                    return (
                      <div key={field} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {labels[field].label}
                        </Label>
                        <Textarea
                          placeholder={labels[field].placeholder}
                          value={incident[field]}
                          onChange={(e) =>
                            updateIncident(index, field, e.target.value)
                          }
                          className="text-sm min-h-[60px]"
                        />
                      </div>
                    );
                  },
                )}
              </div>
            ))
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
