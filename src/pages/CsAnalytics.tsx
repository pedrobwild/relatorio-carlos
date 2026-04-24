/**
 * CsAnalytics — visão executiva e analítica de Customer Success.
 *
 * Apresenta exclusivamente o dashboard agregado de tickets:
 *   - KPIs (totais, abertos, em andamento, concluídos, críticos)
 *   - Matriz Status × Severidade (heatmap clicável)
 *   - Listas de prioridade (críticos, antigos, parados)
 *
 * Para a operação (CRUD/lista filtrável), ver `CsOperacional`.
 */
import { useNavigate } from 'react-router-dom';
import { BarChart3, ListChecks } from 'lucide-react';

import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useCsTickets, type CsTicketSeverity, type CsTicketStatus } from '@/hooks/useCsTickets';
import { CsDashboard } from '@/components/cs/CsDashboard';

export default function CsAnalytics() {
  const navigate = useNavigate();
  const { data: tickets = [], isLoading } = useCsTickets();

  /**
   * Quando um filtro é selecionado no dashboard, levamos o usuário ao módulo
   * operacional já com o estado pré-preenchido via querystring (status/severity).
   */
  const handleFilter = ({
    status,
    severity,
  }: {
    status?: CsTicketStatus | null;
    severity?: CsTicketSeverity | null;
  }) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (severity) params.set('severity', severity);
    const qs = params.toString();
    navigate(`/gestao/cs/operacional${qs ? `?${qs}` : ''}`);
  };

  return (
    <PageContainer>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">CS — Analytics</h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Visão executiva dos tickets de Customer Success por obra: severidade, status,
              gargalos e tickets parados.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/gestao/cs/operacional')} className="shrink-0">
          <ListChecks className="h-4 w-4 mr-1.5" />
          Ir para operacional
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <CsDashboard tickets={tickets} onFilter={handleFilter} />
      )}
    </PageContainer>
  );
}
