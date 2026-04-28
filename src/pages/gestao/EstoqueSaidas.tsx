import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpFromLine,
  Loader2,
  Building2,
  Warehouse,
  ArrowLeft,
  Package,
} from "lucide-react";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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

// ─── Tipagens ────────────────────────────────────────────────────────────────

type StockItem = {
  id: string;
  name: string;
  unit: string;
};

type StockBalance = {
  item_id: string;
  location_type: "estoque" | "obra";
  project_id: string | null;
  quantity: number;
};

type StockMovement = {
  id: string;
  item_id: string;
  movement_type: "entrada" | "saida" | "ajuste";
  quantity: number;
  movement_date: string;
  location_type: "estoque" | "obra";
  project_id: string | null;
  responsible_user_id: string | null;
  reason: string | null;
  notes: string | null;
};

const REASONS = [
  "Aplicação na obra",
  "Transferência entre obras",
  "Devolução ao fornecedor",
  "Perda / quebra",
  "Ajuste de inventário",
  "Outro",
] as const;

const schema = z
  .object({
    item_id: z.string().uuid("Selecione o material"),
    quantity: z.coerce.number().positive("Quantidade deve ser maior que zero"),
    movement_date: z.string().min(1, "Data obrigatória"),
    location_type: z.enum(["obra", "estoque"]),
    project_id: z.string().uuid().nullable().optional(),
    responsible_user_id: z.string().uuid("Selecione o responsável"),
    reason: z.string().trim().min(2, "Informe o motivo").max(120),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((v) => (v.location_type === "obra" ? !!v.project_id : true), {
    path: ["project_id"],
    message: "Selecione a obra",
  });

// ─── Página ──────────────────────────────────────────────────────────────────

export default function EstoqueSaidas({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const itemsQ = useQuery({
    queryKey: ["stock", "items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("id, name, unit")
        .order("name");
      if (error) throw error;
      return (data ?? []) as StockItem[];
    },
  });

  const balancesQ = useQuery({
    queryKey: ["stock", "balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_balances")
        .select("item_id, location_type, project_id, quantity");
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
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const staffQ = useStaffUsers();

  const recentQ = useQuery({
    queryKey: ["stock", "movements", "saidas-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select(
          "id, item_id, movement_type, quantity, movement_date, location_type, project_id, responsible_user_id, reason, notes",
        )
        .eq("movement_type", "saida")
        .order("movement_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as StockMovement[];
    },
  });

  // Form state
  const today = format(new Date(), "yyyy-MM-dd");
  const [form, setForm] = useState({
    item_id: "",
    quantity: "",
    movement_date: today,
    location_type: "obra" as "obra" | "estoque",
    project_id: "",
    responsible_user_id: user?.id ?? "",
    reason: REASONS[0] as string,
    customReason: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const staffMap = useMemo(() => {
    const m = new Map<string, string>();
    (staffQ.data ?? []).forEach((u) => m.set(u.id, u.nome || u.email));
    return m;
  }, [staffQ.data]);

  // Saldo disponível no local selecionado
  const availableBalance = useMemo(() => {
    if (!form.item_id) return null;
    const list = balancesQ.data ?? [];
    if (form.location_type === "estoque") {
      return list.find((b) => b.item_id === form.item_id && b.location_type === "estoque");
    }
    if (form.project_id) {
      return list.find(
        (b) =>
          b.item_id === form.item_id &&
          b.location_type === "obra" &&
          b.project_id === form.project_id,
      );
    }
    return null;
  }, [form.item_id, form.location_type, form.project_id, balancesQ.data]);

  const selectedItem = form.item_id ? itemMap.get(form.item_id) : null;
  const qtyNum = Number(form.quantity || 0);
  const willGoNegative =
    !!availableBalance && qtyNum > 0 && qtyNum > Number(availableBalance.quantity);

  const createSaida = useMutation({
    mutationFn: async () => {
      const finalReason =
        form.reason === "Outro" ? form.customReason.trim() : form.reason;

      const parsed = schema.safeParse({
        item_id: form.item_id,
        quantity: form.quantity,
        movement_date: form.movement_date,
        location_type: form.location_type,
        project_id: form.location_type === "obra" ? form.project_id || null : null,
        responsible_user_id: form.responsible_user_id,
        reason: finalReason,
        notes: form.notes,
      });

      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => (errs[i.path.join(".")] = i.message));
        setErrors(errs);
        throw new Error("Verifique os campos do formulário.");
      }
      setErrors({});

      const v = parsed.data;
      const { error } = await supabase.from("stock_movements").insert({
        item_id: v.item_id,
        movement_type: "saida",
        quantity: v.quantity,
        movement_date: v.movement_date,
        location_type: v.location_type,
        project_id: v.location_type === "obra" ? v.project_id! : null,
        responsible_user_id: v.responsible_user_id,
        reason: v.reason,
        notes: v.notes || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock", "balances"] });
      qc.invalidateQueries({ queryKey: ["stock", "movements"] });
      qc.invalidateQueries({ queryKey: ["stock", "movements", "saidas-recent"] });
      toast.success("Saída registrada — saldo atualizado");
      setForm((f) => ({
        ...f,
        item_id: "",
        quantity: "",
        notes: "",
        customReason: "",
      }));
    },
    onError: (e: any) => {
      if (e?.message && e.message !== "Verifique os campos do formulário.") {
        toast.error(e.message);
      }
    },
  });

  const isLoading = itemsQ.isLoading || balancesQ.isLoading || staffQ.isLoading;

  const Wrapper: any = embedded ? "div" : "main";
  return (
    <Wrapper className={embedded ? "space-y-6" : "max-w-6xl mx-auto px-4 py-6 space-y-6"}>
      {!embedded && (
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="gap-2 mb-2 -ml-2">
              <Link to="/gestao/estoque">
                <ArrowLeft className="h-4 w-4" /> Voltar ao Estoque
              </Link>
            </Button>
            <h1 className="text-h2 font-bold flex items-center gap-2">
              <ArrowUpFromLine className="h-6 w-6" />
              Saídas de materiais
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Registre a retirada de materiais do estoque ou da obra. O saldo é reduzido
              automaticamente.
            </p>
          </div>
        </header>
      )}

      {isLoading ? (
        <PageSkeleton />
      ) : (itemsQ.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Package}
          title="Cadastre um item antes de registrar saídas"
          description="Você precisa ter materiais no catálogo de estoque para registrar uma saída."
          action={{
            label: "Ir para o Estoque",
            onClick: () => (window.location.href = "/gestao/estoque"),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Nova saída</CardTitle>
              <CardDescription>
                Informe o material, quantidade, responsável e o motivo da retirada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Local */}
              <div className="space-y-1.5">
                <Label>Local *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={form.location_type === "obra" ? "default" : "outline"}
                    onClick={() => setForm((f) => ({ ...f, location_type: "obra" }))}
                    className="gap-2"
                  >
                    <Building2 className="h-4 w-4" /> Obra
                  </Button>
                  <Button
                    type="button"
                    variant={form.location_type === "estoque" ? "default" : "outline"}
                    onClick={() =>
                      setForm((f) => ({ ...f, location_type: "estoque", project_id: "" }))
                    }
                    className="gap-2"
                  >
                    <Warehouse className="h-4 w-4" /> Estoque central
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
                      {(projectsQ.data ?? []).map((p) => (
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

              {/* Item */}
              <div className="space-y-1.5">
                <Label>Material *</Label>
                <Select
                  value={form.item_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, item_id: v }))}
                >
                  <SelectTrigger aria-invalid={!!errors.item_id}>
                    <SelectValue placeholder="Selecione o material" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-50">
                    {(itemsQ.data ?? []).map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        {it.name}{" "}
                        <span className="text-muted-foreground">({it.unit})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.item_id && (
                  <p className="text-xs text-destructive">{errors.item_id}</p>
                )}
                {selectedItem && (
                  <p
                    className={cn(
                      "text-xs mt-1",
                      willGoNegative ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    Saldo disponível:{" "}
                    <span className="font-mono tabular-nums">
                      {Number(availableBalance?.quantity ?? 0).toLocaleString("pt-BR", {
                        maximumFractionDigits: 3,
                      })}{" "}
                      {selectedItem.unit}
                    </span>
                    {willGoNegative && " — saída deixará o saldo negativo"}
                  </p>
                )}
              </div>

              {/* Qtd + Data */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qty">Quantidade *</Label>
                  <Input
                    id="qty"
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    placeholder="0"
                    aria-invalid={!!errors.quantity}
                  />
                  {errors.quantity && (
                    <p className="text-xs text-destructive">{errors.quantity}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date">Data da saída *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={form.movement_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, movement_date: e.target.value }))
                    }
                    max={today}
                  />
                </div>
              </div>

              {/* Responsável */}
              <div className="space-y-1.5">
                <Label>Responsável pela retirada *</Label>
                <Select
                  value={form.responsible_user_id}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, responsible_user_id: v }))
                  }
                >
                  <SelectTrigger aria-invalid={!!errors.responsible_user_id}>
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-50">
                    {(staffQ.data ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.responsible_user_id && (
                  <p className="text-xs text-destructive">{errors.responsible_user_id}</p>
                )}
              </div>

              {/* Motivo */}
              <div className="space-y-1.5">
                <Label>Motivo *</Label>
                <Select
                  value={form.reason}
                  onValueChange={(v) => setForm((f) => ({ ...f, reason: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-50">
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.reason === "Outro" && (
                  <Input
                    className="mt-2"
                    placeholder="Descreva o motivo"
                    value={form.customReason}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, customReason: e.target.value }))
                    }
                    maxLength={120}
                    aria-invalid={!!errors.reason}
                  />
                )}
                {errors.reason && (
                  <p className="text-xs text-destructive">{errors.reason}</p>
                )}
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Opcional"
                  maxLength={500}
                  rows={2}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => createSaida.mutate()}
                  disabled={createSaida.isPending}
                  className="gap-2"
                >
                  {createSaida.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpFromLine className="h-4 w-4" />
                  )}
                  Registrar saída
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Saídas recentes */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Últimas saídas</CardTitle>
              <CardDescription>20 movimentações mais recentes do tipo saída.</CardDescription>
            </CardHeader>
            <CardContent>
              {(recentQ.data?.length ?? 0) === 0 ? (
                <EmptyState
                  icon={ArrowUpFromLine}
                  title="Nenhuma saída registrada"
                  description="Quando você registrar saídas, elas aparecem aqui."
                  className="p-6"
                />
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead>Resp.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(recentQ.data ?? []).map((m) => {
                        const item = itemMap.get(m.item_id);
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs">
                              {format(
                                new Date(m.movement_date + "T00:00:00"),
                                "dd/MM/yy",
                                { locale: ptBR },
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="font-medium">{item?.name ?? "—"}</div>
                              <div className="text-muted-foreground">
                                {m.location_type === "obra"
                                  ? projectMap.get(m.project_id ?? "") ?? "Obra"
                                  : "Estoque central"}
                              </div>
                              {m.reason && (
                                <Badge variant="outline" className="mt-1 text-[10px]">
                                  {m.reason}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-xs">
                              {Number(m.quantity).toLocaleString("pt-BR", {
                                maximumFractionDigits: 3,
                              })}{" "}
                              <span className="text-muted-foreground">{item?.unit}</span>
                            </TableCell>
                            <TableCell className="text-xs">
                              {m.responsible_user_id
                                ? staffMap.get(m.responsible_user_id) ?? "—"
                                : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
