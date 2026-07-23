/**
 * Relatórios Internos — Onda F (staff-only).
 *
 * Lista relatórios executivos internos por obra/semana e permite gerar
 * um relatório sob demanda para a semana atual. Visualização executiva
 * (KPIs + listas) com layout print-friendly.
 *
 * NÃO altera o fluxo de weekly_reports do cliente.
 */
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BookOpenCheck,
  Loader2,
  Printer,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader, EmptyState } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import {
  getISOWeekStart,
  useDeleteInternalWeeklyReport,
  useGenerateInternalWeeklyReport,
  useInternalWeeklyReports,
} from "@/hooks/useInternalWeeklyReports";
import type { InternalWeeklyReport } from "@/infra/repositories/internalWeeklyReports.repository";

interface ReportPayload {
  project?: { name?: string } | null;
  week?: { start?: string; end?: string };
  progress?: {
    weighted_percent?: number | null;
    planned_to_date?: number | null;
    actual_to_date?: number | null;
    variance?: number | null;
    week_measurements?: Array<{ activity_id: string; measured_on: string; progress_percent: number; notes?: string | null }>;
  };
  costs?: {
    totals?: { orcado?: number; comprometido?: number; realizado?: number; eac?: number } | null;
    over_categories?: Array<{ category?: string; budget_amount?: number; realized_amount?: number }>;
  };
  daily_logs?: {
    filled_days?: number;
    business_days?: number;
    coverage_percent?: number;
    avg_workers?: number;
    occurrences_by_severity?: Record<string, number>;
  };
  ncs?: {
    opened?: number;
    closed?: number;
    critical_open?: Array<{ id: string; title?: string; severity?: string; due_date?: string | null }>;
  };
  punch_list?: {
    by_room?: Record<string, { total: number; done: number }>;
    total?: number;
    done?: number;
  };
  lookahead?: {
    window?: { start?: string; end?: string };
    activities?: Array<{ id: string; description?: string; planned_start?: string; planned_end?: string; responsible_user_id?: string | null }>;
    without_assignee?: Array<{ id: string; description?: string }>;
  };
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd 'de' LLLL", { locale: ptBR });
  } catch {
    return iso;
  }
}

function fmtMoney(n?: number | null): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function fmtPct(n?: number | null): string {
  if (n === null || n === undefined) return "—";
  return `${Number(n).toFixed(1)}%`;
}

