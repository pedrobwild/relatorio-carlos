import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Calendar,
  Weight,
  ListChecks,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Activity } from "./types";

interface TabAtividadesProps {
  activities: Activity[];
  onAdd: (a: {
    description: string;
    planned_start: string;
    planned_end: string;
    weight: string;
    etapa?: string;
    detailed_description?: string;
  }) => Promise<boolean>;
  onUpdate: (
    id: string,
    field: string,
    value: string | number | null,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (fromIndex: number, toIndex: number) => Promise<void>;
}

function WeightBar({ total }: { total: number }) {
  const isValid = total === 100;
  const isOver = total > 100;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted/50 border border-border/60">
      <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
        Peso total das atividades:
      </span>
      <Progress
        value={Math.min(total, 100)}
        className={cn(
          "h-2 flex-1 rounded-full",
          isValid
            ? "[&>div]:bg-[hsl(var(--success))]"
            : isOver
              ? "[&>div]:bg-destructive"
              : "[&>div]:bg-[hsl(var(--warning))]",
        )}
      />
      <span
        className={cn(
          "text-sm font-bold tabular-nums whitespace-nowrap",
          isValid
            ? "text-[hsl(var(--success))]"
            : isOver
              ? "text-destructive"
              : "text-[hsl(var(--warning))]",
        )}
      >
        {total.toFixed(1)}%
      </span>
    </div>
  );
}

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "0px";
      ref.current.style.height = `${Math.max(38, ref.current.scrollHeight)}px`;
    }
  }, [value]);

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      rows={1}
      className={cn(
        "min-h-[38px] resize-none overflow-hidden py-2 px-2.5 text-sm leading-snug",
        className,
      )}
    />
  );
}

