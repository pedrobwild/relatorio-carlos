import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  MessageSquareWarning,
  Calendar,
  DollarSign,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  type PendingItem,
  getStatus,
  getDaysOverdue,
} from "@/hooks/usePendencias";
import {
  getTypeLabel,
  getTypeIcon,
  getTypeColor,
} from "@/components/tabs/PendenciaItemCard";
import { cn } from "@/lib/utils";

type ApprovalMode = "idle" | "approve" | "adjust";

interface ApprovalDialogProps {
  item: PendingItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (notes: string) => void;
  onRequestAdjust: (notes: string) => void;
  isSubmitting?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );

export function ApprovalDialog({
  item,
  open,
  onOpenChange,
  onApprove,
  onRequestAdjust,
  isSubmitting = false,
}: ApprovalDialogProps) {
  const [mode, setMode] = useState<ApprovalMode>("idle");
  const [notes, setNotes] = useState("");

  const status = item.dueDate ? getStatus(item.dueDate) : "pendente";
  const daysOverdue = getDaysOverdue(item);

  const handleClose = (val: boolean) => {
    if (!val) {
      setMode("idle");
      setNotes("");
    }
    onOpenChange(val);
  };

  const handleConfirm = () => {
    if (mode === "approve") {
      onApprove(notes);
    } else {
      onRequestAdjust(notes);
    }
    setMode("idle");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
                getTypeColor(item.type),
              )}
            >
              {getTypeIcon(item.type)}
            </div>
            <Badge variant="outline" className="text-[10px]">
              {getTypeLabel(item.type)}
            </Badge>
            {status === "atrasado" && (
              <Badge variant="destructive" className="text-[10px]">
                {daysOverdue}d atrasado
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg">{item.title}</DialogTitle>
          <DialogDescription>{item.description}</DialogDescription>
        </DialogHeader>

        {/* Impact summary cards */}
        <div className="grid gap-3 py-2">
          {/* What changed */}
          {item.options && item.options.length > 0 && (
            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                O que mudou
              </p>
              <div className="flex flex-wrap gap-1.5">
                {item.options.map((opt, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {opt}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Impact on deadline */}
          {item.impact && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-[hsl(var(--warning))] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                  Impacto no Prazo
                </p>
                <p className="text-sm text-foreground">{item.impact}</p>
              </div>
            </div>
          )}

          {/* Impact on cost */}
          {item.amount != null && item.amount > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-2.5">
              <DollarSign className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                  Impacto no Custo
                </p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(item.amount)}
                </p>
              </div>
            </div>
          )}

          {/* Due date */}
          {item.dueDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Prazo:{" "}
                <span className="font-medium text-foreground">
                  {format(parseISO(item.dueDate), "dd 'de' MMMM", {
                    locale: ptBR,
                  })}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Notes input when in approve/adjust mode */}
        {mode !== "idle" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {mode === "approve"
                ? "Observação (opcional)"
                : "Descreva o ajuste necessário"}
            </label>
            <Textarea
              placeholder={
                mode === "approve"
                  ? "Ex: Aprovado conforme alinhamento em reunião."
                  : "Ex: Preferimos o acabamento em porcelanato ao invés de laminado."
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              autoFocus
            />
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {mode === "idle" ? (
            <>
              <Button
                variant="outline"
                className="gap-2 border-warning/40 text-[hsl(var(--warning))] hover:bg-warning/10"
                onClick={() => setMode("adjust")}
              >
                <MessageSquareWarning className="w-4 h-4" />
                Solicitar Ajuste
              </Button>
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setMode("approve")}
              >
                <CheckCircle2 className="w-4 h-4" />
                Aprovar
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setMode("idle");
                  setNotes("");
                }}
                disabled={isSubmitting}
              >
                Voltar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isSubmitting || (mode === "adjust" && !notes.trim())}
                className={cn(
                  "gap-2",
                  mode === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/90 text-[hsl(var(--warning-foreground))]",
                )}
              >
                {isSubmitting ? (
                  <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                ) : mode === "approve" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <MessageSquareWarning className="w-4 h-4" />
                )}
                {mode === "approve" ? "Confirmar Aprovação" : "Enviar Ajuste"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
