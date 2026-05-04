/**
 * Painel de Alertas de Cronograma
 *
 * Visão executiva das atividades cujo cronograma exige ação imediata:
 *  - Início previsto já passou e não houve sinalização (actual_start ausente)
 *  - Término previsto já passou (após 18h do dia previsto) e não houve
 *    sinalização (actual_end ausente)
 *
 * Cada linha mostra a obra, atividade, datas previstas, dias de atraso e o
 * tipo de pendência. O usuário pode marcar início, marcar conclusão (ambos
 * com data de hoje) ou abrir o cronograma da obra para replanejar.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2,
  Clock,
  PlayCircle,
  CalendarRange,
  Building2,
  Search,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader, MetricCard, MetricRail } from '@/components/ui-premium';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { matchesSearch } from '@/lib/searchNormalize';
import { useCan } from '@/hooks/useCan';
import {
  useScheduleAlerts,
  type ScheduleAlertActivity,
  type ScheduleAlertKind,
} from '@/hooks/useScheduleAlerts';

const ALL = '__all__';

const fmtDate = (iso: string | null) =>
  iso ? format(parseISO(iso), 'dd/MM/yy', { locale: ptBR }) : '—';

type AlertFilter = 'all' | ScheduleAlertKind;

const KIND_LABEL: Record<ScheduleAlertKind, string> = {
  missing_start: 'Início não sinalizado',
  missing_end: 'Término não sinalizado',
};

function KindBadge({ kind }: { kind: ScheduleAlertKind }) {
  if (kind === 'missing_start') {
    return (
      <Badge
        variant="outline"
        className="border-warning/40 bg-warning/10 text-warning"
      >
        <PlayCircle className="mr-1 h-3 w-3" /> Início pendente
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-destructive/40 bg-destructive/10 text-destructive"
    >
      <Clock className="mr-1 h-3 w-3" /> Término pendente
    </Badge>
  );
}

export default function PainelAlertasCronograma() {
  const navigate = useNavigate();
  const { can } = useCan();
  const canEdit = can('schedule:edit');

  const {
    alerts,
    summary,
    isLoading,
    error,
    refetch,
    markStarted,
    markCompleted,
  } = useScheduleAlerts();

  // Estado sincronizado com a URL (?q=&project=&kind=).
  // Mantém filtros ao sair/voltar para a página e permite atalhos pré-filtrados.
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const filterProject = searchParams.get('project') ?? ALL;
  const filterKindRaw = searchParams.get('kind');
  const filterKind: AlertFilter =
    filterKindRaw === 'missing_start' || filterKindRaw === 'missing_end' ? filterKindRaw : 'all';

  const updateParam = (key: 'q' | 'project' | 'kind', value: string, defaultValue: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (!value || value === defaultValue) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };
  const setSearchQuery = (v: string) => updateParam('q', v, '');
  const setFilterProject = (v: string) => updateParam('project', v, ALL);
  const setFilterKind = (v: AlertFilter) => updateParam('kind', v, 'all');

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of alerts) map.set(a.project_id, a.project_name);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (filterProject !== ALL && a.project_id !== filterProject) return false;
      if (filterKind !== 'all' && !a.kinds.includes(filterKind)) return false;
      if (searchQuery && !matchesSearch(searchQuery, [a.description, a.project_name, a.etapa ?? ''])) {
        return false;
      }
      return true;
    });
  }, [alerts, filterProject, filterKind, searchQuery]);

  const goToCronograma = (projectId: string) => {
    navigate(`/obra/${projectId}/cronograma`);
  };

  return (
    <TooltipProvider>
      <PageContainer maxWidth="full" className="py-4 sm:py-6 flex flex-col gap-4">
        <PageHeader
          eyebrow="Cronograma"
          title="Alertas de Cronograma"
          description="Atividades com início ou término não sinalizados dentro do prazo previsto. Use as ações para registrar a evolução real ou replanejar o cronograma da obra."
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Atualizar
            </Button>
          }
          flush
        />

        <MetricRail>
          <MetricCard
            label="Pendências"
            value={isLoading ? '—' : summary.total}
            accent={summary.total > 0 ? 'destructive' : 'success'}
            hint="Total de atividades alertando"
          />
          <MetricCard
            label="Início pendente"
            value={isLoading ? '—' : summary.missingStart}
            accent={summary.missingStart > 0 ? 'warning' : 'muted'}
          />
          <MetricCard
            label="Término pendente"
            value={isLoading ? '—' : summary.missingEnd}
            accent={summary.missingEnd > 0 ? 'destructive' : 'muted'}
          />
          <MetricCard
            label="Obras impactadas"
            value={isLoading ? '—' : summary.projects}
            accent="info"
          />
        </MetricRail>

        <Card>
          <CardContent className="p-3 sm:p-4 flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por atividade, obra ou etapa…"
                  className="pl-8 h-9"
                />
              </div>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="md:w-56 h-9">
                  <SelectValue placeholder="Todas as obras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as obras</SelectItem>
                  {projectOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterKind}
                onValueChange={(v) => setFilterKind(v as AlertFilter)}
              >
                <SelectTrigger className="md:w-52 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="missing_start">
                    {KIND_LABEL.missing_start}
                  </SelectItem>
                  <SelectItem value="missing_end">
                    {KIND_LABEL.missing_end}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-4 text-sm text-destructive">
                Não foi possível carregar os alertas. Tente novamente.
              </div>
            ) : isLoading ? (
              <AlertTableSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyAlerts hasFilters={alerts.length > 0} />
            ) : (
              <>
                {/* Mobile: cards */}
                <div className="flex flex-col gap-2 md:hidden">
                  {filtered.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      canEdit={canEdit}
                      onMarkStarted={() => markStarted.mutate(alert.id)}
                      onMarkCompleted={() => markCompleted.mutate(alert.id)}
                      onReplan={() => goToCronograma(alert.project_id)}
                      pending={
                        markStarted.isPending || markCompleted.isPending
                      }
                    />
                  ))}
                </div>
                {/* Desktop: tabela densa */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Obra</TableHead>
                        <TableHead>Atividade</TableHead>
                        <TableHead>Pendência</TableHead>
                        <TableHead className="whitespace-nowrap">
                          Início previsto
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          Término previsto
                        </TableHead>
                        <TableHead className="text-right">Atraso</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((alert) => (
                        <AlertRow
                          key={alert.id}
                          alert={alert}
                          canEdit={canEdit}
                          onMarkStarted={() => markStarted.mutate(alert.id)}
                          onMarkCompleted={() => markCompleted.mutate(alert.id)}
                          onReplan={() => goToCronograma(alert.project_id)}
                          pending={
                            markStarted.isPending || markCompleted.isPending
                          }
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </TooltipProvider>
  );
}

// ── Linha de tabela ─────────────────────────────────────────────
interface AlertRowProps {
  alert: ScheduleAlertActivity;
  canEdit: boolean;
  pending: boolean;
  onMarkStarted: () => void;
  onMarkCompleted: () => void;
  onReplan: () => void;
}

function AlertRow({
  alert,
  canEdit,
  pending,
  onMarkStarted,
  onMarkCompleted,
  onReplan,
}: AlertRowProps) {
  const showStartAction =
    canEdit && alert.kinds.includes('missing_start') && !alert.actual_start;
  const showEndAction = canEdit && alert.kinds.includes('missing_end');

  return (
    <TableRow>
      <TableCell className="align-top">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium truncate">{alert.project_name}</span>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-medium truncate">{alert.description}</span>
          {alert.etapa && (
            <span className="text-xs text-muted-foreground truncate">
              {alert.etapa}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-wrap gap-1">
          {alert.kinds.map((k) => (
            <KindBadge key={k} kind={k} />
          ))}
        </div>
      </TableCell>
      <TableCell className="align-top whitespace-nowrap">
        <DateChip
          iso={alert.planned_start}
          highlight={alert.kinds.includes('missing_start')}
        />
      </TableCell>
      <TableCell className="align-top whitespace-nowrap">
        <DateChip
          iso={alert.planned_end}
          highlight={alert.kinds.includes('missing_end')}
        />
      </TableCell>
      <TableCell className="align-top text-right whitespace-nowrap">
        <OverdueBadge days={alert.days_overdue} />
      </TableCell>
      <TableCell className="align-top text-right">
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          {showStartAction && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onMarkStarted}
                  disabled={pending}
                >
                  <PlayCircle className="h-3.5 w-3.5 mr-1" />
                  Iniciada
                </Button>
              </TooltipTrigger>
              <TooltipContent>Marcar início com a data de hoje</TooltipContent>
            </Tooltip>
          )}
          {showEndAction && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="default"
                  onClick={onMarkCompleted}
                  disabled={pending}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Concluída
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Marcar conclusão com a data de hoje
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={onReplan}>
                <CalendarRange className="h-3.5 w-3.5 mr-1" />
                Replanejar
                <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Abrir cronograma da obra</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Card mobile ─────────────────────────────────────────────────
function AlertCard({
  alert,
  canEdit,
  pending,
  onMarkStarted,
  onMarkCompleted,
  onReplan,
}: AlertRowProps) {
  const showStartAction =
    canEdit && alert.kinds.includes('missing_start') && !alert.actual_start;
  const showEndAction = canEdit && alert.kinds.includes('missing_end');

  return (
    <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            <span className="truncate">{alert.project_name}</span>
          </span>
          <span className="font-medium leading-tight">{alert.description}</span>
          {alert.etapa && (
            <span className="text-xs text-muted-foreground">{alert.etapa}</span>
          )}
        </div>
        <OverdueBadge days={alert.days_overdue} />
      </div>
      <div className="flex flex-wrap gap-1">
        {alert.kinds.map((k) => (
          <KindBadge key={k} kind={k} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex flex-col">
          <span className="text-muted-foreground">Início previsto</span>
          <DateChip
            iso={alert.planned_start}
            highlight={alert.kinds.includes('missing_start')}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Término previsto</span>
          <DateChip
            iso={alert.planned_end}
            highlight={alert.kinds.includes('missing_end')}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {showStartAction && (
          <Button
            size="sm"
            variant="outline"
            onClick={onMarkStarted}
            disabled={pending}
            className="flex-1 min-w-[140px]"
          >
            <PlayCircle className="h-3.5 w-3.5 mr-1" />
            Marcar iniciada
          </Button>
        )}
        {showEndAction && (
          <Button
            size="sm"
            onClick={onMarkCompleted}
            disabled={pending}
            className="flex-1 min-w-[140px]"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Concluída
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onReplan}
          className="flex-1 min-w-[140px]"
        >
          <CalendarRange className="h-3.5 w-3.5 mr-1" />
          Replanejar
        </Button>
      </div>
    </div>
  );
}

// ── Helpers visuais ─────────────────────────────────────────────
function DateChip({ iso, highlight }: { iso: string | null; highlight: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm tabular-nums',
        highlight ? 'text-destructive font-medium' : 'text-foreground',
      )}
    >
      {fmtDate(iso)}
    </span>
  );
}

function OverdueBadge({ days }: { days: number }) {
  if (days <= 0) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Hoje
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        'tabular-nums',
        days >= 7
          ? 'border-destructive/50 bg-destructive/10 text-destructive'
          : 'border-warning/50 bg-warning/10 text-warning',
      )}
    >
      {days}d
    </Badge>
  );
}

function EmptyAlerts({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <CheckCircle2 className="h-10 w-10 text-success" />
      <span className="text-base font-medium">
        {hasFilters
          ? 'Nenhum alerta com os filtros atuais'
          : 'Nenhuma pendência de cronograma'}
      </span>
      <span className="text-sm text-muted-foreground max-w-md">
        {hasFilters
          ? 'Ajuste a busca ou os filtros acima para ver outras atividades.'
          : 'Todas as atividades em curso estão com início e término sinalizados dentro do prazo.'}
      </span>
    </div>
  );
}

function AlertTableSkeleton() {
  return (
    <div className="flex flex-col gap-2 py-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
