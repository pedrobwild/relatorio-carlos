
/**
 * ObraDetailSheet — drawer lateral (Sheet) com resumo gerencial de uma obra.
 *
 * Aberto a partir do Painel de Obras (?obra=<id>). Consolida KPIs do snapshot
 * batch (avanço, custos, NCs, punch, lookahead) sem carregamentos adicionais.
 * Mini Curva S (planejado × realizado) reutiliza a RPC da Onda A via
 * useSCurveWeekly, com fetch habilitado apenas quando o Sheet está aberto.
 * Sem baseline/medições, renderiza EmptyState com CTA para /gestao/avanco-fisico.
 *
 * Regras de UX:
 *  - Largura desktop ~ 480–560px; mobile full-screen (`w-full`).
 *  - Fecha com Esc / X (comportamento nativo do Sheet Radix).
 *  - Deep-link: o pai controla via URL `?obra=<id>`.
 *  - Ctrl/Meta+click na linha da tabela mantém navegação direta (feito no pai).
 */
import * as React from "react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  DollarSign,
  ExternalLink,
  FileText,
  LineChart as LineChartIcon,
  ListChecks,
  Plus,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import type { PainelObra } from "@/hooks/usePainelObras";
import type { PortfolioSnapshotRow } from "@/hooks/usePortfolioSnapshot";
import { useLookahead } from "@/hooks/useLookahead";
import { useSCurveWeekly } from "@/hooks/useActivityProgress";
import { CriticidadeBadge } from "@/components/gestao/painel/CriticidadeBadge";
import type { SeverityBreakdown } from "@/lib/calculateObraSeverity";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── formatters ──────────────────────────────────────────────────────────────
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const fmtDateBR = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};
const fmtMoney = (v: number | null | undefined) =>
  v == null ? "—" : brl.format(v);
const fmtPct = (v: number | null | undefined, digits = 0) =>
  v == null ? "—" : `${v.toFixed(digits)}%`;

// Semântica de variação de custo (EAC vs orçado): positivo = estouro
// (destructive), negativo = economia (success), próximo de 0 = neutro.
function costToneClass(v: number | null | undefined): string {
  if (v == null) return "text-muted-foreground";
  if (v >= 5) return "text-destructive";
  if (v <= -5) return "text-success";
  if (v > 0) return "text-warning";
  return "text-foreground";
}

