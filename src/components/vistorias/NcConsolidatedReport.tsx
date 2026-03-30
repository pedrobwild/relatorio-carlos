import { useMemo, useCallback } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileDown, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NonConformity, NcSeverity, NcStatus } from '@/hooks/useNonConformities';

interface Props {
  nonConformities: NonConformity[];
}

const severityLabels: Record<NcSeverity, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
};

const statusLabels: Record<NcStatus, string> = {
  open: 'Aberta', in_treatment: 'Em tratamento', pending_verification: 'Verificação',
  pending_approval: 'Aprovação', closed: 'Encerrada', reopened: 'Reaberta',
};

export function NcConsolidatedReport({ nonConformities }: Props) {
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const total = nonConformities.length;
    const open = nonConformities.filter(nc => nc.status !== 'closed');
    const closed = nonConformities.filter(nc => nc.status === 'closed');
    const overdue = open.filter(nc => nc.deadline && nc.deadline < today);
    const reincident = nonConformities.filter(nc => nc.reopen_count > 0);

    // Average resolution time (for closed NCs)
    const resolutionTimes = closed
      .filter(nc => nc.resolved_at)
      .map(nc => differenceInDays(parseISO(nc.resolved_at!), parseISO(nc.created_at)));
    const avgResolution = resolutionTimes.length > 0
      ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
      : null;

    // By severity
    const bySeverity = (['critical', 'high', 'medium', 'low'] as NcSeverity[]).map(s => ({
      severity: s,
      label: severityLabels[s],
      total: nonConformities.filter(nc => nc.severity === s).length,
      open: open.filter(nc => nc.severity === s).length,
    }));

    // By status
    const byStatus = (['open', 'in_treatment', 'pending_verification', 'pending_approval', 'reopened', 'closed'] as NcStatus[]).map(s => ({
      status: s,
      label: statusLabels[s],
      count: nonConformities.filter(nc => nc.status === s).length,
    }));

    return { total, openCount: open.length, closedCount: closed.length, overdueCount: overdue.length, reincidentCount: reincident.length, avgResolution, bySeverity, byStatus };
  }, [nonConformities]);

  const handleExportCsv = useCallback(() => {
    const headers = ['Título', 'Severidade', 'Status', 'Responsável', 'Prazo', 'Criada em', 'Reaberturas'];
    const rows = nonConformities.map(nc => [
      nc.title,
      severityLabels[nc.severity],
      statusLabels[nc.status],
      nc.responsible_user_name || '-',
      nc.deadline ? format(parseISO(nc.deadline), 'dd/MM/yyyy') : '-',
      format(parseISO(nc.created_at), 'dd/MM/yyyy'),
      nc.reopen_count.toString(),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-ncs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nonConformities]);

  if (nonConformities.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Relatório Consolidado
          </CardTitle>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleExportCsv}>
            <FileDown className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Abertas', value: stats.openCount, danger: stats.openCount > 0 },
            { label: 'Encerradas', value: stats.closedCount },
            { label: 'Vencidas', value: stats.overdueCount, danger: stats.overdueCount > 0 },
            { label: 'Tempo médio (dias)', value: stats.avgResolution ?? '-' },
          ].map(k => (
            <div key={k.label} className="text-center p-2 rounded-lg bg-muted/50">
              <p className={`text-lg font-bold ${k.danger ? 'text-destructive' : ''}`}>{k.value}</p>
              <p className="text-[10px] text-muted-foreground">{k.label}</p>
            </div>
          ))}
        </div>

        {/* By severity */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Por Severidade</p>
          <div className="space-y-1">
            {stats.bySeverity.map(s => (
              <div key={s.severity} className="flex items-center justify-between text-sm py-1">
                <span>{s.label}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{s.total} total</span>
                  {s.open > 0 && <span className="text-destructive font-medium">{s.open} abertas</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By status */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Por Status</p>
          <div className="flex flex-wrap gap-2">
            {stats.byStatus.filter(s => s.count > 0).map(s => (
              <div key={s.status} className="flex items-center gap-1.5 text-xs bg-muted/50 rounded px-2 py-1">
                <span className="text-muted-foreground">{s.label}:</span>
                <span className="font-medium">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reincident indicator */}
        {stats.reincidentCount > 0 && (
          <p className="text-xs text-destructive">
            ⚠ {stats.reincidentCount} NC(s) reincidente(s) — atenção para causas-raiz.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
