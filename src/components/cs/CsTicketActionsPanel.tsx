/**
 * CsTicketActionsPanel — gestão das ações (sub-tarefas) de um ticket de CS.
 *
 * Mostra lista de ações com edição inline (status, prazo, responsável),
 * criação rápida no topo e remoção. Apresenta resumo (total, concluídas,
 * atrasadas) e tempo médio de conclusão.
 */
import { useState } from "react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarClock,
  CheckCircle2,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
  User as UserIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";

import {
  CS_ACTION_STATUS_OPTIONS,
  type CsActionStatus,
  type CsTicketAction,
  avgActionResolutionMs,
  formatDuration,
  summarizeActions,
  useCreateCsTicketAction,
  useCsTicketActions,
  useDeleteCsTicketAction,
  useUpdateCsTicketAction,
} from "@/hooks/useCsTicketActions";
import { useStaffUsers } from "@/hooks/useStaffUsers";

const NONE = "__none__";

const statusClass = (s: CsActionStatus): string => {
  switch (s) {
    case "pendente":
      return "bg-muted text-muted-foreground border border-border";
    case "em_andamento":
      return "bg-warning/10 text-warning border border-warning/30";
    case "concluida":
      return "bg-success/10 text-success border border-success/25";
    case "cancelada":
      return "bg-muted/40 text-muted-foreground border border-dashed border-border";
  }
};

const statusLabel = (s: CsActionStatus) =>
  CS_ACTION_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;

const fmtDate = (d: string | null) =>
  d ? format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }) : "—";

const isOverdue = (a: CsTicketAction) => {
  if (!a.due_date) return false;
  if (a.status === "concluida" || a.status === "cancelada") return false;
  return isBefore(parseISO(a.due_date), startOfDay(new Date()));
};

interface ActionRowProps {
  action: CsTicketAction;
  staff: Array<{ id: string; nome: string }>;
  onPatch: (
    patch: Parameters<
      ReturnType<typeof useUpdateCsTicketAction>["mutate"]
    >[0]["patch"],
  ) => void;
  onDelete: () => void;
}

function ActionRow({ action, staff, onPatch, onDelete }: ActionRowProps) {
  const overdue = isOverdue(action);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 sm:p-4 space-y-3",
        overdue ? "border-destructive/40" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Input
          defaultValue={action.title}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== action.title) onPatch({ title: v });
          }}
          className="h-8 text-sm font-medium border-0 px-2 -ml-2 focus-visible:ring-1 bg-transparent"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Textarea
        defaultValue={action.description ?? ""}
        placeholder="Descrição (opcional)"
        rows={2}
        onBlur={(e) => {
          const v = e.target.value.trim() || null;
          if (v !== (action.description ?? null)) onPatch({ description: v });
        }}
        className="text-xs resize-none"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Status */}
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Status
          </Label>
          <Select
            value={action.status}
            onValueChange={(v) => onPatch({ status: v as CsActionStatus })}
          >
            <SelectTrigger
              className={cn("h-8 text-xs px-2", statusClass(action.status))}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {CS_ACTION_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prazo */}
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Prazo
          </Label>
          <Input
            type="date"
            defaultValue={action.due_date ?? ""}
            onBlur={(e) => {
              const v = e.target.value || null;
              if (v !== (action.due_date ?? null)) onPatch({ due_date: v });
            }}
            className={cn(
              "h-8 text-xs",
              overdue && "border-destructive text-destructive",
            )}
          />
        </div>

        {/* Responsável */}
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Responsável
          </Label>
          <Select
            value={action.responsible_user_id ?? NONE}
            onValueChange={(v) =>
              onPatch({ responsible_user_id: v === NONE ? null : v })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={NONE} className="text-xs">
                — Sem responsável —
              </SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Rodapé com metadados */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {overdue && (
          <span className="text-destructive font-medium flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            Atrasada
          </span>
        )}
        {action.status === "concluida" && action.completed_at && (
          <span className="text-success flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Concluída em {fmtDate(action.completed_at)}
          </span>
        )}
        {action.responsible_name && (
          <span className="flex items-center gap-1">
            <UserIcon className="h-3 w-3" />
            {action.responsible_name}
          </span>
        )}
      </div>
    </div>
  );
}

interface CsTicketActionsPanelProps {
  ticketId: string;
}

export function CsTicketActionsPanel({ ticketId }: CsTicketActionsPanelProps) {
  const { data: actions = [], isLoading } = useCsTicketActions(ticketId);
  const { data: staff = [] } = useStaffUsers();
  const create = useCreateCsTicketAction();
  const update = useUpdateCsTicketAction();
  const remove = useDeleteCsTicketAction();

  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newResp, setNewResp] = useState<string>(NONE);
  const [deleteTarget, setDeleteTarget] = useState<CsTicketAction | null>(null);

  const summary = summarizeActions(actions);
  const avgMs = avgActionResolutionMs(actions);

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    await create.mutateAsync({
      ticket_id: ticketId,
      title,
      due_date: newDue || null,
      responsible_user_id: newResp === NONE ? null : newResp,
    });
    setNewTitle("");
    setNewDue("");
    setNewResp(NONE);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Ações do ticket
        </h2>
        {summary.total > 0 && (
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {summary.done}/{summary.total} concluídas
            {summary.overdue > 0 && (
              <span className="text-destructive font-medium ml-2">
                · {summary.overdue} atrasada{summary.overdue > 1 ? "s" : ""}
              </span>
            )}
            {avgMs != null && (
              <span className="ml-2">
                · tempo médio {formatDuration(avgMs)}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Criação rápida */}
      <div className="rounded-lg border border-dashed border-border bg-surface-sunken/40 p-3 mb-4 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_180px_auto] gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) handleCreate();
            }}
            placeholder="Nova ação… (ex.: Ligar para o cliente)"
            className="h-9 text-sm"
            maxLength={200}
          />
          <Input
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            className="h-9 text-sm"
            title="Prazo"
          />
          <Select value={newResp} onValueChange={setNewResp}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={NONE}>— Sem responsável —</SelectItem>
              {staff.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={!newTitle.trim() || create.isPending}
            size="sm"
            className="h-9"
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-1.5" />
            )}
            Adicionar
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : actions.length === 0 ? (
        <p className="text-sm italic text-muted-foreground py-4 text-center">
          Nenhuma ação registrada. Use o campo acima para criar a primeira.
        </p>
      ) : (
        <div className="space-y-2">
          {actions.map((a) => (
            <ActionRow
              key={a.id}
              action={a}
              staff={staff as any}
              onPatch={(patch) =>
                update.mutate({ id: a.id, ticket_id: ticketId, patch })
              }
              onDelete={() => setDeleteTarget(a)}
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover ação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação será removida permanentemente do ticket.
              {deleteTarget && (
                <span className="block mt-2 font-medium text-foreground">
                  "{deleteTarget.title}"
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  remove.mutate({ id: deleteTarget.id, ticket_id: ticketId });
                  setDeleteTarget(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
