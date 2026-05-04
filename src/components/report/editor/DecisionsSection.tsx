import { ClientDecision } from "@/types/weeklyReport";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface DecisionsSectionProps {
  decisions: ClientDecision[];
  onAdd: () => void;
  onUpdate: (index: number, field: keyof ClientDecision, value: string) => void;
  onRemove: (index: number) => void;
}

const DecisionsSection = ({
  decisions,
  onAdd,
  onUpdate,
  onRemove,
}: DecisionsSectionProps) => (
  <AccordionItem
    value="decisions"
    className="bg-card border border-border rounded-lg overflow-hidden"
  >
    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-[hsl(var(--info))]" />
        <span className="font-semibold">
          Decisões do Cliente ({decisions.length})
        </span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4 space-y-3">
      {decisions.map((decision, index) => (
        <Card key={decision.id} className="border-muted">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Decisão {index + 1}
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
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea
                placeholder="Descreva a decisão necessária"
                value={decision.description}
                onChange={(e) => onUpdate(index, "description", e.target.value)}
                className="min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs">Impacto se Atrasado</Label>
              <Input
                placeholder="O que acontece se não for decidido a tempo"
                value={decision.impactIfDelayed}
                onChange={(e) =>
                  onUpdate(index, "impactIfDelayed", e.target.value)
                }
              />
            </div>
            <div>
              <Label className="text-xs">Prazo</Label>
              <Input
                type="date"
                value={decision.dueDate}
                onChange={(e) => onUpdate(index, "dueDate", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={onAdd} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Adicionar Decisão
      </Button>
    </AccordionContent>
  </AccordionItem>
);

export default DecisionsSection;
