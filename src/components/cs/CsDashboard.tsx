/**
 * CsDashboard — visão executiva do módulo de Customer Success.
 *
 * Resume os tickets em três blocos:
 *   1. KPIs principais (total, abertos, em andamento, concluídos, críticos ativos)
 *   2. Matriz Status × Severidade (heatmap clicável para filtrar)
 *   3. Listas de prioridade: críticos abertos, mais antigos sem conclusão,
 *      e tickets parados (sem atualização há 7+ dias).
 *
 * Toda a leitura usa os tickets já carregados pelo hook `useCsTickets`,
 * portanto não há custo extra de rede.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Headset,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingUp,
  Flame,
  Hourglass,
  Ghost,
  ArrowRight,
  CalendarRange,
  UserX,
  UserCheck,
  Check,
} from "lucide-react";
import {
  differenceInDays,
  formatDistanceToNow,
  parseISO,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  CS_SEVERITY_OPTIONS,
  CS_STATUS_OPTIONS,
  type CsTicket,
  type CsTicketSeverity,
  type CsTicketStatus,
  useTouchCsTicket,
} from "@/hooks/useCsTickets";
import { cn } from "@/lib/utils";

interface CsDashboardProps {
  tickets: CsTicket[];
  /** Aplica um filtro vindo da matriz/listas. Use null para limpar. */
  onFilter?: (filter: {
    status?: CsTicketStatus | null;
    severity?: CsTicketSeverity | null;
  }) => void;
}

// ---------- helpers visuais ----------
const severityOrder: CsTicketSeverity[] = ["critica", "alta", "media", "baixa"];
const statusOrder: CsTicketStatus[] = ["aberto", "em_andamento", "concluido"];

const severityLabel = (s: CsTicketSeverity) =>
  CS_SEVERITY_OPTIONS.find((o) => o.value === s)?.label ?? s;
const statusLabel = (s: CsTicketStatus) =>
  CS_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;

const severityToneText: Record<CsTicketSeverity, string> = {
  baixa: "text-muted-foreground",
  media: "text-info",
  alta: "text-warning",
  critica: "text-destructive",
};

const severityHeatBg = (s: CsTicketSeverity, count: number): string => {
  if (count === 0) return "bg-muted/20 text-muted-foreground border-border";
  switch (s) {
    case "baixa":
      return "bg-muted/60 text-foreground border-border";
    case "media":
      return "bg-info/15 text-info border-info/30";
    case "alta":
      return "bg-warning/20 text-warning border-warning/40";
    case "critica":
      return "bg-destructive/20 text-destructive border-destructive/40";
  }
};

const statusIcon: Record<CsTicketStatus, React.ElementType> = {
  aberto: Hourglass,
  em_andamento: Clock,
  concluido: CheckCircle2,
};

const statusToneText: Record<CsTicketStatus, string> = {
  aberto: "text-info",
  em_andamento: "text-warning",
  concluido: "text-success",
};

// ---------- KPI tile ----------
interface KpiTileProps {
  icon: React.ElementType;
  label: string;
  value: number;
  hint?: string;
  accent?: "default" | "info" | "warning" | "success" | "destructive";
  onClick?: () => void;
}

function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  accent = "default",
  onClick,
}: KpiTileProps) {
  const accentMap = {
    default: {
      bg: "bg-muted/40",
      icon: "text-muted-foreground",
      value: "text-foreground",
    },
    info: { bg: "bg-info/10", icon: "text-info", value: "text-info" },
    warning: {
      bg: "bg-warning/10",
      icon: "text-warning",
      value: "text-warning",
    },
    success: {
      bg: "bg-success/10",
      icon: "text-success",
      value: "text-success",
    },
    destructive: {
      bg: "bg-destructive/10",
      icon: "text-destructive",
      value: "text-destructive",
    },
  };
  const cfg = accentMap[accent];
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border bg-card p-3 flex items-start gap-3 text-left transition-all",
        onClick &&
          "hover:border-primary/40 hover:shadow-sm active:scale-[0.99] cursor-pointer",
      )}
    >
      <div className={cn("rounded-md p-2 shrink-0", cfg.bg)}>
        <Icon className={cn("h-4 w-4", cfg.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium leading-tight">
          {label}
        </p>
        <p
          className={cn(
            "text-2xl font-bold leading-none mt-1 tabular-nums",
            cfg.value,
          )}
        >
          {value}
        </p>
        {hint && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
            {hint}
          </p>
        )}
      </div>
    </Comp>
  );
}

