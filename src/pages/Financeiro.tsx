import { ArrowLeft, Check, Clock, Calendar, Download, FileX, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import bwildLogo from "@/assets/bwild-logo.png";
import { addDays, format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentInstallment {
  id: number;
  stage: string;
  amount: number;
  dueDate: Date;
  status: "paid" | "pending" | "upcoming";
  isForecast?: boolean;
  urgency?: "overdue" | "urgent" | "approaching" | "normal";
  paidDate?: Date;
}

const Financeiro = () => {
  // Contract and project dates
  const contractSignatureDate = new Date(2025, 5, 17); // 17/06/2025
  const constructionStartDate = new Date(2025, 6, 1); // 01/07/2025
  const projectEndDate = new Date(2025, 8, 14); // 14/09/2025 (from schedule)
  const reportDate = new Date(2025, 8, 8); // 08/09/2025 (current report date)

  // Calculate due dates (adding 2 business days approximation)
  const addBusinessDays = (date: Date, days: number): Date => {
    let result = new Date(date);
    let added = 0;
    while (added < days) {
      result = addDays(result, 1);
      const dayOfWeek = result.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        added++;
      }
    }
    return result;
  };

  // Calculate urgency based on days until due
  const getUrgency = (dueDate: Date, status: string): "overdue" | "urgent" | "approaching" | "normal" => {
    if (status === "paid") return "normal";
    const daysUntilDue = differenceInDays(dueDate, reportDate);
    if (daysUntilDue < 0) return "overdue";
    if (daysUntilDue <= 2) return "urgent";
    if (daysUntilDue <= 5) return "approaching";
    return "normal";
  };

  const installmentsRaw: Omit<PaymentInstallment, "urgency">[] = [
    {
      id: 1,
      stage: "Assinatura do Contrato",
      amount: 11000,
      dueDate: addBusinessDays(contractSignatureDate, 2),
      status: "paid",
      paidDate: new Date(2025, 5, 18),
    },
    {
      id: 2,
      stage: "Início da Obra",
      amount: 29333.33,
      dueDate: addBusinessDays(constructionStartDate, 2),
      status: "paid",
      paidDate: new Date(2025, 6, 2),
    },
    {
      id: 3,
      stage: "25 dias corridos após início da obra",
      amount: 29333.33,
      dueDate: addBusinessDays(addDays(constructionStartDate, 25), 2),
      status: "paid",
      paidDate: new Date(2025, 6, 28),
    },
    {
      id: 4,
      stage: "45 dias corridos após início da obra",
      amount: 29333.34,
      dueDate: addBusinessDays(addDays(constructionStartDate, 45), 2),
      status: "pending",
    },
    {
      id: 5,
      stage: "Assinatura do Termo de Entrega",
      amount: 11000,
      dueDate: addBusinessDays(projectEndDate, 2),
      status: "upcoming",
      isForecast: true,
    },
  ];

  const installments: PaymentInstallment[] = installmentsRaw.map((inst) => ({
    ...inst,
    urgency: getUrgency(inst.dueDate, inst.status),
  }));

  const totalValue = 110000;
  const paidAmount = installments
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const remainingAmount = totalValue - paidAmount;
  const paidCount = installments.filter((i) => i.status === "paid").length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const formatShortDate = (date: Date) => {
    return format(date, "dd/MM", { locale: ptBR });
  };

  const getDaysLabel = (installment: PaymentInstallment) => {
    if (installment.status === "paid") return null;
    const days = differenceInDays(installment.dueDate, reportDate);
    if (days < 0) return { text: `${Math.abs(days)} dias em atraso`, color: "text-red-600" };
    if (days === 0) return { text: "Vence hoje", color: "text-red-600" };
    if (days === 1) return { text: "Vence amanhã", color: "text-amber-600" };
    if (days <= 5) return { text: `Vence em ${days} dias`, color: "text-amber-600" };
    return null;
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
        {/* Header - Clean banking style */}
        <div className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link to="/relatorio">
              <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 rounded-full min-h-auto">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2.5">
              <img src={bwildLogo} alt="Bwild" className="h-5 w-auto" />
              <span className="text-muted-foreground/30">|</span>
              <h1 className="text-h2">Financeiro</h1>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-5xl mx-auto w-full">
          {/* Desktop: Two-column layout */}
          <div className="hidden md:grid md:grid-cols-[1fr_1.5fr] md:divide-x md:divide-border">
            {/* Left Column: Summary */}
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
                  <p className="text-h3 text-emerald-700">{formatCurrency(paidAmount)}</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-caption font-medium">A pagar</span>
                  </div>
                  <p className="text-h3">{formatCurrency(remainingAmount)}</p>
                </div>
              </div>

              {/* Progress */}
              <div className="p-4 rounded-lg bg-card border border-border">
                <div className="flex items-center justify-between text-caption mb-2">
                  <span>{paidCount} de {installments.length} parcelas pagas</span>
                  <span className="font-semibold">{((paidAmount / totalValue) * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-foreground rounded-full transition-all duration-500"
                    style={{ width: `${(paidAmount / totalValue) * 100}%` }}
                  />
                </div>
              </div>

              <p className="text-tiny text-center mt-4">
                Última atualização: {formatDate(reportDate)}
              </p>
            </div>

            {/* Right Column: Installments */}
            <div className="p-6">
              <h2 className="text-h2 mb-4">Histórico de Parcelas</h2>
              <div className="space-y-2">
                {installments.map((installment) => {
                  const daysLabel = getDaysLabel(installment);
                  
                  return (
                    <div 
                      key={installment.id}
                      className={`p-4 rounded-lg border transition-all hover:shadow-sm ${
                        installment.status === "paid" 
                          ? "bg-card border-border" 
                          : daysLabel?.color.includes("red") 
                            ? "bg-rose-500/5 border-rose-500/30" 
                            : daysLabel?.color.includes("amber")
                              ? "bg-amber-500/5 border-amber-500/30"
                              : "bg-card border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-body font-medium truncate">
                              {installment.stage}
                            </p>
                            {installment.isForecast && (
                              <span className="shrink-0 text-tiny bg-muted px-1.5 py-0.5 rounded">
                                previsão
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 text-caption">
                            {installment.status === "paid" ? (
                              <span className="flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Pago em {formatShortDate(installment.paidDate!)}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                Vencimento: {formatDate(installment.dueDate)}
                              </span>
                            )}
                            {daysLabel && (
                              <span className={`font-medium ${daysLabel.color}`}>
                                {daysLabel.text}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-h3 tabular-nums mb-1">
                            {formatCurrency(installment.amount)}
                          </p>
                          
                          {installment.status === "paid" ? (
                            <Badge variant="secondary" className="text-tiny">Quitado</Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-3 text-xs hover:bg-primary/10 hover:text-primary hover:border-primary/30 min-h-auto"
                            >
                              <Download className="w-3.5 h-3.5 mr-1.5" />
                              Boleto
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

          {/* Mobile Layout - Unchanged */}
          <div className="md:hidden">
            {/* Summary Section */}
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
                  <span>{paidCount} de {installments.length} parcelas pagas</span>
                  <span>{((paidAmount / totalValue) * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-foreground rounded-full transition-all duration-500"
                    style={{ width: `${(paidAmount / totalValue) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Installments List */}
            <div className="divide-y divide-border">
              {installments.map((installment) => {
                const daysLabel = getDaysLabel(installment);
                
                return (
                  <div 
                    key={installment.id}
                    className="px-4 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-body font-medium truncate">
                            {installment.stage}
                          </p>
                          {installment.isForecast && (
                            <span className="shrink-0 text-tiny bg-muted px-1.5 py-0.5 rounded">
                              previsão
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-caption">
                          {installment.status === "paid" ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-foreground" />
                              <span>Pago em {formatShortDate(installment.paidDate!)}</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              <span>Vencimento: {formatDate(installment.dueDate)}</span>
                            </>
                          )}
                        </div>

                        {daysLabel && (
                          <p className={`text-caption mt-1 font-medium ${daysLabel.color}`}>
                            {daysLabel.text}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-h3 tabular-nums">
                          {formatCurrency(installment.amount)}
                        </p>
                        
                        {installment.status === "paid" ? (
                          <span className="text-caption">Quitado</span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 mt-1 text-xs text-primary hover:text-primary hover:bg-primary/10 min-h-auto"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Boleto
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-4 text-center">
              <p className="text-caption">
                Última atualização: {formatDate(reportDate)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Financeiro;
