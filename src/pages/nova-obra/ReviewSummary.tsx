import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, DollarSign, User, MapPin, CheckCircle2 } from 'lucide-react';
import type { FormData } from './types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ReviewSummaryProps {
  formData: FormData;
}

export function ReviewSummary({ formData }: ReviewSummaryProps) {
  const formatDate = (d: string) => {
    if (!d) return 'Em definição';
    try {
      return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return d;
    }
  };

  const formatCurrency = (v: string) => {
    if (!v) return '—';
    const num = parseFloat(v);
    if (isNaN(num)) return '—';
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const items = [
    {
      icon: Building2,
      label: 'Obra',
      value: formData.name || 'Sem nome',
      sub: [formData.unit_name, formData.is_project_phase && 'Fase de projeto'].filter(Boolean).join(' · '),
      filled: !!formData.name,
    },
    {
      icon: MapPin,
      label: 'Local',
      value: [formData.address, formData.bairro].filter(Boolean).join(', ') || '—',
      sub: formData.cep || '',
      filled: !!(formData.address || formData.bairro),
    },
    {
      icon: Calendar,
      label: 'Período',
      value: formData.is_project_phase && !formData.planned_start_date
        ? 'Em definição'
        : `${formatDate(formData.planned_start_date)} → ${formatDate(formData.planned_end_date)}`,
      sub: formData.business_days_duration ? `${formData.business_days_duration} dias úteis` : '',
      filled: !!(formData.planned_start_date && formData.planned_end_date),
    },
    {
      icon: DollarSign,
      label: 'Contrato',
      value: formatCurrency(formData.contract_value),
      filled: !!formData.contract_value,
    },
    {
      icon: User,
      label: 'Cliente',
      value: formData.customer_name || '(preencher abaixo)',
      sub: formData.customer_email || '',
      filled: !!(formData.customer_name && formData.customer_email),
    },
  ];

  const filledCount = items.filter(i => i.filled).length;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-primary">Resumo da Obra</CardTitle>
          <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary">
            {filledCount}/{items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-0">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className={cn(
                'flex items-start gap-2.5 py-2.5',
                i < items.length - 1 && 'border-b border-primary/10',
              )}
            >
              <div className={cn(
                'mt-0.5 shrink-0',
                item.filled ? 'text-primary' : 'text-muted-foreground/50'
              )}>
                {item.filled ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{item.label}</p>
                <p className={cn(
                  'text-sm font-medium truncate',
                  !item.filled && 'text-muted-foreground'
                )}>
                  {item.value}
                </p>
                {item.sub && <p className="text-xs text-muted-foreground truncate">{item.sub}</p>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