// ---------- período ----------
type PeriodKey = "7d" | "30d" | "90d" | "all";

const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number | null }[] =
  [
    { key: "7d", label: "7 dias", days: 7 },
    { key: "30d", label: "30 dias", days: 30 },
    { key: "90d", label: "90 dias", days: 90 },
    { key: "all", label: "Tudo", days: null },
  ];

// ============================================================
// Componente
// ============================================================
export function CsDashboard({ tickets, onFilter }: CsDashboardProps) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const touchTicket = useTouchCsTicket();

  // Tickets dentro do período (por data de criação). 'all' não aplica filtro.
  const scopedTickets = useMemo(() => {
    const cfg = PERIOD_OPTIONS.find((o) => o.key === period);
    if (!cfg || cfg.days === null) return tickets;
    const cutoff = subDays(new Date(), cfg.days);
    return tickets.filter((t) => parseISO(t.created_at) >= cutoff);
  }, [tickets, period]);

  const stats = useMemo(() => {
    const total = scopedTickets.length;
    const byStatus: Record<CsTicketStatus, number> = {
      aberto: 0,
      em_andamento: 0,
      concluido: 0,
    };
    const bySeverity: Record<CsTicketSeverity, number> = {
      baixa: 0,
      media: 0,
      alta: 0,
      critica: 0,
    };
    // matrix[status][severity] = count
    const matrix: Record<CsTicketStatus, Record<CsTicketSeverity, number>> = {
      aberto: { baixa: 0, media: 0, alta: 0, critica: 0 },
      em_andamento: { baixa: 0, media: 0, alta: 0, critica: 0 },
      concluido: { baixa: 0, media: 0, alta: 0, critica: 0 },
    };

    scopedTickets.forEach((t) => {
      byStatus[t.status]++;
      bySeverity[t.severity]++;
      matrix[t.status][t.severity]++;
    });

    const ativos = total - byStatus.concluido;
    const criticosAtivos = scopedTickets.filter(
      (t) => t.severity === "critica" && t.status !== "concluido",
    ).length;
    const altosAtivos = scopedTickets.filter(
      (t) => t.severity === "alta" && t.status !== "concluido",
    ).length;

    // Tickets sem responsável (ativos)
    const semResponsavel = scopedTickets.filter(
      (t) => !t.responsible_user_id && t.status !== "concluido",
    ).length;

    // Tickets com responsável mas sem update há 7d+ (follow-up necessário)
    const now = new Date();
    const atrasadosComDono = scopedTickets.filter(
      (t) =>
        t.responsible_user_id &&
        t.status !== "concluido" &&
        differenceInDays(now, parseISO(t.updated_at)) >= 7,
    ).length;

    // Resolução: % concluídos
    const taxaConclusao =
      total > 0 ? Math.round((byStatus.concluido / total) * 100) : 0;

    return {
      total,
      ativos,
      byStatus,
      bySeverity,
      matrix,
      criticosAtivos,
      altosAtivos,
      semResponsavel,
      atrasadosComDono,
      taxaConclusao,
    };
  }, [scopedTickets]);

  // Listas priorizadas
  const criticosAbertos = useMemo(
    () =>
      scopedTickets
        .filter((t) => t.severity === "critica" && t.status !== "concluido")
        .sort(
          (a, b) =>
            parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime(),
        )
        .slice(0, 5),
    [scopedTickets],
  );

  // Tickets ativos sem responsável (mais antigos primeiro)
  const semResponsavelLista = useMemo(
    () =>
      scopedTickets
        .filter((t) => !t.responsible_user_id && t.status !== "concluido")
        .sort(
          (a, b) =>
            parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime(),
        )
        .slice(0, 5),
    [scopedTickets],
  );

  // Tickets com responsável mas sem update há 7d+ (follow-up)
  const followUpAtrasado = useMemo(() => {
    const now = new Date();
    return scopedTickets
      .filter(
        (t) =>
          t.responsible_user_id &&
          t.status !== "concluido" &&
          differenceInDays(now, parseISO(t.updated_at)) >= 7,
      )
      .sort(
        (a, b) =>
          parseISO(a.updated_at).getTime() - parseISO(b.updated_at).getTime(),
      )
      .slice(0, 5);
  }, [scopedTickets]);

  return (
    <div className="space-y-4 mb-5">
      {/* Seletor de período */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarRange className="h-3.5 w-3.5" />
          <span className="font-medium uppercase tracking-wider">Período</span>
        </div>
        <div
          role="radiogroup"
          aria-label="Período do dashboard"
          className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-0.5"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={period === opt.key}
              onClick={() => setPeriod(opt.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                period === opt.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Linha 1: KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <KpiTile
          icon={Headset}
          label="Total"
          value={stats.total}
          hint={`${stats.ativos} ativo(s)`}
          onClick={() => onFilter?.({ status: null, severity: null })}
        />
        <KpiTile
          icon={Hourglass}
          label="Abertos"
          value={stats.byStatus.aberto}
          accent="info"
          onClick={() => onFilter?.({ status: "aberto" })}
        />
        <KpiTile
          icon={Clock}
          label="Em andamento"
          value={stats.byStatus.em_andamento}
          accent="warning"
          onClick={() => onFilter?.({ status: "em_andamento" })}
        />
        <KpiTile
          icon={CheckCircle2}
          label="Concluídos"
          value={stats.byStatus.concluido}
          accent="success"
          hint={`${stats.taxaConclusao}% do total`}
          onClick={() => onFilter?.({ status: "concluido" })}
        />
        <KpiTile
          icon={Flame}
          label="Críticos ativos"
          value={stats.criticosAtivos}
          accent="destructive"
          hint={
            stats.altosAtivos > 0 ? `+${stats.altosAtivos} altos` : undefined
          }
          onClick={() => onFilter?.({ severity: "critica" })}
        />
        <KpiTile
          icon={UserX}
          label="Sem responsável"
          value={stats.semResponsavel}
          accent={stats.semResponsavel > 0 ? "warning" : "default"}
          hint="Ativos sem dono"
        />
        <KpiTile
          icon={UserCheck}
          label="Atrasados c/ dono"
          value={stats.atrasadosComDono}
          accent={stats.atrasadosComDono > 0 ? "warning" : "default"}
          hint="Sem update 7d+"
        />
      </div>

      {/* Linha 2: Matriz + Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Matriz Status × Severidade */}
        <section className="lg:col-span-2 rounded-lg border border-border bg-card p-4">
          <header className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Distribuição: Status × Severidade
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Clique para filtrar
            </span>
          </header>

          {stats.total === 0 ? (
            <p className="text-sm italic text-muted-foreground py-6 text-center">
              Sem tickets registrados ainda.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1 w-[120px]">
                      Status \ Severidade
                    </th>
                    {severityOrder.map((sev) => (
                      <th
                        key={sev}
                        className={cn(
                          "text-center text-[11px] uppercase tracking-wider font-semibold px-2 py-1",
                          severityToneText[sev],
                        )}
                      >
                        {severityLabel(sev)}
                      </th>
                    ))}
                    <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statusOrder.map((st) => {
                    const StIcon = statusIcon[st];
                    const rowTotal = severityOrder.reduce(
                      (acc, sev) => acc + stats.matrix[st][sev],
                      0,
                    );
                    return (
                      <tr key={st}>
                        <td className="px-2 py-1">
                          <button
                            type="button"
                            onClick={() => onFilter?.({ status: st })}
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs font-medium hover:underline",
                              statusToneText[st],
                            )}
                          >
                            <StIcon className="h-3.5 w-3.5" />
                            {statusLabel(st)}
                          </button>
                        </td>
                        {severityOrder.map((sev) => {
                          const count = stats.matrix[st][sev];
                          return (
                            <td key={sev} className="p-0">
                              <button
                                type="button"
                                disabled={count === 0}
                                onClick={() =>
                                  onFilter?.({ status: st, severity: sev })
                                }
                                className={cn(
                                  "w-full h-12 rounded-md border text-base font-bold tabular-nums transition-all",
                                  severityHeatBg(sev, count),
                                  count > 0 &&
                                    "hover:scale-[1.03] hover:shadow-sm cursor-pointer active:scale-[0.98]",
                                  count === 0 && "cursor-default",
                                )}
                              >
                                {count}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-2 py-1 text-center text-sm font-semibold tabular-nums text-foreground">
                          {rowTotal}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="px-2 pt-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      Total
                    </td>
                    {severityOrder.map((sev) => (
                      <td
                        key={sev}
                        className={cn(
                          "px-2 pt-2 text-center text-sm font-semibold tabular-nums",
                          severityToneText[sev],
                        )}
                      >
                        {stats.bySeverity[sev]}
                      </td>
                    ))}
                    <td className="px-2 pt-2 text-center text-sm font-bold tabular-nums text-foreground">
                      {stats.total}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Listas de prioridade */}
        <section className="space-y-4">
          {/* Críticos abertos */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <header className="flex items-center gap-2 mb-2.5">
              <Flame className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold text-destructive">
                Críticos para resolver
              </h3>
              <span className="ml-auto text-xs font-bold text-destructive tabular-nums">
                {stats.criticosAtivos}
              </span>
            </header>
            {criticosAbertos.length === 0 ? (
              <p className="text-xs italic text-muted-foreground py-2">
                Nenhum ticket crítico ativo. 🎉
              </p>
            ) : (
              <ul className="space-y-1.5">
                {criticosAbertos.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/gestao/cs/${t.id}`)}
                      className="w-full text-left rounded-md px-2 py-1.5 hover:bg-card transition-colors group"
                    >
                      <p className="text-xs font-medium text-foreground line-clamp-1">
                        {t.situation}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 flex items-center gap-1 mt-0.5">
                        <span className="truncate">
                          {t.project_name ?? "Obra"}
                        </span>
                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 shrink-0 ml-auto" />
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sem responsável (ativos) */}
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
            <header className="flex items-center gap-2 mb-2.5">
              <UserX className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold text-warning">
                Sem responsável
              </h3>
              <span className="ml-auto text-xs font-bold text-warning tabular-nums">
                {stats.semResponsavel}
              </span>
            </header>
            {semResponsavelLista.length === 0 ? (
              <p className="text-xs italic text-muted-foreground py-2">
                Todos os tickets ativos têm dono. ✅
              </p>
            ) : (
              <ul className="space-y-1.5">
                {semResponsavelLista.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/gestao/cs/${t.id}`)}
                      className="w-full text-left rounded-md px-2 py-1.5 hover:bg-card transition-colors group"
                    >
                      <p className="text-xs font-medium text-foreground line-clamp-1">
                        {t.situation}
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <span className="truncate">
                          {t.project_name ?? "Obra"}
                        </span>
                        <span className="ml-auto shrink-0">
                          aberto{" "}
                          {formatDistanceToNow(parseISO(t.created_at), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                        </span>
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Follow-up atrasado: tem dono mas sem update 7d+ */}
          <div className="rounded-lg border border-info/30 bg-info/5 p-4">
            <header className="flex items-center gap-2 mb-2.5">
              <Ghost className="h-4 w-4 text-info" />
              <h3 className="text-sm font-semibold text-info">
                Follow-up atrasado
              </h3>
              <span className="ml-auto text-xs font-bold text-info tabular-nums">
                {stats.atrasadosComDono}
              </span>
            </header>
            {followUpAtrasado.length === 0 ? (
              <p className="text-xs italic text-muted-foreground py-2">
                Tickets com dono estão com updates em dia.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {followUpAtrasado.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-md hover:bg-card transition-colors group flex items-stretch gap-1"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/gestao/cs/${t.id}`)}
                      className="flex-1 min-w-0 text-left px-2 py-1.5"
                    >
                      <p className="text-xs font-medium text-foreground line-clamp-1">
                        {t.situation}
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-x-1.5 mt-0.5">
                        <span className="truncate">
                          {t.responsible_name ?? "Responsável"} ·{" "}
                          {t.project_name ?? "Obra"}
                        </span>
                        <span className="ml-auto shrink-0">
                          {formatDistanceToNow(parseISO(t.updated_at), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                        </span>
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        touchTicket.mutate(t.id);
                      }}
                      disabled={touchTicket.isPending}
                      title="Marcar como tratado (atualiza o follow-up)"
                      aria-label="Marcar como tratado"
                      className={cn(
                        "shrink-0 self-center mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
                        "bg-info/10 text-info border border-info/30 hover:bg-info/20 transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                    >
                      <Check className="h-3 w-3" />
                      <span className="hidden sm:inline">Tratado</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
