import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  ChevronUp,
  ChevronDown,
  ListChecks,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TASK_STATUSES,
  type ObraTask,
  type ObraTaskStatus,
  type ObraTaskInput,
} from "@/hooks/useObraTasks";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { AtividadeFormDialog } from "./AtividadeFormDialog";
import { DeleteTaskDialog } from "./DeleteTaskDialog";
import { TableSkeleton, EmptyState } from "@/components/ui-premium";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { cn } from "@/lib/utils";
import {
  getMemberName,
  isTaskOverdue,
  priorityConfig,
  statusVariant,
} from "@/lib/taskUtils";

interface Props {
  tasks: ObraTask[];
  isLoading: boolean;
  onUpdateStatus: (id: string, status: ObraTaskStatus) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ObraTaskInput>) => void;
}

type SortField = "title" | "responsible" | "due_date" | "priority" | "status";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};
const STATUS_ORDER: Record<string, number> = {
  pendente: 0,
  em_andamento: 1,
  pausado: 2,
  concluido: 3,
};

export function AtividadesListView({
  tasks,
  isLoading,
  onUpdateStatus,
  onDelete,
  onUpdate,
}: Props) {
  const [editTask, setEditTask] = useState<ObraTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ObraTask | null>(null);
  const [sortField, setSortField] = useState<SortField>("due_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const navigate = useNavigate();
  const { projectId } = useProjectNavigation();
  const { data: staffUsers = [] } = useStaffUsers();

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title, "pt-BR");
          break;
        case "responsible": {
          const na = getMemberName(staffUsers, a.responsible_user_id) ?? "zzz";
          const nb = getMemberName(staffUsers, b.responsible_user_id) ?? "zzz";
          cmp = na.localeCompare(nb, "pt-BR");
          break;
        }
        case "due_date":
          cmp = (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
          break;
        case "priority":
          cmp =
            (PRIORITY_ORDER[a.priority] ?? 2) -
            (PRIORITY_ORDER[b.priority] ?? 2);
          break;
        case "status":
          cmp = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tasks, sortField, sortDir, staffUsers]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  if (isLoading) {
    return <TableSkeleton rows={6} columns={6} />;
  }

  if (!tasks.length) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nenhuma atividade cadastrada"
        description="Crie a primeira atividade para começar a gerenciar as tarefas internas da equipe."
        size="md"
      />
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="w-[25%] cursor-pointer select-none"
                onClick={() => handleSort("title")}
              >
                <span className="inline-flex items-center gap-1">
                  Atividade <SortIcon field="title" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("responsible")}
              >
                <span className="inline-flex items-center gap-1">
                  Responsável <SortIcon field="responsible" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("priority")}
              >
                <span className="inline-flex items-center gap-1">
                  Prioridade <SortIcon field="priority" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("due_date")}
              >
                <span className="inline-flex items-center gap-1">
                  Prazo <SortIcon field="due_date" />
                </span>
              </TableHead>
              <TableHead>Custo</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("status")}
              >
                <span className="inline-flex items-center gap-1">
                  Status <SortIcon field="status" />
                </span>
              </TableHead>
              <TableHead>Conclusão</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((task) => {
              const overdue = isTaskOverdue(task);
              const prio = priorityConfig[task.priority];
              return (
                <TableRow
                  key={task.id}
                  className={task.status === "concluido" ? "opacity-60" : ""}
                >
                  <TableCell
                    className="cursor-pointer"
                    onClick={() =>
                      navigate(`/obra/${projectId}/atividades/${task.id}`)
                    }
                  >
                    <div>
                      <span
                        className={cn(
                          "font-medium",
                          task.status === "concluido" && "line-through",
                        )}
                      >
                        {task.title}
                      </span>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {getMemberName(staffUsers, task.responsible_user_id) ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs font-medium",
                        prio.color,
                      )}
                    >
                      <span>{prio.icon}</span> {prio.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    {task.due_date ? (
                      <span
                        className={cn(
                          "text-sm flex items-center gap-1",
                          overdue && "text-destructive font-medium",
                        )}
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        {format(
                          new Date(task.due_date + "T00:00:00"),
                          "dd/MM/yy",
                          { locale: ptBR },
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {task.cost != null ? (
                      <span className="text-sm">
                        R${" "}
                        {task.cost.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={task.status}
                      onValueChange={(v) =>
                        onUpdateStatus(task.id, v as ObraTaskStatus)
                      }
                    >
                      <SelectTrigger className="h-7 w-auto border-0 p-0 focus:ring-0">
                        <Badge
                          variant="outline"
                          className={cn(
                            statusVariant[task.status],
                            "text-xs cursor-pointer",
                          )}
                        >
                          {
                            TASK_STATUSES.find((s) => s.value === task.status)
                              ?.label
                          }
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {task.status === "concluido" && task.completed_at ? (
                      <div className="text-xs space-y-0.5">
                        <span>
                          {format(new Date(task.completed_at), "dd/MM/yy", {
                            locale: ptBR,
                          })}
                        </span>
                        {task.days_overdue != null && (
                          <p
                            className={
                              task.days_overdue > 0
                                ? "text-destructive font-medium"
                                : "text-green-600 font-medium"
                            }
                          >
                            {task.days_overdue > 0
                              ? `${task.days_overdue}d atraso`
                              : task.days_overdue === 0
                                ? "No prazo"
                                : `${Math.abs(task.days_overdue)}d antecipado`}
                          </p>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditTask(task)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTarget(task)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AtividadeFormDialog
        open={!!editTask}
        onOpenChange={(open) => !open && setEditTask(null)}
        onSubmit={(input) => {
          if (editTask) {
            onUpdate(editTask.id, input);
            setEditTask(null);
          }
        }}
        initialData={editTask}
        draftScope={projectId}
      />

      <DeleteTaskDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        taskTitle={deleteTarget?.title || ""}
        onConfirm={() => {
          if (deleteTarget) {
            onDelete(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </>
  );
}
