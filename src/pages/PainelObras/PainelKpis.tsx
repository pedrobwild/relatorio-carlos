/**
 * KPIs do Painel — 5 cards clicáveis que filtram a lista por status.
 *
 * Cada `MetricCard` aplica o filtro correspondente quando clicado (ou limpa
 * se já estiver ativo, devolvendo "Todas").
 */
import { MetricCard, MetricRail } from '@/components/ui-premium';
import type { PainelStatus } from '@/hooks/usePainelObras';
import { ALL } from './types';

export interface PainelKpisSummary {
  total: number;
  aguardando: number;
  emDia: number;
  atrasadas: number;
  paralisadas: number;
}

interface PainelKpisProps {
  summary: PainelKpisSummary;
  /** Valor atual do filtro de status — para destacar o card ativo. */
  activeStatusFilter: string;
  onSelectStatus: (status: string) => void;
}

export function PainelKpis({ summary, activeStatusFilter, onSelectStatus }: PainelKpisProps) {
  const handleClick = (status: PainelStatus | typeof ALL) => () => {
    if (status === ALL) {
      onSelectStatus(ALL);
      return;
    }
    onSelectStatus(activeStatusFilter === status ? ALL : status);
  };

  return (
    <MetricRail>
      <MetricCard
        label="Total"
        value={summary.total}
        onClick={handleClick(ALL)}
        accent="default"
      />
      <MetricCard
        label="Aguardando"
        value={summary.aguardando}
        accent="info"
        onClick={handleClick('Aguardando')}
      />
      <MetricCard
        label="Em dia"
        value={summary.emDia}
        accent="success"
        onClick={handleClick('Em dia')}
      />
      <MetricCard
        label="Atrasadas"
        value={summary.atrasadas}
        accent="destructive"
        onClick={handleClick('Atrasado')}
      />
      <MetricCard
        label="Paralisadas"
        value={summary.paralisadas}
        accent="muted"
        onClick={handleClick('Paralisada')}
      />
    </MetricRail>
  );
}
