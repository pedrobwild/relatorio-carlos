/**
 * CsTicketDetalhe — página de detalhes de um ticket de Customer Success.
 *
 * Mostra:
 *   - Cabeçalho com obra/cliente, situação, status atual e severidade
 *   - Cards com plano de ação, descrição, responsável e datas
 *   - Linha do tempo de atualizações (status/severidade/responsável/etc)
 *     alimentada pelo trigger `log_cs_ticket_changes`, e comentários
 *     livres adicionados pela equipe.
 *
 * Acesso restrito a equipe staff (mesma RLS dos tickets).
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Headset,
  Pencil,
  AlertTriangle,
  Clock,
  CheckCircle2,
  MessageSquare,
  Send,
  ExternalLink,
  User as UserIcon,
  CalendarClock,
  ListChecks,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/states';
import { cn } from '@/lib/utils';

import {
  CS_SEVERITY_OPTIONS,
  CS_STATUS_OPTIONS,
  type CsTicket,
  type CsTicketSeverity,
  type CsTicketStatus,
  useCsTickets,
  useUpdateCsTicket,
} from '@/hooks/useCsTickets';
import {
  useAddCsTicketComment,
  useCsTicketHistory,
  type CsTicketHistoryEntry,
  type CsTicketHistoryEventType,
} from '@/hooks/useCsTicketHistory';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { CsTicketDialog } from '@/components/cs/CsTicketDialog';
import { CsTicketActionsPanel } from '@/components/cs/CsTicketActionsPanel';
import { formatDuration } from '@/hooks/useCsTicketActions';

// ----- helpers visuais (espelham CsTickets) -----

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
const severityLabel = (s: CsTicketSeverity) =>
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
const statusLabel = (s: CsTicketStatus) =>
  CS_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;

const fmtDateTime = (iso: string | null | undefined) =>
  iso ? format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—';

const fmtRelative = (iso: string) =>
  formatDistanceToNow(parseISO(iso), { locale: ptBR, addSuffix: true });

// ----- Linha do tempo: rótulos por evento -----

const EVENT_META: Record<
  CsTicketHistoryEventType,
  { icon: React.ElementType; label: string; tone: string }
> = {
  created: { icon: CheckCircle2, label: 'Ticket criado', tone: 'text-success' },
  status_changed: { icon: RefreshCw, label: 'Status alterado', tone: 'text-info' },
  severity_changed: { icon: AlertTriangle, label: 'Severidade alterada', tone: 'text-warning' },
  responsible_changed: { icon: UserIcon, label: 'Responsável alterado', tone: 'text-foreground' },
  action_plan_changed: { icon: ListChecks, label: 'Plano de ação atualizado', tone: 'text-primary' },
  situation_changed: { icon: FileText, label: 'Situação atualizada', tone: 'text-foreground' },
  description_changed: { icon: FileText, label: 'Descrição atualizada', tone: 'text-foreground' },
  comment: { icon: MessageSquare, label: 'Comentário', tone: 'text-foreground' },
};

interface TimelineEntryProps {
  entry: CsTicketHistoryEntry;
  resolveResponsibleName: (id: string | null) => string | null;
}

function TimelineEntry({ entry, resolveResponsibleName }: TimelineEntryProps) {
  const meta = EVENT_META[entry.event_type] ?? EVENT_META.comment;
  const Icon = meta.icon;

  // Renderização do diff por tipo
  let body: React.ReactNode = null;
  if (entry.event_type === 'status_changed') {
    body = (
      <p className="text-sm text-foreground">
        <span className="text-muted-foreground">de</span>{' '}
        <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', statusClass(entry.old_value as CsTicketStatus))}>
          {statusLabel(entry.old_value as CsTicketStatus)}
        </span>{' '}
        <span className="text-muted-foreground">para</span>{' '}
        <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', statusClass(entry.new_value as CsTicketStatus))}>
          {statusLabel(entry.new_value as CsTicketStatus)}
        </span>
      </p>
    );
  } else if (entry.event_type === 'severity_changed') {
    body = (
      <p className="text-sm text-foreground">
        <span className="text-muted-foreground">de</span>{' '}
        <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', severityClass(entry.old_value as CsTicketSeverity))}>
          {severityLabel(entry.old_value as CsTicketSeverity)}
        </span>{' '}
        <span className="text-muted-foreground">para</span>{' '}
        <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', severityClass(entry.new_value as CsTicketSeverity))}>
          {severityLabel(entry.new_value as CsTicketSeverity)}
        </span>
      </p>
    );
  } else if (entry.event_type === 'responsible_changed') {
    const oldName = resolveResponsibleName(entry.old_value || null) ?? 'Não atribuído';
    const newName = resolveResponsibleName(entry.new_value || null) ?? 'Não atribuído';
    body = (
      <p className="text-sm text-foreground">
        <span className="text-muted-foreground">de</span> <strong>{oldName}</strong>{' '}
        <span className="text-muted-foreground">para</span> <strong>{newName}</strong>
      </p>
    );
  } else if (entry.event_type === 'created') {
    body = (
      <p className="text-sm text-muted-foreground">
        Ticket aberto com status{' '}
        <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', statusClass((entry.new_value as CsTicketStatus) ?? 'aberto'))}>
          {statusLabel((entry.new_value as CsTicketStatus) ?? 'aberto')}
        </span>
      </p>
    );
  } else if (entry.event_type === 'comment') {
    body = (
      <div className="rounded-md bg-muted/40 border border-border px-3 py-2">
        <p className="text-sm text-foreground whitespace-pre-wrap">{entry.notes}</p>
      </div>
    );
  } else {
    // action_plan_changed, situation_changed, description_changed → mostra preview
    const preview = entry.new_value?.trim() || '(vazio)';
    body = (
      <div className="rounded-md bg-muted/40 border border-border px-3 py-2">
        <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">{preview}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'h-8 w-8 rounded-full bg-card border border-border flex items-center justify-center shrink-0',
            meta.tone,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 w-px bg-border mt-1" />
      </div>
      <div className="flex-1 pb-5 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{meta.label}</span>
          <span className="text-xs text-muted-foreground">
            {entry.actor_name ? `por ${entry.actor_name}` : 'sistema'}
          </span>
          <span className="text-xs text-muted-foreground" title={fmtDateTime(entry.created_at)}>
            • {fmtRelative(entry.created_at)}
          </span>
        </div>
        <div className="mt-1.5">{body}</div>
      </div>
    </div>
  );
}

// ============================================================
// Página
// ============================================================
export default function CsTicketDetalhe() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  const { data: tickets = [], isLoading } = useCsTickets();
  const { data: history = [], isLoading: loadingHistory } = useCsTicketHistory(ticketId);
  const { data: staff = [] } = useStaffUsers();
  const update = useUpdateCsTicket();
  const addComment = useAddCsTicketComment();

  const [editOpen, setEditOpen] = useState(false);
  const [comment, setComment] = useState('');

  const ticket = useMemo<CsTicket | undefined>(
    () => tickets.find((t) => t.id === ticketId),
    [tickets, ticketId],
  );

  const staffMap = useMemo(() => {
    const m: Record<string, string> = {};
    staff.forEach((s: any) => {
      m[s.id] = s.nome;
    });
    return m;
  }, [staff]);

  const resolveResponsibleName = (id: string | null) => (id ? staffMap[id] ?? null : null);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (!ticket) {
    return (
      <PageContainer>
        <EmptyState
          icon={Headset}
          title="Ticket não encontrado"
          description="O ticket pode ter sido excluído ou você não tem permissão para visualizá-lo."
          action={{ label: 'Voltar para CS', onClick: () => navigate('/gestao/cs/operacional'), icon: ArrowLeft }}
        />
      </PageContainer>
    );
  }

  const handleStatusChange = (s: CsTicketStatus) => {
    if (s === ticket.status) return;
    update.mutate({ id: ticket.id, patch: { status: s } });
  };

  const handleSeverityChange = (s: CsTicketSeverity) => {
    if (s === ticket.severity) return;
    update.mutate({ id: ticket.id, patch: { severity: s } });
  };

  const handleAddComment = async () => {
    const text = comment.trim();
    if (!text) return;
    await addComment.mutateAsync({ ticketId: ticket.id, notes: text });
    setComment('');
  };

  return (
    <PageContainer>
      {/* Voltar */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/gestao/cs/operacional')}
        className="mb-3 -ml-2 h-8 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Voltar para Customer Success
      </Button>

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Headset className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1 min-w-0">
            <button
              type="button"
              onClick={() => navigate(`/gestao/obra/${ticket.project_id}`)}
              className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 group"
            >
              {ticket.project_name ?? 'Obra'}
              {ticket.customer_name ? ` — ${ticket.customer_name}` : ''}
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
            </button>
            <h1 className="text-2xl font-bold tracking-tight leading-tight break-words">
              {ticket.situation}
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              Aberto em {fmtDateTime(ticket.created_at)} · Atualizado{' '}
              {fmtRelative(ticket.updated_at)}
            </p>
          </div>
        </div>
        <Button onClick={() => setEditOpen(true)} variant="outline" className="shrink-0">
          <Pencil className="h-4 w-4 mr-1.5" />
          Editar ticket
        </Button>
      </div>

      {/* Status + Severidade (controles rápidos) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Status atual
          </p>
          <Select value={ticket.status} onValueChange={(v) => handleStatusChange(v as CsTicketStatus)}>
            <SelectTrigger
              className={cn(
                'h-10 text-sm font-semibold border-0 px-3 rounded-md w-full',
                statusClass(ticket.status),
              )}
            >
              <SelectValue>{statusLabel(ticket.status)}</SelectValue>
            </SelectTrigger>
            <SelectContent position="popper">
              {CS_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {ticket.resolved_at && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              Concluído em {fmtDateTime(ticket.resolved_at)} · resolução em{' '}
              <span className="font-medium text-foreground">
                {formatDuration(
                  new Date(ticket.resolved_at).getTime() -
                    new Date(ticket.created_at).getTime(),
                )}
              </span>
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Severidade
          </p>
          <Select
            value={ticket.severity}
            onValueChange={(v) => handleSeverityChange(v as CsTicketSeverity)}
          >
            <SelectTrigger
              className={cn(
                'h-10 text-sm font-semibold border-0 px-3 rounded-md w-full',
                severityClass(ticket.severity),
              )}
            >
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  {ticket.severity === 'critica' && <AlertTriangle className="h-3.5 w-3.5" />}
                  {severityLabel(ticket.severity)}
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
        </div>
      </div>

      {/* Conteúdo + Linha do tempo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-4">
          {/* Plano de ação */}
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Plano de ação
              </h2>
            </div>
            {ticket.action_plan ? (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {ticket.action_plan}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                Nenhum plano de ação registrado. Use "Editar ticket" para adicionar.
              </p>
            )}
          </section>

          {/* Descrição */}
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Descrição da situação
              </h2>
            </div>
            {ticket.description ? (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {ticket.description}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">Sem descrição adicional.</p>
            )}
          </section>

          {/* Linha do tempo */}
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Histórico e atualizações
              </h2>
              <span className="text-xs text-muted-foreground ml-auto">
                {history.length} {history.length === 1 ? 'evento' : 'eventos'}
              </span>
            </div>

            {/* Adicionar comentário */}
            <div className="mb-5 space-y-2">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Adicione um comentário ou atualização para o time…"
                rows={3}
                maxLength={2000}
                className="resize-none"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleAddComment}
                  disabled={!comment.trim() || addComment.isPending}
                  size="sm"
                >
                  {addComment.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1.5" />
                  )}
                  Comentar
                </Button>
              </div>
            </div>

            <Separator className="mb-4" />

            {/* Eventos */}
            {loadingHistory ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm italic text-muted-foreground py-4 text-center">
                Nenhuma atualização registrada ainda.
              </p>
            ) : (
              <div className="space-y-0">
                {history.map((entry) => (
                  <TimelineEntry
                    key={entry.id}
                    entry={entry}
                    resolveResponsibleName={resolveResponsibleName}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Coluna lateral */}
        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Responsável
            </h3>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                {ticket.responsible_name ? (
                  <p className="text-sm font-medium text-foreground truncate">
                    {ticket.responsible_name}
                  </p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">Não atribuído</p>
                )}
                <p className="text-xs text-muted-foreground">Equipe staff</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 space-y-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Detalhes
            </h3>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Obra</span>
              <button
                type="button"
                onClick={() => navigate(`/gestao/obra/${ticket.project_id}`)}
                className="font-medium text-foreground hover:text-primary truncate text-right"
              >
                {ticket.project_name ?? '—'}
              </button>
            </div>
            {ticket.customer_name && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium text-foreground truncate text-right">
                  {ticket.customer_name}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Criado em</span>
              <span className="font-medium text-foreground text-right tabular-nums">
                {fmtDateTime(ticket.created_at)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Última atualização</span>
              <span className="font-medium text-foreground text-right tabular-nums">
                {fmtDateTime(ticket.updated_at)}
              </span>
            </div>
            {ticket.resolved_at && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Concluído em</span>
                <span className="font-medium text-success text-right tabular-nums">
                  {fmtDateTime(ticket.resolved_at)}
                </span>
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Dialog de edição */}
      <CsTicketDialog open={editOpen} onOpenChange={setEditOpen} ticket={ticket} />
    </PageContainer>
  );
}
