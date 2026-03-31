import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, DollarSign, User, MapPin } from 'lucide-react';
import type { FormData } from './types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-primary">Resumo da Obra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Project */}
        <div className="flex items-start gap-2">
          <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <p className="font-medium">{formData.name || 'Sem nome'}</p>
            {formData.unit_name && <p className="text-muted-foreground">{formData.unit_name}</p>}
            {formData.is_project_phase && (
              <Badge variant="outline" className="mt-1 text-xs">Fase de projeto</Badge>
            )}
          </div>
        </div>

        {/* Location */}
        {(formData.address || formData.bairro) && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <p className="text-muted-foreground">
              {[formData.address, formData.bairro, formData.cep].filter(Boolean).join(' · ')}
            </p>
          </div>
        )}

        {/* Schedule */}
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <p>
              {formData.is_project_phase && !formData.planned_start_date
                ? 'Datas em definição'
                : `${formatDate(formData.planned_start_date)} → ${formatDate(formData.planned_end_date)}`}
            </p>
            {formData.business_days_duration && (
              <p className="text-muted-foreground">{formData.business_days_duration} dias úteis</p>
            )}
          </div>
        </div>

        {/* Financial */}
        <div className="flex items-start gap-2">
          <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p>{formatCurrency(formData.contract_value)}</p>
        </div>

        {/* Customer preview */}
        <div className="flex items-start gap-2">
          <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-muted-foreground">(preencher abaixo)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
