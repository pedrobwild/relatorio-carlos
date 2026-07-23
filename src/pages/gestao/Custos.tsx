/**
 * /gestao/custos — Consolidação de custos por obra (Onda B1, staff-only).
 *
 * KPIs: Orçado × Comprometido × Realizado × Saldo × EAC × Variação.
 * Tabela por categoria com alerta visual quando (Comprometido + Realizado) > Orçado.
 * Export CSV do detalhamento.
 *
 * Cálculo 100% no banco via `get_project_cost_summary` / `get_project_cost_totals`
 * (SECURITY DEFINER, guard is_staff + has_project_access). Nunca referenciar em
 * superfícies do cliente.
 */
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Coins, Download, LineChart as LineIcon, Wallet } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader, EmptyState } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { useCostSCurveWeekly, useCostSummary, useCostTotals } from "@/hooks/useCosts";
import type { CostSummaryRow } from "@/infra/repositories/costs.repository";
import { cn } from "@/lib/utils";

function formatBRL(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Number(value).toFixed(1)}%`;
}

interface EnrichedRow extends CostSummaryRow {
  eac: number;
  variacao: number;
  variacao_pct: number | null;
}

function computeEac(row: CostSummaryRow): {
  eac: number;
  variacao: number;
  variacao_pct: number | null;
} {
  // EAC = realizado + comprometido + max(0, orcado - realizado - comprometido)
  const remainingBudget = Math.max(row.orcado - row.realizado - row.comprometido, 0);
  const eac = row.realizado + row.comprometido + remainingBudget;
  const variacao = eac - row.orcado;
  const variacao_pct = row.orcado > 0 ? (variacao / row.orcado) * 100 : null;
  return { eac, variacao, variacao_pct };
}

function toCsv(rows: EnrichedRow[]): string {
  const header = [
    "Categoria",
    "Orcado",
    "Comprometido",
    "Realizado",
    "Saldo",
    "Consumido (%)",
    "EAC",
    "Variacao",
    "Variacao (%)",
    "Compras",
  ];
  const body = rows.map((r) => [
    r.category,
    r.orcado.toFixed(2),
    r.comprometido.toFixed(2),
    r.realizado.toFixed(2),
    r.saldo.toFixed(2),
    r.consumido_pct === null ? "" : r.consumido_pct.toFixed(2),
    r.eac.toFixed(2),
    r.variacao.toFixed(2),
    r.variacao_pct === null ? "" : r.variacao_pct.toFixed(2),
    String(r.purchases_count),
  ]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [header, ...body]
    .map((row) => row.map((c) => escape(String(c))).join(";"))
    .join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\ufeff" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Custos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectsQ = useProjectsQuery({ status: "active" });
  const projects = projectsQ.data ?? [];

  const selectedProjectId =
    searchParams.get("projectId") ?? projects[0]?.id ?? undefined;

  const summaryQ = useCostSummary(selectedProjectId);
  const totalsQ = useCostTotals(selectedProjectId);
  const sCurveQ = useCostSCurveWeekly(selectedProjectId);

  const setSelectedProject = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("projectId", id);
    setSearchParams(next, { replace: true });
  };

  const rows: EnrichedRow[] = useMemo(
    () =>
      (summaryQ.data ?? []).map((r) => ({ ...r, ...computeEac(r) })),
    [summaryQ.data],
  );
  const totals = totalsQ.data;

  const chartData = useMemo(
    () =>
      (sCurveQ.data ?? []).map((p) => ({
        week: p.week_start.slice(5), // MM-DD
        planejado: Math.round(p.planned_cum),
        realizado: Math.round(p.realized_cum),
        comprometido: Math.round(p.committed_projected_cum),
      })),
    [sCurveQ.data],
  );

  const overBudgetCount = useMemo(
    () =>
      rows.filter(
        (r) => r.orcado > 0 && r.comprometido + r.realizado > r.orcado,
      ).length,
    [rows],
  );

  const selectedProjectName = useMemo(
    () => projects.find((p) => p.id === selectedProjectId)?.name ?? "obra",
    [projects, selectedProjectId],
  );

  const handleExport = () => {
    if (rows.length === 0) return;
    const safeName = selectedProjectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`custos-${safeName}-${stamp}.csv`, toCsv(rows));
  };

  const isLoading = projectsQ.isLoading || summaryQ.isLoading || totalsQ.isLoading;

  return (
    <PageContainer>
      <PageHeader
        title="Custos"
        description="Comparativo Orçado × Comprometido × Realizado por categoria, com EAC e variação."
      />

      {projectsQ.isLoading ? (
        <div className="space-y-4 mt-6">
          <Skeleton className="h-11 w-full max-w-sm" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Coins}
            title="Nenhuma obra ativa"
            description="Ative uma obra em /gestao/painel-obras para consolidar custos."
          />
        </div>
      ) : (
        <div className="space-y-6 mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-[220px] sm:w-72">
              <label className="text-xs font-medium text-muted-foreground">
                Obra
              </label>
              <Select
                value={selectedProjectId ?? ""}
                onValueChange={setSelectedProject}
              >
                <SelectTrigger className="h-11 mt-1">
                  <SelectValue placeholder="Selecione uma obra" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleExport}
              variant="outline"
              disabled={rows.length === 0}
              className="gap-2 h-11"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label="Orçado"
              value={formatBRL(totals?.orcado)}
              loading={isLoading}
            />
            <KpiCard
              label="Comprometido"
              value={formatBRL(totals?.comprometido)}
              loading={isLoading}
              tone="warning"
            />
            <KpiCard
              label="Realizado"
              value={formatBRL(totals?.realizado)}
              loading={isLoading}
              tone="info"
            />
            <KpiCard
              label="EAC (estimativa final)"
              value={formatBRL(totals?.eac)}
              loading={isLoading}
            />
            <KpiCard
              label="Variação vs orçado"
              value={
                totals
                  ? `${totals.variacao >= 0 ? "+" : ""}${formatBRL(
                      totals.variacao,
                    )}`
                  : "—"
              }
              hint={
                totals?.variacao_pct !== null && totals?.variacao_pct !== undefined
                  ? `${totals.variacao_pct >= 0 ? "+" : ""}${totals.variacao_pct.toFixed(
                      1,
                    )}%`
                  : undefined
              }
              loading={isLoading}
              tone={
                totals && totals.variacao > 0
                  ? "danger"
                  : totals && totals.variacao < 0
                    ? "success"
                    : "neutral"
              }
            />
          </div>

          {overBudgetCount > 0 && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div className="text-sm">
                  <span className="font-medium text-destructive">
                    {overBudgetCount}{" "}
                    {overBudgetCount === 1
                      ? "categoria estourou"
                      : "categorias estouraram"}{" "}
                    o orçado.
                  </span>{" "}
                  <span className="text-muted-foreground">
                    Comprometido + Realizado excede o valor orçado.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Curva S financeira */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <LineIcon className="h-4 w-4 text-muted-foreground" />
                Curva S financeira — desembolso acumulado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sCurveQ.isLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : chartData.length === 0 ? (
                <EmptyState
                  icon={LineIcon}
                  title="Sem dados suficientes para a curva"
                  description="Cadastre datas planejadas de início/fim da obra e registre pedidos com data de emissão e pagamento para visualizar a curva S financeira."
                />
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) =>
                          v >= 1000
                            ? `${(v / 1000).toFixed(0)}k`
                            : String(v)
                        }
                        className="text-muted-foreground"
                        width={56}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => formatBRL(v)}
                      />
                      <Line
                        type="monotone"
                        dataKey="planejado"
                        name="Planejado"
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="comprometido"
                        name="Comprometido projetado"
                        stroke="hsl(var(--warning))"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="realizado"
                        name="Realizado"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-0.5 w-4 border-b-2 border-dashed border-muted-foreground" />
                      Planejado
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-0.5 w-4 bg-warning" />
                      Comprometido projetado
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-0.5 w-4 bg-primary" />
                      Realizado
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela por categoria */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Custos por categoria
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              {summaryQ.isLoading ? (
                <div className="px-6 pb-6 space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : rows.length === 0 ? (
                <div className="px-6 pb-6">
                  <EmptyState
                    icon={Coins}
                    title="Sem dados de custo ainda"
                    description="Importe o orçamento em /gestao/orcamentos e cadastre pedidos em /obra/:id/compras para ver a consolidação aqui."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Orçado</TableHead>
                        <TableHead className="text-right">Comprometido</TableHead>
                        <TableHead className="text-right">Realizado</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead className="min-w-[160px]">Consumido</TableHead>
                        <TableHead className="text-right">EAC</TableHead>
                        <TableHead className="text-right">Variação</TableHead>
                        <TableHead className="text-right">Compras</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const overBudget =
                          row.orcado > 0 &&
                          row.comprometido + row.realizado > row.orcado;
                        const nearLimit =
                          !overBudget &&
                          row.consumido_pct !== null &&
                          row.consumido_pct >= 85;
                        return (
                          <TableRow
                            key={row.category}
                            className={cn(
                              overBudget && "bg-destructive/5",
                            )}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {row.category}
                                {overBudget && (
                                  <Badge
                                    variant="destructive"
                                    className="gap-1 text-[10px]"
                                  >
                                    <AlertTriangle className="h-3 w-3" />
                                    Estourou
                                  </Badge>
                                )}
                                {nearLimit && (
                                  <Badge
                                    variant="outline"
                                    className="border-warning text-warning text-[10px]"
                                  >
                                    Perto do limite
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatBRL(row.orcado)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatBRL(row.comprometido)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatBRL(row.realizado)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right tabular-nums",
                                row.saldo < 0 && "text-destructive font-medium",
                              )}
                            >
                              {formatBRL(row.saldo)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={Math.min(
                                    Math.max(row.consumido_pct ?? 0, 0),
                                    100,
                                  )}
                                  className={cn(
                                    "h-2 flex-1",
                                    overBudget && "[&>div]:bg-destructive",
                                    nearLimit && "[&>div]:bg-warning",
                                  )}
                                />
                                <span className="text-xs tabular-nums text-muted-foreground w-12 text-right">
                                  {formatPct(row.consumido_pct)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatBRL(row.eac)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right tabular-nums",
                                row.variacao > 0 && "text-destructive font-medium",
                                row.variacao < 0 && "text-success",
                              )}
                            >
                              {row.variacao === 0
                                ? formatBRL(0)
                                : `${row.variacao > 0 ? "+" : ""}${formatBRL(row.variacao)}`}
                              {row.variacao_pct !== null && (
                                <div className="text-[10px] text-muted-foreground font-normal">
                                  {`${row.variacao_pct > 0 ? "+" : ""}${row.variacao_pct.toFixed(1)}%`}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.purchases_count}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
  tone?: "neutral" | "info" | "warning" | "success" | "danger";
}

function KpiCard({ label, value, hint, loading, tone = "neutral" }: KpiCardProps) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "success"
        ? "text-success"
        : tone === "warning"
          ? "text-warning"
          : tone === "info"
            ? "text-primary"
            : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <>
            <div className={cn("text-xl sm:text-2xl font-semibold tabular-nums", toneClass)}>
              {value}
            </div>
            {hint && (
              <p className={cn("text-xs mt-1 tabular-nums", toneClass)}>{hint}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
