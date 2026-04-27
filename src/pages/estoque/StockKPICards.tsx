import { Package, AlertTriangle, DollarSign, TrendingDown, ShoppingCart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StockKPICardsProps {
  totalItems: number;
  toBuyCount: number;
  outOfStockCount: number;
  stockValue: number;
  lossValue: number;
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface KPI {
  label: string;
  value: string | number;
  icon: typeof Package;
  tone?: 'default' | 'warning' | 'danger' | 'primary';
  hint?: string;
}

export function StockKPICards({
  totalItems,
  toBuyCount,
  outOfStockCount,
  stockValue,
  lossValue,
}: StockKPICardsProps) {
  const kpis: KPI[] = [
    {
      label: 'Itens cadastrados',
      value: totalItems,
      icon: Package,
      tone: 'primary',
      hint: 'Materiais no inventário desta obra',
    },
    {
      label: 'Para comprar',
      value: toBuyCount,
      icon: ShoppingCart,
      tone: toBuyCount > 0 ? 'warning' : 'default',
      hint: 'Abaixo do mínimo',
    },
    {
      label: 'Sem estoque',
      value: outOfStockCount,
      icon: AlertTriangle,
      tone: outOfStockCount > 0 ? 'danger' : 'default',
      hint: 'Saldo zero ou negativo',
    },
    {
      label: 'Valor em estoque',
      value: fmt(stockValue),
      icon: DollarSign,
      tone: 'default',
      hint: 'Saldo × custo unitário',
    },
    {
      label: 'Valor de perdas',
      value: fmt(lossValue),
      icon: TrendingDown,
      tone: lossValue > 0 ? 'danger' : 'default',
      hint: 'Quebras e perdas registradas',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpis.map(({ label, value, icon: Icon, tone, hint }) => (
        <Card
          key={label}
          className={cn(
            'border-border/60',
            tone === 'primary' && 'border-primary/20 bg-primary/[0.03]',
            tone === 'warning' && 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/[0.04]',
            tone === 'danger' && 'border-destructive/30 bg-destructive/[0.04]',
          )}
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground truncate">
                {label}
              </span>
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  tone === 'primary' && 'text-primary',
                  tone === 'warning' && 'text-amber-600',
                  tone === 'danger' && 'text-destructive',
                  (!tone || tone === 'default') && 'text-muted-foreground',
                )}
              />
            </div>
            <p className="text-2xl font-semibold tabular-nums leading-none">
              {value}
            </p>
            {hint && (
              <p className="text-[11px] text-muted-foreground leading-tight">{hint}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
