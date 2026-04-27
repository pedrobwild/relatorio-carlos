import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardCheck, Calendar, ChevronRight, Copy, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import type { Inspection } from '@/hooks/useInspections';
import type { NonConformity } from '@/hooks/useNonConformities';
import { INSPECTION_TYPES, getInspectionTypeConfig, type InspectionType } from './inspectionConstants';
import { matchesSearch } from '@/lib/searchNormalize';

type InspectionStatus = 'draft' | 'in_progress' | 'completed';

const statusConfig: Record<InspectionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  in_progress: { label: 'Em andamento', variant: 'default' },
  completed: { label: 'Concluída', variant: 'secondary' },
};

const allStatuses: InspectionStatus[] = ['draft', 'in_progress', 'completed'];

interface Props {
  inspections: Inspection[];
  nonConformities?: NonConformity[];
  searchQuery: string;
  onSelect: (inspection: Inspection) => void;
  onDuplicate?: (inspection: Inspection) => void;
}

export function InspectionsList({ inspections, nonConformities = [], searchQuery, onSelect, onDuplicate }: Props) {
  const [filterStatus, setFilterStatus] = useState<InspectionStatus | null>(null);
  const [filterTypes, setFilterTypes] = useState<InspectionType[]>([]);

  const toggleTypeFilter = (type: InspectionType) => {
    setFilterTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const filtered = useMemo(() => {
    let result = inspections;
    if (filterStatus) result = result.filter(i => i.status === filterStatus);
    if (filterTypes.length > 0) result = result.filter(i => filterTypes.includes((i.inspection_type || 'rotina') as InspectionType));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.notes?.toLowerCase().includes(q) ||
        i.inspection_date.includes(q)
      );
    }
    return result;
  }, [inspections, searchQuery, filterStatus, filterTypes]);

  const ncCountByInspection = useMemo(() => {
    const map: Record<string, number> = {};
    nonConformities.forEach(nc => {
      if (nc.inspection_id) {
        map[nc.inspection_id] = (map[nc.inspection_id] || 0) + 1;
      }
    });
    return map;
  }, [nonConformities]);

  // Only show type filter if there are inspections with different types
  const usedTypes = useMemo(() => {
    const types = new Set(inspections.map(i => (i.inspection_type || 'rotina') as InspectionType));
    return INSPECTION_TYPES.filter(t => types.has(t.value));
  }, [inspections]);

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

      {/* Type filter chips */}
      {usedTypes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {usedTypes.map(t => (
            <Button
              key={t.value}
              variant={filterTypes.includes(t.value) ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-[10px] min-w-[44px] gap-1"
              onClick={() => toggleTypeFilter(t.value)}
            >
              {t.emoji} {t.label}
            </Button>
          ))}
        </div>
      )}

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
            const typeConfig = getInspectionTypeConfig(inspection.inspection_type || 'rotina');
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
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeConfig.color}`}>
                            {typeConfig.emoji} {typeConfig.label}
                          </span>
                          <Badge variant={cfg.variant} className="text-[10px] sm:text-xs">{cfg.label}</Badge>
                          {(ncCountByInspection[inspection.id] ?? 0) > 0 && (
                            <Badge variant="destructive" className="gap-1 text-[10px] sm:text-xs">
                              <AlertTriangle className="h-3 w-3" />
                              {ncCountByInspection[inspection.id]} NC{ncCountByInspection[inspection.id] > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        {inspection.inspector_user_name && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            Vistoriador: {inspection.inspector_user_name}
                          </p>
                        )}
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
