import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, MinusCircle, Clock, AlertTriangle } from 'lucide-react';
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
  approved: { icon: <CheckCircle2 className="h-4 w-4" />, label: 'OK', className: 'text-green-600' },
  rejected: { icon: <XCircle className="h-4 w-4" />, label: 'NC', className: 'text-destructive' },
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
      <DialogContent className="max-w-2xl max-h-[100dvh] sm:max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-2 text-base sm:text-lg">
            <span>Vistoria — {format(parseISO(inspection.inspection_date), "dd/MM/yyyy", { locale: ptBR })}</span>
            <Badge variant={isCompleted ? 'secondary' : 'default'}>
              {isCompleted ? 'Concluída' : 'Em andamento'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Summary - compact on mobile */}
        <div className="flex gap-3 sm:gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{approvedCount}</span>
          </div>
          <div className="flex items-center gap-1 text-destructive">
            <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{rejectedCount}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{pendingCount}</span>
          </div>
        </div>

        {inspection.notes && (
          <p className="text-xs sm:text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            {inspection.notes}
          </p>
        )}

        {/* Items checklist - optimized for touch */}
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
                {/* Description + status badge on mobile */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground font-mono mt-0.5 shrink-0">{i + 1}.</span>
                    <span className={`text-sm font-medium ${cfg.className}`}>
                      {item.description}
                    </span>
                  </div>

                  {/* Action buttons - larger touch targets on mobile */}
                  {!isCompleted && (
                    <div className="flex items-center gap-1.5 shrink-0 ml-5 sm:ml-0">
                      <Button
                        variant={item.result === 'approved' ? 'default' : 'outline'}
                        size="icon"
                        className="h-10 w-10 sm:h-8 sm:w-8"
                        onClick={() => handleResultChange(item, 'approved')}
                        title="Aprovado"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={item.result === 'rejected' ? 'destructive' : 'outline'}
                        size="icon"
                        className="h-10 w-10 sm:h-8 sm:w-8"
                        onClick={() => handleResultChange(item, 'rejected')}
                        title="Reprovado"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={item.result === 'not_applicable' ? 'secondary' : 'outline'}
                        size="icon"
                        className="h-10 w-10 sm:h-8 sm:w-8"
                        onClick={() => handleResultChange(item, 'not_applicable')}
                        title="N/A"
                      >
                        <MinusCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {isCompleted && (
                    <div className={`flex items-center gap-1 text-xs font-medium ${cfg.className} ml-5 sm:ml-0`}>
                      {cfg.icon}
                      {cfg.label}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {!isCompleted ? (
                  <Textarea
                    placeholder="Observações..."
                    className="text-xs min-h-[44px] resize-none"
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
                    className="gap-1.5 text-xs h-9 min-w-[44px]"
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
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 sm:h-10 w-full sm:w-auto">
              Fechar
            </Button>
            <Button
              onClick={handleComplete}
              disabled={pendingCount > 0 || completeInspection.isPending}
              className="h-11 sm:h-10 w-full sm:w-auto"
            >
              {completeInspection.isPending ? 'Finalizando...' : 'Finalizar Vistoria'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
