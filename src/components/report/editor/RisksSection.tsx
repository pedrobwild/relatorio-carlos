import { RiskIssue } from "@/types/weeklyReport";
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

interface RisksSectionProps {
  risks: RiskIssue[];
  onAdd: () => void;
  onUpdate: (index: number, updates: Partial<RiskIssue>) => void;
  onRemove: (index: number) => void;
}

const RisksSection = ({
  risks,
  onAdd,
  onUpdate,
  onRemove,
}: RisksSectionProps) => (
  <AccordionItem
    value="risks"
    className="bg-card border border-border rounded-lg overflow-hidden"
  >
    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" />
        <span className="font-semibold">
          Riscos e Impedimentos ({risks.length})
        </span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4 space-y-3">
      {risks.map((risk, index) => (
        <Card key={risk.id} className="border-muted">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Item {index + 1}
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
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={risk.type}
                  onValueChange={(v) =>
                    onUpdate(index, { type: v as RiskIssue["type"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="risco">Risco</SelectItem>
                    <SelectItem value="impedimento">Impedimento</SelectItem>
                    <SelectItem value="problema">Problema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Severidade</Label>
                <Select
                  value={risk.severity}
                  onValueChange={(v) =>
                    onUpdate(index, { severity: v as RiskIssue["severity"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="média">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="crítica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Título</Label>
              <Input
                placeholder="Título do risco/impedimento"
                value={risk.title}
                onChange={(e) => onUpdate(index, { title: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea
                placeholder="Descreva o risco ou impedimento"
                value={risk.description}
                onChange={(e) =>
                  onUpdate(index, { description: e.target.value })
                }
                className="min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs">Plano de Ação</Label>
              <Textarea
                placeholder="O que será feito para mitigar/resolver"
                value={risk.actionPlan}
                onChange={(e) =>
                  onUpdate(index, { actionPlan: e.target.value })
                }
                className="min-h-[60px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Responsável</Label>
                <Input
                  placeholder="Nome"
                  value={risk.owner}
                  onChange={(e) => onUpdate(index, { owner: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Prazo</Label>
                <Input
                  type="date"
                  value={risk.dueDate}
                  onChange={(e) => onUpdate(index, { dueDate: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={onAdd} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Adicionar Risco/Impedimento
      </Button>
    </AccordionContent>
  </AccordionItem>
);

export default RisksSection;
