import { Incident } from "@/types/weeklyReport";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface IncidentsSectionProps {
  incidents: Incident[];
  onAdd: () => void;
  onUpdate: (index: number, field: keyof Incident, value: string) => void;
  onRemove: (index: number) => void;
}

const IncidentsSection = ({
  incidents,
  onAdd,
  onUpdate,
  onRemove,
}: IncidentsSectionProps) => (
  <AccordionItem
    value="incidents"
    className="bg-card border border-border rounded-lg overflow-hidden"
  >
    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <span className="font-semibold">Ocorrências ({incidents.length})</span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4 space-y-3">
      {incidents.map((incident, index) => (
        <Card key={incident.id} className="border-muted">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Ocorrência {index + 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] h-11 w-11"
                onClick={() => onRemove(index)}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={incident.occurrenceDate}
                  onChange={(e) =>
                    onUpdate(index, "occurrenceDate", e.target.value)
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={incident.status}
                  onValueChange={(v) => onUpdate(index, "status", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="em andamento">Em Andamento</SelectItem>
                    <SelectItem value="resolvido">Resolvido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Ocorrência</Label>
              <Textarea
                placeholder="Descreva o que aconteceu"
                value={incident.occurrence}
                onChange={(e) => onUpdate(index, "occurrence", e.target.value)}
                className="min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs">Causa</Label>
              <Input
                placeholder="O que causou a ocorrência"
                value={incident.cause}
                onChange={(e) => onUpdate(index, "cause", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Ação Tomada</Label>
              <Textarea
                placeholder="O que foi feito para resolver"
                value={incident.action}
                onChange={(e) => onUpdate(index, "action", e.target.value)}
                className="min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs">Impacto</Label>
              <Input
                placeholder="Qual o impacto na obra"
                value={incident.impact}
                onChange={(e) => onUpdate(index, "impact", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Previsão de Resolução</Label>
              <Input
                type="date"
                value={incident.expectedResolutionDate}
                onChange={(e) =>
                  onUpdate(index, "expectedResolutionDate", e.target.value)
                }
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={onAdd} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Adicionar Ocorrência
      </Button>
    </AccordionContent>
  </AccordionItem>
);

export default IncidentsSection;
