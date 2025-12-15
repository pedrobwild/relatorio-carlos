import { ArrowLeft, DollarSign, Check, Clock, Calendar, CreditCard, AlertCircle, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer } from "recharts";
import bwildLogo from "@/assets/bwild-logo.png";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentInstallment {
  id: number;
  stage: string;
  amount: number;
  dueDate: Date;
  status: "paid" | "pending" | "upcoming";
  isForecast?: boolean;
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

  const installments: PaymentInstallment[] = [
    {
      id: 1,
      stage: "Assinatura do Contrato",
      amount: 11000,
      dueDate: addBusinessDays(contractSignatureDate, 2),
      status: "paid",
    },
    {
      id: 2,
      stage: "Início da Obra",
      amount: 29333.33,
      dueDate: addBusinessDays(constructionStartDate, 2),
      status: "paid",
    },
    {
      id: 3,
      stage: "25 dias corridos após início da obra",
      amount: 29333.33,
      dueDate: addBusinessDays(addDays(constructionStartDate, 25), 2),
      status: "paid",
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

  const getStatusBadge = (status: string, isForecast?: boolean) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20">
            <Check className="w-3 h-3 mr-1" />
            Pago
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20">
            <Clock className="w-3 h-3 mr-1" />
            A vencer
          </Badge>
        );
      case "upcoming":
        return (
          <Badge className="bg-slate-500/10 text-slate-600 border-slate-200 hover:bg-slate-500/20">
            <Calendar className="w-3 h-3 mr-1" />
            {isForecast ? "Previsão" : "A vencer"}
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor Total</p>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(totalValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10">
                    <Check className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor Pago</p>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(paidAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo a Pagar</p>
                    <p className="text-lg font-bold text-amber-600">{formatCurrency(totalValue - paidAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Section */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Progresso de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {paidCount} de {installments.length} parcelas pagas
                </span>
                <span className="font-semibold text-foreground">{paidPercentage.toFixed(0)}%</span>
              </div>
              <Progress value={paidPercentage} className="h-3" />
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
                      <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installments.map((installment) => (
                      <TableRow 
                        key={installment.id}
                        className={installment.status === "paid" ? "bg-emerald-500/5" : ""}
                      >
                        <TableCell className="font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{installment.stage}</span>
                            {installment.isForecast && (
                              <span className="text-[10px] text-muted-foreground italic">(previsão)</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          {formatCurrency(installment.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-foreground">{formatDate(installment.dueDate)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(installment.status, installment.isForecast)}
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
                    className={`p-4 space-y-3 ${installment.status === "paid" ? "bg-emerald-500/5" : ""}`}
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
                      {getStatusBadge(installment.status, installment.isForecast)}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Venc: {formatDate(installment.dueDate)}</span>
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
  );
};

export default Financeiro;