// ─── props ───────────────────────────────────────────────────────────────────
export interface ObraDetailSheetProps {
  obra: PainelObra | null;
  snapshot: PortfolioSnapshotRow | undefined;
  /** Breakdown de severidade (score + gatilhos) da obra. */
  severity?: SeverityBreakdown | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ObraDetailSheet({
  obra,
  snapshot,
  severity,
  open,
  onOpenChange,
}: ObraDetailSheetProps) {
  const projectId = obra?.id ?? null;
  const navigate = useNavigate();

  // Lookahead 14 dias, restrito à obra ativa. Só busca quando o Sheet abre.
  const lookahead = useLookahead(14, {
    projectIds: projectId ? [projectId] : [],
  });
  const nextActivities = useMemo(() => {
    if (!open || !projectId) return [];
    return lookahead.weeks.flatMap((w) => w.activities).slice(0, 6);
  }, [open, projectId, lookahead.weeks]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          // Mobile: full-screen; desktop: 480–560 px conforme breakpoint.
          "w-full sm:max-w-[480px] lg:max-w-[560px] p-0 flex flex-col gap-0",
          "bg-background",
        )}
        aria-label={obra ? `Resumo da obra ${obra.nome ?? ""}` : "Resumo da obra"}
      >
        {!obra ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {/* Header — sticky */}
            <SheetHeader className="px-5 pt-5 pb-3 border-b border-border-subtle bg-surface-sunken/60">
              <SheetTitle className="text-base font-semibold leading-tight truncate">
                {obra.customer_name ?? "Sem cliente"}
              </SheetTitle>
              <SheetDescription className="text-[13px] text-muted-foreground truncate">
                {obra.nome ?? "—"}
              </SheetDescription>
              <div className="pt-3 flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="default" className="h-8 gap-1.5">
                  <Link to={`/obra/${obra.id}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir obra
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                  <Link to={`/obra/${obra.id}/cronograma`}>
                    <CalendarClock className="h-3.5 w-3.5" />
                    Cronograma
                  </Link>
                </Button>
              </div>
            </SheetHeader>

            {/* Scroll body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {/* KPIs — grid 2×3 */}
              <section aria-label="Indicadores gerenciais">
                <div className="grid grid-cols-2 gap-2">
                  <KpiTile
                    icon={Activity}
                    label="Avanço físico"
                    value={fmtPct(snapshot?.weighted_progress_pct ?? 0, 0)}
                    progress={snapshot?.weighted_progress_pct ?? null}
                  />
                  <KpiTile
                    icon={DollarSign}
                    label="Variação (EAC)"
                    value={fmtPct(snapshot?.variacao_pct, 1)}
                    valueClass={costToneClass(snapshot?.variacao_pct)}
                    trailingIcon={
                      snapshot?.variacao_pct != null &&
                      (snapshot.variacao_pct >= 0 ? TrendingUp : TrendingDown)
                    }
                  />
                  <KpiTile
                    icon={AlertTriangle}
                    label="NCs críticas"
                    value={String(snapshot?.ncs_criticas ?? 0)}
                    valueClass={
                      (snapshot?.ncs_criticas ?? 0) > 0
                        ? "text-destructive"
                        : "text-foreground"
                    }
                    hint={`${snapshot?.ncs_abertas ?? 0} abertas`}
                  />
                  <KpiTile
                    icon={ListChecks}
                    label="Punch list"
                    value={String(snapshot?.punch_abertos ?? 0)}
                    hint="itens abertos"
                  />
                </div>
              </section>

              {/* Custos */}
              <section aria-label="Resumo de custos">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Custos
                </h3>
                <dl className="rounded-lg border border-border-subtle divide-y divide-border-subtle bg-card overflow-hidden">
                  <CostRow label="Orçado" value={fmtMoney(snapshot?.orcado)} />
                  <CostRow
                    label="Comprometido"
                    value={fmtMoney(snapshot?.comprometido)}
                  />
                  <CostRow
                    label="Realizado"
                    value={fmtMoney(snapshot?.realizado)}
                  />
                  <CostRow
                    label="EAC (previsto)"
                    value={fmtMoney(snapshot?.eac)}
                    emphasis
                  />
                </dl>
              </section>

              {/* Mini Curva S — reutiliza a RPC/hook da Onda A (useSCurveWeekly).
                  Fetch só quando o Sheet abre (enabled = open && projectId).
                  Sem baseline/medições, mostra EmptyState com CTA que abre o
                  CriarBaselineDialog em /gestao/avanco-fisico. */}
              <SCurveSection
                projectId={obra.id}
                enabled={open}
                onCreateBaseline={() =>
                  navigate(`/gestao/avanco-fisico?projectId=${obra.id}`)
                }
              />


              {/* Lookahead 14d filtrado */}
              <section aria-label="Próximos 14 dias">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Próximos 14 dias
                  </h3>
                  <Link
                    to={`/gestao/lookahead?obra=${obra.id}`}
                    className="text-[12px] text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    Abrir lookahead
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                {lookahead.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : nextActivities.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    Nenhuma atividade planejada nos próximos 14 dias.
                  </p>
                ) : (
                  <ul className="rounded-lg border border-border-subtle divide-y divide-border-subtle bg-card overflow-hidden">
                    {nextActivities.map((a) => (
                      <li
                        key={a.id}
                        className="px-3 py-2 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate">
                            {a.description}
                          </p>
                          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-2">
                            <span className="tabular-nums">
                              {fmtDateBR(a.planned_start)}
                            </span>
                            <span aria-hidden>·</span>
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3 opacity-60" />
                              {a.responsible_name ?? "sem responsável"}
                            </span>
                          </p>
                        </div>
                        {a.isOverdue && (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            atrasada
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Separator />

              {/* Atalhos com obra pré-selecionada */}
              <section aria-label="Atalhos">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Atalhos
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <ShortcutBtn
                    to={`/obra/${obra.id}/compras?novo=1`}
                    icon={ShoppingCart}
                    label="Nova compra"
                  />
                  <ShortcutBtn
                    to={`/obra/${obra.id}/formalizacoes/nova`}
                    icon={FileText}
                    label="Nova formalização"
                  />
                  <ShortcutBtn
                    to={`/obra/${obra.id}/pendencias`}
                    icon={ClipboardList}
                    label="Pendências"
                  />
                  <ShortcutBtn
                    to={`/obra/${obra.id}/financeiro`}
                    icon={DollarSign}
                    label="Financeiro"
                  />
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── subcomponents ───────────────────────────────────────────────────────────
interface KpiTileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass?: string;
  hint?: string;
  progress?: number | null;
  trailingIcon?: React.ComponentType<{ className?: string }> | false | null;
}

function KpiTile({
  icon: Icon,
  label,
  value,
  valueClass,
  hint,
  progress,
  trailingIcon,
}: KpiTileProps) {
  const Trailing = trailingIcon || null;
  return (
    <div className="rounded-lg border border-border-subtle bg-card p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-lg font-semibold tabular-nums leading-none",
            valueClass,
          )}
        >
          {value}
        </span>
        {Trailing && <Trailing className={cn("h-3.5 w-3.5", valueClass)} />}
      </div>
      {progress != null && (
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              progress >= 100 ? "bg-success" : "bg-primary",
            )}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {hint && (
        <span className="text-[11px] text-muted-foreground truncate">
          {hint}
        </span>
      )}
    </div>
  );
}

function CostRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <dt
        className={cn(
          "text-[13px]",
          emphasis
            ? "font-semibold text-foreground"
            : "text-muted-foreground",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "text-[13px] tabular-nums",
          emphasis ? "font-semibold text-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function ShortcutBtn({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="h-10 justify-start gap-2 text-[13px] font-normal"
    >
      <Link to={to}>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </Link>
    </Button>
  );
}

// ── Mini Curva S ────────────────────────────────────────────────────────────
// Reutiliza useSCurveWeekly (RPC get_project_s_curve_weekly) da Onda A.
// Fetch só habilitado com o Sheet aberto para não sobrecarregar o painel.
// Gráfico compacto (~130px), linhas planejado (tracejada) × realizado, tokens
// semânticos (--muted-foreground e --primary), sem eixos pesados e tooltip
// minimalista. Baseline padrão: passamos undefined → RPC usa a baseline ativa.
function SCurveSection({
  projectId,
  enabled,
  onCreateBaseline,
}: {
  projectId: string;
  enabled: boolean;
  onCreateBaseline: () => void;
}) {
  const query = useSCurveWeekly(enabled ? projectId : undefined);
  const points = query.data ?? [];
  const hasData =
    points.length > 0 &&
    points.some((p) => p.planned_pct > 0 || p.actual_pct > 0);

  return (
    <section aria-label="Curva S">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Curva S
      </h3>
      {query.isLoading ? (
        <div className="rounded-lg border border-border-subtle bg-surface-sunken/40 p-4">
          <Skeleton className="h-[130px] w-full" />
        </div>
      ) : hasData ? (
        <div className="rounded-lg border border-border-subtle bg-surface-sunken/40 p-2">
          <div className="h-[130px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={points}
                margin={{ top: 6, right: 8, bottom: 0, left: -18 }}
              >
                <XAxis
                  dataKey="week_start"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: string) => {
                    const [, m, d] = v.split("-");
                    return `${d}/${m}`;
                  }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: number) => `${v}%`}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <RTooltip
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                    padding: "6px 8px",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  labelFormatter={(v: string) => {
                    const [y, m, d] = v.split("-");
                    return `Semana de ${d}/${m}/${y}`;
                  }}
                  formatter={(value: number, name: string) => [
                    `${Number(value).toFixed(1)}%`,
                    name === "planned_pct" ? "Planejado" : "Realizado",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="planned_pct"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual_pct"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border-subtle bg-surface-sunken/40 p-4">
          <EmptyState
            icon={LineChartIcon}
            title="Sem baseline cadastrada"
            description="Registre uma baseline para acompanhar avanço planejado × real."
            action={{
              label: "Criar baseline",
              onClick: onCreateBaseline,
              icon: Plus,
            }}
          />
        </div>
      )}
    </section>
  );
}

