import { LookaheadTask } from "@/types/weeklyReport";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface LookaheadSectionProps {
  tasks: LookaheadTask[];
  onAdd: () => void;
  onUpdate: (index: number, field: keyof LookaheadTask, value: string) => void;
  onRemove: (index: number) => void;
}

const LookaheadSection = ({
  tasks,
  onAdd,
  onUpdate,
  onRemove,
}: LookaheadSectionProps) => (
  <AccordionItem
    value="lookahead"
    className="bg-card border border-border rounded-lg overflow-hidden"
  >
    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-primary" />
        <span className="font-semibold">Próximos 7 Dias ({tasks.length})</span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4 space-y-3">
      {tasks.map((task, index) => (
        <Card key={task.id} className="border-muted">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Tarefa {index + 1}
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
                  value={task.date}
                  onChange={(e) => onUpdate(index, "date", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Responsável</Label>
                <Input
                  placeholder="Nome do responsável"
                  value={task.responsible}
                  onChange={(e) =>
                    onUpdate(index, "responsible", e.target.value)
                  }
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input
                placeholder="Descreva a tarefa"
                value={task.description}
                onChange={(e) => onUpdate(index, "description", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Pré-requisitos</Label>
              <Input
                placeholder="O que precisa estar pronto antes"
                value={task.prerequisites}
                onChange={(e) =>
                  onUpdate(index, "prerequisites", e.target.value)
                }
              />
            </div>
            <div>
              <Label className="text-xs">Risco</Label>
              <Select
                value={task.risk}
                onValueChange={(v) => onUpdate(index, "risk", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">Baixo</SelectItem>
                  <SelectItem value="médio">Médio</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={onAdd} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Adicionar Tarefa
      </Button>
    </AccordionContent>
  </AccordionItem>
);

export default LookaheadSection;
