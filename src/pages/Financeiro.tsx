import { ArrowLeft, Check, Clock, Calendar, Download, Loader2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import bwildLogo from "@/assets/bwild-logo-dark.png";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectPayments, useMarkPaymentPaid, ProjectPayment } from "@/hooks/useProjectPayments";
import { useUserRole } from "@/hooks/useUserRole";
import { BoletoUploadButton } from "@/components/BoletoUploadButton";
import { downloadBoleto } from "@/hooks/useBoletoUpload";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectSubNav } from "@/components/layout/ProjectSubNav";

const Financeiro = () => {
  const { project, loading: projectLoading } = useProject();
  const { data: payments = [], isLoading: paymentsLoading } = useProjectPayments(project?.id);
  const { isAdmin, loading: roleLoading } = useUserRole();
  const markPaidMutation = useMarkPaymentPaid();
  const { paths } = useProjectNavigation();

  // Parse date string as local date to avoid UTC timezone offset issues
  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const getPaymentStatus = (payment: ProjectPayment): "paid" | "pending" | "upcoming" => {
    if (payment.paid_at) return "paid";
    if (!payment.due_date) return "pending";
    const dueDate = parseLocalDate(payment.due_date);
    if (dueDate <= todayLocal) return "pending";
    return "upcoming";
  };

  const getUrgency = (payment: ProjectPayment): "overdue" | "urgent" | "approaching" | "normal" => {
    if (payment.paid_at) return "normal";
    if (!payment.due_date) return "normal";
    const dueDate = parseLocalDate(payment.due_date);
    const daysUntilDue = differenceInDays(dueDate, todayLocal);
    if (daysUntilDue < 0) return "overdue";
    if (daysUntilDue <= 2) return "urgent";
    if (daysUntilDue <= 5) return "approaching";
    return "normal";
  };

  const getDaysLabel = (payment: ProjectPayment) => {
    if (payment.paid_at) return null;
    if (!payment.due_date) return { text: "Em definição", color: "text-muted-foreground" };
    const dueDate = parseLocalDate(payment.due_date);
    const days = differenceInDays(dueDate, todayLocal);
    if (days < 0) return { text: `${Math.abs(days)} dias em atraso`, color: "text-red-600" };
    if (days === 0) return { text: "Vence hoje", color: "text-red-600" };
    if (days === 1) return { text: "Vence amanhã", color: "text-amber-600" };
    if (days <= 5) return { text: `Vence em ${days} dias`, color: "text-amber-600" };
    return null;
  };

  const totalValue = project?.contract_value ?? payments.reduce((sum, p) => sum + p.amount, 0);
  const paidAmount = payments.filter(p => p.paid_at).reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = totalValue - paidAmount;
  const paidCount = payments.filter(p => p.paid_at).length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  };

  const formatShortDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, "dd/MM", { locale: ptBR });
  };

  const handleTogglePaid = (payment: ProjectPayment) => {
    markPaidMutation.mutate({
      paymentId: payment.id,
      paid: !payment.paid_at,
    });
  };

  const isLoading = projectLoading || paymentsLoading || roleLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
        <div className="flex-1 max-w-5xl mx-auto w-full p-6">
          <div className="space-y-4">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Projeto não encontrado</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
        {/* Header */}
        <PageHeader
          title="Financeiro"
          backTo={paths.relatorio}
          breadcrumbs={[
            { label: "Minhas Obras", href: "/minhas-obras" },
            { label: project?.name || "Obra", href: paths.relatorio },
            { label: "Financeiro" },
          ]}
        />
        <ProjectSubNav />

        {/* Content */}
        <div className="flex-1 max-w-5xl mx-auto w-full">
          {payments.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Nenhum pagamento cadastrado para esta obra</p>
            </div>
          ) : (
            <>
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
                      <span>{paidCount} de {payments.length} parcelas pagas</span>
                      <span className="font-semibold">{totalValue > 0 ? ((paidAmount / totalValue) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-foreground rounded-full transition-all duration-500"
                        style={{ width: `${totalValue > 0 ? (paidAmount / totalValue) * 100 : 0}%` }}
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
                    {isAdmin && (
                      <Badge variant="outline" className="text-xs">
                        Admin: pode editar
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
                                ? "bg-rose-500/5 border-rose-500/30" 
                                : urgency === "approaching"
                                  ? "bg-amber-500/5 border-amber-500/30"
                                  : "bg-card border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-body font-medium truncate">
                                  {payment.description}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-3 text-caption">
                                {payment.paid_at ? (
                                  <span className="flex items-center gap-1.5">
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    Pago em {formatShortDate(payment.paid_at)}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Vencimento: {payment.due_date ? formatDate(payment.due_date) : 'Em definição'}
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
                              
                              {isAdmin ? (
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
                                <Badge variant="secondary" className="text-tiny">Quitado</Badge>
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
                                <Badge variant="outline" className="text-tiny text-muted-foreground">Aguardando boleto</Badge>
                              )}
                              
                              {isAdmin && !payment.paid_at && (
                                <BoletoUploadButton
                                  paymentId={payment.id}
                                  projectId={project.id}
                                  boletoPath={payment.boleto_path}
                                />
                              )}
                              
                              {isAdmin && payment.boleto_path && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground min-h-auto"
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
                      <span>{paidCount} de {payments.length} parcelas pagas</span>
                      <span>{totalValue > 0 ? ((paidAmount / totalValue) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-foreground rounded-full transition-all duration-500"
                        style={{ width: `${totalValue > 0 ? (paidAmount / totalValue) * 100 : 0}%` }}
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

                {/* Installments List */}
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
                                  <span>Pago em {formatShortDate(payment.paid_at)}</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Vencimento: {payment.due_date ? formatDate(payment.due_date) : 'Em definição'}</span>
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
                              {formatCurrency(payment.amount)}
                            </p>
                            
                            {isAdmin ? (
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
                              <span className="text-tiny text-muted-foreground">Aguardando boleto</span>
                            )}
                            
                            {isAdmin && !payment.paid_at && (
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
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Financeiro;
