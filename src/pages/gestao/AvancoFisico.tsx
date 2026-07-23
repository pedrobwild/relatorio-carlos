/**
 * /gestao/avanco-fisico — Curva S staff-only por obra.
 *
 * - Seletor de obra
 * - Curva S semanal (planejado × realizado — cálculo no banco)
 * - % ponderado da obra (RPC)
 * - Baselines: criar, marcar atual, listar
 * - Medições recentes
 *
 * RLS restringe ao staff com acesso à obra. Componente não deve ser
 * referenciado em superfícies do cliente.
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart as LineIcon, Plus, Star } from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader, EmptyState } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
  useCurrentBaseline,
  useProjectMeasurements,
  useSCurveWeekly,
  useScheduleBaselines,
  useSetBaselineAsCurrent,
  useWeightedProgress,
} from "@/hooks/useActivityProgress";
import { CriarBaselineDialog } from "@/components/gestao/avanco/CriarBaselineDialog";
import { parseLocalDate } from "@/lib/dates";

function fmtWeek(iso: string): string {
  const d = parseLocalDate(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AvancoFisico() {
  const [params, setParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  const projectsQ = useProjectsQuery();
  const projects = useMemo(
    () =>
      (projectsQ.data ?? [])
        .filter((p) => p.status !== "cancelled")
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [projectsQ.data],
  );

  const selectedProjectId =
    params.get("obra") || projects[0]?.id || undefined;
  const setSelectedProject = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("obra", id);
    setParams(next, { replace: true });
  };

  const baselinesQ = useScheduleBaselines(selectedProjectId);
  const currentBaselineQ = useCurrentBaseline(selectedProjectId);
  const selectedBaselineId =
    params.get("baseline") || currentBaselineQ.data?.id || undefined;
  const setSelectedBaseline = (id: string | undefined) => {
    const next = new URLSearchParams(params);
    if (!id) next.delete("baseline");
    else next.set("baseline", id);
    setParams(next, { replace: true });
  };

  const curveQ = useSCurveWeekly(selectedProjectId, selectedBaselineId);
  const progressQ = useWeightedProgress(selectedProjectId, selectedBaselineId);
  const measurementsQ = useProjectMeasurements(selectedProjectId);
  const setCurrentMutation = useSetBaselineAsCurrent(selectedProjectId ?? "");

  const chartData = useMemo(
    () =>
      (curveQ.data ?? []).map((p) => ({
        week: fmtWeek(p.week_start),
        Planejado: p.planned_pct,
        Realizado: p.actual_pct,
      })),
    [curveQ.data],
  );

  const recentMeasurements = useMemo(
    () => (measurementsQ.data ?? []).slice(0, 20),
    [measurementsQ.data],
  );

  const noProjects = !projectsQ.isLoading && projects.length === 0;
  const noBaseline =
    !!selectedProjectId &&
    !baselinesQ.isLoading &&
    (baselinesQ.data ?? []).length === 0;
  const noMeasurements =
    !!selectedProjectId &&
    !measurementsQ.isLoading &&
    (measurementsQ.data ?? []).length === 0;

  return (
    <PageContainer>
      <PageHeader
        title="Avanço físico"
        description="Curva S semanal por obra, baselines e histórico de medições."
      />

      {noProjects ? (
        <EmptyState
          icon={LineIcon}
          title="Sem obras disponíveis"
          description="Você ainda não tem obras com acesso para acompanhar avanço físico."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-[220px] sm:w-72">
                <label className="text-xs font-medium text-muted-foreground">
                  Obra
                </label>
                <Select
                  value={selectedProjectId}
                  onValueChange={(v) => {
                    setSelectedProject(v);
                    setSelectedBaseline(undefined);
                  }}
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

              <div className="min-w-[220px] sm:w-64">
                <label className="text-xs font-medium text-muted-foreground">
                  Baseline
                </label>
                <Select
                  value={selectedBaselineId ?? ""}
                  onValueChange={(v) => setSelectedBaseline(v || undefined)}
                  disabled={
                    !selectedProjectId || (baselinesQ.data ?? []).length === 0
                  }
                >
                  <SelectTrigger className="h-11 mt-1">
                    <SelectValue placeholder="Baseline atual" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {(baselinesQ.data ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        <span className="flex items-center gap-2">
                          {b.name}
                          {b.is_current && (
                            <Star className="h-3 w-3 fill-primary text-primary" />
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() => setDialogOpen(true)}
              disabled={!selectedProjectId}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nova baseline
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Avanço ponderado
                </CardTitle>
              </CardHeader>
              <CardContent>
                {progressQ.isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-3xl font-semibold">
                    {(progressQ.data ?? 0).toFixed(1)}%
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Baseado nas medições mais recentes por atividade.
                </p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Baseline selecionada
                </CardTitle>
              </CardHeader>
              <CardContent>
                {baselinesQ.isLoading ? (
                  <Skeleton className="h-8 w-40" />
                ) : selectedBaselineId ? (
                  (() => {
                    const b = (baselinesQ.data ?? []).find(
                      (x) => x.id === selectedBaselineId,
                    );
                    if (!b) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-medium">{b.name}</span>
                        {b.is_current ? (
                          <Badge variant="default" className="gap-1">
                            <Star className="h-3 w-3" /> Atual
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setCurrentMutation.mutate(b.id)
                            }
                            disabled={setCurrentMutation.isPending}
                          >
                            Marcar como atual
                          </Button>
                        )}
                        <span className="text-xs text-muted-foreground w-full">
                          Criada em {fmtDateTime(b.created_at)}
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Nenhuma baseline selecionada.
                  </span>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Curva S — planejado × realizado</CardTitle>
            </CardHeader>
            <CardContent>
              {curveQ.isLoading || baselinesQ.isLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : noBaseline ? (
                <EmptyState
                  icon={LineIcon}
                  title="Sem baseline para esta obra"
                  description="Crie uma baseline para congelar o cronograma atual como referência. A curva S compara o planejado dessa baseline com as medições registradas."
                  action={{
                    label: "Criar baseline",
                    onClick: () => setDialogOpen(true),
                    icon: Plus,
                  }}
                />
              ) : chartData.length === 0 ? (
                <EmptyState
                  icon={LineIcon}
                  title="Baseline sem atividades com datas"
                  description="A baseline selecionada não possui atividades com datas planejadas para calcular a curva."
                />
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 16, bottom: 4, left: -16 }}
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
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        className="text-muted-foreground"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => `${v.toFixed(1)}%`}
                      />
                      <Line
                        type="monotone"
                        dataKey="Planejado"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="Realizado"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Medições recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {measurementsQ.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : noMeasurements ? (
                <EmptyState
                  icon={LineIcon}
                  title="Nenhuma medição registrada"
                  description="Registre o avanço parcial de uma atividade pelo Lookahead ou pelo cronograma para começar a alimentar a curva S."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead className="w-24">%</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentMeasurements.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {fmtDateTime(m.created_at)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {Number(m.progress_pct).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-pre-line">
                            {m.notes || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {selectedProjectId && (
        <CriarBaselineDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          projectId={selectedProjectId}
        />
      )}
    </PageContainer>
  );
}
