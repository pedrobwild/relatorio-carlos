import {
  Check,
  Clock,
  Calendar,
  Download,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useProject } from "@/contexts/ProjectContext";
import {
  useProjectPayments,
  useMarkPaymentPaid,
  ProjectPayment,
} from "@/hooks/useProjectPayments";
import { useUserRole } from "@/hooks/useUserRole";
import { BoletoUploadButton } from "@/components/BoletoUploadButton";
import { downloadBoleto } from "@/hooks/useBoletoUpload";

const FinanceiroContent = () => {
  const { project, loading: projectLoading } = useProject();
  const { data: payments = [], isLoading: paymentsLoading } =
    useProjectPayments(project?.id);
  const { isStaff, loading: roleLoading } = useUserRole();
  const markPaidMutation = useMarkPaymentPaid();

  const today = new Date();

  /** Parse date string safely – handles YYYY-MM-DD and full ISO timestamps */
  const parseLocal = (d: string): Date => {
    if (!d) return new Date(NaN);
    // If it's a plain YYYY-MM-DD, parse as local to avoid UTC off-by-one in BRT
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [year, month, day] = d.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    // Otherwise parse as-is (ISO timestamp, etc.)
    return new Date(d);
  };

  const getPaymentStatus = (
    payment: ProjectPayment,
  ): "paid" | "pending" | "upcoming" => {
    if (payment.paid_at) return "paid";
    if (!payment.due_date) return "pending";
    const dueDate = parseLocal(payment.due_date);
    if (dueDate <= today) return "pending";
    return "upcoming";
  };

  const getUrgency = (
    payment: ProjectPayment,
  ): "overdue" | "urgent" | "approaching" | "normal" => {
    if (payment.paid_at) return "normal";
    if (!payment.due_date) return "normal";
    const dueDate = parseLocal(payment.due_date);
    const daysUntilDue = differenceInDays(dueDate, today);
    if (daysUntilDue < 0) return "overdue";
    if (daysUntilDue <= 2) return "urgent";
    if (daysUntilDue <= 5) return "approaching";
    return "normal";
  };

  const getDaysLabel = (payment: ProjectPayment) => {
    if (payment.paid_at) return null;
    if (!payment.due_date)
      return { text: "Em definição", color: "text-muted-foreground" };
    const dueDate = parseLocal(payment.due_date);
    const days = differenceInDays(dueDate, today);
    if (days < 0)
      return {
        text: `${Math.abs(days)} dias em atraso`,
        color: "text-destructive",
      };
    if (days === 0)
      return { text: "Vence hoje", color: "text-[hsl(var(--warning))]" };
    if (days === 1)
      return { text: "Vence amanhã", color: "text-[hsl(var(--warning))]" };
    if (days <= 5)
      return {
        text: `Vence em ${days} dias`,
        color: "text-[hsl(var(--warning))]",
      };
    return null;
  };

  const totalValue =
    project?.contract_value || payments.reduce((sum, p) => sum + p.amount, 0);
  const paidAmount = payments
    .filter((p) => p.paid_at)
    .reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = totalValue - paidAmount;
  const paidCount = payments.filter((p) => p.paid_at).length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? parseLocal(date) : date;
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  };

  const formatShortDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    const d = typeof date === "string" ? parseLocal(date) : date;
    if (isNaN(d.getTime())) return "—";
    return format(d, "dd/MM", { locale: ptBR });
  };

  const handleTogglePaid = (payment: ProjectPayment) => {
    markPaidMutation.mutate({ paymentId: payment.id, paid: !payment.paid_at });
  };

  const isLoading = projectLoading || paymentsLoading || roleLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!project || payments.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          Nenhum pagamento cadastrado para esta obra
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div>
        {/* Desktop: Two-column layout */}
        <div className="hidden md:grid md:grid-cols-[1fr_1.5fr] md:divide-x md:divide-border">
          {/* Left Column: Summary */}
          <div className="p-6 sticky top-16 h-fit">
            <p className="text-caption mb-1">Valor total do contrato</p>
            <p className="text-3xl font-bold text-foreground tracking-tight mb-6">
              {formatCurrency(totalValue)}
            </p>

            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[hsl(var(--success))]" />
                  <span className="text-caption font-medium">Pago</span>
                </div>
                <p className="text-h3 text-[hsl(var(--success))]">
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
                  {paidCount} de {payments.length} parcelas pagas
                </span>
                <span className="font-semibold">
                  {totalValue > 0
                    ? ((paidAmount / totalValue) * 100).toFixed(0)
                    : 0}
                  %
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full transition-all duration-500"
                  style={{
                    width: `${totalValue > 0 ? (paidAmount / totalValue) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <p className="text-tiny text-center mt-4">
              Última atualização: {formatDate(today)}
            </p>
          </div>

          {/* Right Column: Installments */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h2">Histórico de Parcelas</h2>
              {isStaff && (
                <Badge variant="outline" className="text-xs">
                  Equipe: pode editar
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              {payments.map((payment) => {
                const daysLabel = getDaysLabel(payment);
                const urgency = getUrgency(payment);
                return (
                  <div
                    key={payment.id}
                    className={`p-4 rounded-lg border transition-all hover:shadow-sm ${
                      payment.paid_at
                        ? "bg-card border-border"
                        : urgency === "overdue" || urgency === "urgent"
                          ? "bg-destructive/5 border-destructive/30"
                          : urgency === "approaching"
                            ? "bg-warning/5 border-warning/30"
                            : "bg-card border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-body font-medium truncate mb-1">
                          {payment.description}
                        </p>
                        <div className="flex items-center gap-3 text-caption">
                          {payment.paid_at ? (
                            <span className="flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                              Pago em {formatShortDate(payment.paid_at)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              Vencimento:{" "}
                              {payment.due_date
                                ? formatDate(payment.due_date)
                                : "Em definição"}
                            </span>
                          )}
                          {daysLabel && (
                            <span className={`font-medium ${daysLabel.color}`}>
                              {daysLabel.text}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <p className="text-h3 tabular-nums">
                          {formatCurrency(payment.amount)}
                        </p>
                        {isStaff ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {payment.paid_at ? "Pago" : "Pendente"}
                            </span>
                            <Switch
                              checked={!!payment.paid_at}
                              onCheckedChange={() => handleTogglePaid(payment)}
                              disabled={markPaidMutation.isPending}
                            />
                          </div>
                        ) : payment.paid_at ? (
                          <Badge variant="secondary" className="text-tiny">
                            Quitado
                          </Badge>
                        ) : payment.boleto_path ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-11 min-h-[44px] px-3 text-xs hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                            onClick={() => downloadBoleto(payment.boleto_path!)}
                          >
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            Boleto
                          </Button>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-tiny text-muted-foreground"
                          >
                            Aguardando pagamento
                          </Badge>
                        )}
                        {isStaff && !payment.paid_at && (
                          <BoletoUploadButton
                            paymentId={payment.id}
                            projectId={project.id}
                            boletoPath={payment.boleto_path}
                          />
                        )}
                        {isStaff && payment.boleto_path && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-11 min-h-[44px] px-3 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => downloadBoleto(payment.boleto_path!)}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden">
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
                  {paidCount} de {payments.length} parcelas pagas
                </span>
                <span>
                  {totalValue > 0
                    ? ((paidAmount / totalValue) * 100).toFixed(0)
                    : 0}
                  %
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full transition-all duration-500"
                  style={{
                    width: `${totalValue > 0 ? (paidAmount / totalValue) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            {isStaff && (
              <div className="mt-4">
                <Badge variant="outline" className="text-xs">
                  Equipe: pode editar pagamentos
                </Badge>
              </div>
            )}
          </div>

          <div className="divide-y divide-border">
            {payments.map((payment) => {
              const daysLabel = getDaysLabel(payment);
              return (
                <div
                  key={payment.id}
                  className="px-4 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-body font-medium truncate mb-1">
                        {payment.description}
                      </p>
                      <div className="flex items-center gap-2 text-caption">
                        {payment.paid_at ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-foreground" />
                            <span>
                              Pago em {formatShortDate(payment.paid_at)}
                            </span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              Vencimento:{" "}
                              {payment.due_date
                                ? formatDate(payment.due_date)
                                : "Em definição"}
                            </span>
                          </>
                        )}
                      </div>
                      {daysLabel && (
                        <p
                          className={`text-caption mt-1 font-medium ${daysLabel.color}`}
                        >
                          {daysLabel.text}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-h3 tabular-nums">
                        {formatCurrency(payment.amount)}
                      </p>
                      {isStaff ? (
                        <div className="flex items-center gap-2 mt-2 justify-end">
                          <span className="text-xs text-muted-foreground">
                            {payment.paid_at ? "Pago" : "Pend."}
                          </span>
                          <Switch
                            checked={!!payment.paid_at}
                            onCheckedChange={() => handleTogglePaid(payment)}
                            disabled={markPaidMutation.isPending}
                          />
                        </div>
                      ) : payment.paid_at ? (
                        <span className="text-caption">Quitado</span>
                      ) : payment.boleto_path ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-11 min-h-[44px] px-3 mt-1 text-xs text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => downloadBoleto(payment.boleto_path!)}
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Boleto
                        </Button>
                      ) : (
                        <span className="text-tiny text-muted-foreground">
                          Aguardando pagamento
                        </span>
                      )}
                      {isStaff && !payment.paid_at && (
                        <div className="mt-1">
                          <BoletoUploadButton
                            paymentId={payment.id}
                            projectId={project.id}
                            boletoPath={payment.boleto_path}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-4 text-center">
            <p className="text-caption">
              Última atualização: {formatDate(today)}
            </p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default FinanceiroContent;
