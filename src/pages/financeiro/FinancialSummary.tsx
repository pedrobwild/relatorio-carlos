import { Check, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "./helpers";

interface FinancialSummaryProps {
  totalValue: number;
  paidAmount: number;
  remainingAmount: number;
  paidCount: number;
  totalCount: number;
  isAdmin: boolean;
  variant: "desktop" | "mobile";
}

export function FinancialSummary({
  totalValue,
  paidAmount,
  remainingAmount,
  paidCount,
  totalCount,
  isAdmin,
  variant,
}: FinancialSummaryProps) {
  const today = new Date();
  const formatDate = (d: Date) => format(d, "dd/MM/yyyy", { locale: ptBR });
  const pctPaid =
    totalValue > 0 ? ((paidAmount / totalValue) * 100).toFixed(0) : "0";

  if (variant === "mobile") {
    return (
      <div className="px-4 py-6 border-b border-border">
        <p className="text-caption mb-1">Valor total do contrato</p>
        <p className="text-2xl font-bold text-foreground tracking-tight mb-6">
          {formatCurrency(totalValue)}
        </p>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-caption mb-1">Pago</p>
            <p className="text-h2">{formatCurrency(paidAmount)}</p>
          </div>
          <div>
            <p className="text-caption mb-1">A pagar</p>
            <p className="text-h2">{formatCurrency(remainingAmount)}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-caption mb-2">
            <span>
              {paidCount} de {totalCount} parcelas pagas
            </span>
            <span>{pctPaid}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground rounded-full transition-all duration-500"
              style={{ width: `${pctPaid}%` }}
            />
          </div>
        </div>

        {isAdmin && (
          <div className="mt-4">
            <Badge variant="outline" className="text-xs">
              Admin: pode editar pagamentos
            </Badge>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 sticky top-16 h-fit">
      <p className="text-caption mb-1">Valor total do contrato</p>
      <p className="text-3xl font-bold text-foreground tracking-tight mb-6">
        {formatCurrency(totalValue)}
      </p>

      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span className="text-caption font-medium">Pago</span>
          </div>
          <p className="text-h3 text-emerald-700">
            {formatCurrency(paidAmount)}
          </p>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-caption font-medium">A pagar</span>
          </div>
          <p className="text-h3">{formatCurrency(remainingAmount)}</p>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center justify-between text-caption mb-2">
          <span>
            {paidCount} de {totalCount} parcelas pagas
          </span>
          <span className="font-semibold">{pctPaid}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground rounded-full transition-all duration-500"
            style={{ width: `${pctPaid}%` }}
          />
        </div>
      </div>

      <p className="text-tiny text-center mt-4">
        Última atualização: {formatDate(today)}
      </p>
    </div>
  );
}
