import { CalendarClock, DollarSign, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseISO, differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { UpcomingPayment } from "@/hooks/useClientDashboard";

interface UpcomingPaymentsCardProps {
  payments: UpcomingPayment[];
  onPaymentClick?: (projectId: string) => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function parseDueDate(value: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDaysUntilDueDate(dueDate: string): number | null {
  const parsed = parseDueDate(dueDate);
  if (!parsed) return null;
  return differenceInDays(parsed, new Date());
}

function getUrgencyClass(dueDate: string): string {
  const days = getDaysUntilDueDate(dueDate);
  if (days === null) return "text-muted-foreground";
  if (days < 0) return "text-muted-foreground";
  if (days <= 2) return "text-[hsl(var(--warning))] font-medium";
  return "text-muted-foreground";
}

function getUrgencyLabel(dueDate: string): string {
  const days = getDaysUntilDueDate(dueDate);
  if (days === null) return "Data a confirmar";
  if (days < 0) return "Vencimento pendente";
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Amanhã";
  if (days <= 7) return `Em ${days} dias`;

  const parsed = parseDueDate(dueDate);
  if (!parsed) return "Data a confirmar";
  return format(parsed, "dd 'de' MMM", { locale: ptBR });
}

export function UpcomingPaymentsCard({
  payments,
  onPaymentClick,
}: UpcomingPaymentsCardProps) {
  if (payments.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          Próximos Vencimentos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-border">
          {payments.map((payment) => (
            <button
              key={payment.id}
              onClick={() => onPaymentClick?.(payment.project_id)}
              className="w-full flex items-center gap-3 py-3 first:pt-0 last:pb-0 text-left hover:bg-muted/50 -mx-3 px-3 rounded-lg transition-colors group"
            >
              <div className="rounded-full bg-muted p-1.5 shrink-0">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-caption font-medium truncate">
                  {payment.description}
                </p>
                <p className="text-tiny text-muted-foreground truncate">
                  {payment.project_name}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-caption font-semibold">
                  {formatCurrency(payment.amount)}
                </p>
                <p className={`text-tiny ${getUrgencyClass(payment.due_date)}`}>
                  {getUrgencyLabel(payment.due_date)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
