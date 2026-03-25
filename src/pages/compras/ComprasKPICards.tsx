import { Clock, Package, CheckCircle2, AlertTriangle, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ComprasKPICardsProps {
  pendingCount: number;
  orderedCount: number;
  deliveredCount: number;
  overdueCount: number;
  totalEstimatedCost: number;
}

export function ComprasKPICards({ pendingCount, orderedCount, deliveredCount, overdueCount, totalEstimatedCost }: ComprasKPICardsProps) {
  const cards = [
    { label: 'Pendentes', value: pendingCount, icon: Clock, bg: 'bg-amber-500/20', text: 'text-amber-600' },
    { label: 'Em Pedido', value: orderedCount, icon: Package, bg: 'bg-blue-500/20', text: 'text-blue-600' },
    { label: 'Concluídas', value: deliveredCount, icon: CheckCircle2, bg: 'bg-green-500/20', text: 'text-green-600' },
    { label: 'Atrasados', value: overdueCount, icon: AlertTriangle, bg: 'bg-destructive/20', text: 'text-destructive', valueClass: 'text-destructive' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
      {cards.map(({ label, value, icon: Icon, bg, text, valueClass }) => (
        <Card key={label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${bg}`}>
                <Icon className={`h-5 w-5 ${text}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold ${valueClass || ''}`}>{value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Estimado</p>
              <p className="text-xl font-bold">
                {totalEstimatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
