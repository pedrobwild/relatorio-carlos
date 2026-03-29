import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardCheck, Calendar, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import type { Inspection } from '@/hooks/useInspections';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  in_progress: { label: 'Em andamento', variant: 'default' },
  completed: { label: 'Concluída', variant: 'secondary' },
};

interface Props {
  inspections: Inspection[];
  searchQuery: string;
  onSelect: (inspection: Inspection) => void;
}

export function InspectionsList({ inspections, searchQuery, onSelect }: Props) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return inspections;
    const q = searchQuery.toLowerCase();
    return inspections.filter(i =>
      i.notes?.toLowerCase().includes(q) ||
      i.inspection_date.includes(q)
    );
  }, [inspections, searchQuery]);

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Nenhuma vistoria encontrada"
        description="Crie uma nova vistoria para iniciar o checklist de qualidade."
      />
    );
  }

  return (
    <div className="grid gap-3">
      {filtered.map((inspection) => {
        const cfg = statusConfig[inspection.status] || statusConfig.draft;
        return (
          <Card
            key={inspection.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => onSelect(inspection)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        Vistoria {format(parseISO(inspection.inspection_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </div>
                    {inspection.notes && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {inspection.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
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
  );
}
