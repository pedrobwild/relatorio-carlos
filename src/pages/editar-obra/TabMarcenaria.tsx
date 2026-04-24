import { useState, useMemo } from "react";
import {
  Plus,
  Hammer,
  Paperclip,
  Trash2,
  Download,
  Upload,
  Loader2,
  FileText,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { EmptyState } from "@/components/EmptyState";
import {
  useMarcenaria,
  MarcenariaItem,
  MarcenariaItemInput,
  MarcenariaStatus,
  MARCENARIA_STATUS,
  MARCENARIA_STATUS_LABELS,
} from "@/hooks/useMarcenaria";
import {
  useMarcenariaAttachments,
  MarcenariaAttachment,
} from "@/hooks/useMarcenariaAttachments";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TabMarcenariaProps {
  projectId: string;
}

const statusBadgeVariant: Record<MarcenariaStatus, string> = {
  orcamento: "bg-muted text-muted-foreground border-border",
  aprovado: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900",
  producao: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900",
  entregue: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-900",
  instalado: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900",
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return value;
  }
}

interface ItemFormState {
  name: string;
  supplier: string;
  status: MarcenariaStatus;
  valor_orcado: string;
  valor_aprovado: string;
  observacoes: string;
  planned_approval_date: string;
  actual_approval_date: string;
  planned_production_start: string;
  actual_production_start: string;
  planned_delivery_date: string;
  actual_delivery_date: string;
  planned_installation_date: string;
  actual_installation_date: string;
}

function emptyFormState(): ItemFormState {
  return {
    name: "",
    supplier: "",
    status: "orcamento",
    valor_orcado: "",
    valor_aprovado: "",
    observacoes: "",
    planned_approval_date: "",
    actual_approval_date: "",
    planned_production_start: "",
    actual_production_start: "",
    planned_delivery_date: "",
    actual_delivery_date: "",
    planned_installation_date: "",
    actual_installation_date: "",
  };
}

function itemToFormState(item: MarcenariaItem): ItemFormState {
  return {
    name: item.name,
    supplier: item.supplier ?? "",
    status: item.status,
    valor_orcado: item.valor_orcado != null ? String(item.valor_orcado) : "",
    valor_aprovado:
      item.valor_aprovado != null ? String(item.valor_aprovado) : "",
    observacoes: item.observacoes ?? "",
    planned_approval_date: item.planned_approval_date ?? "",
    actual_approval_date: item.actual_approval_date ?? "",
    planned_production_start: item.planned_production_start ?? "",
    actual_production_start: item.actual_production_start ?? "",
    planned_delivery_date: item.planned_delivery_date ?? "",
    actual_delivery_date: item.actual_delivery_date ?? "",
    planned_installation_date: item.planned_installation_date ?? "",
    actual_installation_date: item.actual_installation_date ?? "",
  };
}

