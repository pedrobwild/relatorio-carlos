import { DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FormData } from './types';

interface FinancialCardProps {
  formData: FormData;
  onChange: (field: keyof FormData, value: string | boolean) => void;
}

export function FinancialCard({ formData, onChange }: FinancialCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-body">
          <DollarSign className="h-5 w-5" />
          Financeiro
        </CardTitle>
        <CardDescription>Dados financeiros e condições de pagamento</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="contract_value">Valor Total do Contrato (R$)</Label>
          <Input
            id="contract_value"
            type="number"
            step="0.01"
            value={formData.contract_value}
            onChange={(e) => onChange('contract_value', e.target.value)}
            placeholder="0,00"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Parcelas, forma e status de pagamento podem ser configurados na edição da obra.
        </p>
      </CardContent>
    </Card>
  );
}
