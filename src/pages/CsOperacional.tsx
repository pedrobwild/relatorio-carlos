/**
 * CsOperacional — Módulo operacional de Customer Success.
 *
 * Lista, filtra e gerencia tickets de atendimento da equipe de CS.
 * Cada ticket vincula uma obra/cliente, situação, severidade, status,
 * descrição, plano de ação e responsável.
 *
 * Acesso: toda a equipe staff (admin, manager, engineer, gestor, cs,
 * arquitetura, suprimentos, financeiro). Clientes não têm acesso.
 *
 * Para a visão executiva agregada, ver `CsAnalytics`.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Headset,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Eye,
  BarChart3,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { PageContainer } from "@/components/layout/PageContainer";
import {
  PageHeader,
  PageToolbar,
  DataTable,
  type DataTableColumn,
  EmptyState,
  TableSkeleton,
  StatusBadge,
  type StatusTone,
} from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/searchNormalize";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  CS_SEVERITY_OPTIONS,
  CS_STATUS_OPTIONS,
  type CsTicket,
  type CsTicketSeverity,
  type CsTicketStatus,
  useCsTickets,
  useDeleteCsTicket,
  useUpdateCsTicket,
} from "@/hooks/useCsTickets";
import { CsTicketDialog } from "@/components/cs/CsTicketDialog";
import { useAllCsActionsSummary } from "@/hooks/useCsTicketActions";

const ALL = "__all__";

// ----- mapeamento semântico para StatusBadge -----
const severityTone = (s: CsTicketSeverity): StatusTone => {
  switch (s) {
    case "baixa":
      return "muted";
    case "media":
      return "info";
    case "alta":
      return "warning";
    case "critica":
      return "danger";
  }
};

const severityLabel = (s: CsTicketSeverity): string =>
  CS_SEVERITY_OPTIONS.find((o) => o.value === s)?.label ?? s;

const statusTone = (s: CsTicketStatus): StatusTone => {
  switch (s) {
    case "aberto":
      return "info";
    case "em_andamento":
      return "warning";
    case "concluido":
      return "success";
  }
};

const statusLabel = (s: CsTicketStatus): string =>
  CS_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;

const fmtDateTime = (iso: string | null) =>
  iso ? format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—";

// Trigger pílula (mantém affordance de edição, visual semelhante ao StatusBadge)
const pillTriggerClass = (extra?: string) =>
  cn(
    "h-7 w-fit max-w-[160px] text-xs font-medium border-0 px-2 py-0 rounded-md gap-1.5",
    "[&>svg]:hidden focus:ring-2 focus:ring-ring",
    extra,
  );

const severityPillBg = (s: CsTicketSeverity): string => {
  switch (s) {
    case "baixa":
      return "bg-muted text-muted-foreground hover:bg-muted/80";
    case "media":
      return "bg-info/10 text-info hover:bg-info/15";
    case "alta":
      return "bg-warning/12 text-warning hover:bg-warning/20";
    case "critica":
      return "bg-destructive/10 text-destructive hover:bg-destructive/15";
  }
};

const statusPillBg = (s: CsTicketStatus): string => {
  switch (s) {
    case "aberto":
      return "bg-info/10 text-info hover:bg-info/15";
    case "em_andamento":
      return "bg-warning/12 text-warning hover:bg-warning/20";
    case "concluido":
      return "bg-success/10 text-success hover:bg-success/15";
  }
};

// ============================================================
// Página
// ============================================================
export default function CsOperacional() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: tickets = [], isLoading } = useCsTickets();
  const { data: actionsSummary = {} } = useAllCsActionsSummary();
  const updateMutation = useUpdateCsTicket();
  const deleteMutation = useDeleteCsTicket();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") ?? ALL,
  );
  const [severityFilter, setSeverityFilter] = useState<string>(
    searchParams.get("severity") ?? ALL,
  );
  const [projectFilter, setProjectFilter] = useState<string>(ALL);
  const [responsibleFilter, setResponsibleFilter] = useState<string>(ALL);

  // Limpa querystring após aplicar para não engessar a navegação subsequente
  useEffect(() => {
    if (searchParams.get("status") || searchParams.get("severity")) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        : (t.customer_name ?? "Obra sem nome");
      map.set(t.project_id, label);
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
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
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    return { opts, hasUnassigned };
  }, [tickets]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== ALL ||
    severityFilter !== ALL ||
    projectFilter !== ALL ||
    responsibleFilter !== ALL;

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== ALL && t.status !== statusFilter) return false;
      if (severityFilter !== ALL && t.severity !== severityFilter) return false;
      if (projectFilter !== ALL && t.project_id !== projectFilter) return false;
      if (responsibleFilter !== ALL) {
        if (responsibleFilter === "__unassigned__") {
          if (t.responsible_user_id) return false;
        } else if (t.responsible_user_id !== responsibleFilter) {
          return false;
        }
      }
      if (
        !matchesSearch(search, [
          t.situation,
          t.description,
          t.action_plan,
          t.project_name,
          t.customer_name,
          t.responsible_name,
        ])
      ) {
        return false;
      }
      return true;
    });
  }, [
    tickets,
    search,
    statusFilter,
    severityFilter,
    projectFilter,
    responsibleFilter,
  ]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter(ALL);
    setSeverityFilter(ALL);
    setProjectFilter(ALL);
    setResponsibleFilter(ALL);
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

  const handleSeverityChange = (
    ticket: CsTicket,
    newSeverity: CsTicketSeverity,
  ) => {
    if (newSeverity === ticket.severity) return;
    updateMutation.mutate({ id: ticket.id, patch: { severity: newSeverity } });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  // ----- columns -----
  const columns: DataTableColumn<CsTicket>[] = useMemo(
    () => [
      {
        id: "project",
        header: "Obra / Cliente",
        width: "minmax(220px, 1.4fr)",
        cell: (t) => (
          <div className="flex flex-col min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/gestao/obra/${t.project_id}`);
              }}
              className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate text-left flex items-center gap-1 group/link"
            >
              <span className="truncate">{t.project_name ?? "—"}</span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 shrink-0" />
            </button>
            {t.customer_name && (
              <span className="text-xs text-muted-foreground truncate">
                {t.customer_name}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "situation",
        header: "Situação",
        width: "minmax(240px, 2fr)",
        cell: (t) => (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/gestao/cs/${t.id}`);
              }}
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
        ),
      },
      {
        id: "severity",
        header: "Severidade",
        width: "140px",
        cell: (t) => (
          <Select
            value={t.severity}
            onValueChange={(v) =>
              handleSeverityChange(t, v as CsTicketSeverity)
            }
          >
            <SelectTrigger
              className={pillTriggerClass(severityPillBg(t.severity))}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Severidade: ${severityLabel(t.severity)}`}
            >
              <SelectValue>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      `bg-${severityTone(t.severity) === "muted" ? "muted-foreground" : severityTone(t.severity) === "danger" ? "destructive" : severityTone(t.severity)}`,
                    )}
                  />
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
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "160px",
        cell: (t) => (
          <Select
            value={t.status}
            onValueChange={(v) => handleStatusChange(t, v as CsTicketStatus)}
          >
            <SelectTrigger
              className={pillTriggerClass(statusPillBg(t.status))}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Status: ${statusLabel(t.status)}`}
            >
              <SelectValue>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      `bg-${statusTone(t.status) === "danger" ? "destructive" : statusTone(t.status)}`,
                    )}
                  />
                  {statusLabel(t.status)}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper">
              {CS_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        id: "responsible",
        header: "Responsável",
        width: "minmax(140px, 1fr)",
        cell: (t) => (
          <span className="text-sm text-foreground truncate">
            {t.responsible_name ?? (
              <span className="text-muted-foreground italic">
                Não atribuído
              </span>
            )}
          </span>
        ),
      },
      {
        id: "actions_progress",
        header: "Ações",
        width: "minmax(160px, 1.2fr)",
        cell: (t) => {
          const s = actionsSummary[t.id];
          if (!s || s.total === 0) {
            return (
              <span className="text-xs italic text-muted-foreground">
                Sem ações
              </span>
            );
          }
          const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
          return (
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="tabular-nums font-medium text-foreground">
                  {s.done}/{s.total}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[40px] max-w-[80px]">
                  <div
                    className={cn(
                      "h-full",
                      s.overdue > 0 ? "bg-destructive" : "bg-success",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {s.overdue > 0 && (
                  <span className="text-destructive font-medium text-[11px]">
                    {s.overdue} atras.
                  </span>
                )}
              </div>
              {s.nextDueDate && (
                <span
                  className="text-[11px] text-muted-foreground truncate"
                  title={s.nextDueTitle ?? ""}
                >
                  Próx.:{" "}
                  {format(parseISO(s.nextDueDate), "dd/MM", { locale: ptBR })}
                  {s.nextDueTitle ? ` · ${s.nextDueTitle}` : ""}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "updated_at",
        header: "Atualizado",
        width: "160px",
        cell: (t) => (
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {fmtDateTime(t.updated_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Ações",
        width: "120px",
        align: "right",
        cell: (t) => (
          <div className="flex items-center justify-end gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/gestao/cs/${t.id}`);
                  }}
                  aria-label="Abrir detalhes"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abrir detalhes</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(t);
                  }}
                  aria-label="Editar ticket"
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(t);
                  }}
                  aria-label="Excluir ticket"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Excluir ticket</TooltipContent>
            </Tooltip>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, actionsSummary],
  );

  return (
    <PageContainer>
      <TooltipProvider delayDuration={150}>
        <PageHeader
          eyebrow="Customer Success"
          title="CS — Operacional"
          description="Gestão diária de tickets vinculados às obras: registre situações, severidade, plano de ação e responsável."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/gestao/cs/analytics")}
                className="h-9"
              >
                <BarChart3 className="h-4 w-4 mr-1.5" />
                Ver analytics
              </Button>
              <Button onClick={openNew} size="sm" className="h-9">
                <Plus className="h-4 w-4 mr-1.5" />
                Novo ticket
              </Button>
            </>
          }
          flush
        />

        {/* Toolbar premium — busca + filtros + contador */}
        <PageToolbar
          className="mt-2"
          sticky={false}
          search={
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por obra, cliente, situação, responsável…"
                className="h-9 pl-8 text-sm bg-surface border-border-subtle"
              />
            </div>
          }
          filters={
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[140px] text-xs border-border-subtle bg-surface">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={ALL}>Todos status</SelectItem>
                  {CS_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="h-8 w-[150px] text-xs border-border-subtle bg-surface">
                  <SelectValue placeholder="Severidade" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={ALL}>Todas severidades</SelectItem>
                  {CS_SEVERITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-8 w-[180px] text-xs border-border-subtle bg-surface">
                  <SelectValue placeholder="Obra" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  <SelectItem value={ALL}>Todas as obras</SelectItem>
                  {projectOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={responsibleFilter}
                onValueChange={setResponsibleFilter}
              >
                <SelectTrigger className="h-8 w-[170px] text-xs border-border-subtle bg-surface">
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  <SelectItem value={ALL}>Todos responsáveis</SelectItem>
                  {responsibleOptions.hasUnassigned && (
                    <SelectItem value="__unassigned__">
                      Não atribuído
                    </SelectItem>
                  )}
                  {responsibleOptions.opts.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 px-2 text-xs text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Limpar
                </Button>
              )}
            </>
          }
          meta={
            <span className="text-xs text-muted-foreground tabular-nums">
              <span className="font-semibold text-foreground">
                {filtered.length}
              </span>
              <span className="opacity-60"> / {tickets.length} tickets</span>
            </span>
          }
        />

        {/* Conteúdo */}
        <div className="mt-4">
          {isLoading ? (
            <TableSkeleton rows={6} columns={7} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Headset}
              title={
                tickets.length === 0 ? "Nenhum ticket ainda" : "Sem resultados"
              }
              description={
                tickets.length === 0
                  ? "Crie o primeiro ticket de atendimento da equipe de CS."
                  : "Ajuste os filtros ou limpe a busca para ver mais resultados."
              }
              action={
                tickets.length === 0
                  ? { label: "Novo ticket", onClick: openNew, icon: Plus }
                  : {
                      label: "Limpar filtros",
                      onClick: clearFilters,
                      icon: X,
                      variant: "outline",
                    }
              }
            />
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(t) => t.id}
              density="comfortable"
              ariaLabel="Tickets de Customer Success"
            />
          )}
        </div>

        {/* Dialog de criação/edição */}
        <CsTicketDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          ticket={editingTicket}
        />

        {/* Confirmação de exclusão */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Excluir ticket?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O ticket{" "}
                <strong>"{deleteTarget?.situation}"</strong> da obra{" "}
                <strong>{deleteTarget?.project_name ?? "—"}</strong> será
                removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </PageContainer>
  );
}
