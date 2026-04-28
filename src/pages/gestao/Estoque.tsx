import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Loader2, ArrowDownToLine, ArrowUpFromLine, Wrench, Building2, Warehouse } from "lucide-react";
import EstoqueSaidas from "./EstoqueSaidas";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type StockMovement = {
  id: string;
  item_id: string;
  movement_type: "entrada" | "saida" | "ajuste";
  quantity: number;
  movement_date: string;
  location_type: "estoque" | "obra";
  project_id: string | null;
  supplier_name: string | null;
  unit_cost: number | null;
  invoice_number: string | null;
  notes: string | null;
  created_at: string;
};

// ─── Schemas ─────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(120),
  unit: z.string().trim().min(1, "Unidade obrigatória").max(20),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

const movementSchema = z
  .object({
    item_id: z.string().uuid("Selecione um item"),
    movement_type: z.enum(["entrada", "saida", "ajuste"]),
    quantity: z.coerce.number().positive("Quantidade deve ser maior que zero"),
    movement_date: z.string().min(1, "Data obrigatória"),
    location_type: z.enum(["estoque", "obra"]),
    project_id: z.string().uuid().nullable().optional(),
    supplier_name: z.string().trim().max(120).optional().or(z.literal("")),
    unit_cost: z.coerce.number().nonnegative().optional().nullable(),
    invoice_number: z.string().trim().max(60).optional().or(z.literal("")),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine(
    (v) => (v.location_type === "obra" ? !!v.project_id : true),
    { path: ["project_id"], message: "Selecione a obra" },
  );

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Estoque() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = ["saldo", "movimentacoes", "saidas", "itens"] as const;
  const urlTab = searchParams.get("tab");
  const initialTab =
    urlTab && (VALID_TABS as readonly string[]).includes(urlTab) ? urlTab : "saldo";
  const [tab, setTab] = useState<string>(initialTab);
  const [movDialogOpen, setMovDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);

  // Sync tab → URL (and vice-versa)
  useEffect(() => {
    if (urlTab && (VALID_TABS as readonly string[]).includes(urlTab) && urlTab !== tab) {
      setTab(urlTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  const handleTabChange = (next: string) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === "saldo") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  // Queries
  const itemsQ = useQuery({
    queryKey: ["stock", "items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StockItem[];
    },
  });

  const balancesQ = useQuery({
    queryKey: ["stock", "balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_balances")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StockBalance[];
    },
  });

  const movementsQ = useQuery({
    queryKey: ["stock", "movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*")
        .order("movement_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as StockMovement[];
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
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  // Mutations
  const createItem = useMutation({
    mutationFn: async (input: z.infer<typeof itemSchema>) => {
      const { data, error } = await supabase
        .from("stock_items")
        .insert({
          name: input.name,
          unit: input.unit,
          category: input.category || null,
          description: input.description || null,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock", "items"] });
      toast.success("Item cadastrado");
      setItemDialogOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cadastrar item"),
  });

  const createMovement = useMutation({
    mutationFn: async (input: z.infer<typeof movementSchema>) => {
      const payload = {
        item_id: input.item_id,
        movement_type: input.movement_type,
        quantity: input.quantity,
        movement_date: input.movement_date,
        location_type: input.location_type,
        project_id: input.location_type === "obra" ? input.project_id! : null,
        supplier_name: input.supplier_name || null,
        unit_cost: input.unit_cost ?? null,
        invoice_number: input.invoice_number || null,
        notes: input.notes || null,
        created_by: user?.id ?? null,
      };
      const { data, error } = await supabase
        .from("stock_movements")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock", "balances"] });
      qc.invalidateQueries({ queryKey: ["stock", "movements"] });
      toast.success("Movimentação registrada — saldo atualizado");
      setMovDialogOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao registrar movimentação"),
  });

  const itemMap = useMemo(() => {
    const m = new Map<string, StockItem>();
    (itemsQ.data ?? []).forEach((it) => m.set(it.id, it));
    return m;
  }, [itemsQ.data]);

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    (projectsQ.data ?? []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [projectsQ.data]);

  const isLoading = itemsQ.isLoading || balancesQ.isLoading;

  const noItems = (itemsQ.data?.length ?? 0) === 0;

  const tabMeta: Record<string, { title: string; description: string }> = {
    saldo: {
      title: "Saldo atual",
      description: "Saldos consolidados por material e localização (estoque central ou obra).",
    },
    movimentacoes: {
      title: "Movimentações",
      description: "Histórico cronológico de entradas, saídas e ajustes de materiais.",
    },
    saidas: {
      title: "Saídas de materiais",
      description: "Registre retiradas do estoque ou da obra. O saldo é reduzido automaticamente.",
    },
    itens: {
      title: "Itens cadastrados",
      description: "Catálogo de materiais controlados no estoque.",
    },
  };
  const meta = tabMeta[tab] ?? tabMeta.saldo;

  const renderActions = () => {
    switch (tab) {
      case "saldo":
        return (
          <>
            <Button
              variant="outline"
              onClick={() => handleTabChange("saidas")}
              disabled={noItems}
              className="gap-2"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Registrar saída
            </Button>
            <Button onClick={() => setMovDialogOpen(true)} disabled={noItems} className="gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Registrar entrada
            </Button>
          </>
        );
      case "movimentacoes":
        return (
          <>
            <Button
              variant="outline"
              onClick={() => handleTabChange("saidas")}
              disabled={noItems}
              className="gap-2"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Registrar saída
            </Button>
            <Button onClick={() => setMovDialogOpen(true)} disabled={noItems} className="gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Registrar entrada
            </Button>
          </>
        );
      case "saidas":
        return (
          <Button
            variant="outline"
            onClick={() => handleTabChange("movimentacoes")}
            className="gap-2"
          >
            <Wrench className="h-4 w-4" />
            Ver movimentações
          </Button>
        );
      case "itens":
        return (
          <Button onClick={() => setItemDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo item
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Estoque · {meta.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{meta.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">{renderActions()}</div>
      </header>

      {isLoading ? (
        <PageSkeleton />
      ) : (
        <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="saldo">Saldo atual</TabsTrigger>
            <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
            <TabsTrigger value="saidas">Saídas</TabsTrigger>
            <TabsTrigger value="itens">Itens</TabsTrigger>
          </TabsList>

          {/* Saldo */}
          <TabsContent value="saldo">
            <BalancesTable
              balances={balancesQ.data ?? []}
              itemMap={itemMap}
              projectMap={projectMap}
              onAdd={() => setMovDialogOpen(true)}
            />
          </TabsContent>

          {/* Movimentações */}
          <TabsContent value="movimentacoes">
            <MovementsTable
              movements={movementsQ.data ?? []}
              itemMap={itemMap}
              projectMap={projectMap}
              onAdd={() => setMovDialogOpen(true)}
            />
          </TabsContent>

          {/* Saídas */}
          <TabsContent value="saidas">
            <EstoqueSaidas embedded />
          </TabsContent>

          {/* Itens */}
          <TabsContent value="itens">
            <ItemsTable items={itemsQ.data ?? []} onAdd={() => setItemDialogOpen(true)} />
          </TabsContent>
        </Tabs>
      )}

      <NewItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        onSubmit={(v) => createItem.mutate(v)}
        loading={createItem.isPending}
      />

      <NewMovementDialog
        open={movDialogOpen}
        onOpenChange={setMovDialogOpen}
        items={itemsQ.data ?? []}
        projects={projectsQ.data ?? []}
        onSubmit={(v) => createMovement.mutate(v)}
        loading={createMovement.isPending}
      />
    </main>
  );
}

// ─── Balances Table ─────────────────────────────────────────────────────────

function BalancesTable({
  balances,
  itemMap,
  projectMap,
  onAdd,
}: {
  balances: StockBalance[];
  itemMap: Map<string, StockItem>;
  projectMap: Map<string, string>;
  onAdd: () => void;
}) {
  if (balances.length === 0) {
    return (
      <EmptyState
        icon={Warehouse}
        title="Nenhum saldo registrado"
        description="Registre uma entrada para começar a controlar o saldo de materiais por obra ou no estoque central."
        action={{ label: "Registrar movimentação", onClick: onAdd, icon: Plus }}
      />
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Local</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Atualizado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {balances.map((b) => {
            const item = itemMap.get(b.item_id);
            const negative = Number(b.quantity) < 0;
            return (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{item?.name ?? "—"}</TableCell>
                <TableCell>
                  <LocationBadge
                    locationType={b.location_type}
                    projectName={b.project_id ? projectMap.get(b.project_id) : undefined}
                  />
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono tabular-nums",
                    negative && "text-destructive",
                  )}
                >
                  {Number(b.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                </TableCell>
                <TableCell className="text-muted-foreground">{item?.unit ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(b.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Movements Table ────────────────────────────────────────────────────────

function MovementsTable({
  movements,
  itemMap,
  projectMap,
  onAdd,
}: {
  movements: StockMovement[];
  itemMap: Map<string, StockItem>;
  projectMap: Map<string, string>;
  onAdd: () => void;
}) {
  if (movements.length === 0) {
    return (
      <EmptyState
        icon={ArrowDownToLine}
        title="Nenhuma movimentação registrada"
        description="Toda entrada, saída ou ajuste de material aparece aqui em ordem cronológica."
        action={{ label: "Registrar movimentação", onClick: onAdd, icon: Plus }}
      />
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Qtd.</TableHead>
            <TableHead>Local</TableHead>
            <TableHead>Fornecedor / NF</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((m) => {
            const item = itemMap.get(m.item_id);
            return (
              <TableRow key={m.id}>
                <TableCell className="text-sm">
                  {format(new Date(m.movement_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <MovementBadge type={m.movement_type} />
                </TableCell>
                <TableCell className="font-medium">{item?.name ?? "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {Number(m.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}{" "}
                  <span className="text-xs text-muted-foreground">{item?.unit}</span>
                </TableCell>
                <TableCell>
                  <LocationBadge
                    locationType={m.location_type}
                    projectName={m.project_id ? projectMap.get(m.project_id) : undefined}
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {m.supplier_name || "—"}
                  {m.invoice_number ? ` • NF ${m.invoice_number}` : ""}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Items Table ────────────────────────────────────────────────────────────

function ItemsTable({ items, onAdd }: { items: StockItem[]; onAdd: () => void }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Nenhum item cadastrado"
        description="Cadastre os materiais que você quer controlar no estoque (ex: cimento, tinta, piso)."
        action={{ label: "Novo item", onClick: onAdd, icon: Plus }}
      />
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Descrição</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => (
            <TableRow key={it.id}>
              <TableCell className="font-medium">{it.name}</TableCell>
              <TableCell className="text-muted-foreground">{it.unit}</TableCell>
              <TableCell className="text-muted-foreground">{it.category || "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground line-clamp-2">
                {it.description || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Badges ─────────────────────────────────────────────────────────────────

function LocationBadge({
  locationType,
  projectName,
}: {
  locationType: "estoque" | "obra";
  projectName?: string;
}) {
  if (locationType === "estoque") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Warehouse className="h-3 w-3" />
        Estoque central
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 max-w-[220px]">
      <Building2 className="h-3 w-3 shrink-0" />
      <span className="truncate">{projectName ?? "Obra"}</span>
    </Badge>
  );
}

function MovementBadge({ type }: { type: "entrada" | "saida" | "ajuste" }) {
  if (type === "entrada") {
    return (
      <Badge className="gap-1 bg-green-600 hover:bg-green-600/90 text-white">
        <ArrowDownToLine className="h-3 w-3" /> Entrada
      </Badge>
    );
  }
  if (type === "saida") {
    return (
      <Badge variant="destructive" className="gap-1">
        <ArrowUpFromLine className="h-3 w-3" /> Saída
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Wrench className="h-3 w-3" /> Ajuste
    </Badge>
  );
}

// ─── New Item Dialog ────────────────────────────────────────────────────────

function NewItemDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: z.infer<typeof itemSchema>) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({ name: "", unit: "un", category: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setForm({ name: "", unit: "un", category: "", description: "" });
          setErrors({});
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo item de estoque</DialogTitle>
          <DialogDescription>
            Cadastre um material para controlar suas entradas e saldo.
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
              aria-describedby={errors.name ? "item-name-err" : undefined}
            />
            {errors.name && (
              <p id="item-name-err" className="text-xs text-destructive">
                {errors.name}
              </p>
            )}
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
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Ex: Acabamento"
                maxLength={60}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-desc">Descrição</Label>
            <Textarea
              id="item-desc"
              value={form.description}
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
            Cadastrar item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Movement Dialog ────────────────────────────────────────────────────

function NewMovementDialog({
  open,
  onOpenChange,
  items,
  projects,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: StockItem[];
  projects: { id: string; name: string }[];
  onSubmit: (v: z.infer<typeof movementSchema>) => void;
  loading: boolean;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [form, setForm] = useState({
    item_id: "",
    movement_type: "entrada" as "entrada" | "saida" | "ajuste",
    quantity: "",
    movement_date: today,
    location_type: "estoque" as "estoque" | "obra",
    project_id: "" as string,
    supplier_name: "",
    unit_cost: "",
    invoice_number: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () =>
    setForm({
      item_id: "",
      movement_type: "entrada",
      quantity: "",
      movement_date: today,
      location_type: "estoque",
      project_id: "",
      supplier_name: "",
      unit_cost: "",
      invoice_number: "",
      notes: "",
    });

  const submit = () => {
    const parsed = movementSchema.safeParse({
      item_id: form.item_id,
      movement_type: form.movement_type,
      quantity: form.quantity,
      movement_date: form.movement_date,
      location_type: form.location_type,
      project_id: form.location_type === "obra" ? form.project_id || null : null,
      supplier_name: form.supplier_name,
      unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
      invoice_number: form.invoice_number,
      notes: form.notes,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path.join(".")] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  const isEntrada = form.movement_type === "entrada";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          reset();
          setErrors({});
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar movimentação</DialogTitle>
          <DialogDescription>
            Lance entradas, saídas ou ajustes. O saldo do item será atualizado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo de movimentação *</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["entrada", "saida", "ajuste"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={form.movement_type === t ? "default" : "outline"}
                  onClick={() => setForm((f) => ({ ...f, movement_type: t }))}
                  className="capitalize"
                >
                  {t === "saida" ? "Saída" : t}
                </Button>
              ))}
            </div>
          </div>

          {/* Item */}
          <div className="space-y-1.5">
            <Label>Item *</Label>
            <Select
              value={form.item_id}
              onValueChange={(v) => setForm((f) => ({ ...f, item_id: v }))}
            >
              <SelectTrigger aria-invalid={!!errors.item_id}>
                <SelectValue placeholder="Selecione o material" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-50">
                {items.map((it) => (
                  <SelectItem key={it.id} value={it.id}>
                    {it.name} <span className="text-muted-foreground">({it.unit})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.item_id && <p className="text-xs text-destructive">{errors.item_id}</p>}
          </div>

          {/* Qtd + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mov-qty">Quantidade *</Label>
              <Input
                id="mov-qty"
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
                aria-invalid={!!errors.quantity}
              />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mov-date">Data *</Label>
              <Input
                id="mov-date"
                type="date"
                value={form.movement_date}
                onChange={(e) => setForm((f) => ({ ...f, movement_date: e.target.value }))}
                aria-invalid={!!errors.movement_date}
              />
              {errors.movement_date && (
                <p className="text-xs text-destructive">{errors.movement_date}</p>
              )}
            </div>
          </div>

          {/* Local */}
          <div className="space-y-1.5">
            <Label>Local *</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={form.location_type === "estoque" ? "default" : "outline"}
                onClick={() => setForm((f) => ({ ...f, location_type: "estoque", project_id: "" }))}
                className="gap-2"
              >
                <Warehouse className="h-4 w-4" /> Estoque central
              </Button>
              <Button
                type="button"
                variant={form.location_type === "obra" ? "default" : "outline"}
                onClick={() => setForm((f) => ({ ...f, location_type: "obra" }))}
                className="gap-2"
              >
                <Building2 className="h-4 w-4" /> Obra
              </Button>
            </div>
          </div>

          {form.location_type === "obra" && (
            <div className="space-y-1.5">
              <Label>Obra *</Label>
              <Select
                value={form.project_id}
                onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}
              >
                <SelectTrigger aria-invalid={!!errors.project_id}>
                  <SelectValue placeholder="Selecione a obra" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-50">
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.project_id && (
                <p className="text-xs text-destructive">{errors.project_id}</p>
              )}
            </div>
          )}

          {/* Campos opcionais (mais relevantes para entrada) */}
          {isEntrada && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mov-sup">Fornecedor</Label>
                <Input
                  id="mov-sup"
                  value={form.supplier_name}
                  onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
                  placeholder="Opcional"
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mov-nf">Nota fiscal</Label>
                <Input
                  id="mov-nf"
                  value={form.invoice_number}
                  onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
                  placeholder="Opcional"
                  maxLength={60}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="mov-notes">Observações</Label>
            <Textarea
              id="mov-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Opcional"
              maxLength={500}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
