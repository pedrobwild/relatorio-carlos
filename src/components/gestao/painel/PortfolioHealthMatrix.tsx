/**
 * PortfolioHealthMatrix — Onda P2 (staff-only).
 *
 * Matriz de saúde do portfólio: dispersão das obras ATIVAS em dois eixos
 * gerenciais — atraso (X, dias) × variação de custo (Y, %). Tamanho da bolha
 * pelo orçado; cor pela criticidade calculada (mesma classificação do badge).
 *
 * Regras:
 *  - Colapsável, fechada por padrão; estado persistido em localStorage.
 *  - Skeleton no loading; EmptyState quando não há obras ativas com dados.
 *  - Clique na bolha abre o drawer (mesmo mecanismo ?obra=).
 *  - Sem hex hardcoded: tokens semânticos + cores derivadas de CSS vars.
 */
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChevronDown, ChevronRight, ScatterChart as ScatterIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import {
  severityLabel,
  type SeverityBreakdown,
  type SeverityLevel,
} from "@/lib/calculateObraSeverity";

// ── Types ────────────────────────────────────────────────────────────────────
export interface HealthMatrixPoint {
  id: string;
  nome: string;
  cliente: string | null;
  responsavel: string | null;
  overdueDays: number;
  variacaoPct: number | null;
  orcado: number | null;
  severity: SeverityBreakdown;
}

