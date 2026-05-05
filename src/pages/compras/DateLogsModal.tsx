import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, ShieldCheck, ThumbsUp, ShoppingCart, Package, CheckCircle2, ArrowRightCircle, Warehouse, Calendar } from "lucide-react";
import type { ProjectPurchase } from "@/hooks/useProjectPurchases";

const fmtDate = (d: string | null) => {
  if (!d) return null;
  const parts = d.split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

interface DateLogEntry {
  label: string;
  date: string | null;
  icon: React.ElementType;
  color: string;
  extra?: string;
}

function buildTimeline(p: ProjectPurchase): DateLogEntry[] {
  const isProduto = p.purchase_type === "produto";

  const entries: DateLogEntry[] = [
    {
      label: "Cadastrado",
      date: p.created_at?.split("T")[0] ?? null,
      icon: Clock,
      color: "text-muted-foreground",
    },
  ];

  if (isProduto) {
    entries.push(
      {
        label: "Solic. Aprovação",
        date:
          p.status === "awaiting_approval" ||
          [
            "approved",
            "purchased",
            "ordered",
            "in_transit",
            "delivered",
            "sent_to_site",
          ].includes(p.status)
            ? p.order_date || p.created_at?.split("T")[0] || null
            : null,
        icon: ShieldCheck,
        color: "text-orange-500",
      },
      {
        label: "Aprovado",
        date: [
          "approved",
          "purchased",
          "ordered",
          "in_transit",
          "delivered",
          "sent_to_site",
        ].includes(p.status)
          ? p.order_date || null
          : null,
        icon: ThumbsUp,
        color: "text-blue-500",
      },
      {
        label: "Compra Realizada",
        date: p.planned_purchase_date,
        icon: ShoppingCart,
        color: "text-indigo-500",
      },
      {
        label: "Pedido",
        date: p.order_date,
        icon: Package,
        color: "text-primary",
      },
      {
        label: "Previsão de Entrega",
        date: p.expected_delivery_date,
        icon: Calendar,
        color: "text-muted-foreground",
      },
      {
        label: "Data Necessária na Obra",
        date: p.required_by_date,
        icon: Calendar,
        color: "text-[hsl(var(--warning))]",
      },
      {
        label: "Produto Entregue",
        date: p.actual_delivery_date,
        icon: CheckCircle2,
        color: "text-[hsl(var(--success))]",
        extra:
          p.delivery_location === "estoque"
            ? "→ Estoque"
            : p.delivery_location === "obra"
              ? "→ Obra"
              : undefined,
      },
    );

    if (p.delivery_location === "estoque") {
      entries.push(
        {
          label: "Entrada no Estoque",
          date: p.stock_entry_date,
          icon: Warehouse,
          color: "text-amber-500",
        },
        {
          label: "Enviado para Obra",
          date: p.stock_exit_date,
          icon: ArrowRightCircle,
          color: "text-emerald-500",
        },
      );
    }
  } else {
    entries.push(
      {
        label: "Contratação",
        date: p.planned_purchase_date,
        icon: ShoppingCart,
        color: "text-indigo-500",
      },
      {
        label: "Início na Obra",
        date: p.start_date,
        icon: Calendar,
        color: "text-primary",
      },
      {
        label: "Fim na Obra",
        date: p.end_date,
        icon: Calendar,
        color: "text-[hsl(var(--success))]",
      },
    );
  }

  return entries;
}

function computeStockDays(p: ProjectPurchase): number | null {
  if (!p.stock_entry_date) return null;
  const entry = new Date(p.stock_entry_date + "T00:00:00");
  const exit = p.stock_exit_date
    ? new Date(p.stock_exit_date + "T00:00:00")
    : new Date();
  exit.setHours(0, 0, 0, 0);
  return Math.max(
    0,
    Math.ceil((exit.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

interface DateLogsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: ProjectPurchase;
}

export function DateLogsModal({
  open,
  onOpenChange,
  purchase,
}: DateLogsModalProps) {
  const timeline = buildTimeline(purchase);
  const stockDays = computeStockDays(purchase);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Histórico de Datas — {purchase.item_name}
          </DialogTitle>
        </DialogHeader>

        <div className="relative pl-6 py-2 space-y-0">
          {/* Vertical line */}
          <div className="absolute left-[11px] top-4 bottom-4 w-px bg-border" />

          {timeline.map((entry, i) => {
            const Icon = entry.icon;
            const dateStr = fmtDate(entry.date);
            const hasDate = !!dateStr;

            return (
              <div
                key={i}
                className={cn(
                  "relative flex items-start gap-3 py-2.5",
                  !hasDate && "opacity-40",
                )}
              >
                {/* Dot */}
                <div
                  className={cn(
                    "absolute -left-6 top-3 z-10 flex items-center justify-center w-5 h-5 rounded-full border-2",
                    hasDate
                      ? "bg-background border-primary"
                      : "bg-muted border-border",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3 w-3",
                      hasDate ? entry.color : "text-muted-foreground",
                    )}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      !hasDate && "text-muted-foreground",
                    )}
                  >
                    {entry.label}
                  </p>
                  {hasDate ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {dateStr}
                      </span>
                      {entry.extra && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {entry.extra}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      Pendente
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Stock summary */}
        {purchase.delivery_location === "estoque" && stockDays != null && (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm flex items-center gap-2",
              "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
            )}
          >
            <Warehouse className="h-4 w-4" />
            <span className="font-medium">
              {stockDays} dia{stockDays !== 1 ? "s" : ""} no estoque
            </span>
            {purchase.shipping_cost != null && purchase.shipping_cost > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">
                Frete:{" "}
                {purchase.shipping_cost.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