function parseNumber(raw: string): number | null {
  if (!raw.trim()) return null;
  const normalized = raw.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(raw: string): string | null {
  return raw.trim() ? raw : null;
}

function formStateToPayload(
  state: ItemFormState,
  projectId: string
): MarcenariaItemInput {
  return {
    project_id: projectId,
    name: state.name.trim(),
    supplier: state.supplier.trim() || null,
    status: state.status,
    valor_orcado: parseNumber(state.valor_orcado),
    valor_aprovado: parseNumber(state.valor_aprovado),
    observacoes: state.observacoes.trim() || null,
    planned_approval_date: parseDate(state.planned_approval_date),
    actual_approval_date: parseDate(state.actual_approval_date),
    planned_production_start: parseDate(state.planned_production_start),
    actual_production_start: parseDate(state.actual_production_start),
    planned_delivery_date: parseDate(state.planned_delivery_date),
    actual_delivery_date: parseDate(state.actual_delivery_date),
    planned_installation_date: parseDate(state.planned_installation_date),
    actual_installation_date: parseDate(state.actual_installation_date),
  };
}

function ItemFormDialog({
  projectId,
  mode,
  initialItem,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  projectId: string;
  mode: "create" | "edit";
  initialItem?: MarcenariaItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: MarcenariaItemInput) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<ItemFormState>(
    initialItem ? itemToFormState(initialItem) : emptyFormState()
  );

  // Reset form quando o dialog abrir com um item diferente
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setForm(initialItem ? itemToFormState(initialItem) : emptyFormState());
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = formStateToPayload(form, projectId);
    await onSubmit(payload);
  };

  const update = <K extends keyof ItemFormState>(
    key: K,
    value: ItemFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo item de marcenaria" : "Editar item"}
          </DialogTitle>
          <DialogDescription>
            Cadastre armários, painéis e móveis sob medida com fornecedor, status e mini-cronograma.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="marc-name">Nome *</Label>
              <Input
                id="marc-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Ex.: Armário da cozinha"
                required
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="marc-supplier">Fornecedor</Label>
              <Input
                id="marc-supplier"
                value={form.supplier}
                onChange={(e) => update("supplier", e.target.value)}
                placeholder="Nome do marceneiro"
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="marc-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => update("status", v as MarcenariaStatus)}
              >
                <SelectTrigger id="marc-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARCENARIA_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {MARCENARIA_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="marc-valor-orcado">Valor orçado (R$)</Label>
              <Input
                id="marc-valor-orcado"
                type="number"
                step="0.01"
                min="0"
                value={form.valor_orcado}
                onChange={(e) => update("valor_orcado", e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="marc-valor-aprovado">Valor aprovado (R$)</Label>
              <Input
                id="marc-valor-aprovado"
                type="number"
                step="0.01"
                min="0"
                value={form.valor_aprovado}
                onChange={(e) => update("valor_aprovado", e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Mini-cronograma */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Mini-cronograma</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <DateStageGroup
                label="Aprovação"
                plannedId="plan-approval"
                actualId="actual-approval"
                plannedValue={form.planned_approval_date}
                actualValue={form.actual_approval_date}
                onPlannedChange={(v) => update("planned_approval_date", v)}
                onActualChange={(v) => update("actual_approval_date", v)}
              />
              <DateStageGroup
                label="Produção"
                plannedId="plan-prod"
                actualId="actual-prod"
                plannedValue={form.planned_production_start}
                actualValue={form.actual_production_start}
                onPlannedChange={(v) => update("planned_production_start", v)}
                onActualChange={(v) => update("actual_production_start", v)}
              />
              <DateStageGroup
                label="Entrega"
                plannedId="plan-delivery"
                actualId="actual-delivery"
                plannedValue={form.planned_delivery_date}
                actualValue={form.actual_delivery_date}
                onPlannedChange={(v) => update("planned_delivery_date", v)}
                onActualChange={(v) => update("actual_delivery_date", v)}
              />
              <DateStageGroup
                label="Instalação"
                plannedId="plan-install"
                actualId="actual-install"
                plannedValue={form.planned_installation_date}
                actualValue={form.actual_installation_date}
                onPlannedChange={(v) => update("planned_installation_date", v)}
                onActualChange={(v) => update("actual_installation_date", v)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="marc-obs">Observações</Label>
            <Textarea
              id="marc-obs"
              value={form.observacoes}
              onChange={(e) => update("observacoes", e.target.value)}
              placeholder="Dimensões, acabamentos, material..."
              rows={3}
              maxLength={2000}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!form.name.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "create" ? "Criar item" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DateStageGroup({
  label,
  plannedId,
  actualId,
  plannedValue,
  actualValue,
  onPlannedChange,
  onActualChange,
}: {
  label: string;
  plannedId: string;
  actualId: string;
  plannedValue: string;
  actualValue: string;
  onPlannedChange: (v: string) => void;
  onActualChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={plannedId} className="text-xs">
            Planejado
          </Label>
          <Input
            id={plannedId}
            type="date"
            value={plannedValue}
            onChange={(e) => onPlannedChange(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={actualId} className="text-xs">
            Real
          </Label>
          <Input
            id={actualId}
            type="date"
            value={actualValue}
            onChange={(e) => onActualChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function AttachmentsPanel({
  item,
  projectId,
  canEdit,
}: {
  item: MarcenariaItem;
  projectId: string;
  canEdit: boolean;
}) {
  const { attachments, isLoading, upload, isUploading, remove } =
    useMarcenariaAttachments(item.id, projectId);
  const [pendingDelete, setPendingDelete] = useState<MarcenariaAttachment | null>(
    null
  );

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await upload(Array.from(files));
    e.target.value = "";
  };

  const handleDownload = async (att: MarcenariaAttachment) => {
    if (!att.url) return;
    try {
      const resp = await fetch(att.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.caption || `anexo-${att.id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(att.url, "_blank");
    }
  };

  return (
    <div className="space-y-3 border-t border-border pt-3 mt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Paperclip className="w-4 h-4" />
          Anexos
          <Badge variant="outline" className="ml-1">
            {attachments.length}
          </Badge>
        </h4>
        {canEdit && (
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 min-h-[36px]">
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>Enviar arquivo</span>
            <input
              type="file"
              className="sr-only"
              multiple
              disabled={isUploading}
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.dwg,.dxf"
              onChange={handleFiles}
            />
          </label>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando anexos...
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum anexo. {canEdit && "Envie o projeto executivo em PDF, orçamentos ou fotos de referência."}
        </p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-3 rounded-md border border-border bg-background p-2"
            >
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {att.caption || "Arquivo"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(att.uploaded_at), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                  {att.size_bytes != null &&
                    ` • ${(att.size_bytes / 1024).toFixed(0)} KB`}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(att)}
                disabled={!att.url}
              >
                <Download className="w-4 h-4" />
              </Button>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingDelete(att)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover anexo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover &quot;{pendingDelete?.caption}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pendingDelete) await remove(pendingDelete);
                setPendingDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MarcenariaItemCard({
  item,
  projectId,
  canEdit,
  onEdit,
  onDelete,
}: {
  item: MarcenariaItem;
  projectId: string;
  canEdit: boolean;
  onEdit: (item: MarcenariaItem) => void;
  onDelete: (item: MarcenariaItem) => void;
}) {
  const [showAttachments, setShowAttachments] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{item.name}</CardTitle>
            {item.supplier && (
              <CardDescription className="mt-1">
                Fornecedor: {item.supplier}
              </CardDescription>
            )}
          </div>
          <Badge
            variant="outline"
            className={statusBadgeVariant[item.status]}
          >
            {MARCENARIA_STATUS_LABELS[item.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Valores */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Valor orçado</p>
            <p className="font-medium">{formatCurrency(item.valor_orcado)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valor aprovado</p>
            <p className="font-medium">{formatCurrency(item.valor_aprovado)}</p>
          </div>
        </div>

        {/* Mini-cronograma compacto */}
        <div className="rounded-md border border-border bg-muted/30 p-2 text-xs space-y-1">
          <MiniScheduleRow
            label="Aprovação"
            planned={item.planned_approval_date}
            actual={item.actual_approval_date}
          />
          <MiniScheduleRow
            label="Produção"
            planned={item.planned_production_start}
            actual={item.actual_production_start}
          />
          <MiniScheduleRow
            label="Entrega"
            planned={item.planned_delivery_date}
            actual={item.actual_delivery_date}
          />
          <MiniScheduleRow
            label="Instalação"
            planned={item.planned_installation_date}
            actual={item.actual_installation_date}
          />
        </div>

        {item.observacoes && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {item.observacoes}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAttachments((v) => !v)}
            className="gap-2"
          >
            <Paperclip className="w-4 h-4" />
            {showAttachments ? "Ocultar anexos" : "Ver anexos"}
          </Button>
          {canEdit && (
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(item)}
              >
                Editar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(item)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {showAttachments && (
          <AttachmentsPanel
            item={item}
            projectId={projectId}
            canEdit={canEdit}
          />
        )}
      </CardContent>
    </Card>
  );
}

function MiniScheduleRow({
  label,
  planned,
  actual,
}: {
  label: string;
  planned: string | null;
  actual: string | null;
}) {
  const hasPlanned = !!planned;
  const hasActual = !!actual;
  const isLate =
    hasPlanned &&
    !hasActual &&
    new Date(planned as string).getTime() < new Date().setHours(0, 0, 0, 0);

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium text-muted-foreground w-20 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-3 text-right">
        <span
          className={isLate ? "text-destructive font-medium" : ""}
          title="Planejado"
        >
          P: {formatDate(planned)}
        </span>
        <span
          className={hasActual ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}
          title="Real"
        >
          R: {formatDate(actual)}
        </span>
      </div>
    </div>
  );
}

export function TabMarcenaria({ projectId }: TabMarcenariaProps) {
  const { isStaff } = useUserRole();
  const {
    items,
    isLoading,
    create,
    isCreating,
    update,
    isUpdating,
    remove,
  } = useMarcenaria(projectId);

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<MarcenariaItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<MarcenariaItem | null>(null);

  // Agrupa itens por status para visão de board-like
  const grouped = useMemo(() => {
    const map = new Map<MarcenariaStatus, MarcenariaItem[]>();
    for (const s of MARCENARIA_STATUS) map.set(s, []);
    for (const it of items) {
      const list = map.get(it.status);
      if (list) list.push(it);
    }
    return map;
  }, [items]);

  const handleCreate = async (payload: MarcenariaItemInput) => {
    await create(payload);
    setCreateOpen(false);
  };

  const handleUpdate = async (payload: MarcenariaItemInput) => {
    if (!editItem) return;
    const { project_id: _ignored, ...patch } = payload;
    void _ignored;
    await update({ id: editItem.id, patch });
    setEditItem(null);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await remove(deleteItem.id);
    setDeleteItem(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Hammer className="w-5 h-5" />
            Marcenaria
          </h2>
          <p className="text-sm text-muted-foreground">
            Armários, painéis e móveis sob medida com fornecedor, status e mini-cronograma.
          </p>
        </div>
        {isStaff && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Novo item
              </Button>
            </DialogTrigger>
            <ItemFormDialog
              projectId={projectId}
              mode="create"
              open={createOpen}
              onOpenChange={setCreateOpen}
              onSubmit={handleCreate}
              isSubmitting={isCreating}
            />
          </Dialog>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          variant="documents"
          title="Nenhum item de marcenaria"
          description={
            isStaff
              ? "Cadastre o primeiro item para acompanhar fornecedor, status e cronograma."
              : "Assim que a equipe técnica cadastrar itens de marcenaria, eles aparecerão aqui."
          }
        >
          {isStaff && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Cadastrar item
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {MARCENARIA_STATUS.map((status) => {
            const list = grouped.get(status) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={status} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={statusBadgeVariant[status]}
                  >
                    {MARCENARIA_STATUS_LABELS[status]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {list.length} {list.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {list.map((item) => (
                    <MarcenariaItemCard
                      key={item.id}
                      item={item}
                      projectId={projectId}
                      canEdit={isStaff}
                      onEdit={setEditItem}
                      onDelete={setDeleteItem}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Dialog de edição */}
      {editItem && (
        <ItemFormDialog
          projectId={projectId}
          mode="edit"
          initialItem={editItem}
          open={!!editItem}
          onOpenChange={(o) => !o && setEditItem(null)}
          onSubmit={handleUpdate}
          isSubmitting={isUpdating}
        />
      )}

      {/* Confirmação de exclusão */}
      <AlertDialog
        open={!!deleteItem}
        onOpenChange={(o) => !o && setDeleteItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover &quot;{deleteItem?.name}&quot;? Todos os anexos vinculados também serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default TabMarcenaria;
