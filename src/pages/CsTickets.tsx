/**
 * CsTickets — Módulo de Customer Success.
 *
 * Lista, filtra e gerencia tickets de atendimento da equipe de CS.
 * Cada ticket vincula uma obra/cliente, situação, severidade, status,
 * descrição, plano de ação e responsável.
 *
 * Acesso: toda a equipe staff (admin, manager, engineer, gestor, cs,
 * arquitetura, suprimentos, financeiro). Clientes não têm acesso.
 */
import { useMemo, useState } from 'react';
import {
  Headset,
  Plus,
  Search,
  Filter,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmptyState } from '@/components/ui/states';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

import {
  CS_SEVERITY_OPTIONS,
  CS_STATUS_OPTIONS,
  type CsTicket,
  type CsTicketSeverity,
  type CsTicketStatus,
  useCsTickets,
  useDeleteCsTicket,
  useUpdateCsTicket,
} from '@/hooks/useCsTickets';
import { CsTicketDialog } from '@/components/cs/CsTicketDialog';
import { CsDashboard } from '@/components/cs/CsDashboard';

const ALL = '__all__';

// ----- helpers visuais -----

const severityClass = (s: CsTicketSeverity): string => {
  switch (s) {
    case 'baixa':
      return 'bg-muted text-muted-foreground border border-border';
    case 'media':
      return 'bg-info/10 text-info border border-info/25';
    case 'alta':
      return 'bg-warning/10 text-warning border border-warning/30';
    case 'critica':
      return 'bg-destructive/10 text-destructive border border-destructive/25';
  }
};

const severityLabel = (s: CsTicketSeverity): string =>
  CS_SEVERITY_OPTIONS.find((o) => o.value === s)?.label ?? s;

const statusClass = (s: CsTicketStatus): string => {
  switch (s) {
    case 'aberto':
      return 'bg-info/10 text-info border border-info/25';
    case 'em_andamento':
      return 'bg-warning/10 text-warning border border-warning/30';
    case 'concluido':
      return 'bg-success/10 text-success border border-success/25';
  }
};

const statusLabel = (s: CsTicketStatus): string =>
  CS_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;

const fmtDateTime = (iso: string | null) =>
  iso ? format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—';