function InlineAddRow({ onAdd }: { onAdd: TabAtividadesProps["onAdd"] }) {
  const [form, setForm] = useState({
    description: "",
    planned_start: "",
    planned_end: "",
    weight: "5",
    etapa: "",
    detailed_description: "",
  });
  const [adding, setAdding] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const canSubmit = form.description && form.planned_start && form.planned_end;

  const handleAdd = async () => {
    if (!canSubmit) return;
    setAdding(true);
    const ok = await onAdd({
      ...form,
      etapa: form.etapa || undefined,
      detailed_description: form.detailed_description || undefined,
    });
    if (ok) {
      setForm({
        description: "",
        planned_start: "",
        planned_end: "",
        weight: "5",
        etapa: "",
        detailed_description: "",
      });
      setShowDetails(false);
    }
    setAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div
      className="border-t-2 border-dashed border-primary/20 bg-accent/20"
      onKeyDown={handleKeyDown}
    >
      {/* Desktop inline row */}
      <div className="hidden md:grid md:grid-cols-[1fr_100px_130px_130px_130px_130px_70px_44px] gap-0 items-start">
        <div className="p-2 pl-3 flex items-start gap-2">
          <span className="inline-flex items-center justify-center w-6 h-[38px] text-xs font-bold text-primary/40">
            +
          </span>
          <AutoResizeTextarea
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            placeholder="Nova atividade... (Ctrl+Enter para adicionar)"
            autoFocus={false}
          />
        </div>
        <div className="p-2">
          <Input
            value={form.etapa}
            onChange={(e) => setForm({ ...form, etapa: e.target.value })}
            placeholder="Etapa"
            className="h-[38px] text-xs"
          />
        </div>
        <div className="p-2">
          <Input
            type="date"
            value={form.planned_start}
            onChange={(e) =>
              setForm({ ...form, planned_start: e.target.value })
            }
            className="h-[38px] text-xs"
          />
        </div>
        <div className="p-2">
          <Input
            type="date"
            value={form.planned_end}
            onChange={(e) => setForm({ ...form, planned_end: e.target.value })}
            className="h-[38px] text-xs"
          />
        </div>
        <div className="p-2" />
        <div className="p-2" />
        <div className="p-2">
          <Input
            type="number"
            min={1}
            max={100}
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: e.target.value })}
            className="h-[38px] text-xs text-center"
          />
        </div>
        <div className="p-2 flex items-center justify-center">
          <Button
            size="icon"
            variant="default"
            className="h-[38px] w-[38px] rounded-lg"
            onClick={handleAdd}
            disabled={!canSubmit || adding}
          >
            {adding ? (
              <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      {/* Desktop: optional detailed description row */}
      <div className="hidden md:block px-3 pb-2">
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"
        >
          {showDetails ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Descrição detalhada
        </button>
        {showDetails && (
          <div className="pl-[calc(1.5rem+20px+0.5rem)]">
            <Textarea
              value={form.detailed_description}
              onChange={(e) =>
                setForm({ ...form, detailed_description: e.target.value })
              }
              placeholder="Descreva detalhes da atividade..."
              rows={2}
              className="text-xs resize-none"
            />
          </div>
        )}
      </div>

      {/* Mobile add form */}
      <div className="md:hidden p-3 space-y-3">
        <AutoResizeTextarea
          value={form.description}
          onChange={(v) => setForm({ ...form, description: v })}
          placeholder="Descrição da nova atividade..."
        />
        <Input
          value={form.etapa}
          onChange={(e) => setForm({ ...form, etapa: e.target.value })}
          placeholder="Etapa (opcional)"
          className="h-9 text-xs"
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Início Prev.
            </Label>
            <Input
              type="date"
              value={form.planned_start}
              onChange={(e) =>
                setForm({ ...form, planned_start: e.target.value })
              }
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Término Prev.
            </Label>
            <Input
              type="date"
              value={form.planned_end}
              onChange={(e) =>
                setForm({ ...form, planned_end: e.target.value })
              }
              className="h-9 text-xs"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {showDetails ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Descrição detalhada
        </button>
        {showDetails && (
          <Textarea
            value={form.detailed_description}
            onChange={(e) =>
              setForm({ ...form, detailed_description: e.target.value })
            }
            placeholder="Descreva detalhes da atividade..."
            rows={2}
            className="text-xs resize-none"
          />
        )}
        <div className="flex items-end gap-2">
          <div className="w-20 space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Peso (%)
            </Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              className="h-9 text-xs"
            />
          </div>
          <Button
            className="flex-1 h-9 gap-1.5"
            onClick={handleAdd}
            disabled={!canSubmit || adding}
          >
            {adding ? (
              <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  activity,
  index,
  onUpdate,
  onDelete,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  detailOpen,
  onToggleDetail,
}: {
  activity: Activity;
  index: number;
  onUpdate: TabAtividadesProps["onUpdate"];
  onDelete: TabAtividadesProps["onDelete"];
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (
    event: React.DragEvent<HTMLButtonElement>,
    index: number,
  ) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnd: () => void;
  detailOpen: boolean;
  onToggleDetail: () => void;
}) {
  // BUG-C: trim check for hasDetail
  const hasDetail = !!activity.detailed_description?.trim();

  return (
    <>
      {/* Desktop row */}
      <div
        className={cn(
          "hidden md:block group/row border-b border-border/40 last:border-b-0 transition-colors hover:bg-accent/30",
          index % 2 === 1 && "bg-muted/20",
          isDragging && "opacity-55",
          isDragOver && "bg-primary/10 ring-1 ring-inset ring-primary/30",
        )}
        onDragOver={(event) => onDragOver(event, index)}
        onDrop={(event) => onDrop(event, index)}
      >
        <div className="grid grid-cols-[1fr_100px_130px_130px_130px_130px_70px_44px] gap-0 items-start">
          <div className="p-2 pl-3 flex items-start gap-2">
            <div className="flex items-center gap-1 shrink-0 pt-2">
              {hasDetail || detailOpen ? (
                <button
                  type="button"
                  onClick={onToggleDetail}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-accent hover:text-foreground transition-colors"
                >
                  {detailOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  draggable
                  aria-label={`Reordenar atividade ${index + 1}`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 opacity-0 transition-all cursor-grab active:cursor-grabbing group-hover/row:opacity-100 hover:bg-accent hover:text-foreground"
                  onDragStart={(event) => onDragStart(event, index)}
                  onDragEnd={onDragEnd}
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
              )}
              <span className="text-xs font-bold text-muted-foreground tabular-nums w-5 text-right">
                {index + 1}
              </span>
            </div>
            <AutoResizeTextarea
              value={activity.description}
              onChange={(v) => onUpdate(activity.id, "description", v)}
              placeholder="Descrição da atividade..."
            />
          </div>
          <div className="p-2">
            <Input
              value={activity.etapa || ""}
              onChange={(e) =>
                onUpdate(activity.id, "etapa", e.target.value || null)
              }
              placeholder="Etapa"
              className="h-[38px] text-xs"
            />
          </div>
          <div className="p-2">
            <Input
              type="date"
              value={activity.planned_start}
              onChange={(e) =>
                onUpdate(activity.id, "planned_start", e.target.value)
              }
              className="h-[38px] text-xs"
            />
          </div>
          <div className="p-2">
            <Input
              type="date"
              value={activity.planned_end}
              onChange={(e) =>
                onUpdate(activity.id, "planned_end", e.target.value)
              }
              className="h-[38px] text-xs"
            />
          </div>
          <div className="p-2">
            <Input
              type="date"
              value={activity.actual_start || ""}
              onChange={(e) =>
                onUpdate(activity.id, "actual_start", e.target.value || null)
              }
              className="h-[38px] text-xs"
            />
          </div>
          <div className="p-2">
            <Input
              type="date"
              value={activity.actual_end || ""}
              onChange={(e) =>
                onUpdate(activity.id, "actual_end", e.target.value || null)
              }
              className="h-[38px] text-xs"
            />
          </div>
          <div className="p-2">
            <Input
              type="number"
              min={0}
              max={100}
              value={activity.weight}
              onChange={(e) =>
                onUpdate(activity.id, "weight", parseFloat(e.target.value) || 0)
              }
              className="h-[38px] text-xs text-center font-semibold"
            />
          </div>
          <div className="p-2 flex items-center justify-center">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-[38px] w-[38px] text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/row:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover atividade?</AlertDialogTitle>
                  <AlertDialogDescription>
                    "{activity.description}" será removida permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(activity.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        {/* Collapsible detailed description — BUG-A: only persist on actual typing */}
        {detailOpen && (
          <div className="px-3 pb-2 pl-[calc(1.5rem+20px+2rem)]">
            <Textarea
              value={activity.detailed_description || ""}
              onChange={(e) => {
                const val = e.target.value.trim() ? e.target.value : null;
                onUpdate(activity.id, "detailed_description", val);
              }}
              placeholder="Descrição detalhada..."
              rows={2}
              className="text-xs resize-none bg-muted/30"
              autoFocus={!hasDetail}
            />
          </div>
        )}
        {/* Add detail button — BUG-A: only opens panel, no DB write */}
        {!hasDetail && !detailOpen && (
          <div className="px-3 pb-1 pl-[calc(1.5rem+20px+2rem)] opacity-0 group-hover/row:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onToggleDetail}
              className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-1"
            >
              <Plus className="h-2.5 w-2.5" /> Adicionar descrição detalhada
            </button>
          </div>
        )}
      </div>

      {/* Mobile card */}
      <div
        className={cn(
          "md:hidden border-b border-border/40 last:border-b-0 p-3 space-y-2.5",
          isDragging && "opacity-55",
          isDragOver && "bg-primary/10 ring-1 ring-inset ring-primary/30",
        )}
        onDragOver={(event) => onDragOver(event, index)}
        onDrop={(event) => onDrop(event, index)}
      >
        <div className="flex items-start gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold bg-primary/10 text-primary shrink-0 mt-1">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <AutoResizeTextarea
              value={activity.description}
              onChange={(v) => onUpdate(activity.id, "description", v)}
              placeholder="Descrição..."
            />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground/50 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover atividade?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{activity.description}" será removida permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(activity.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="pl-8">
          <Input
            value={activity.etapa || ""}
            onChange={(e) =>
              onUpdate(activity.id, "etapa", e.target.value || null)
            }
            placeholder="Etapa (opcional)"
            className="h-8 text-xs"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 pl-8">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Início Prev.
            </Label>
            <Input
              type="date"
              value={activity.planned_start}
              onChange={(e) =>
                onUpdate(activity.id, "planned_start", e.target.value)
              }
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Término Prev.
            </Label>
            <Input
              type="date"
              value={activity.planned_end}
              onChange={(e) =>
                onUpdate(activity.id, "planned_end", e.target.value)
              }
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Início Real
            </Label>
            <Input
              type="date"
              value={activity.actual_start || ""}
              onChange={(e) =>
                onUpdate(activity.id, "actual_start", e.target.value || null)
              }
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Término Real
            </Label>
            <Input
              type="date"
              value={activity.actual_end || ""}
              onChange={(e) =>
                onUpdate(activity.id, "actual_end", e.target.value || null)
              }
              className="h-9 text-xs"
            />
          </div>
        </div>
        <div className="pl-8 flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground">Peso:</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={activity.weight}
            onChange={(e) =>
              onUpdate(activity.id, "weight", parseFloat(e.target.value) || 0)
            }
            className="h-8 w-16 text-xs text-center font-semibold"
          />
          <span className="text-[10px] text-muted-foreground">%</span>
        </div>
        {/* Mobile collapsible detail */}
        {(hasDetail || detailOpen) && (
          <Collapsible open={detailOpen} onOpenChange={onToggleDetail}>
            <CollapsibleTrigger className="pl-8 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
              {detailOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Descrição detalhada
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-8 pt-1">
              <Textarea
                value={activity.detailed_description || ""}
                onChange={(e) => {
                  const val = e.target.value.trim() ? e.target.value : null;
                  onUpdate(activity.id, "detailed_description", val);
                }}
                placeholder="Descrição detalhada..."
                rows={2}
                className="text-xs resize-none bg-muted/30"
              />
            </CollapsibleContent>
          </Collapsible>
        )}
        {!hasDetail && !detailOpen && (
          <button
            type="button"
            onClick={onToggleDetail}
            className="pl-8 text-[10px] text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-1"
          >
            <Plus className="h-2.5 w-2.5" /> Descrição detalhada
          </button>
        )}
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 space-y-3">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-accent flex items-center justify-center">
        <ListChecks className="h-6 w-6 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Nenhuma atividade cadastrada
        </p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Adicione atividades ao cronograma para acompanhar o progresso da obra.
        </p>
      </div>
    </div>
  );
}

export function TabAtividades({
  activities,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}: TabAtividadesProps) {
  const totalWeight = activities.reduce((sum, a) => sum + (a.weight || 0), 0);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // BUG-F: Lift detail open state to parent, indexed by activity.id
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const toggleDetail = useCallback((id: string) => {
    setOpenDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const clearDragState = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      await onDelete(id);
      setOpenDetails((prev) => {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
    },
    [onDelete],
  );

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLButtonElement>, index: number) => {
      setDraggedIndex(index);
      setDragOverIndex(index);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    },
    [],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dragOverIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [dragOverIndex],
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();

      const sourceIndex =
        draggedIndex ?? Number(event.dataTransfer.getData("text/plain"));
      if (Number.isNaN(sourceIndex) || sourceIndex === index) {
        clearDragState();
        return;
      }

      await onReorder(sourceIndex, index);
      clearDragState();
    },
    [clearDragState, draggedIndex, onReorder],
  );

  return (
    <div className="space-y-4">
      {activities.length > 0 && <WeightBar total={totalWeight} />}

      <Card className="border-border/60 overflow-hidden">
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Cronograma de Atividades
              </CardTitle>
              <CardDescription className="text-xs">
                {activities.length === 0
                  ? "Monte o cronograma adicionando atividades abaixo"
                  : `${activities.length} atividade${activities.length !== 1 ? "s" : ""}`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 mt-3">
          {/* Desktop column headers */}
          <div className="hidden md:grid md:grid-cols-[1fr_100px_130px_130px_130px_130px_70px_44px] gap-0 bg-muted/60 border-y border-border/60 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="py-2.5 pl-3 pr-2 flex items-center gap-2">
              <span className="w-[calc(1rem+20px+0.5rem)]" />
              Descrição
            </div>
            <div className="py-2.5 px-2 text-center">Etapa</div>
            <div className="py-2.5 px-2 text-center">Início Prev.</div>
            <div className="py-2.5 px-2 text-center">Término Prev.</div>
            <div className="py-2.5 px-2 text-center">Início Real</div>
            <div className="py-2.5 px-2 text-center">Término Real</div>
            <div className="py-2.5 px-2 text-center flex items-center justify-center gap-1">
              <Weight className="h-3 w-3" /> %
            </div>
            <div className="py-2.5 px-2" />
          </div>

          {activities.length > 0 ? (
            <div>
              {activities.map((a, i) => (
                <ActivityRow
                  key={a.id}
                  activity={a}
                  index={i}
                  onUpdate={onUpdate}
                  onDelete={handleDelete}
                  isDragging={draggedIndex === i}
                  isDragOver={dragOverIndex === i && draggedIndex !== i}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={clearDragState}
                  detailOpen={!!openDetails[a.id]}
                  onToggleDetail={() => toggleDetail(a.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}

          <InlineAddRow onAdd={onAdd} />
        </CardContent>
      </Card>
    </div>
  );
}