interface PortfolioHealthMatrixProps {
  points: HealthMatrixPoint[];
  isLoading: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectObra: (id: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const LEVEL_COLOR: Record<SeverityLevel, string> = {
  critica: "hsl(var(--destructive))",
  atencao: "hsl(var(--warning))",
  saudavel: "hsl(var(--success))",
};

/** Escala de raio da bolha (px) via orçado. Min visível = 6 · Max = 22. */
function bubbleSize(orcado: number | null, maxOrc: number): number {
  if (!orcado || orcado <= 0 || maxOrc <= 0) return 6 * 6; // recharts usa "area"
  const ratio = Math.sqrt(orcado / maxOrc);
  const radius = 6 + ratio * 16;
  return radius * radius; // recharts ZAxis "range" trabalha com área
}

function fmtNumber(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
interface TooltipPayload {
  payload?: HealthMatrixPoint;
}
function MatrixTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-md border border-border-subtle bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs max-w-[240px]">
      <p className="font-semibold text-foreground truncate">{p.nome}</p>
      <p className="text-muted-foreground truncate">
        {p.cliente ?? "Sem cliente"}
      </p>
      {p.responsavel && (
        <p className="text-muted-foreground truncate">
          Resp.: {p.responsavel}
        </p>
      )}
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
        <span className="text-muted-foreground">Atraso</span>
        <span className="text-right">{p.overdueDays}d</span>
        <span className="text-muted-foreground">Variação</span>
        <span className="text-right">
          {p.variacaoPct == null ? "—" : `${fmtNumber(p.variacaoPct)}%`}
        </span>
        <span className="text-muted-foreground">Orçado</span>
        <span className="text-right">{fmtCurrency(p.orcado)}</span>
        <span className="text-muted-foreground">Criticidade</span>
        <span className="text-right">
          {severityLabel(p.severity.level)} · {p.severity.score}
        </span>
      </div>
    </div>
  );
}

// ── Chart body (memoized shell) ──────────────────────────────────────────────
function MatrixChart({
  points,
  onSelectObra,
}: {
  points: HealthMatrixPoint[];
  onSelectObra: (id: string) => void;
}) {
  const maxOrc = useMemo(
    () => points.reduce((mx, p) => Math.max(mx, p.orcado ?? 0), 0),
    [points],
  );

  const series = useMemo(() => {
    const buckets: Record<SeverityLevel, (HealthMatrixPoint & { z: number; opacity: number })[]> = {
      critica: [],
      atencao: [],
      saudavel: [],
    };
    for (const p of points) {
      const z = bubbleSize(p.orcado, maxOrc);
      const opacity = p.variacaoPct == null ? 0.35 : 0.85;
      buckets[p.severity.level].push({ ...p, z, opacity });
    }
    return buckets;
  }, [points, maxOrc]);

  return (
    <div className="h-[320px] sm:h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="overdueDays"
            name="Atraso"
            unit="d"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
            label={{
              value: "Atraso (dias)",
              position: "insideBottom",
              offset: -14,
              fill: "hsl(var(--muted-foreground))",
              fontSize: 11,
            }}
            allowDecimals={false}
            domain={[0, "dataMax + 2"]}
          />
          <YAxis
            type="number"
            dataKey="variacaoPct"
            name="Variação EAC"
            unit="%"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
            label={{
              value: "Variação EAC (%)",
              angle: -90,
              position: "insideLeft",
              offset: 12,
              fill: "hsl(var(--muted-foreground))",
              fontSize: 11,
            }}
          />
          <ZAxis type="number" dataKey="z" range={[36, 500]} />
          <ReferenceLine
            x={0}
            stroke="hsl(var(--border))"
            strokeDasharray="4 4"
          />
          <ReferenceLine
            y={0}
            stroke="hsl(var(--border))"
            strokeDasharray="4 4"
          />
          <RTooltip cursor={{ strokeDasharray: "3 3" }} content={<MatrixTooltip />} />
          {(Object.keys(series) as SeverityLevel[]).map((level) => (
            <Scatter
              key={level}
              name={severityLabel(level)}
              data={series[level]}
              fill={LEVEL_COLOR[level]}
              fillOpacity={0.75}
              stroke={LEVEL_COLOR[level]}
              onClick={(node) => {
                const p = (node as unknown as { payload?: HealthMatrixPoint })
                  .payload;
                if (p?.id) onSelectObra(p.id);
              }}
              style={{ cursor: "pointer" }}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────
export function PortfolioHealthMatrix({
  points,
  isLoading,
  isOpen,
  onOpenChange,
  onSelectObra,
}: PortfolioHealthMatrixProps) {
  const counts = useMemo(() => {
    let critica = 0;
    let atencao = 0;
    let saudavel = 0;
    for (const p of points) {
      if (p.severity.level === "critica") critica++;
      else if (p.severity.level === "atencao") atencao++;
      else saudavel++;
    }
    return { critica, atencao, saudavel };
  }, [points]);

  // Resumo aria-live para leitores de tela.
  const ariaSummary = `Matriz de saúde: ${points.length} obras ativas — ${counts.critica} críticas, ${counts.atencao} em atenção, ${counts.saudavel} saudáveis.`;

  return (
    <section
      aria-label="Matriz de saúde do portfólio"
      className="rounded-lg border border-border-subtle bg-card"
    >
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="portfolio-health-matrix-panel"
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/40 rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
        <ScatterIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="text-sm font-semibold text-foreground">
          Matriz de saúde
        </span>
        <span className="text-xs text-muted-foreground ml-1">
          atraso × variação de custo
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] tabular-nums">
          <LegendDot level="critica" count={counts.critica} />
          <LegendDot level="atencao" count={counts.atencao} />
          <LegendDot level="saudavel" count={counts.saudavel} />
        </span>
      </button>

      {isOpen && (
        <div
          id="portfolio-health-matrix-panel"
          className="border-t border-border-subtle p-3"
        >
          <p className="sr-only" aria-live="polite">
            {ariaSummary}
          </p>
          {isLoading ? (
            <Skeleton className="h-[320px] sm:h-[360px] w-full" />
          ) : points.length === 0 ? (
            <EmptyState
              icon={ScatterIcon}
              title="Sem dados para a matriz"
              description="Nenhuma obra ativa com dados suficientes para a dispersão."
            />
          ) : (
            <>
              <MatrixChart points={points} onSelectObra={onSelectObra} />
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <LegendItem level="critica" label="Crítica" />
                <LegendItem level="atencao" label="Atenção" />
                <LegendItem level="saudavel" label="Saudável" />
                <span className="ml-auto">Tamanho ∝ orçado</span>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function LegendDot({ level, count }: { level: SeverityLevel; count: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden
        className={cn("inline-block h-2 w-2 rounded-full")}
        style={{ backgroundColor: LEVEL_COLOR[level] }}
      />
      <span className="text-muted-foreground">{count}</span>
    </span>
  );
}

function LegendItem({ level, label }: { level: SeverityLevel; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: LEVEL_COLOR[level] }}
      />
      {label}
    </span>
  );
}

// ── Persistence hook ─────────────────────────────────────────────────────────
/**
 * Hook para persistir o estado aberto/fechado da matriz por usuário.
 * Chave: `painel-obras:health-matrix:open:<userId|anon>`.
 */
export function useHealthMatrixOpen(userId: string | null): [boolean, (v: boolean) => void] {
  const key = `painel-obras:health-matrix:open:${userId ?? "anon"}`;
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === "1") setOpen(true);
      else if (raw === "0") setOpen(false);
      else setOpen(false); // padrão: fechado
    } catch {
      /* localStorage indisponível: mantém padrão fechado */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = (v: boolean) => {
    setOpen(v);
    try {
      window.localStorage.setItem(key, v ? "1" : "0");
    } catch {
      /* ignora */
    }
  };
  return [open, set];
}
