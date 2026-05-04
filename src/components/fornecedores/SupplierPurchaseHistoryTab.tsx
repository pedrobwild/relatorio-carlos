import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, TrendingUp } from "lucide-react";

interface PurchaseRecord {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  status: string;
  order_date: string | null;
  actual_delivery_date: string | null;
  required_by_date: string;
  category: string | null;
  project_id: string;
  projects: { name: string } | null;
}

const STATUS_MAP: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "Pendente", variant: "outline" },
  ordered: { label: "Pedido", variant: "secondary" },
  in_transit: { label: "Em trânsito", variant: "default" },
  delivered: { label: "Entregue", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

const formatCurrency = (v: number | null) =>
  v != null
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export function SupplierPurchaseHistoryTab({
  fornecedorId,
}: {
  fornecedorId: string;
}) {
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["fornecedor-purchases", fornecedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_purchases")
        .select(
          "id, item_name, quantity, unit, estimated_cost, actual_cost, status, order_date, actual_delivery_date, required_by_date, category, project_id, projects(name)",
        )
        .eq("fornecedor_id", fornecedorId)
        .order("order_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as PurchaseRecord[];
    },
    enabled: !!fornecedorId,
  });

  const totalEstimated = purchases.reduce(
    (s, p) => s + (p.estimated_cost || 0),
    0,
  );
  const totalActual = purchases.reduce((s, p) => s + (p.actual_cost || 0), 0);
  const delivered = purchases.filter((p) => p.status === "delivered").length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">
          Nenhuma compra registrada para este fornecedor.
        </p>
        <p className="text-xs mt-1">
          Vincule este fornecedor ao criar itens no módulo de Compras.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total de itens" value={String(purchases.length)} />
        <SummaryCard label="Entregues" value={String(delivered)} />
        <SummaryCard label="Estimado" value={formatCurrency(totalEstimated)} />
        <SummaryCard
          label="Custo Real"
          value={formatCurrency(totalActual)}
          highlight
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Custo Est.</TableHead>
              <TableHead className="text-right">Custo Real</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data Pedido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((p) => {
              const st = STATUS_MAP[p.status] || {
                label: p.status,
                variant: "outline" as const,
              };
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{p.item_name}</p>
                      {p.category && (
                        <p className="text-xs text-muted-foreground">
                          {p.category}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.projects?.name || "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {p.quantity} {p.unit}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(p.estimated_cost)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatCurrency(p.actual_cost)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={st.variant} className="text-xs">
                      {st.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(p.order_date)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${highlight ? "bg-primary/5" : "bg-card"}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-semibold mt-0.5 ${highlight ? "text-primary" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
