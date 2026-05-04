import { useState, useCallback } from "react";
import { DollarSign, FileCheck2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyBRL, parseCurrencyBRL } from "@/lib/currencyMask";
import { AiFieldIndicator } from "./AiFieldIndicator";
import type { FormData } from "./types";

interface FinancialCardProps {
  formData: FormData;
  onChange: (field: keyof FormData, value: string | boolean) => void;
  aiPrefilledFields?: Set<string>;
  aiConflictFields?: Set<string>;
}

const PAYMENT_METHODS = [
  { value: "", label: "Selecione..." },
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto Bancário" },
  { value: "transferencia", label: "Transferência Bancária" },
  { value: "cartao", label: "Cartão de Crédito" },
  { value: "financiamento", label: "Financiamento" },
  { value: "outro", label: "Outro" },
];

export function FinancialCard({
  formData,
  onChange,
  aiPrefilledFields = new Set(),
  aiConflictFields = new Set(),
}: FinancialCardProps) {
  const [displayValue, setDisplayValue] = useState(() => {
    if (!formData.contract_value) return "";
    const cents = Math.round(
      parseFloat(formData.contract_value) * 100,
    ).toString();
    return formatCurrencyBRL(cents);
  });

  const handleCurrencyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const formatted = formatCurrencyBRL(raw);
      setDisplayValue(formatted);
      const numericValue = parseCurrencyBRL(formatted);
      onChange("contract_value", numericValue);
    },
    [onChange],
  );

  const numericValue = formData.contract_value
    ? parseFloat(formData.contract_value)
    : 0;
  const isInvalid = formData.contract_value !== "" && numericValue < 0;

  const ai = (field: string) => (
    <AiFieldIndicator
      fieldName={field}
      aiPrefilledFields={aiPrefilledFields}
      aiConflictFields={aiConflictFields}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-body">
          <DollarSign className="h-5 w-5" />
          Dados Comerciais
        </CardTitle>
        <CardDescription>
          Valor do contrato, forma de pagamento e condições comerciais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <Label htmlFor="contract_value" className="inline-flex items-center">
            Valor Total do Contrato (R$)
            {ai("contract_value")}
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              id="contract_value"
              inputMode="numeric"
              value={displayValue}
              onChange={handleCurrencyChange}
              placeholder="0,00"
              className={`pl-10 ${isInvalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
          </div>
          {isInvalid && (
            <p className="text-xs text-destructive">
              O valor do contrato não pode ser negativo.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="payment_method" className="inline-flex items-center">
            Forma de Pagamento
            {ai("payment_method")}
          </Label>
          <Select
            value={formData.payment_method}
            onValueChange={(v) => onChange("payment_method", v)}
          >
            <SelectTrigger id="payment_method">
              <SelectValue placeholder="Selecione a forma de pagamento" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.filter((m) => m.value).map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label
            htmlFor="contract_signed_at"
            className="inline-flex items-center"
          >
            Data de Assinatura do Contrato
            {ai("contract_signed_at")}
          </Label>
          <Input
            id="contract_signed_at"
            type="date"
            value={formData.contract_signed_at}
            onChange={(e) => onChange("contract_signed_at", e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Opcional. Pode ser preenchida depois.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="commercial_notes">Observações Comerciais</Label>
          <Textarea
            id="commercial_notes"
            value={formData.commercial_notes}
            onChange={(e) => onChange("commercial_notes", e.target.value)}
            placeholder="Condições especiais, observações sobre o contrato..."
            rows={3}
            className="resize-none"
          />
        </div>

        {formData.budget_uploaded && formData.budget_file_name && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-muted/30">
            <FileCheck2 className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {formData.budget_file_name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Orçamento anexado
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
