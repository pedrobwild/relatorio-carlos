import { useProjectDashboardSummary } from '@/hooks/useOptimizedQueries';
import { Loader2, TrendingUp, AlertTriangle, FileCheck, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ObraExpandedRowProps {
  projectId: string;
  contractValue: number | null;
}

export function ObraExpandedRow({ projectId, contractValue }: ObraExpandedRowProps) {
  const { data: summary, isLoading } = useProjectDashboardSummary(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando resumo…</span>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="py-3 px-4 text-sm text-muted-foreground italic">
        Resumo não disponível para este projeto.
      </div>
    );
  }

  const progress = summary.progress_pct ?? 0;
  const totalActivities = summary.total_activities ?? 0;
  const completedActivities = summary.completed_activities ?? 0;
  const openNcs = summary.open_ncs ?? 0;
  const pendingInspections = summary.pending_inspections ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 px-4 bg-muted/30 rounded-md">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Progresso</p>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <span className="text-sm font-medium">{progress}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <FileCheck className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Atividades</p>
          <p className="text-sm font-medium">{completedActivities}/{totalActivities}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <AlertTriangle className={`h-4 w-4 ${openNcs > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
        <div>
          <p className="text-xs text-muted-foreground">NCs Abertas</p>
          <p className="text-sm font-medium">
            {openNcs > 0 ? (
              <Badge variant="outline" className="bg-warning/10 text-[hsl(var(--warning))] border-warning/20 text-xs px-1.5 py-0">
                {openNcs}
              </Badge>
            ) : (
              '0'
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Contrato</p>
          <p className="text-sm font-medium">
            {contractValue
              ? `R$ ${contractValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
