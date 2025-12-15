import { ArrowLeft, DollarSign, Check, Clock, Calendar, CreditCard, AlertCircle, TrendingUp, AlertTriangle, Download, FileX } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer } from "recharts";
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
      paidDate: new Date(2025, 5, 18), // 18/06/2025
    },
    {
      id: 2,
      stage: "Início da Obra",
      amount: 29333.33,
      dueDate: addBusinessDays(constructionStartDate, 2),
      status: "paid",
      paidDate: new Date(2025, 6, 2), // 02/07/2025
    },
    {
      id: 3,
      stage: "25 dias corridos após início da obra",
      amount: 29333.33,
      dueDate: addBusinessDays(addDays(constructionStartDate, 25), 2),
      status: "paid",
      paidDate: new Date(2025, 6, 28), // 28/07/2025
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
  const paidPercentage = (paidAmount / totalValue) * 100;
  const paidCount = installments.filter((i) => i.status === "paid").length;

  // Generate chart data
  const generateChartData = () => {
    const data: { date: string; previsto: number; realizado: number | null; label: string }[] = [];
    
    let cumulativePlanned = 0;
    let cumulativePaid = 0;

    installments.forEach((installment, index) => {
      cumulativePlanned += installment.amount;
      
      // Only show actual payments up to report date
      if (installment.status === "paid") {
        cumulativePaid += installment.amount;
      }

      const isPastReportDate = installment.dueDate > reportDate;

      data.push({
        date: format(installment.dueDate, "dd/MM"),
        previsto: Math.round((cumulativePlanned / totalValue) * 100),
        realizado: isPastReportDate ? null : Math.round((cumulativePaid / totalValue) * 100),
        label: `Parcela ${index + 1}`,
      });
    });

    return data;
  };

  const chartData = generateChartData();

  const chartConfig = {
    previsto: {
      label: "Previsto",
      color: "hsl(var(--muted-foreground))",
    },
    realizado: {
      label: "Realizado",
      color: "hsl(var(--primary))",
    },
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return format(date, "dd/MM", { locale: ptBR });
  };

  const getStatusBadge = (installment: PaymentInstallment) => {
    const { status, isForecast, urgency } = installment;
    
    if (status === "paid") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20">
          <Check className="w-3 h-3 mr-1" />
          Pago
        </Badge>
      );
    }

    if (urgency === "overdue") {
      return (
        <Badge className="bg-red-500/10 text-red-600 border-red-300 hover:bg-red-500/20 animate-pulse">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Vencido
        </Badge>
      );
    }

    if (urgency === "urgent") {
      return (
        <Badge className="bg-red-500/10 text-red-600 border-red-300 hover:bg-red-500/20">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Vence em breve
        </Badge>
      );
    }

    if (urgency === "approaching") {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20">
          <Clock className="w-3 h-3 mr-1" />
          Próximo
        </Badge>
      );
    }

    if (isForecast) {
      return (
        <Badge className="bg-slate-500/10 text-slate-600 border-slate-200 hover:bg-slate-500/20">
          <Calendar className="w-3 h-3 mr-1" />
          Previsão
        </Badge>
      );
    }

    return (
      <Badge className="bg-slate-500/10 text-slate-600 border-slate-200 hover:bg-slate-500/20">
        <Clock className="w-3 h-3 mr-1" />
        A vencer
      </Badge>
    );
  };

  const getRowClassName = (installment: PaymentInstallment) => {
    if (installment.status === "paid") return "bg-emerald-500/5";
    if (installment.urgency === "overdue") return "bg-red-500/10 border-l-4 border-l-red-500";
    if (installment.urgency === "urgent") return "bg-red-500/5 border-l-4 border-l-red-400";
    if (installment.urgency === "approaching") return "bg-amber-500/5 border-l-4 border-l-amber-400";
    return "";
  };

  const getDaysUntilDueLabel = (installment: PaymentInstallment) => {
    if (installment.status === "paid") return null;
    const days = differenceInDays(installment.dueDate, reportDate);
    if (days < 0) return <span className="text-[10px] text-red-600 font-medium">{Math.abs(days)} dias atrasado</span>;
    if (days === 0) return <span className="text-[10px] text-red-600 font-medium">Vence hoje</span>;
    if (days === 1) return <span className="text-[10px] text-red-600 font-medium">Vence amanhã</span>;
    if (days <= 5) return <span className="text-[10px] text-amber-600 font-medium">em {days} dias</span>;
    return null;
  };

  return (
    <TooltipProvider>
    <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-primary/5 via-background to-background border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/relatorio">
              <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={bwildLogo} alt="Bwild" className="h-6 sm:h-7 w-auto" />
              <div className="h-5 w-px bg-border/60 hidden sm:block" />
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary hidden sm:block" />
                <h1 className="font-bold text-base sm:text-lg text-foreground">Financeiro</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Financial Summary - Premium Design */}
          <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card via-card to-primary/5">
            <CardContent className="p-0">
              {/* Main Value Section */}
              <div className="relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.08)_0%,transparent_50%)]" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
                
                <div className="relative p-6 pb-4">
                  {/* Total Value - Hero */}
                  <div className="text-center mb-6">
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                      Valor do Contrato
                    </p>
                    <p className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                      {formatCurrency(totalValue)}
                    </p>
                  </div>

                  {/* Split Values - Paid / Remaining */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Paid */}
                    <div className="relative bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/15">
                          <Check className="w-4 h-4 text-emerald-600" strokeWidth={2.5} />
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-emerald-600/80 font-medium">
                          Pago
                        </span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-emerald-600 tracking-tight">
                        {formatCurrency(paidAmount)}
                      </p>
                    </div>

                    {/* Remaining */}
                    <div className="relative bg-amber-500/5 rounded-xl p-4 border border-amber-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/15">
                          <Clock className="w-4 h-4 text-amber-600" strokeWidth={2.5} />
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-amber-600/80 font-medium">
                          Saldo
                        </span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-amber-600 tracking-tight">
                        {formatCurrency(totalValue - paidAmount)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Section - Full Width Bottom */}
              <div className="bg-muted/30 px-6 py-5 border-t border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-xs font-medium text-foreground uppercase tracking-wide">
                      Progresso
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-primary">{paidPercentage.toFixed(0)}%</span>
                    <span className="text-xs text-muted-foreground">concluído</span>
                  </div>
                </div>
                
                {/* Custom Progress Bar */}
                <div className="relative h-4 bg-muted rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-primary/80 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${paidPercentage}%` }}
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                  </div>
                  {/* Milestones */}
                  <div className="absolute inset-0 flex justify-between px-1">
                    {[0, 25, 50, 75, 100].map((milestone) => (
                      <div 
                        key={milestone}
                        className={`w-px h-full ${milestone <= paidPercentage ? 'bg-primary-foreground/30' : 'bg-muted-foreground/20'}`}
                        style={{ marginLeft: milestone === 0 ? '0' : undefined }}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Installments Counter */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1.5">
                    {installments.map((inst, idx) => (
                      <div 
                        key={idx}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${
                          inst.status === 'paid' 
                            ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' 
                            : inst.status === 'pending' 
                              ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                              : 'bg-muted-foreground/30'
                        }`}
                        title={inst.stage}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{paidCount}</span>/{installments.length} parcelas pagas
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Schedule Table */}
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="bg-primary-dark py-3 px-4">
              <CardTitle className="text-sm font-medium text-primary-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fluxo de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold text-foreground">Etapa</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Vencimento</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Pagamento</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Boleto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installments.map((installment) => (
                      <TableRow 
                        key={installment.id}
                        className={getRowClassName(installment)}
                      >
                        <TableCell className="font-medium text-foreground">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span>{installment.stage}</span>
                              {installment.isForecast && (
                                <span className="text-[10px] text-muted-foreground italic">(previsão)</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          {formatCurrency(installment.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-foreground">{formatDate(installment.dueDate)}</span>
                            </div>
                            {getDaysUntilDueLabel(installment)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {installment.status === "paid" && installment.paidDate ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="font-medium text-emerald-600">{formatDate(installment.paidDate)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(installment)}
                        </TableCell>
                        <TableCell className="text-center">
                          {installment.status === "paid" ? (
                            <div className="flex items-center justify-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/50 cursor-not-allowed">
                                    <FileX className="w-4 h-4 text-muted-foreground/50" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Boleto indisponível - parcela já quitada</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-primary/10"
                              title="Baixar boleto"
                            >
                              <Download className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden divide-y divide-border">
                {installments.map((installment) => (
                  <div 
                    key={installment.id}
                    className={`p-4 space-y-3 ${getRowClassName(installment)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-foreground text-sm leading-tight">
                          {installment.stage}
                          {installment.isForecast && (
                            <span className="text-[10px] text-muted-foreground italic ml-1">(previsão)</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(installment)}
                        {installment.status === "paid" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/50 cursor-not-allowed">
                                <FileX className="w-4 h-4 text-muted-foreground/50" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>Boleto indisponível - parcela já quitada</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-primary/10"
                            title="Baixar boleto"
                          >
                            <Download className="w-4 h-4 text-primary" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Venc: {formatDate(installment.dueDate)}</span>
                        </div>
                        {installment.status === "paid" && installment.paidDate && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-medium text-emerald-600">Pago em {formatDate(installment.paidDate)}</span>
                          </div>
                        )}
                        {getDaysUntilDueLabel(installment)}
                      </div>
                      <p className="font-bold text-foreground">
                        {formatCurrency(installment.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Financial Evolution Chart */}
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="bg-primary-dark py-3 px-4">
              <CardTitle className="text-sm font-medium text-primary-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Evolução Financeira
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-[280px] w-full">
                <ChartContainer config={chartConfig}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="colorPrevisto" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorRealizado" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        tickFormatter={(value) => `${value}%`}
                        domain={[0, 100]}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => (
                              <span className="font-medium">
                                {name === "previsto" ? "Previsto" : "Realizado"}: {value}%
                              </span>
                            )}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="previsto"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fill="url(#colorPrevisto)"
                        connectNulls={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="realizado"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        fill="url(#colorRealizado)"
                        connectNulls={false}
                      />
                      <ReferenceLine
                        y={paidPercentage}
                        stroke="hsl(var(--primary))"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-muted-foreground" style={{ borderStyle: 'dashed', borderWidth: '1px 0 0 0', borderColor: 'hsl(var(--muted-foreground))' }} />
                  <span className="text-muted-foreground">Previsto</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Realizado</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Note */}
          <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border border-border">
            <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Informações de Pagamento</p>
              <p>Forma de pagamento: Boleto bancário/transferência</p>
              <p>Prazo de vencimento: 2 dias úteis após a etapa</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default Financeiro;
