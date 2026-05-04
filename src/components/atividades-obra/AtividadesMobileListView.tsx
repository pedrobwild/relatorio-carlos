import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import {
  type ObraTask,
  type ObraTaskStatus,
  type ObraTaskInput,
  TASK_STATUSES,
} from "@/hooks/useObraTasks";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { AtividadeMobileCard } from "./AtividadeMobileCard";
import { AtividadeFormDialog } from "./AtividadeFormDialog";
import { DeleteTaskDialog } from "./DeleteTaskDialog";
import { EmptyState, PageSkeleton } from "@/components/ui/states";
import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMemberName } from "@/lib/taskUtils";

interface Props {
  tasks: ObraTask[];
  isLoading: boolean;
  onUpdateStatus: (id: string, status: ObraTaskStatus) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ObraTaskInput>) => void;
}

type FilterValue = "all" | ObraTaskStatus;

const filters: { value: FilterValue; label: string; dot?: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pendente", label: "Pendente", dot: "bg-yellow-500" },
  { value: "em_andamento", label: "Andamento", dot: "bg-blue-500" },
  { value: "pausado", label: "Pausado", dot: "bg-orange-500" },
  { value: "concluido", label: "Concluído", dot: "bg-green-500" },
];

export function AtividadesMobileListView({
  tasks,
  isLoading,
  onUpdateStatus,
  onDelete,
  onUpdate,
}: Props) {
  const [filter, setFilter] = useState<FilterValue>("all");
  const navigate = useNavigate();
  const { projectId } = useProjectNavigation();
  const [editTask, setEditTask] = useState<ObraTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ObraTask | null>(null);
  const { data: staffUsers = [] } = useStaffUsers();

  const resolveName = (userId: string | null) =>
    getMemberName(staffUsers, userId);

  const filtered = useMemo(() => {
    if (filter === "all") return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  // Count per status for filter chips
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tasks.length };
    TASK_STATUSES.forEach((s) => {
      c[s.value] = tasks.filter((t) => t.status === s.value).length;
    });
    return c;
  }, [tasks]);

  if (isLoading) {
    return <PageSkeleton rows={5} />;
  }

  return (
    <>
      {/* Horizontal filter chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-3">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0",
              filter === f.value
                ? "bg-foreground text-background shadow-sm"
                : "bg-muted/60 text-muted-foreground active:bg-muted",
            )}
          >
            {f.dot && <div className={cn("w-2 h-2 rounded-full", f.dot)} />}
            {f.label}
            <span className="tabular-nums opacity-70">
              {counts[f.value] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            filter === "all"
              ? "Nenhuma atividade"
              : "Nenhuma atividade neste status"
          }
          description={
            filter === "all"
              ? "Crie a primeira atividade para começar."
              : "Tente outro filtro."
          }
        />
      ) : (
        <div className="space-y-2 pb-bottom-nav">
          <AnimatePresence mode="popLayout">
            {filtered.map((task) => (
              <AtividadeMobileCard
                key={task.id}
                task={task}
                responsibleName={resolveName(task.responsible_user_id)}
                onUpdateStatus={onUpdateStatus}
                onDelete={(id) => {
                  const t = tasks.find((x) => x.id === id);
                  if (t) setDeleteTarget(t);
                }}
                onOpenDetail={(task) =>
                  navigate(`/obra/${projectId}/atividades/${task.id}`)
                }
                onEdit={setEditTask}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

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
