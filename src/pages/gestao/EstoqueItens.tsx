import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Plus,
  Search,
  Loader2,
  Pencil,
  Building2,
  Warehouse,
  AlertTriangle,
  CircleSlash,
  X,
} from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EmptyState, PageSkeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type StockItem = {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  description: string | null;
};

type StockBalance = {
  id: string;
  item_id: string;
  location_type: "estoque" | "obra";
  project_id: string | null;
  quantity: number;
  updated_at: string;
};

type Project = { id: string; name: string };

type StatusFilter = "all" | "low" | "zero" | "ok";

const itemSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(120),
  unit: z.string().trim().min(1, "Unidade obrigatória").max(20),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  min_quantity: z.coerce
    .number()
    .min(0, "Mínimo deve ser zero ou maior")
    .optional()
    .nullable(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

// Limite considerado "saldo baixo" caso o item não tenha min_quantity definido.
const DEFAULT_LOW_THRESHOLD = 5;

export default function EstoqueItens() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all"); // all | estoque | <projectId>
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [creating, setCreating] = useState(false);

  // Queries
  const itemsQ = useQuery({
    queryKey: ["stock", "items", "with-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as (StockItem & { min_quantity?: number | null })[];
    },
  });

  const balancesQ = useQuery({
    queryKey: ["stock", "balances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_balances").select("*");
      if (error) throw error;
      return (data ?? []) as StockBalance[];
    },
  });

  const projectsQ = useQuery({
    queryKey: ["stock", "projects-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    (projectsQ.data ?? []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [projectsQ.data]);

  // Mutations
  const upsertItem = useMutation({
    mutationFn: async (input: ItemFormValues & { id?: string }) => {
      const payload: Record<string, unknown> = {
        name: input.name,
        unit: input.unit,
        category: input.category || null,
        description: input.description || null,
        min_quantity: input.min_quantity ?? null,
      };

      if (input.id) {
        const { error } = await supabase
          .from("stock_items")
          .update(payload)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id ?? null;
        const { error } = await supabase.from("stock_items").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["stock", "items"] });
      qc.invalidateQueries({ queryKey: ["stock", "items", "with-min"] });
      toast.success(vars.id ? "Item atualizado" : "Item cadastrado");
      setEditing(null);
      setCreating(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar item"),
  });

  // Agregação por item para a linha (saldo total + por local + status)
  type Row = {
    item: StockItem & { min_quantity?: number | null };
    totalByLocation: { key: string; locationType: "estoque" | "obra"; projectId: string | null; quantity: number }[];
    total: number;
    matchingTotal: number; // saldo somado considerando filtro de obra/estoque
    status: "zero" | "low" | "ok";
  };

  const rows: Row[] = useMemo(() => {
    const items = itemsQ.data ?? [];
    const balances = balancesQ.data ?? [];

    return items.map((item) => {
      const itemBalances = balances.filter((b) => b.item_id === item.id);
      const totalByLocation = itemBalances.map((b) => ({
        key: `${b.location_type}:${b.project_id ?? "central"}`,
        locationType: b.location_type,
        projectId: b.project_id,
        quantity: Number(b.quantity),
      }));
      const total = totalByLocation.reduce((s, b) => s + b.quantity, 0);

      // saldo considerando o filtro de local
      let matchingTotal = total;
      if (projectFilter === "estoque") {
        matchingTotal = totalByLocation
          .filter((b) => b.locationType === "estoque")
          .reduce((s, b) => s + b.quantity, 0);
      } else if (projectFilter !== "all") {
        matchingTotal = totalByLocation
          .filter((b) => b.locationType === "obra" && b.projectId === projectFilter)
          .reduce((s, b) => s + b.quantity, 0);
      }

      const min = item.min_quantity ?? DEFAULT_LOW_THRESHOLD;
      const refQty = projectFilter === "all" ? total : matchingTotal;
      let status: "zero" | "low" | "ok";
      if (refQty <= 0) status = "zero";
      else if (refQty <= min) status = "low";
      else status = "ok";

      return { item, totalByLocation, total, matchingTotal, status };
    });
  }, [itemsQ.data, balancesQ.data, projectFilter]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      // busca por nome / categoria / descrição
      if (term) {
        const hay = `${r.item.name} ${r.item.category ?? ""} ${r.item.description ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      // filtro por obra: exige que o item tenha algum saldo registrado naquele local
      if (projectFilter === "estoque") {
        if (!r.totalByLocation.some((b) => b.locationType === "estoque")) return false;
      } else if (projectFilter !== "all") {
        if (
          !r.totalByLocation.some(
            (b) => b.locationType === "obra" && b.projectId === projectFilter,
          )
        )
          return false;
      }
      // filtro por status
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, projectFilter, statusFilter]);

  const counters = useMemo(() => {
    const total = rows.length;
    const zero = rows.filter((r) => r.status === "zero").length;
    const low = rows.filter((r) => r.status === "low").length;
    return { total, zero, low };
  }, [rows]);

  const isLoading = itemsQ.isLoading || balancesQ.isLoading;
  const hasFilter = search.trim() !== "" || projectFilter !== "all" || statusFilter !== "all";

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Itens de estoque
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catálogo de materiais com saldo, filtros por obra e edição rápida.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo item
        </Button>
      </header>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Itens cadastrados"
          value={counters.total}
          icon={Package}
          tone="default"
        />
        <SummaryCard
          label="Saldo baixo"
          value={counters.low}
          icon={AlertTriangle}
          tone="warning"
          onClick={() => setStatusFilter("low")}
        />
        <SummaryCard
          label="Zerado / negativo"
          value={counters.zero}
          icon={CircleSlash}
          tone="danger"
          onClick={() => setStatusFilter("zero")}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, categoria ou descrição"
            className="pl-9"
            aria-label="Buscar itens"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="sm:w-[220px]" aria-label="Filtrar por local">
            <SelectValue placeholder="Local" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Todos os locais</SelectItem>
            <SelectItem value="estoque">Estoque central</SelectItem>
            {(projectsQ.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="sm:w-[180px]" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="low">Saldo baixo</SelectItem>
            <SelectItem value="zero">Zerado / negativo</SelectItem>
            <SelectItem value="ok">Saldo ok</SelectItem>
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setProjectFilter("all");
              setStatusFilter("all");
            }}
            className="gap-1"
          >
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <PageSkeleton />
      ) : filteredRows.length === 0 ? (
        hasFilter ? (
          <EmptyState
            icon={Search}
            title="Nenhum item encontrado"
            description="Ajuste os filtros ou a busca para ver outros materiais."
          />
        ) : (
          <EmptyState
            icon={Package}
            title="Nenhum item cadastrado"
            description="Cadastre os materiais que você quer controlar no estoque (ex: cimento, tinta, piso)."
            action={{ label: "Novo item", onClick: () => setCreating(true), icon: Plus }}
          />
        )
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">
                  {projectFilter === "all" ? "Saldo total" : "Saldo no local"}
                </TableHead>
                <TableHead>Mínimo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Onde está</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => {
                const refQty = projectFilter === "all" ? r.total : r.matchingTotal;
                return (
                  <TableRow key={r.item.id}>
                    <TableCell>
                      <div className="font-medium">{r.item.name}</div>
                      {r.item.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {r.item.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.item.category || "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        r.status === "zero" && "text-destructive font-semibold",
                        r.status === "low" && "text-amber-700 dark:text-amber-400 font-semibold",
                      )}
                    >
                      {refQty.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}{" "}
                      <span className="text-xs text-muted-foreground font-sans">
                        {r.item.unit}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.item.min_quantity != null
                        ? `${r.item.min_quantity} ${r.item.unit}`
                        : `≤ ${DEFAULT_LOW_THRESHOLD} ${r.item.unit}`}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {r.totalByLocation.length === 0 && (
                          <span className="text-xs text-muted-foreground">Sem saldo</span>
                        )}
                        {r.totalByLocation.map((b) => (
                          <Badge
                            key={b.key}
                            variant={b.locationType === "estoque" ? "secondary" : "outline"}
                            className="gap-1"
                          >
                            {b.locationType === "estoque" ? (
                              <Warehouse className="h-3 w-3" />
                            ) : (
                              <Building2 className="h-3 w-3" />
                            )}
                            <span className="truncate max-w-[140px]">
                              {b.locationType === "estoque"
                                ? "Central"
                                : projectMap.get(b.projectId ?? "") ?? "Obra"}
                            </span>
                            <span className="font-mono text-[10px] opacity-80">
                              {b.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(r.item)}
                        aria-label={`Editar ${r.item.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ItemFormDialog
        open={creating || !!editing}
        editing={editing}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setCreating(false);
          }
        }}
        onSubmit={(values) =>
          upsertItem.mutate(editing ? { ...values, id: editing.id } : values)
        }
        loading={upsertItem.isPending}
      />
    </main>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Package;
  tone: "default" | "warning" | "danger";
  onClick?: () => void;
}) {
  const toneClasses =
    tone === "danger"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "warning"
      ? "border-amber-400/40 bg-amber-50 dark:bg-amber-950/20"
      : "bg-card";

  const valueClasses =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
      ? "text-amber-700 dark:text-amber-400"
      : "text-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors",
        toneClasses,
        onClick && "hover:bg-muted/50 cursor-pointer",
        !onClick && "cursor-default",
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={cn("text-2xl font-bold mt-1", valueClasses)}>{value}</div>
    </button>
  );
}

function StatusBadge({ status }: { status: "zero" | "low" | "ok" }) {
  if (status === "zero") {
    return (
      <Badge variant="destructive" className="gap-1">
        <CircleSlash className="h-3 w-3" />
        Zerado
      </Badge>
    );
  }
  if (status === "low") {
    return (
      <Badge className="gap-1 bg-amber-500 hover:bg-amber-500/90 text-white">
        <AlertTriangle className="h-3 w-3" />
        Saldo baixo
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      Ok
    </Badge>
  );
}

// ─── Form Dialog (criar / editar) ───────────────────────────────────────────

function ItemFormDialog({
  open,
  editing,
  onOpenChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  editing: (StockItem & { min_quantity?: number | null }) | null;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: ItemFormValues) => void;
  loading: boolean;
}) {
  const initial = useMemo<ItemFormValues>(
    () => ({
      name: editing?.name ?? "",
      unit: editing?.unit ?? "un",
      category: editing?.category ?? "",
      description: editing?.description ?? "",
      min_quantity: editing?.min_quantity ?? null,
    }),
    [editing],
  );

  const [form, setForm] = useState<ItemFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset quando abre/fecha ou troca o item editado
  useMemo(() => {
    setForm(initial);
    setErrors({});
  }, [initial, open]);

  const submit = () => {
    const parsed = itemSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path.join(".")] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar item" : "Novo item de estoque"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Atualize os dados do material. Saldos existentes não são alterados."
              : "Cadastre um material para controlar suas entradas e saldo."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="item-name">Nome *</Label>
            <Input
              id="item-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Cimento CP-II 50kg"
              maxLength={120}
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-unit">Unidade *</Label>
              <Input
                id="item-unit"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="un, kg, m, m², saco"
                maxLength={20}
                aria-invalid={!!errors.unit}
              />
              {errors.unit && <p className="text-xs text-destructive">{errors.unit}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-cat">Categoria</Label>
              <Input
                id="item-cat"
                value={form.category ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Ex: Acabamento"
                maxLength={60}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-min">Saldo mínimo (alerta)</Label>
            <Input
              id="item-min"
              type="number"
              min={0}
              step="0.001"
              value={form.min_quantity ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  min_quantity: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              placeholder={`Padrão: ${DEFAULT_LOW_THRESHOLD}`}
              aria-invalid={!!errors.min_quantity}
            />
            <p className="text-xs text-muted-foreground">
              Quando o saldo total ficar abaixo desse valor, o item aparece como “Saldo baixo”.
            </p>
            {errors.min_quantity && (
              <p className="text-xs text-destructive">{errors.min_quantity}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-desc">Descrição</Label>
            <Textarea
              id="item-desc"
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Detalhes opcionais sobre o item"
              maxLength={500}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? "Salvar alterações" : "Cadastrar item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
