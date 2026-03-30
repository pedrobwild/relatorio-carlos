import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardCheck, Calendar, ChevronRight, Copy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import type { Inspection } from '@/hooks/useInspections';

type InspectionStatus = 'draft' | 'in_progress' | 'completed';

const statusConfig: Record<InspectionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  in_progress: { label: 'Em andamento', variant: 'default' },
  completed: { label: 'Concluída', variant: 'secondary' },
};

const allStatuses: InspectionStatus[] = ['draft', 'in_progress', 'completed'];

interface Props {
  inspections: Inspection[];
  searchQuery: string;
  onSelect: (inspection: Inspection) => void;
  onDuplicate?: (inspection: Inspection) => void;
}

export function InspectionsList({ inspections, searchQuery, onSelect, onDuplicate }: Props) {
  const [filterStatus, setFilterStatus] = useState<InspectionStatus | null>(null);

  const filtered = useMemo(() => {
    let result = inspections;
    if (filterStatus) result = result.filter(i => i.status === filterStatus);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.notes?.toLowerCase().includes(q) ||
        i.inspection_date.includes(q)
      );
    }
    return result;
  }, [inspections, searchQuery, filterStatus]);

  return (
    <div className="space-y-3">
      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant={filterStatus === null ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs min-w-[44px]"
          onClick={() => setFilterStatus(null)}
        >
          Todas
        </Button>
        {allStatuses.map(s => (
          <Button
            key={s}
            variant={filterStatus === s ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs min-w-[44px]"
            onClick={() => setFilterStatus(prev => prev === s ? null : s)}
          >
            {statusConfig[s].label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhuma vistoria encontrada"
          description="Crie uma nova vistoria para iniciar o checklist de qualidade."
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((inspection) => {
            const cfg = statusConfig[inspection.status as InspectionStatus] || statusConfig.draft;
            return (
              <Card
                key={inspection.id}
                className="cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98]"
                onClick={() => onSelect(inspection)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <ClipboardCheck className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm sm:text-base">
                            Vistoria {format(parseISO(inspection.inspection_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <Badge variant={cfg.variant} className="text-[10px] sm:text-xs">{cfg.label}</Badge>
                        </div>
                        {inspection.activity_description && (
                          <p className="text-xs text-primary/80 truncate mt-0.5">
                            {inspection.activity_description}
                          </p>
                        )}
                        {inspection.notes && (
                          <p className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">
                            {inspection.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onDuplicate && inspection.status === 'completed' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Duplicar vistoria"
                          onClick={(e) => { e.stopPropagation(); onDuplicate(inspection); }}
                        >
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                      <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(parseISO(inspection.created_at), "dd/MM", { locale: ptBR })}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
