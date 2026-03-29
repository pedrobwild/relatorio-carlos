import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ChevronRight, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import type { NonConformity, NcSeverity, NcStatus } from '@/hooks/useInspections';

const severityConfig: Record<NcSeverity, { label: string; className: string }> = {
  low: { label: 'Baixa', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  medium: { label: 'Média', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critical: { label: 'Crítica', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const statusConfig: Record<NcStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open: { label: 'Aberta', variant: 'destructive' },
  in_treatment: { label: 'Em tratamento', variant: 'default' },
  pending_verification: { label: 'Verificação', variant: 'outline' },
  pending_approval: { label: 'Aprovação', variant: 'outline' },
  closed: { label: 'Encerrada', variant: 'secondary' },
  reopened: { label: 'Reaberta', variant: 'destructive' },
};

interface Props {
  nonConformities: NonConformity[];
  searchQuery: string;
  onSelect: (nc: NonConformity) => void;
}

export function NonConformitiesList({ nonConformities, searchQuery, onSelect }: Props) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return nonConformities;
    const q = searchQuery.toLowerCase();
    return nonConformities.filter(nc =>
      nc.title.toLowerCase().includes(q) ||
      nc.description?.toLowerCase().includes(q)
    );
  }, [nonConformities, searchQuery]);

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Nenhuma não conformidade"
        description="NCs serão criadas automaticamente a partir de itens reprovados nas vistorias."
      />
    );
  }

  return (
    <div className="grid gap-3">
      {filtered.map((nc) => {
        const sev = severityConfig[nc.severity];
        const st = statusConfig[nc.status];
        const isOverdue = nc.deadline && new Date(nc.deadline) < new Date() && nc.status !== 'closed';

        return (
          <Card
            key={nc.id}
            className="cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98]"
            onClick={() => onSelect(nc)}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                    nc.severity === 'critical' || nc.severity === 'high'
                      ? 'bg-destructive/10'
                      : 'bg-warning/10'
                  }`}>
                    <AlertTriangle className={`h-5 w-5 ${
                      nc.severity === 'critical' || nc.severity === 'high'
                        ? 'text-destructive'
                        : 'text-warning'
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate">{nc.title}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded ${sev.className}`}>
                        {sev.label}
                      </span>
                      <Badge variant={st.variant} className="text-[10px] sm:text-xs">{st.label}</Badge>
                      {isOverdue && (
                        <Badge variant="destructive" className="gap-1 text-[10px] sm:text-xs">
                          <Clock className="h-3 w-3" />
                          Atrasada
                        </Badge>
                      )}
                    </div>
                    {nc.description && (
                      <p className="text-xs text-muted-foreground truncate mt-1 hidden sm:block">
                        {nc.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 mt-1 sm:mt-0">
                  {nc.deadline && (
                    <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                      {format(parseISO(nc.deadline), "dd/MM", { locale: ptBR })}
                    </span>
                  )}
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
