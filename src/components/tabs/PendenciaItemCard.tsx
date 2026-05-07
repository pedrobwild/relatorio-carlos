import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, Clock, FileSignature, Receipt, Palette, Ruler, ShoppingCart, Calendar, ChevronRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  usePendencias,
  getStatus,
  getDaysOverdue,
  getDaysRemaining,
  type PendingType,
  type PendingStatus,
  type PendingItem,
} from "@/hooks/usePendencias";
import { ApprovalDialog } from "@/components/pendencias/ApprovalDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ---- helpers ----

// eslint-disable-next-line react-refresh/only-export-components
export const getTypeIcon = (type: PendingType) => {
  const icons: Record<PendingType, React.ReactNode> = {
    decision: <AlertTriangle className="w-4 h-4" />,
    invoice: <Receipt className="w-4 h-4" />,
    signature: <FileSignature className="w-4 h-4" />,
    approval_3d: <Palette className="w-4 h-4" />,
    approval_exec: <Ruler className="w-4 h-4" />,
    extra_purchase: <ShoppingCart className="w-4 h-4" />,
  };
  return icons[type] || <Clock className="w-4 h-4" />;
};

// eslint-disable-next-line react-refresh/only-export-components
export const getTypeLabel = (type: PendingType) => {
  const labels: Record<PendingType, string> = {
    decision: "Decisão",
    invoice: "Fatura",
    signature: "Assinatura",
    approval_3d: "Aprovação 3D",
    approval_exec: "Aprovação Executivo",
    extra_purchase: "Compra Extra",
  };
  return labels[type] || "Pendência";
};

// eslint-disable-next-line react-refresh/only-export-components
export const getTypeColor = (type: PendingType) => {
  const colors: Record<PendingType, string> = {
    decision: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    invoice: "bg-rose-500/15 text-rose-600 border-rose-500/30",
    signature: "bg-violet-500/15 text-violet-600 border-violet-500/30",
    approval_3d: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30",
    approval_exec: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30",
    extra_purchase: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  };
  return colors[type] || "bg-secondary text-muted-foreground border-border";
};

// eslint-disable-next-line react-refresh/only-export-components
export const getStatusBadge = (status: PendingStatus) => {
  switch (status) {
    case "atrasado":
      return (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
          Atrasado
        </Badge>
      );
    case "urgente":
      return (
        <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
          Urgente
        </Badge>
      );
    case "pendente":
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          Pendente
        </Badge>
      );
  }
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  return format(parseISO(dateStr), "dd/MM", { locale: ptBR });
};

// Types that support one-click approval flow
const APPROVABLE_TYPES = new Set<PendingType>([
  "approval_3d",
  "approval_exec",
  "decision",
  "extra_purchase",
]);

interface PendenciaItemCardProps {
  item: PendingItem;
  index: number;
  actionUrl: string;
  compact?: boolean;
}

