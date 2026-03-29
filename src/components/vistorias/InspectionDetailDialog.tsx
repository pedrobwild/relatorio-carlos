import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, MinusCircle, Clock, AlertTriangle, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useInspectionItems,
  useUpdateInspectionItem,
  useCompleteInspection,
  useCreateNonConformity,
  type Inspection,
  type InspectionItem,
  type InspectionItemResult,
} from '@/hooks/useInspections';
import { toast } from 'sonner';

const resultConfig: Record<InspectionItemResult, { icon: React.ReactNode; label: string; className: string }> = {
  pending: { icon: <Clock className="h-4 w-4" />, label: 'Pendente', className: 'text-muted-foreground' },
  approved: { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Aprovado', className: 'text-green-600' },
  rejected: { icon: <XCircle className="h-4 w-4" />, label: 'Reprovado', className: 'text-destructive' },
  not_applicable: { icon: <MinusCircle className="h-4 w-4" />, label: 'N/A', className: 'text-muted-foreground' },
};

interface Props {
  inspection: Inspection;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNc?: (item: InspectionItem) => void;
}

export function InspectionDetailDialog({ inspection, projectId, open, onOpenChange }: Props) {
  const { data: items = [], isLoading } = useInspectionItems(inspection.id);
  const updateItem = useUpdateInspectionItem();
  const completeInspection = useCompleteInspection();
  const createNc = useCreateNonConformity();
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  const isCompleted = inspection.status === 'completed';

  const handleResultChange = (item: InspectionItem, result: InspectionItemResult) => {
    if (isCompleted) return;
    updateItem.mutate({
      id: item.id,
      inspection_id: inspection.id,
      result,
    });
  };

  const handleNotesBlur = (item: InspectionItem) => {
    const notes = itemNotes[item.id];
    if (notes !== undefined && notes !== (item.notes || '')) {
      updateItem.mutate({
        id: item.id,
        inspection_id: inspection.id,
        notes: notes || null,
      });
    }
  };

  const handleComplete = () => {
    const pendingItems = items.filter(i => i.result === 'pending');
    if (pendingItems.length > 0) {
      toast.error(`Ainda há ${pendingItems.length} itens pendentes`);
      return;
    }
    completeInspection.mutate({ id: inspection.id, project_id: projectId });
  };

  const handleCreateNcFromItem = (item: InspectionItem) => {
    createNc.mutate({
      project_id: projectId,
      inspection_id: inspection.id,
      inspection_item_id: item.id,
      title: `NC: ${item.description}`,
      description: item.notes || undefined,
      severity: 'medium',
    });
  };

  const approvedCount = items.filter(i => i.result === 'approved').length;
  const rejectedCount = items.filter(i => i.result === 'rejected').length;
  const pendingCount = items.filter(i => i.result === 'pending').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Vistoria — {format(parseISO(inspection.inspection_date), "dd/MM/yyyy", { locale: ptBR })}
            <Badge variant={isCompleted ? 'secondary' : 'default'}>
              {isCompleted ? 'Concluída' : 'Em andamento'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>{approvedCount} aprovados</span>
          </div>
          <div className="flex items-center gap-1.5 text-destructive">
            <XCircle className="h-4 w-4" />
            <span>{rejectedCount} reprovados</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{pendingCount} pendentes</span>
          </div>
        </div>

        {inspection.notes && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            {inspection.notes}
          </p>
        )}

        {/* Items checklist */}
        <div className="space-y-2">
          {items.map((item, i) => {
            const cfg = resultConfig[item.result];
            return (
              <div
                key={item.id}
                className={`border rounded-lg p-3 space-y-2 transition-colors ${
                  item.result === 'rejected' ? 'border-destructive/30 bg-destructive/5' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground font-mono mt-0.5">{i + 1}.</span>
                    <span className={`text-sm font-medium ${cfg.className}`}>
                      {item.description}
                    </span>
                  </div>

                  {!isCompleted && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant={item.result === 'approved' ? 'default' : 'outline'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleResultChange(item, 'approved')}
                        title="Aprovado"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={item.result === 'rejected' ? 'destructive' : 'outline'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleResultChange(item, 'rejected')}
                        title="Reprovado"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={item.result === 'not_applicable' ? 'secondary' : 'outline'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleResultChange(item, 'not_applicable')}
                        title="N/A"
                      >
                        <MinusCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {isCompleted && (
                    <div className={`flex items-center gap-1 text-xs font-medium ${cfg.className}`}>
                      {cfg.icon}
                      {cfg.label}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {!isCompleted ? (
                  <Textarea
                    placeholder="Observações do item..."
                    className="text-xs min-h-[40px] resize-none"
                    rows={1}
                    value={itemNotes[item.id] ?? item.notes ?? ''}
                    onChange={(e) => setItemNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                    onBlur={() => handleNotesBlur(item)}
                  />
                ) : item.notes ? (
                  <p className="text-xs text-muted-foreground ml-5">{item.notes}</p>
                ) : null}

                {/* Create NC button for rejected items */}
                {item.result === 'rejected' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => handleCreateNcFromItem(item)}
                    disabled={createNc.isPending}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Abrir NC
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {!isCompleted && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              onClick={handleComplete}
              disabled={pendingCount > 0 || completeInspection.isPending}
            >
              {completeInspection.isPending ? 'Finalizando...' : 'Finalizar Vistoria'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