function ReportView({ report }: { report: InternalWeeklyReport }) {
  const payload = (report.payload ?? {}) as ReportPayload;
  const progress = payload.progress ?? {};
  const costs = payload.costs ?? {};
  const rdos = payload.daily_logs ?? {};
  const ncs = payload.ncs ?? {};
  const punch = payload.punch_list ?? {};
  const lookahead = payload.lookahead ?? {};
  const totals = costs.totals ?? {};

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Progresso físico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avanço físico</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Progresso atual" value={fmtPct(progress.weighted_percent)} />
          <Kpi label="Planejado até hoje" value={fmtPct(progress.planned_to_date)} />
          <Kpi label="Realizado até hoje" value={fmtPct(progress.actual_to_date)} />
          <Kpi
            label="Variação"
            value={fmtPct(progress.variance)}
            tone={
              progress.variance === null || progress.variance === undefined
                ? "neutral"
                : progress.variance < -2
                  ? "danger"
                  : progress.variance < 0
                    ? "warning"
                    : "success"
            }
          />
          <div className="col-span-2 md:col-span-4 text-xs text-muted-foreground">
            Medições registradas na semana: {(progress.week_measurements ?? []).length}
          </div>
        </CardContent>
      </Card>

      {/* Custos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Orçado" value={fmtMoney(totals.orcado)} />
            <Kpi label="Comprometido" value={fmtMoney(totals.comprometido)} />
            <Kpi label="Realizado" value={fmtMoney(totals.realizado)} />
            <Kpi label="EAC (estimado)" value={fmtMoney(totals.eac)} />
          </div>
          {(costs.over_categories ?? []).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-destructive mb-1">
                Categorias estouradas
              </div>
              <ul className="text-sm space-y-1">
                {(costs.over_categories ?? []).map((c, i) => (
                  <li key={i} className="flex justify-between border-b border-border-subtle py-1">
                    <span>{c.category ?? "Sem categoria"}</span>
                    <span className="text-destructive font-medium">
                      {fmtMoney(c.realized_amount)} / {fmtMoney(c.budget_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diário de obra (RDO)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi
            label="Cobertura"
            value={`${rdos.filled_days ?? 0}/${rdos.business_days ?? 0}`}
            hint={`${rdos.coverage_percent ?? 0}% dos dias úteis`}
          />
          <Kpi label="Efetivo médio" value={String(rdos.avg_workers ?? 0)} />
          <Kpi
            label="Ocorrências críticas"
            value={String(rdos.occurrences_by_severity?.critical ?? 0)}
            tone={(rdos.occurrences_by_severity?.critical ?? 0) > 0 ? "danger" : "neutral"}
          />
          <Kpi
            label="Ocorrências altas"
            value={String(rdos.occurrences_by_severity?.high ?? 0)}
            tone={(rdos.occurrences_by_severity?.high ?? 0) > 0 ? "warning" : "neutral"}
          />
        </CardContent>
      </Card>

      {/* NCs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Não conformidades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <Kpi label="Abertas na semana" value={String(ncs.opened ?? 0)} />
            <Kpi label="Fechadas na semana" value={String(ncs.closed ?? 0)} />
            <Kpi
              label="Críticas em aberto"
              value={String((ncs.critical_open ?? []).length)}
              tone={(ncs.critical_open ?? []).length > 0 ? "danger" : "success"}
            />
          </div>
          {(ncs.critical_open ?? []).length > 0 && (
            <ul className="text-sm space-y-1">
              {(ncs.critical_open ?? []).map((n) => (
                <li key={n.id} className="flex justify-between border-b border-border-subtle py-1">
                  <span className="truncate">{n.title ?? "Sem título"}</span>
                  <Badge variant="destructive" className="ml-2">{n.severity}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Punch list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Punch list de entrega</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <Kpi label="Total" value={String(punch.total ?? 0)} />
            <Kpi label="Concluídos" value={String(punch.done ?? 0)} />
            <Kpi
              label="% concluído"
              value={
                punch.total
                  ? `${Math.round(((punch.done ?? 0) / punch.total) * 100)}%`
                  : "—"
              }
            />
          </div>
          {Object.keys(punch.by_room ?? {}).length > 0 && (
            <ul className="text-sm space-y-1">
              {Object.entries(punch.by_room ?? {}).map(([room, v]) => (
                <li key={room} className="flex justify-between border-b border-border-subtle py-1">
                  <span>{room}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {v.done}/{v.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Lookahead */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Lookahead — semana{" "}
            {lookahead.window?.start ? fmtDate(lookahead.window.start) : ""} a{" "}
            {lookahead.window?.end ? fmtDate(lookahead.window.end) : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <Kpi label="Atividades planejadas" value={String((lookahead.activities ?? []).length)} />
            <Kpi
              label="Sem responsável"
              value={String((lookahead.without_assignee ?? []).length)}
              tone={(lookahead.without_assignee ?? []).length > 0 ? "warning" : "success"}
            />
          </div>
          {(lookahead.without_assignee ?? []).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-warning mb-1">
                Precisam de responsável
              </div>
              <ul className="text-sm space-y-1">
                {(lookahead.without_assignee ?? []).map((a) => (
                  <li key={a.id} className="border-b border-border-subtle py-1">
                    {a.description ?? "Sem descrição"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneCls =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-foreground";
  return (
    <div className="rounded-md border border-border-subtle p-3 bg-card">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export default function RelatoriosInternos() {
  const [projectId, setProjectId] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: projects = [], isLoading: loadingProjects } = useProjectsQuery({
    filters: { status: "active" },
  });
  const reportsQ = useInternalWeeklyReports({
    projectId: projectId === "all" ? undefined : projectId,
    limit: 200,
  });
  const genMut = useGenerateInternalWeeklyReport();
  const delMut = useDeleteInternalWeeklyReport();

  const reports = reportsQ.data ?? [];
  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? reports[0] ?? null,
    [reports, selectedId],
  );

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  const canGenerate = projectId !== "all" && !genMut.isPending;

  const handleGenerate = () => {
    if (projectId === "all") return;
    genMut.mutate({ projectId, weekStart: getISOWeekStart() });
  };

  return (
    <PageContainer>
      <div className="print:hidden">
        <PageHeader
          icon={<BookOpenCheck className="h-5 w-5" />}
          title="Relatórios internos"
          description="Relatório executivo interno semanal por obra (staff-only). Não substitui os relatórios semanais enviados ao cliente."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={projectId} onValueChange={setProjectId} disabled={loadingProjects}>
                <SelectTrigger className="w-[240px]" aria-label="Filtrar obra">
                  <SelectValue placeholder="Selecione a obra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as obras</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                title={projectId === "all" ? "Selecione uma obra para gerar" : "Gerar da semana atual"}
              >
                {genMut.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Gerar agora
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 mt-4">
        <aside className="print:hidden space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
            Histórico
          </div>
          {reportsQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              icon={<BookOpenCheck className="h-6 w-6" />}
              title="Nenhum relatório ainda"
              description="Escolha uma obra e clique em Gerar agora."
            />
          ) : (
            <ul className="space-y-1">
              {reports.map((r) => {
                const active = selected?.id === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                        active
                          ? "border-primary bg-accent"
                          : "border-border-subtle hover:bg-muted/60"
                      }`}
                    >
                      <div className="text-sm font-medium truncate">
                        {projectMap.get(r.project_id) ?? "Obra removida"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Semana de {fmtDate(r.week_start)} · gerado {fmtDate(r.generated_at)}
                        {r.generated_by === null && " · auto"}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section>
          {!selected ? (
            <EmptyState
              icon={<BookOpenCheck className="h-6 w-6" />}
              title="Selecione um relatório"
              description="Escolha um relatório do histórico para visualizar."
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between print:hidden">
                <div>
                  <h2 className="text-lg font-semibold">
                    {projectMap.get(selected.project_id) ?? "Obra"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Semana de {fmtDate(selected.week_start)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir / PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(selected.id)}
                    aria-label="Remover relatório"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="hidden print:block mb-2">
                <h1 className="text-xl font-bold">
                  Relatório interno — {projectMap.get(selected.project_id) ?? "Obra"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Semana de {fmtDate(selected.week_start)}
                </p>
              </div>
              <ReportView report={selected} />
            </div>
          )}
        </section>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              O relatório será arquivado. Você poderá gerar novamente para a mesma semana.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteId) {
                  await delMut.mutateAsync(deleteId);
                  if (selected?.id === deleteId) setSelectedId(null);
                }
                setDeleteId(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
