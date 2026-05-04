import { useMemo, useCallback } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileDown, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  NonConformity,
  NcSeverity,
  NcStatus,
} from "@/hooks/useNonConformities";
import { NC_CATEGORIES, formatBRL } from "./ncConstants";

interface Props {
  nonConformities: NonConformity[];
}

const severityLabels: Record<NcSeverity, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

const statusLabels: Record<NcStatus, string> = {
  open: "Aberta",
  in_treatment: "Em tratamento",
  pending_verification: "Verificação",
  pending_approval: "Aprovação",
  closed: "Encerrada",
  reopened: "Reaberta",
};

export function NcConsolidatedReport({ nonConformities }: Props) {
  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const total = nonConformities.length;
    const open = nonConformities.filter((nc) => nc.status !== "closed");
    const closed = nonConformities.filter((nc) => nc.status === "closed");
    const overdue = open.filter((nc) => nc.deadline && nc.deadline < today);
    const reincident = nonConformities.filter((nc) => nc.reopen_count > 0);

    const resolutionTimes = closed
      .filter((nc) => nc.resolved_at)
      .map((nc) =>
        differenceInDays(parseISO(nc.resolved_at!), parseISO(nc.created_at)),
      );
    const avgResolution =
      resolutionTimes.length > 0
        ? Math.round(
            resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length,
          )
        : null;

    const bySeverity = (
      ["critical", "high", "medium", "low"] as NcSeverity[]
    ).map((s) => ({
      severity: s,
      label: severityLabels[s],
      total: nonConformities.filter((nc) => nc.severity === s).length,
      open: open.filter((nc) => nc.severity === s).length,
    }));

    const byStatus = (
      [
        "open",
        "in_treatment",
        "pending_verification",
        "pending_approval",
        "reopened",
        "closed",
      ] as NcStatus[]
    ).map((s) => ({
      status: s,
      label: statusLabels[s],
      count: nonConformities.filter((nc) => nc.status === s).length,
    }));

    const byCategory = NC_CATEGORIES.map((cat) => {
      const catTotal = nonConformities.filter(
        (nc) => nc.category === cat,
      ).length;
      const openCount = open.filter((nc) => nc.category === cat).length;
      return { category: cat, total: catTotal, open: openCount };
    }).filter((c) => c.total > 0);

    const uncategorized = nonConformities.filter((nc) => !nc.category).length;

    // Financial totals
    const totalEstimated = nonConformities.reduce(
      (sum, nc) => sum + (nc.estimated_cost ?? 0),
      0,
    );
    const totalActual = nonConformities.reduce(
      (sum, nc) => sum + (nc.actual_cost ?? 0),
      0,
    );
    const openEstimated = open.reduce(
      (sum, nc) => sum + (nc.estimated_cost ?? 0),
      0,
    );
    const closedActual = closed.reduce(
      (sum, nc) => sum + (nc.actual_cost ?? 0),
      0,
    );

    return {
      total,
      openCount: open.length,
      closedCount: closed.length,
      overdueCount: overdue.length,
      reincidentCount: reincident.length,
      avgResolution,
      bySeverity,
      byStatus,
      byCategory,
      uncategorized,
      totalEstimated,
      totalActual,
      openEstimated,
      closedActual,
    };
  }, [nonConformities]);

  const handleExportCsv = useCallback(() => {
    const headers = [
      "Título",
      "Categoria",
      "Severidade",
      "Status",
      "Responsável",
      "Prazo",
      "Criada em",
      "Causa Raiz",
      "Custo Est.",
      "Custo Real",
      "Reaberturas",
    ];
    const rows = nonConformities.map((nc) => [
      nc.title,
      nc.category || "-",
      severityLabels[nc.severity],
      statusLabels[nc.status],
      nc.responsible_user_name || "-",
      nc.deadline ? format(parseISO(nc.deadline), "dd/MM/yyyy") : "-",
      format(parseISO(nc.created_at), "dd/MM/yyyy"),
      nc.root_cause || "-",
      nc.estimated_cost != null ? formatBRL(nc.estimated_cost) : "-",
      nc.actual_cost != null ? formatBRL(nc.actual_cost) : "-",
      nc.reopen_count.toString(),
    ]);
    // Add totals row
    rows.push([
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      stats.totalEstimated > 0 ? formatBRL(stats.totalEstimated) : "-",
      stats.totalActual > 0 ? formatBRL(stats.totalActual) : "-",
      "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-ncs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nonConformities, stats.totalEstimated, stats.totalActual]);

  if (nonConformities.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Relatório Consolidado
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={handleExportCsv}
          >
            <FileDown className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total },
            {
              label: "Abertas",
              value: stats.openCount,
              danger: stats.openCount > 0,
            },
            { label: "Encerradas", value: stats.closedCount },
            {
              label: "Vencidas",
              value: stats.overdueCount,
              danger: stats.overdueCount > 0,
            },
            { label: "Tempo médio (dias)", value: stats.avgResolution ?? "-" },
          ].map((k) => (
            <div
              key={k.label}
              className="text-center p-2 rounded-lg bg-muted/50"
            >
              <p
                className={`text-lg font-bold ${k.danger ? "text-destructive" : ""}`}
              >
                {k.value}
              </p>
              <p className="text-[10px] text-muted-foreground">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Financial summary */}
        {(stats.totalEstimated > 0 || stats.totalActual > 0) && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Impacto Financeiro
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stats.openEstimated > 0 && (
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-sm font-bold">
                    {formatBRL(stats.openEstimated)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Est. abertas
                  </p>
                </div>
              )}
              {stats.closedActual > 0 && (
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-sm font-bold">
                    {formatBRL(stats.closedActual)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Real encerradas
                  </p>
                </div>
              )}
              {stats.totalEstimated > 0 && (
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-sm font-bold">
                    {formatBRL(stats.totalEstimated)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Est. total
                  </p>
                </div>
              )}
              {stats.totalActual > 0 && (
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-sm font-bold">
                    {formatBRL(stats.totalActual)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Real total
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* By category */}
        {stats.byCategory.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Por Categoria
            </p>
            <div className="space-y-1">
              {stats.byCategory.map((c) => (
                <div
                  key={c.category}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <span>{c.category}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{c.total} total</span>
                    {c.open > 0 && (
                      <span className="text-destructive font-medium">
                        {c.open} abertas
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {stats.uncategorized > 0 && (
                <div className="flex items-center justify-between text-sm py-1 text-muted-foreground">
                  <span className="italic">Sem categoria</span>
                  <span className="text-xs">{stats.uncategorized}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* By severity */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Por Severidade
          </p>
          <div className="space-y-1">
            {stats.bySeverity.map((s) => (
              <div
                key={s.severity}
                className="flex items-center justify-between text-sm py-1"
              >
                <span>{s.label}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{s.total} total</span>
                  {s.open > 0 && (
                    <span className="text-destructive font-medium">
                      {s.open} abertas
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By status */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Por Status
          </p>
          <div className="flex flex-wrap gap-2">
            {stats.byStatus
              .filter((s) => s.count > 0)
              .map((s) => (
                <div
                  key={s.status}
                  className="flex items-center gap-1.5 text-xs bg-muted/50 rounded px-2 py-1"
                >
                  <span className="text-muted-foreground">{s.label}:</span>
                  <span className="font-medium">{s.count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Reincident indicator */}
        {stats.reincidentCount > 0 && (
          <p className="text-xs text-destructive">
            ⚠ {stats.reincidentCount} NC(s) reincidente(s) — atenção para
            causas-raiz.
          </p>
        )}

        {/* Financial impact total */}
        {stats.totalEstimated > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm font-semibold">
              Total de impacto financeiro estimado:{" "}
              {formatBRL(stats.totalEstimated)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