// ============================================================
// Página
// ============================================================
export default function CsTickets() {
  const navigate = useNavigate();
  const { data: tickets = [], isLoading } = useCsTickets();
  const updateMutation = useUpdateCsTicket();
  const deleteMutation = useDeleteCsTicket();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [severityFilter, setSeverityFilter] = useState<string>(ALL);
  const [projectFilter, setProjectFilter] = useState<string>(ALL);
  const [responsibleFilter, setResponsibleFilter] = useState<string>(ALL);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<CsTicket | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CsTicket | null>(null);

  // Opções dinâmicas derivadas dos tickets
  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    tickets.forEach((t) => {
      const label = t.project_name
        ? t.customer_name
          ? `${t.project_name} — ${t.customer_name}`
          : t.project_name
        : t.customer_name ?? 'Obra sem nome';
      map.set(t.project_id, label);
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [tickets]);

  const responsibleOptions = useMemo(() => {
    const map = new Map<string, string>();
    let hasUnassigned = false;
    tickets.forEach((t) => {
      if (t.responsible_user_id && t.responsible_name) {
        map.set(t.responsible_user_id, t.responsible_name);
      } else {
        hasUnassigned = true;
      }
    });
    const opts = Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return { opts, hasUnassigned };
  }, [tickets]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== ALL ||
    severityFilter !== ALL ||
    projectFilter !== ALL ||
    responsibleFilter !== ALL;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== ALL && t.status !== statusFilter) return false;
      if (severityFilter !== ALL && t.severity !== severityFilter) return false;
      if (projectFilter !== ALL && t.project_id !== projectFilter) return false;
      if (responsibleFilter !== ALL) {
        if (responsibleFilter === '__unassigned__') {
          if (t.responsible_user_id) return false;
        } else if (t.responsible_user_id !== responsibleFilter) {
          return false;
        }
      }
      if (q) {
        const hay = [
          t.situation,
          t.description ?? '',
          t.action_plan ?? '',
          t.project_name ?? '',
          t.customer_name ?? '',
          t.responsible_name ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, search, statusFilter, severityFilter, projectFilter, responsibleFilter]);

  const handleDashboardFilter = ({
    status,
    severity,
  }: {
    status?: CsTicketStatus | null;
    severity?: CsTicketSeverity | null;
  }) => {
    if (status !== undefined) setStatusFilter(status ?? ALL);
    if (severity !== undefined) setSeverityFilter(severity ?? ALL);
    if (status === null && severity === null) setSearch('');
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter(ALL);
    setSeverityFilter(ALL);
  };

  const openNew = () => {
    setEditingTicket(null);
    setDialogOpen(true);
  };

  const openEdit = (ticket: CsTicket) => {
    setEditingTicket(ticket);
    setDialogOpen(true);
  };

  const handleStatusChange = (ticket: CsTicket, newStatus: CsTicketStatus) => {
    if (newStatus === ticket.status) return;
    updateMutation.mutate({ id: ticket.id, patch: { status: newStatus } });
  };

  const handleSeverityChange = (ticket: CsTicket, newSeverity: CsTicketSeverity) => {
    if (newSeverity === ticket.severity) return;
    updateMutation.mutate({ id: ticket.id, patch: { severity: newSeverity } });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <PageContainer>
      <TooltipProvider delayDuration={150}>
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Headset className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Customer Success</h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Gerencie tickets de atendimento das obras: registre situações, severidade, plano de
                ação e responsável.
              </p>
            </div>
          </div>
          <Button onClick={openNew} className="shrink-0">
            <Plus className="h-4 w-4 mr-1.5" />
            Novo ticket
          </Button>
        </div>

        {/* Dashboard executivo */}
        <CsDashboard tickets={tickets} onFilter={handleDashboardFilter} />

        {/* Toolbar de filtros */}
        <div className="rounded-lg border border-border bg-card p-3 mb-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por obra, cliente, situação, responsável…"
                className="pl-9 h-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                Filtros:
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[150px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={ALL}>Todos os status</SelectItem>
                  {CS_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="h-9 w-[160px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={ALL}>Todas as severidades</SelectItem>
                  {CS_SEVERITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                  <X className="h-3.5 w-3.5 mr-1" />
                  Limpar
                </Button>
              )}
              <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                {filtered.length} de {tickets.length}
              </span>
            </div>
          </div>
        </div>

        {/* Tabela */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Headset}
            title={tickets.length === 0 ? 'Nenhum ticket ainda' : 'Sem resultados'}
            description={
              tickets.length === 0
                ? 'Crie o primeiro ticket de atendimento da equipe de CS.'
                : 'Ajuste os filtros ou limpe a busca para ver mais resultados.'
            }
            action={
              tickets.length === 0
                ? { label: 'Novo ticket', onClick: openNew, icon: Plus }
                : { label: 'Limpar filtros', onClick: clearFilters, icon: X }
            }
          />
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs uppercase tracking-wider font-semibold">
                    Obra / Cliente
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold">
                    Situação
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold w-[140px]">
                    Severidade
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold w-[160px]">
                    Status
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold">
                    Responsável
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold w-[160px]">
                    Atualizado
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold w-[120px] text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} className="align-top">
                    {/* Obra / Cliente */}
                    <TableCell className="py-3">
                      <div className="flex flex-col min-w-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/gestao/obra/${t.project_id}`)}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate text-left flex items-center gap-1 group"
                        >
                          <span className="truncate">{t.project_name ?? '—'}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 shrink-0" />
                        </button>
                        {t.customer_name && (
                          <span className="text-xs text-muted-foreground truncate">
                            {t.customer_name}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Situação + descrição preview */}
                    <TableCell className="py-3 max-w-[320px]">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => navigate(`/gestao/cs/${t.id}`)}
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2 text-left"
                        >
                          {t.situation}
                        </button>
                        {t.description && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5 cursor-help">
                                {t.description}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md">
                              <p className="whitespace-pre-wrap text-xs">{t.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>

                    {/* Severidade — editável */}
                    <TableCell className="py-3">
                      <Select
                        value={t.severity}
                        onValueChange={(v) => handleSeverityChange(t, v as CsTicketSeverity)}
                      >
                        <SelectTrigger
                          className={cn(
                            'h-8 text-xs font-semibold border-0 px-2.5 rounded-md w-fit min-w-[110px]',
                            severityClass(t.severity),
                          )}
                        >
                          <SelectValue>
                            <span className="flex items-center gap-1.5">
                              {t.severity === 'critica' && (
                                <AlertTriangle className="h-3 w-3" />
                              )}
                              {severityLabel(t.severity)}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {CS_SEVERITY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Status — editável */}
                    <TableCell className="py-3">
                      <Select
                        value={t.status}
                        onValueChange={(v) => handleStatusChange(t, v as CsTicketStatus)}
                      >
                        <SelectTrigger
                          className={cn(
                            'h-8 text-xs font-semibold border-0 px-2.5 rounded-md w-fit min-w-[130px]',
                            statusClass(t.status),
                          )}
                        >
                          <SelectValue>{statusLabel(t.status)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {CS_STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Responsável */}
                    <TableCell className="py-3">
                      <span className="text-sm text-foreground">
                        {t.responsible_name ?? (
                          <span className="text-xs italic text-muted-foreground">Não atribuído</span>
                        )}
                      </span>
                    </TableCell>

                    {/* Atualizado */}
                    <TableCell className="py-3 text-xs text-muted-foreground tabular-nums">
                      {fmtDateTime(t.updated_at)}
                    </TableCell>

                    {/* Ações */}
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/gestao/cs/${t.id}`)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver detalhes</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(t)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar ticket</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteTarget(t)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Excluir ticket</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Dialog de criação/edição */}
        <CsTicketDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          ticket={editingTicket}
        />

        {/* Confirmação de exclusão */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Excluir ticket?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O ticket{' '}
                <strong>"{deleteTarget?.situation}"</strong> da obra{' '}
                <strong>{deleteTarget?.project_name ?? '—'}</strong> será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </PageContainer>
  );
}
