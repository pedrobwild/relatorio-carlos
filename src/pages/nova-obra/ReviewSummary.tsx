import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Calendar,
  DollarSign,
  User,
  Home,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import type { FormData } from "./types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ReviewSummaryProps {
  formData: FormData;
  contractSourceDoc?: string;
  aiPrefilledCount?: number;
  aiConflictsCount?: number;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto Bancário",
  transferencia: "Transferência Bancária",
  cartao: "Cartão de Crédito",
  financiamento: "Financiamento",
  outro: "Outro",
};

export function ReviewSummary({
  formData,
  contractSourceDoc,
  aiPrefilledCount = 0,
  aiConflictsCount = 0,
}: ReviewSummaryProps) {
  const formatDate = (d: string) => {
    if (!d) return "Em definição";
    try {
      return format(new Date(d + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return d;
    }
  };

  const formatCurrency = (v: string) => {
    if (!v) return "—";
    const num = parseFloat(v);
    if (isNaN(num)) return "—";
    return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  const items = [
    {
      icon: Building2,
      label: "Obra",
      value: formData.name || "Sem nome",
      sub: [
        formData.unit_name,
        formData.nome_do_empreendimento,
        formData.is_project_phase && "Fase de projeto",
      ]
        .filter(Boolean)
        .join(" · "),
      filled: !!formData.name,
    },
    {
      icon: Home,
      label: "Imóvel",
      value:
        [formData.address, formData.bairro, formData.cidade_imovel]
          .filter(Boolean)
          .join(", ") || "—",
      sub: [
        formData.cep,
        formData.tipo_de_locacao,
        formData.tamanho_imovel_m2 && `${formData.tamanho_imovel_m2}m²`,
      ]
        .filter(Boolean)
        .join(" · "),
      filled: !!(formData.address || formData.bairro),
    },
    {
      icon: DollarSign,
      label: "Comercial",
      value: formatCurrency(formData.contract_value),
      sub: [
        formData.payment_method &&
          (PAYMENT_METHOD_LABELS[formData.payment_method] ||
            formData.payment_method),
        formData.contract_signed_at &&
          `Assinado em ${formatDate(formData.contract_signed_at)}`,
      ]
        .filter(Boolean)
        .join(" · "),
      filled: !!formData.contract_value,
    },
    {
      icon: FileSpreadsheet,
      label: "Orçamento",
      value: formData.budget_uploaded
        ? formData.budget_file_name || "Anexado"
        : "Não anexado",
      sub: formData.budget_uploaded
        ? "Pronto para processamento"
        : "Opcional — pode ser adicionado depois",
      filled: formData.budget_uploaded,
    },
    {
      icon: Calendar,
      label: "Planejamento",
      value:
        formData.is_project_phase && !formData.planned_start_date
          ? "Em definição"
          : `${formatDate(formData.planned_start_date)} → ${formatDate(formData.planned_end_date)}`,
      sub: formData.business_days_duration
        ? `${formData.business_days_duration} dias úteis`
        : "",
      filled: !!(formData.planned_start_date && formData.planned_end_date),
    },
    {
      icon: User,
      label: "Contratante",
      value: formData.customer_name || "(preencher)",
      sub: [formData.customer_email, formData.cpf].filter(Boolean).join(" · "),
      filled: !!(formData.customer_name && formData.customer_email),
    },
  ];

  const filledCount = items.filter((i) => i.filled).length;
  const missingCritical =
    !formData.name || !formData.customer_name || !formData.customer_email;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-primary">
            Resumo da Obra
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] font-bold border-primary/30 text-primary"
          >
            {filledCount}/{items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-0">
        {/* Contract source badge */}
        {contractSourceDoc && aiPrefilledCount > 0 && (
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-[11px] text-primary font-medium">
              {aiPrefilledCount} campos preenchidos via contrato
              {aiConflictsCount > 0 && (
                <span className="text-destructive ml-1">
                  · {aiConflictsCount} divergência(s)
                </span>
              )}
            </p>
          </div>
        )}

        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2.5 py-2.5",
                i < items.length - 1 && "border-b border-primary/10",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 shrink-0",
                  item.filled ? "text-primary" : "text-muted-foreground/50",
                )}
              >
                {item.filled ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  {item.label}
                </p>
                <p
                  className={cn(
                    "text-sm font-medium truncate",
                    !item.filled && "text-muted-foreground",
                  )}
                >
                  {item.value}
                </p>
                {item.sub && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.sub}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {missingCritical && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary/10">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-[11px] text-destructive font-medium">
              Campos obrigatórios pendentes:{" "}
              {[
                !formData.name && "Nome da obra",
                !formData.customer_name && "Nome do cliente",
                !formData.customer_email && "E-mail do cliente",
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        )}

        {formData.commercial_notes && (
          <div className="mt-3 pt-3 border-t border-primary/10">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
              Obs. Comerciais
            </p>
            <p className="text-xs text-muted-foreground line-clamp-3">
              {formData.commercial_notes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
