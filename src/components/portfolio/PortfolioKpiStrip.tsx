import {
  Building2, AlertTriangle, Clock, CheckCircle, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiItem {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  accent?: 'default' | 'success' | 'warning' | 'destructive';
}

interface PortfolioKpiStripProps {
  items?: KpiItem[];
}

const accentStyles = {
  default: 'text-foreground',
  success: 'text-[hsl(var(--success))]',
  warning: 'text-[hsl(var(--warning))]',
  destructive: 'text-destructive',
};

/**
 * Horizontal strip of KPI cards for the command center.
 * Placeholder — accepts items or renders defaults.
 */
export function PortfolioKpiStrip({ items }: PortfolioKpiStripProps) {
  const defaultItems: KpiItem[] = items ?? [
    { label: 'Obras Ativas', value: '—', icon: <Building2 className="h-4 w-4" />, accent: 'default' },
    { label: 'Críticas', value: '—', icon: <AlertTriangle className="h-4 w-4" />, accent: 'destructive' },
    { label: 'Vencendo em 30d', value: '—', icon: <Clock className="h-4 w-4" />, accent: 'warning' },
    { label: 'Concluídas', value: '—', icon: <CheckCircle className="h-4 w-4" />, accent: 'success' },
    { label: 'Progresso Médio', value: '—', icon: <TrendingUp className="h-4 w-4" />, accent: 'default' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {defaultItems.map((kpi, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 transition-colors hover:bg-muted/30"
        >
          <div className={cn(
            'flex items-center justify-center h-9 w-9 rounded-lg bg-muted/60 shrink-0',
            accentStyles[kpi.accent ?? 'default']
          )}>
            {kpi.icon}
          </div>
          <div className="min-w-0">
            <p className={cn(
              'text-lg font-bold tabular-nums leading-none',
              accentStyles[kpi.accent ?? 'default']
            )}>
              {kpi.value}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
              {kpi.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
