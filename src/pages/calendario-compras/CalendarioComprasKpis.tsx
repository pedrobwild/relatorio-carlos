/**
 * Faixa de KPIs do Calendário de Compras: 7 cards com totais agregados sobre
 * o conjunto filtrado (estimado, real, diferença, orçamento disponível, saldo).
 */
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fmt, fmtDiff } from './types';

interface CalendarioComprasKpisProps {
  totalItems: number;
  pendingItems: number;
  thisMonthItems: number;
  totalEstimated: number;
  itemsWithBothCount: number;
  totalDiff: number;
  diffPositive: boolean;
  availableBudget: number;
  budgetBalance: number;
  balancePositive: boolean;
}

export function CalendarioComprasKpis(p: CalendarioComprasKpisProps) {
  const cards: { label: string; value: React.ReactNode; cls: string }[] = [
    { label: 'Total de Itens', value: p.totalItems, cls: '' },
    { label: 'Pendentes', value: p.pendingItems, cls: 'text-amber-600' },
    { label: 'Este Mês', value: p.thisMonthItems, cls: '' },
    { label: 'Total Estimado', value: fmt(p.totalEstimated), cls: 'text-xl' },
    {
      label: `Diferença (${p.itemsWithBothCount})`,
      value: p.itemsWithBothCount === 0 ? '—' : fmtDiff(p.totalDiff),
      cls: cn('text-xl', p.diffPositive ? 'text-emerald-600' : 'text-red-600'),
    },
    {
      label: 'Orçamento Disponível',
      value: fmt(p.availableBudget),
      cls: 'text-xl text-emerald-600',
    },
    {
      label: 'Saldo',
      value: fmtDiff(p.budgetBalance),
      cls: cn('text-xl', p.balancePositive ? 'text-emerald-600' : 'text-red-600'),
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map(({ label, value, cls }) => (
        <Card key={label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground whitespace-nowrap">{label}</p>
            <p
              className={cn(
                'font-bold tabular-nums',
                cls.includes('text-xl') ? 'text-xl whitespace-nowrap' : 'text-2xl',
                cls.replace('text-xl', '').trim(),
              )}
            >
              {value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
