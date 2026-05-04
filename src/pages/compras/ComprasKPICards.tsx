import {
  Clock,
  Package,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ComprasKPICardsProps {
  pendingCount: number;
  orderedCount: number;
  deliveredCount: number;
  overdueCount: number;
  totalEstimatedCost: number;
  totalActualCost?: number;
  totalItems?: number;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ComprasKPICards({
  pendingCount,
  orderedCount,
  deliveredCount,
  overdueCount,
  totalEstimatedCost,
  totalActualCost = 0,
  totalItems = 0,
}: ComprasKPICardsProps) {
  const total =
    totalItems || pendingCount + orderedCount + deliveredCount + overdueCount;
  const completionPercent =
    total > 0 ? Math.round((deliveredCount / total) * 100) : 0;
  const costVariance =
    totalActualCost > 0 && totalEstimatedCost > 0
      ? ((totalActualCost - totalEstimatedCost) / totalEstimatedCost) * 100
      : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Progress Card - spans full on mobile */}
      <Card className="col-span-2 lg:col-span-1 border-primary/20 bg-primary/[0.03]">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                Progresso
              </span>
            </div>
            <span className="text-2xl font-bold text-primary">
              {completionPercent}%
            </span>
          </div>
          <Progress value={completionPercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{deliveredCount} concluídos</span>
            <span>{total} total</span>
          </div>
        </CardContent>
      </Card>

      {/* Status Cards */}
      <Card
        className={cn(
          overdueCount > 0 && "border-destructive/30 bg-destructive/[0.03]",
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "p-1.5 rounded-md",
                overdueCount > 0
                  ? "bg-destructive/10"
                  : "bg-[hsl(var(--warning))]/10",
              )}
            >
              {overdueCount > 0 ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <Clock className="h-4 w-4 text-[hsl(var(--warning))]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground leading-none mb-1">
                {overdueCount > 0 ? "Atrasados" : "Pendentes"}
              </p>
              <div className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "text-2xl font-bold leading-none",
                    overdueCount > 0 && "text-destructive",
                  )}
                >
                  {overdueCount > 0 ? overdueCount : pendingCount}
                </span>
                {overdueCount > 0 && pendingCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    +{pendingCount} pend.
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground leading-none mb-1">
                Em Andamento
              </p>
              <span className="text-2xl font-bold leading-none">
                {orderedCount}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-primary/10">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground leading-none mb-1">
                Orçamento × Real
              </p>
              <span className="text-lg font-bold leading-none truncate block">
                {fmt(totalEstimatedCost)}
              </span>
              {totalActualCost > 0 && (
                <>
                  <span className="text-xs text-muted-foreground block">
                    Real: {fmt(totalActualCost)}
                  </span>
                  {totalEstimatedCost > 0 &&
                    (() => {
                      const diff = totalActualCost - totalEstimatedCost;
                      const isOver = diff > 0;
                      return (
                        <span
                          className={cn(
                            "text-xs font-medium block",
                            isOver
                              ? "text-destructive"
                              : "text-[hsl(var(--success))]",
                          )}
                        >
                          {isOver ? "↑" : "↓"} {isOver ? "+" : ""}
                          {fmt(diff)} ({isOver ? "+" : ""}
                          {((diff / totalEstimatedCost) * 100).toFixed(1)}%)
                        </span>
                      );
                    })()}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
