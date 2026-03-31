import { useState, useCallback } from 'react';
import { DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrencyBRL, parseCurrencyBRL } from '@/lib/currencyMask';
import type { FormData } from './types';

interface FinancialCardProps {
  formData: FormData;
  onChange: (field: keyof FormData, value: string | boolean) => void;
}

export function FinancialCard({ formData, onChange }: FinancialCardProps) {
  // Display formatted version; keep raw value in formData
  const [displayValue, setDisplayValue] = useState(() => {
    if (!formData.contract_value) return '';
    // Convert existing decimal string to cents-based display
    const cents = Math.round(parseFloat(formData.contract_value) * 100).toString();
    return formatCurrencyBRL(cents);
  });

  const handleCurrencyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatCurrencyBRL(raw);
    setDisplayValue(formatted);
    const numericValue = parseCurrencyBRL(formatted);
    onChange('contract_value', numericValue);
  }, [onChange]);

  const numericValue = formData.contract_value ? parseFloat(formData.contract_value) : 0;
  const isInvalid = formData.contract_value !== '' && numericValue < 0;

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
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input
              id="contract_value"
              inputMode="numeric"
              value={displayValue}
              onChange={handleCurrencyChange}
              placeholder="0,00"
              className={`pl-10 ${isInvalid ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
          </div>
          {isInvalid && (
            <p className="text-xs text-destructive">O valor do contrato não pode ser negativo.</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Parcelas, forma e status de pagamento podem ser configurados na edição da obra.
        </p>
      </CardContent>
    </Card>
  );
}