export function PendenciaItemCard({
  item,
  index,
  actionUrl,
  compact = false,
}: PendenciaItemCardProps) {
  const { projectId } = useParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { resolveItem, cancelItem, isResolving, isCancelling } = usePendencias({
    projectId,
  });
  const today = new Date();
  const status = item.dueDate ? getStatus(item.dueDate) : "pendente";
  const daysOverdue = getDaysOverdue(item, today);
  const daysRemaining = getDaysRemaining(item, today);

  const isApprovable = APPROVABLE_TYPES.has(item.type);

  const borderClass =
    status === "atrasado"
      ? "border-rose-500/40"
      : status === "urgente"
        ? "border-amber-500/40"
        : "border-border";

  const iconSize = compact ? "w-7 h-7" : "w-10 h-10";

  const handleApprove = (notes: string) => {
    resolveItem(
      {
        itemId: item.id,
        notes: notes || "Aprovado pelo cliente",
        payload: { action: "approved" },
      },
      {
        onSuccess: () => {
          toast.success("Aprovação registrada com sucesso!");
          setDialogOpen(false);
        },
        onError: () => toast.error("Erro ao aprovar. Tente novamente."),
      },
    );
  };

  const handleRequestAdjust = (notes: string) => {
    cancelItem(
      { itemId: item.id, notes, payload: { action: "adjustment_requested" } },
      {
        onSuccess: () => {
          toast.success("Solicitação de ajuste enviada!");
          setDialogOpen(false);
        },
        onError: () => toast.error("Erro ao enviar ajuste. Tente novamente."),
      },
    );
  };

  return (
    <>
      <div
        className={cn(
          "bg-card border rounded-lg transition-all hover:shadow-sm animate-fade-in",
          compact ? "p-3" : "p-4",
          borderClass,
        )}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        {/* Header */}
        <div className={cn("flex items-start gap-2 mb-2", !compact && "gap-4")}>
          <div
            className={cn(
              "flex items-center justify-center rounded-lg shrink-0",
              iconSize,
              getTypeColor(item.type),
            )}
          >
            {getTypeIcon(item.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <span
                  className={`text-[10px] font-medium uppercase tracking-wide ${getTypeColor(item.type).split(" ")[1]}`}
                >
                  {getTypeLabel(item.type)}
                </span>
                {!compact && (
                  <h3 className="text-body font-medium text-foreground">
                    {item.title}
                  </h3>
                )}
              </div>
              {getStatusBadge(status)}
            </div>
          </div>
        </div>

        {compact && (
          <h3 className="text-body font-medium text-foreground mb-1">
            {item.title}
          </h3>
        )}
        <p className="text-caption text-muted-foreground mb-2">
          {item.description}
        </p>

        {/* Amount */}
        {item.amount && (
          <p className="text-h3 font-bold text-foreground mb-2">
            {formatCurrency(item.amount)}
          </p>
        )}

        {/* Options */}
        {item.options && (
          <div className="mb-2">
            <p className="text-tiny text-muted-foreground mb-1">Opções:</p>
            <div className="flex flex-wrap gap-1">
              {item.options.map((opt, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {opt}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Impact */}
        {item.impact && (
          <p className="text-tiny text-amber-600 bg-amber-500/10 rounded px-2 py-1 mb-2 inline-block">
            <strong>Impacto:</strong> {item.impact}
          </p>
        )}

        {/* Footer */}
        <div
          className={cn(
            "flex items-center justify-between border-t border-border gap-2",
            compact ? "pt-2" : "pt-3 mt-3",
          )}
        >
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span
              className={cn(
                "text-caption font-medium",
                status === "atrasado"
                  ? "text-rose-600"
                  : status === "urgente"
                    ? "text-amber-600"
                    : "text-foreground",
              )}
            >
              Prazo: {formatDate(item.dueDate)}
            </span>
            {status === "atrasado" && (
              <Badge
                variant="destructive"
                className="text-[10px] px-1.5 py-0 ml-1"
              >
                {daysOverdue}d atrasado
              </Badge>
            )}
            {status === "urgente" && daysRemaining >= 0 && (
              <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 ml-1">
                {daysRemaining === 0
                  ? "vence hoje"
                  : daysRemaining === 1
                    ? "vence amanhã"
                    : `${daysRemaining}d restantes`}
              </Badge>
            )}
            {status === "pendente" && compact && (
              <span className="text-tiny text-muted-foreground ml-1">
                ({daysRemaining}d restantes)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isApprovable && (
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                onClick={() => setDialogOpen(true)}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Aprovar</span>
              </Button>
            )}
            <Link
              to={actionUrl}
              className="flex items-center gap-1 text-caption text-primary hover:underline font-medium"
            >
              Detalhes
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {isApprovable && (
        <ApprovalDialog
          item={item}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onApprove={handleApprove}
          onRequestAdjust={handleRequestAdjust}
          isSubmitting={isResolving || isCancelling}
        />
      )}
    </>
  );
}
